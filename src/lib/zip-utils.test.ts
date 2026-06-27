import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createZip, downloadZip } from './zip-utils';

describe('createZip', () => {
  it('creates a zip blob with correct MIME type', async () => {
    const blob = await createZip([
      { name: 'test.txt', data: new Blob(['hello world'], { type: 'text/plain' }) },
    ]);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a valid ZIP (starts with PK signature)', async () => {
    const blob = await createZip([
      { name: 'hello.txt', data: new Blob(['Hello'], { type: 'text/plain' }) },
    ]);
    const buf = await blob.arrayBuffer();
    const header = new Uint8Array(buf, 0, 4);
    // ZIP local file header signature: PK\x03\x04
    expect(header[0]).toBe(0x50); // P
    expect(header[1]).toBe(0x4b); // K
    expect(header[2]).toBe(0x03);
    expect(header[3]).toBe(0x04);
  });

  it('contains filenames in the archive', async () => {
    const blob = await createZip([
      { name: 'video1.mp4', data: new Blob(['fake mp4 content']) },
      { name: 'video2.mp4', data: new Blob(['more fake content']) },
    ]);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // Find filename bytes in the raw zip
    const findStr = (s: string): boolean => {
      const target = new TextEncoder().encode(s);
      for (let i = 0; i < bytes.length - target.length; i++) {
        let match = true;
        for (let j = 0; j < target.length; j++) {
          if (bytes[i + j] !== target[j]) { match = false; break; }
        }
        if (match) return true;
      }
      return false;
    };

    expect(findStr('video1.mp4')).toBe(true);
    expect(findStr('video2.mp4')).toBe(true);
  });

  it('creates zip with multiple files', async () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      name: `segment_${i + 1}.mp4`,
      data: new Blob([`content ${i + 1}`], { type: 'video/mp4' }),
    }));
    const blob = await createZip(files);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('downloadZip', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and document.createElement
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('creates a download link and clicks it', () => {
    const mockClick = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockAppendChild = vi.fn();

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

    const blob = new Blob(['test'], { type: 'application/zip' });
    downloadZip(blob, 'videos.zip');

    // Verify the link was created and clicked
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});
