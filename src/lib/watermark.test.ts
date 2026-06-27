import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultWatermarkConfig,
  drawWatermark,
  loadWatermarkConfig,
  saveWatermarkConfig,
  type WatermarkConfig,
} from './watermark';

// Mock localStorage for node environment
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
  key: () => null,
};

describe('Watermark Config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getDefaultWatermarkConfig returns default values', () => {
    const config = getDefaultWatermarkConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(false);
    expect(config.text).toBe('');
    expect(config.position).toBe('bottom-right');
    expect(config.fontSize).toBe(24);
    expect(config.opacity).toBe(0.6);
    expect(config.color).toBe('#ffffff');
  });

  it('passing partial overrides only specified fields', () => {
    const config = getDefaultWatermarkConfig({ text: 'My Watermark', enabled: true });
    expect(config.text).toBe('My Watermark');
    expect(config.enabled).toBe(true);
    expect(config.position).toBe('bottom-right');
    expect(config.fontSize).toBe(24);
  });

  it('loadWatermarkConfig returns defaults when nothing stored', () => {
    const config = loadWatermarkConfig();
    expect(config.enabled).toBe(false);
    expect(config.text).toBe('');
  });

  it('loadWatermarkConfig returns stored config', () => {
    saveWatermarkConfig({ enabled: true, text: '@Channel', position: 'top-left', fontSize: 32, opacity: 0.8, color: '#000000' });
    const loaded = loadWatermarkConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.text).toBe('@Channel');
    expect(loaded.position).toBe('top-left');
    expect(loaded.fontSize).toBe(32);
  });

  it('saveWatermarkConfig persists to localStorage', () => {
    const config: WatermarkConfig = { enabled: true, text: 'Test', position: 'center', fontSize: 48, opacity: 0.5, color: '#ff0000' };
    saveWatermarkConfig(config);
    const stored = localStorage.getItem('story2video_watermark_config');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.text).toBe('Test');
    expect(parsed.position).toBe('center');
  });

  it('loadWatermarkConfig fills missing fields with defaults', () => {
    localStorage.setItem('story2video_watermark_config', JSON.stringify({ enabled: true }));
    const loaded = loadWatermarkConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.text).toBe('');
    expect(loaded.fontSize).toBe(24);
    expect(loaded.position).toBe('bottom-right');
  });
});

describe('drawWatermark', () => {
  it('does nothing when watermark is disabled', () => {
    const ctx = {
      save: () => { throw new Error('should not be called'); },
    } as unknown as CanvasRenderingContext2D;
    const config = getDefaultWatermarkConfig();
    drawWatermark(ctx, config, 1920, 1080);
  });

  it('does nothing when text is empty', () => {
    let saved = false;
    const ctx = {
      save: () => { saved = true; return; },
      restore: () => { return; },
      font: '',
      fillStyle: '',
      globalAlpha: 1,
      textAlign: '',
      textBaseline: '',
      measureText: () => ({ width: 0 }),
      fillText: () => { return; },
    } as unknown as CanvasRenderingContext2D;
    const config = getDefaultWatermarkConfig({ enabled: true, text: '' });
    drawWatermark(ctx, config, 1920, 1080);
    expect(saved).toBe(false);
  });

  it('draws watermark text at bottom-right by default', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => { calls.push('save'); },
      restore: () => { calls.push('restore'); },
      font: '',
      fillStyle: '',
      globalAlpha: 1,
      textAlign: '',
      textBaseline: '',
      measureText: () => ({ width: 100 }),
      fillText: (text: string, x: number, y: number) => {
        calls.push(`fillText:${text}@${x},${y}`);
      },
    } as unknown as CanvasRenderingContext2D;
    const config = getDefaultWatermarkConfig({ enabled: true, text: '@MyChannel', position: 'bottom-right' });
    drawWatermark(ctx, config, 1920, 1080);
    expect(calls).toContain('save');
    expect(calls).toContain('restore');
    expect(calls.some(c => c.includes('fillText:@MyChannel'))).toBe(true);
  });

  it('draws watermark at top-left position', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => { calls.push('save'); },
      restore: () => { calls.push('restore'); },
      font: '',
      fillStyle: '',
      globalAlpha: 1,
      textAlign: '',
      textBaseline: '',
      measureText: () => ({ width: 80 }),
      fillText: (_text: string, x: number, y: number) => {
        calls.push(`fillText@${x},${y}`);
      },
    } as unknown as CanvasRenderingContext2D;
    const config = getDefaultWatermarkConfig({ enabled: true, text: 'Watermark', position: 'top-left' });
    drawWatermark(ctx, config, 1920, 1080);
    const fillCall = calls.find(c => c.startsWith('fillText@'));
    expect(fillCall).toBeDefined();
    const [, xy] = fillCall!.split('@');
    const [x, y] = xy.split(',').map(Number);
    expect(x).toBeLessThan(400);
    expect(y).toBeLessThan(200);
  });

  it('applies custom font size and opacity', () => {
    let appliedFont = '';
    let appliedAlpha = 0;
    let appliedColor = '';
    const ctx = {
      save: () => { return; },
      restore: () => { return; },
      set font(v: string) { appliedFont = v; },
      set fillStyle(v: string) { appliedColor = v; },
      set globalAlpha(v: number) { appliedAlpha = v; },
      textAlign: '',
      textBaseline: '',
      measureText: () => ({ width: 0 }),
      fillText: () => { return; },
    } as unknown as CanvasRenderingContext2D;
    const config = getDefaultWatermarkConfig({ enabled: true, text: 'Test', fontSize: 32, opacity: 0.8, color: '#ff0000' });
    drawWatermark(ctx, config, 1920, 1080);
    expect(appliedFont).toContain('32px');
    expect(appliedAlpha).toBe(0.8);
    expect(appliedColor).toBe('#ff0000');
  });
});
