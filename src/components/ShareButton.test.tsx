import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ShareButton from './ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders share button', () => {
    render(<ShareButton url="https://example.com/video/123" />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('opens share dialog on click', () => {
    render(<ShareButton url="https://example.com/video/123" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('分享视频')).toBeDefined();
  });

  it('displays the share URL in the dialog', () => {
    render(<ShareButton url="https://example.com/video/123" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByDisplayValue('https://example.com/video/123')).toBeDefined();
  });

  it('copies URL to clipboard when copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<ShareButton url="https://example.com/video/123" />);
    fireEvent.click(screen.getByRole('button'));

    // The copy button is an icon button with title="复制链接"
    const copyButton = screen.getByTitle('复制链接');
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('https://example.com/video/123');
  });

  it('shows custom title when provided', () => {
    render(<ShareButton url="https://example.com/video/123" title="我的视频" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/我的视频/)).toBeDefined();
  });

  it('renders with custom className', () => {
    render(<ShareButton url="https://example.com/v/1" className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });
});
