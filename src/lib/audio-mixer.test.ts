import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mixAudio, uploadMixedAudio } from './audio-mixer';

/**
 * 创建 AudioBuffer mock
 */
function mockAudioBuffer(partial?: Partial<AudioBuffer>): AudioBuffer {
  return {
    length: 44100,
    numberOfChannels: 1,
    sampleRate: 44100,
    duration: 1,
    getChannelData: vi.fn(() => new Float32Array(44100)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
    ...partial,
  } as unknown as AudioBuffer;
}

/**
 * 创建 AudioNode mock（支持 connect 链式调用）
 */
function mockAudioNode() {
  return {
    connect: vi.fn(() => mockAudioNode()),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

/**
 * Mock AudioContext
 */
class MockAudioContext {
  sampleRate = 44100;
  destination = mockAudioNode();
  createBufferSource = vi.fn(() => {
    const node = mockAudioNode();
    Object.defineProperty(node, 'buffer', {
      set: vi.fn(),
      get: () => null,
    });
    return node;
  });
  createGain = vi.fn(() => ({
    ...mockAudioNode(),
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  }));
  createMediaStreamDestination = vi.fn(() => ({
    stream: { getAudioTracks: () => [] },
  }));
  decodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer());
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
    const chData = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      numberOfChannels: channels,
      sampleRate,
      getChannelData: vi.fn((ch: number) => chData[ch]),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
      duration: length / sampleRate,
    } as unknown as AudioBuffer;
  });
  close = vi.fn();
}

/**
 * Mock OfflineAudioContext (extends MockAudioContext with startRendering)
 */
class MockOfflineAudioContext extends MockAudioContext {
  startRendering = vi.fn().mockResolvedValue(mockAudioBuffer());
}

describe('audio-mixer', () => {
  let originalURL: typeof URL;

  beforeEach(() => {
    originalURL = window.URL;

    // stub on both globalThis and window for jsdom compatibility
    const mockCtx = new MockAudioContext();
    // @ts-ignore
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));
    // @ts-ignore
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => new MockOfflineAudioContext()));

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
      blob: vi.fn().mockResolvedValue(new Blob()),
    }));

    // Mock URL
    vi.stubGlobal('URL', {
      ...originalURL,
      createObjectURL: vi.fn(() => 'blob:mixed-audio'),
      revokeObjectURL: vi.fn(),
    });

    // Also set on window for window.AudioContext fallback
    // @ts-ignore
    window.AudioContext = vi.fn(() => mockCtx);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('URL', originalURL);
  });

  describe('mixAudio', () => {
    it('成功混音返回 blob URL', async () => {
      const url = await mixAudio('voice.mp3', 'bgm.mp3', 5, 60);
      expect(url).toBe('blob:mixed-audio');
    }, 10000);

    it('fetch 被调用两次（语音 + BGM）', async () => {
      await mixAudio('voice.mp3', 'bgm.mp3', 5, 60);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('voice.mp3');
      expect(fetch).toHaveBeenCalledWith('bgm.mp3');
    }, 10000);

    it('OfflineAudioContext 被创建', async () => {
      await mixAudio('voice.mp3', 'bgm.mp3', 1, 60);
      expect(OfflineAudioContext).toHaveBeenCalled();
    }, 10000);

    it('fetch 失败时抛出错误', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));
      await expect(mixAudio('bad.mp3', 'bgm.mp3', 5, 60)).rejects.toThrow();
    }, 10000);
  });

  describe('uploadMixedAudio', () => {
    it('调用上传函数并返回 URL', async () => {
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      } as any);

      const mockUpload = vi.fn().mockResolvedValue('https://storage.example.com/mixed.wav');
      const url = await uploadMixedAudio('blob:mixed-audio', mockUpload);
      expect(url).toBe('https://storage.example.com/mixed.wav');
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(File),
        'generated-audio'
      );
    });

    it('上传文件名包含 mixed-audio 前缀', async () => {
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      } as any);

      const mockUpload = vi.fn().mockResolvedValue('https://storage.example.com/mixed.wav');
      await uploadMixedAudio('blob:mixed-audio', mockUpload);
      const fileArg = mockUpload.mock.calls[0][0];
      expect(fileArg.name).toMatch(/^mixed-audio-/);
      expect(fileArg.type).toBe('audio/wav');
    });

    it('上传失败时抛出错误', async () => {
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      } as any);

      const mockUpload = vi.fn().mockRejectedValue(new Error('upload failed'));
      await expect(uploadMixedAudio('blob:mixed-audio', mockUpload)).rejects.toThrow('upload failed');
    });
  });
});
