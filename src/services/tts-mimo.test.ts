import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeFunctionMock = vi.fn();
const getMimoApiKeyMock = vi.fn();

vi.mock('./api-config', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));

vi.mock('@/components/ApiSettingsDialog', () => ({
  getMimoApiKey: () => getMimoApiKeyMock(),
}));

import { generateMimoTTS, getMimoVoiceNameFromId } from './tts-mimo';

describe('tts-mimo service', () => {
  beforeEach(() => {
    invokeFunctionMock.mockReset();
    getMimoApiKeyMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes preset voice requests to tts-mimo with the correct model', async () => {
    invokeFunctionMock.mockResolvedValue({
      audioUrl: 'https://cdn.example/audio.wav',
      audioLength: 12,
      provider: 'mimo',
      model: 'mimo-v2.5-tts',
    });

    const result = await generateMimoTTS({ text: '你好', voice: 'Chloe' });

    expect(invokeFunctionMock).toHaveBeenCalledTimes(1);
    const [funcName, body] = invokeFunctionMock.mock.calls[0];
    expect(funcName).toBe('tts-mimo');
    expect(body).toMatchObject({
      text: '你好',
      voice: 'Chloe',
      model: 'mimo-v2.5-tts',
      format: 'wav',
    });
    expect(body).not.toHaveProperty('mimo_api_key');
    expect(result.audioUrl).toBe('https://cdn.example/audio.wav');
    expect(result.audioLength).toBe(12);
    expect(result.provider).toBe('mimo');
  });

  it('sends voice_record_id and switches to voiceclone model when a record id is provided', async () => {
    invokeFunctionMock.mockResolvedValue({ audioUrl: 'a', audioLength: 5, provider: 'mimo' });

    await generateMimoTTS({ text: 'hi', voiceRecordId: '11111111-1111-1111-1111-111111111111' });

    const [, body] = invokeFunctionMock.mock.calls[0];
    expect(body).toMatchObject({
      model: 'mimo-v2.5-tts-voiceclone',
      voice_record_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(body).not.toHaveProperty('voice');
  });

  it('forwards speed and forwards the user api key when set', async () => {
    getMimoApiKeyMock.mockReturnValue('sk-test');
    invokeFunctionMock.mockResolvedValue({ audioUrl: 'a', audioLength: 1 });

    await generateMimoTTS({ text: 'speed', voice: 'Mia', speed: 1.25, format: 'mp3' });

    const [, body] = invokeFunctionMock.mock.calls[0];
    expect(body).toMatchObject({
      speed: 1.25,
      format: 'mp3',
      mimo_api_key: 'sk-test',
    });
  });

  it('throws when neither voice nor voiceRecordId is provided', async () => {
    await expect(generateMimoTTS({ text: 'no voice' })).rejects.toThrow(/voice|voiceRecordId/);
    expect(invokeFunctionMock).not.toHaveBeenCalled();
  });

  it('extracts the trailing voice name from a composite id', () => {
    expect(getMimoVoiceNameFromId('mimo_default_cn:冰糖')).toBe('冰糖');
    expect(getMimoVoiceNameFromId('mimo_default_en:Chloe')).toBe('Chloe');
    expect(getMimoVoiceNameFromId('Chloe')).toBe('Chloe');
    expect(getMimoVoiceNameFromId('')).toBe('');
  });
});
