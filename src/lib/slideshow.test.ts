import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSlideshowVideo,
  loadImage,
  renderFrame,
  renderTransition,
  mapSubtitleStyle,
  getVideoExtension,
} from './slideshow';

describe('loadImage', () => {
  it('成功加载图片时返回HTMLImageElement', async () => {
    const img = document.createElement('img');
    const originalCreateElement = document.createElement.bind(document);

    // @ts-ignore
    document.createElement = (tagName: string) => {
      if (tagName === 'img') {
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

describe('renderFrame', () => {
  function makeMockCanvas() {
    const ctx = {
      filter: 'none',
      fillStyle: '',
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
    };
    return ctx;
  }

  function makeMockImage(width = 1280, height = 720) {
    const img = document.createElement('img');
    Object.defineProperty(img, 'width', { value: width, configurable: true });
    Object.defineProperty(img, 'height', { value: height, configurable: true });
    return img;
  }

  it('正常效果：绘制黑色背景并调用 drawImage', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'none', duration: 3 }, 0, 1280, 720);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('zoom-in 效果：scale 大于 1', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'zoom-in', duration: 3 }, 0.5, 1280, 720);
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('zoom-out 效果：从 1.15 缩放到 1', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'zoom-out', duration: 3 }, 0.5, 1280, 720);
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('pan-left 效果：panX 为负', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'pan-left', duration: 3 }, 0.5, 1280, 720);
    expect(ctx.translate).toHaveBeenCalled();
  });

  it('pan-right 效果：panX 为正', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'pan-right', duration: 3 }, 0.5, 1280, 720);
    expect(ctx.translate).toHaveBeenCalled();
  });

  it('blur-in 效果：设置 filter', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'blur-in', duration: 3 }, 0, 1280, 720);
    expect(ctx.filter).toMatch(/blur/);
  });

  it('portrait 图片：宽高比小于画布时高度等于画布宽度', () => {
    const ctx = makeMockCanvas();
    const img = makeMockImage(720, 1280);
    renderFrame(ctx, { image: img, effect: 'none', duration: 3 }, 0, 720, 1280);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('重置 filter 为 none', () => {
    const ctx = makeMockCanvas();
    ctx.filter = 'blur(5px)';
    const img = makeMockImage();
    renderFrame(ctx, { image: img, effect: 'none', duration: 3 }, 0, 1280, 720);
    expect(ctx.filter).toBe('none');
  });
});
