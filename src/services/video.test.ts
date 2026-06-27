import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isImageGenerationAvailable,
  useKlingForImage,
  useKlingForVideo,
  useViduForImage,
} from './api-config';

describe('Image Generation Provider', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('默认使用可灵内置AI', () => {
    expect(useKlingForImage()).toBe(true);
    expect(useViduForImage()).toBe(false);
    expect(isImageGenerationAvailable()).toBe(true);
  });

  it('配置Vidu自定义API时切换为Vidu', () => {
    storage.api_config = JSON.stringify({
      modelConfig: {
        image: { source: 'custom', provider: 'vidu', apiKey: 'test-key' },
      },
    });
    expect(useKlingForImage()).toBe(false);
    expect(useViduForImage()).toBe(true);
    expect(isImageGenerationAvailable()).toBe(true);
  });

  it('Vidu自定义API缺少Key时不可用', () => {
    storage.api_config = JSON.stringify({
      modelConfig: {
        image: { source: 'custom', provider: 'vidu', apiKey: '' },
      },
    });
    expect(useViduForImage()).toBe(true);
    expect(isImageGenerationAvailable()).toBe(false);
  });

  it('未配置时默认可用（可灵内置）', () => {
    expect(isImageGenerationAvailable()).toBe(true);
    expect(useKlingForImage()).toBe(true);
  });

  it('jimeng 自动回退到可灵（也视为可用）', () => {
    storage.api_config = JSON.stringify({
      modelConfig: {
        image: { source: 'builtin', provider: 'jimeng' },
      },
    });
    expect(isImageGenerationAvailable()).toBe(true);
  });

  it('默认可灵图片可用，默认可灵视频未选中', () => {
    expect(useKlingForImage()).toBe(true);
    expect(useKlingForVideo()).toBe(false);
  });

  it('选择可灵视频模型', () => {
    storage.api_config = JSON.stringify({
      modelConfig: {
        video: { source: 'builtin', provider: 'kling' },
      },
    });
    expect(useKlingForVideo()).toBe(true);
  });
});
