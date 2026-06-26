import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mixAudio, uploadMixedAudio } from './audio-mixer';

/**
 * 构建一个最小可用的 mock AudioContext + OfflineAudioContext
 * 用于在无真实 Web Audio API 环境下测试 audio-mixer
 */
function createMockAudioContext() {
  const mockCtx = {
    sampleRate: 44100,
    createBufferSource: vi.fn().mockReturnThis(),
    createGain: vi.fn().mockReturnThis(),
    createMediaStreamDestination: vi.fn().mockReturnValue({ stream: { getAudioTracks: () => [] } }),
    close: vi.fn(),
    decodeAudioData: vi.fn().mockResolvedValue({
      length: 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100).fill(0)),
    }),
  };
  return mockCtx;
}

function createMockOfflineAudioContext() {
  const ctx = createMockAudioContext();
  // OfflineAudioContext 特有的 startRendering
  (ctx as any).startRendering = vi.fn().mockResolvedValue({
    length: 44100,
    numberOfChannels: 1,
    sampleRate: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(44100).fill(0)),
  });
  return ctx as any;
}

describe('audio-mixer', () => {
  let originalFetch: typeof fetch;
  let originalAudioContext: typeof window.AudioContext | undefined;
  let originalOfflineAudioContext: typeof OfflineAudioContext | undefined;
  let originalURL: typeof URL;

  beforeEach(() => {
    originalFetch = fetch;
    originalAudioContext = window.AudioContext;
    originalOfflineAudioContext = OfflineAudioContext;
    originalURL = URL;

    // Mock fetch to return a fake audio ArrayBuffer
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
    }));

    // Mock AudioContext
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(createMockAudioContext));

    // Mock OfflineAudioContext
    vi.stubGlobal('OfflineAudioContext', vi.fn().mockImplementation(createMockOfflineAudioContext));

    // Mock URL.createObjectURL
    vi.stubGlobal('URL', {
      ...originalURL,
      createObjectURL: vi.fn().mockReturnValue('blob:mixed-audio'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', originalFetch);
    vi.stubGlobal('AudioContext', originalAudioContext);
    vi.stubGlobal('OfflineAudioContext', originalOfflineAudioContext);
    vi.stubGlobal('URL', originalURL);
  });

  describe('mixAudio', () => {
    it('成功混音返回 blob URL', async () => {
      const url = await mixAudio('voice.mp3', 'bgm.mp3', 5, 60);
      expect(url).toBe('blob:mixed-audio');
    });

    it('fetch 被调用两次（语音 + BGM）', async () => {
      await mixAudio('voice.mp3', 'bgm.mp3', 5, 60);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('voice.mp3');
      expect(fetch).toHaveBeenCalledWith('bgm.mp3');
    });

    it('volumeLevel 为 1 时 gain 值最小', async () => {
      await mixAudio('voice.mp3', 'bgm.mp3', 1, 60);
      // OfflineAudioContext 被创建，说明混音流程走了
      expect(OfflineAudioContext).toHaveBeenCalled();
    });

    it('volumeLevel 为 10 时 gain 值最大', async () => {
      await mixAudio('voice.mp3', 'bgm.mp3', 10, 60);
      expect(OfflineAudioContext).toHaveBeenCalled();
    });

    it('fetch 失败时抛出错误', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));
      await expect(mixAudio('bad.mp3', 'bgm.mp3', 5, 60)).rejects.toThrow();
    });
  });

  describe('uploadMixedAudio', () => {
    it('调用 supabaseUpload 并返回 URL', async () => {
      const mockUpload = vi.fn().mockResolvedValue('https://storage.example.com/mixed.wav');
      // Mock fetch for reading the blob URL
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      });

      const url = await uploadMixedAudio('blob:mixed-audio', mockUpload);
      expect(url).toBe('https://storage.example.com/mixed.wav');
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(File),
        'generated-audio'
      );
    });

    it('上传文件名包含 mixed-audio 前缀', async () => {
      const mockUpload = vi.fn().mockResolvedValue('https://storage.example.com/mixed.wav');
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      });

      await uploadMixedAudio('blob:mixed-audio', mockUpload);
      const fileArg = mockUpload.mock.calls[0][0];
      expect(fileArg.name).toMatch(/^mixed-audio-/);
      expect(fileArg.type).toBe('audio/wav');
    });

    it('上传失败时抛出错误', async () => {
      const mockUpload = vi.fn().mockRejectedValue(new Error('upload failed'));
      vi.mocked(fetch).mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['fake-wav'], { type: 'audio/wav' })),
      });

      await expect(uploadMixedAudio('blob:mixed-audio', mockUpload)).rejects.toThrow('upload failed');
    });
  });
});
