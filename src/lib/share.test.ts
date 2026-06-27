import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateShareUrl,
  getShareText,
  getSharePlatformUrl,
  isWebShareSupported,
} from './share';

describe('generateShareUrl', () => {
  it('generates a full share link', () => {
    const url = generateShareUrl('video-123', { mode: 'text', prompt: 'test video' });
    expect(url).toContain(window.location.origin);
    expect(url).toContain('/share/');
    expect(url).toContain('video-123');
  });

  it('supports custom base URL', () => {
    const url = generateShareUrl('video-456', {}, 'https://mysite.com');
    expect(url).toContain('https://mysite.com');
    expect(url).toContain('/share/video-456');
  });

  it('supports extra query parameters', () => {
    const url = generateShareUrl('video-789', { prompt: 'hello', mode: 'image' }, 'https://example.com');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('prompt')).toBe('hello');
    expect(parsed.searchParams.get('mode')).toBe('image');
  });
});

describe('getShareText', () => {
  it('generates default share text', () => {
    const text = getShareText('https://example.com/share/123');
    expect(text).toContain('https://example.com/share/123');
    expect(text).toContain('AI');
  });

  it('includes custom prompt', () => {
    const text = getShareText('https://example.com/share/123', 'beautiful scene');
    expect(text).toContain('beautiful scene');
  });
});

describe('getSharePlatformUrl', () => {
  it('generates Weibo share link', () => {
    const url = getSharePlatformUrl('weibo', 'https://example.com/v', 'check out my AI video');
    expect(url).toContain('service.weibo.com');
    expect(url).toContain(encodeURIComponent('https://example.com/v'));
  });

  it('returns fallback for unknown platform', () => {
    const url = getSharePlatformUrl('unknown', 'https://example.com/v');
    expect(url).toBe('https://example.com/v');
  });
});

describe('isWebShareSupported', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when navigator.share exists', () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    expect(isWebShareSupported()).toBe(true);
  });

  it('returns false when navigator.share is undefined', () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isWebShareSupported()).toBe(false);
  });
});
