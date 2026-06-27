import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchExportButton from './BatchExportButton';

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

// Mock zip-utils
vi.mock('@/lib/zip-utils', () => ({
  createZip: vi.fn(async (files: any[]) => new Blob(['fake-zip'], { type: 'application/zip' })),
  downloadZip: vi.fn(),
}));

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, disabled }: any) => (
    <button
      data-testid="export-btn"
      data-variant={variant}
      data-size={size}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));

describe('BatchExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with item count', () => {
    render(<BatchExportButton items={[
      { url: 'https://example.com/1.mp4', name: 'video-1.mp4' },
      { url: 'https://example.com/2.mp4', name: 'video-2.mp4' },
    ]} />);

    const btn = screen.getByTestId('export-btn');
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain('2');
  });

  it('shows disabled state with no items', () => {
    render(<BatchExportButton items={[]} />);
    const btn = screen.getByTestId('export-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('is disabled while exporting', async () => {
    render(<BatchExportButton items={[
      { url: 'https://example.com/1.mp4', name: 'video-1.mp4' },
    ]} />);

    const btn = screen.getByTestId('export-btn') as HTMLButtonElement;

    // Mock fetch to not resolve quickly so we catch the "exporting" state
    global.fetch = vi.fn(() => new Promise(() => {})) as any;

    fireEvent.click(btn);
    expect(btn.disabled).toBe(true);
  });
});
