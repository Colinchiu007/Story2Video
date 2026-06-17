import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSlideshowVideo, loadImage } from './slideshow';

describe('loadImage', () => {
  it('成功加载图片时返回HTMLImageElement', async () => {
    const img = document.createElement('img');
    const originalCreateElement = document.createElement.bind(document);

    // @ts-ignore
    document.createElement = (tagName: string) => {
      if (tagName === 'img') {
        // 延迟触发 onload，让 promise 能捕获
        setTimeout(() => {
          Object.defineProperty(img, 'width', { value: 1280, configurable: true });
          Object.defineProperty(img, 'height', { value: 720, configurable: true });
          img.dispatchEvent(new Event('load'));
        }, 10);
        return img;
      }
      return originalCreateElement(tagName);
    };

    const promise = loadImage('https://example.com/test.jpg');
    const result = await promise;
    expect(result).toBeInstanceOf(HTMLImageElement);

    // @ts-ignore
    document.createElement = originalCreateElement;
  }, 5000);
});

describe('createSlideshowVideo', () => {
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);

    // Mock MediaRecorder as a proper constructor
    class MockMediaRecorder {
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      start() {
        setTimeout(() => {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['fake-video-data'], { type: 'video/webm' }) });
          }
          if (this.onstop) this.onstop();
        }, 30);
      }
      stop() {}
      static isTypeSupported(type: string) { return type.includes('webm'); }
    }
    // @ts-ignore
    window.MediaRecorder = MockMediaRecorder;

    // Mock createElement to intercept img creation and auto-trigger onload
    // @ts-ignore
    document.createElement = (tagName: string) => {
      if (tagName === 'img') {
        const img = originalCreateElement('img');
        setTimeout(() => {
          Object.defineProperty(img, 'width', { value: 1280, configurable: true });
          Object.defineProperty(img, 'height', { value: 720, configurable: true });
          img.dispatchEvent(new Event('load'));
        }, 10);
        return img;
      }
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas');
        const mockCtx = {
          save: vi.fn(),
          restore: vi.fn(),
          fillRect: vi.fn(),
          translate: vi.fn(),
          scale: vi.fn(),
          drawImage: vi.fn(),
          globalAlpha: 1,
        };
        // @ts-ignore
        canvas.getContext = () => mockCtx;
        // @ts-ignore
        canvas.captureStream = () => ({ getTracks: () => [] });
        return canvas;
      }
      return originalCreateElement(tagName);
    };

    // Mock requestAnimationFrame to fire a few times then stop
    let callCount = 0;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb: FrameRequestCallback) {
      callCount++;
      if (callCount > 5) return 0;
      setTimeout(() => cb(performance.now()), 5);
      return callCount;
    };
  });

  afterEach(() => {
    // @ts-ignore
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });

  it('无图片时抛出错误', async () => {
    await expect(createSlideshowVideo([], null, 'none', 'none')).rejects.toThrow('没有图片');
  });

  it('有图片时返回Blob', async () => {
    const images = [
      { image_url: 'https://example.com/1.jpg', prompt: '图1' },
      { image_url: 'https://example.com/2.jpg', prompt: '图2' },
    ];

    const blob = await createSlideshowVideo(images, null, 'zoom-in', 'fade');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toMatch(/^video\/(webm|mp4)/);
  }, 10000);
});
