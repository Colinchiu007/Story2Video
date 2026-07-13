import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseInsertMock = vi.fn();
const supabaseSelectMock = vi.fn();
const supabaseSingleMock = vi.fn();
const supabaseFromMock = vi.fn();

const supabaseChain = {
  insert: supabaseInsertMock.mockReturnThis(),
  select: supabaseSelectMock.mockReturnThis(),
  single: supabaseSingleMock,
};
supabaseFromMock.mockReturnValue(supabaseChain);

vi.mock('@/db/supabase', () => ({
  supabase: { from: (...args: unknown[]) => supabaseFromMock(...args) },
}));

vi.mock('@/components/ApiSettingsDialog', () => ({
  getDoubaoApiKey: () => null,
}));

vi.mock('./api-config', () => ({
  invokeFunction: vi.fn(),
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  getCustomApiConfig: () => null,
}));

import { uploadMimoVoiceSample } from './voice-clone';

describe('uploadMimoVoiceSample', () => {
  beforeEach(() => {
    supabaseFromMock.mockClear();
    supabaseInsertMock.mockClear();
    supabaseSelectMock.mockClear();
    supabaseSingleMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a user_voices row with provider=mimo and status=ready', async () => {
    supabaseSingleMock.mockResolvedValue({
      data: { id: 'row-1', name: '我的 MiMo 声音', status: 'ready' },
      error: null,
    });

    const result = await uploadMimoVoiceSample({
      name: '我的 MiMo 声音',
      description: '测试用',
      audioUrl: 'https://cdn.example/sample.wav',
      duration: 30,
    });

    expect(supabaseFromMock).toHaveBeenCalledWith('user_voices');
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
    const inserted = supabaseInsertMock.mock.calls[0][0];
    expect(inserted).toMatchObject({
      name: '我的 MiMo 声音',
      description: '测试用',
      sample_audio_url: 'https://cdn.example/sample.wav',
      status: 'ready',
      provider: 'mimo',
      duration_seconds: 30,
      language: 'Chinese',
    });
    expect(result).toEqual({ id: 'row-1', name: '我的 MiMo 声音', status: 'ready' });
  });

  it('propagates errors from supabase', async () => {
    supabaseSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(uploadMimoVoiceSample({
      name: 'x',
      audioUrl: 'https://cdn.example/sample.wav',
    })).rejects.toBeTruthy();
  });
});
