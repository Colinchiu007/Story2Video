import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoClipEditor from './VideoClipEditor';
import { useVideoClip } from '@/hooks/useVideoClip';

// Mock shadcn/ui components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      data-testid="ui-button"
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

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-desc">{children}</p>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, min, max, step, disabled }: any) => (
    <input
      type="range"
      data-testid="clip-range-slider"
      min={min}
      max={max}
      step={step}
      value={value?.[1] || max}
      disabled={disabled}
      onChange={(e) => onValueChange([value?.[0] || 0, Number(e.target.value)])}
    />
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="clip-progress" data-value={value} />,
}));

vi.mock('@/hooks/useVideoClip', () => {
  let mockState = {
    startTime: 0,
    endTime: 30,
    duration: 30,
    isClipping: false,
    progress: 0,
    error: null,
    clipResult: null,
  };
  const mockFn = vi.fn(() => ({
    ...mockState,
    setStartTime: vi.fn((t: number) => { mockState.startTime = t; }),
    setEndTime: vi.fn((t: number) => { mockState.endTime = t; }),
    setDuration: vi.fn((d: number) => { mockState.duration = d; }),
    clipVideo: vi.fn().mockResolvedValue({
      blob: new Blob(),
      url: 'blob:test-clip',
      startTime: mockState.startTime,
      endTime: mockState.endTime,
      duration: mockState.endTime - mockState.startTime,
    }),
    reset: vi.fn(() => {
      mockState = { startTime: 0, endTime: 30, duration: 30, isClipping: false, progress: 0, error: null, clipResult: null };
    }),
    clearResult: vi.fn(),
  }));
  return { useVideoClip: mockFn };
});

describe('VideoClipEditor Component', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnClipComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={false}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders dialog with title when open', () => {
    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('视频剪辑');
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });

  it('renders video element with source', () => {
    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    const video = document.querySelector('video');
    expect(video).toBeDefined();
    expect(video?.src).toContain('example.com/video.mp4');
  });

  it('shows cancel and clip buttons', () => {
    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.getByText('取消')).toBeDefined();
    expect(screen.getByText('裁剪视频')).toBeDefined();
  });

  it('clips disables button when clipping is in progress', () => {
    // Re-mock with isClipping=true
    vi.mocked(useVideoClip).mockReturnValueOnce({
      startTime: 0,
      endTime: 30,
      duration: 30,
      isClipping: true,
      progress: 50,
      error: null,
      clipResult: null,
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setDuration: vi.fn(),
      clipVideo: vi.fn(),
      reset: vi.fn(),
      clearResult: vi.fn(),
    });

    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    const clipBtn = screen.getByText('剪辑中...');
    expect(clipBtn).toBeDefined();
  });

  it('shows error message when clip fails', () => {
    vi.mocked(useVideoClip).mockReturnValueOnce({
      startTime: 0,
      endTime: 30,
      duration: 30,
      isClipping: false,
      progress: 0,
      error: '剪辑失败：网络错误',
      clipResult: null,
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setDuration: vi.fn(),
      clipVideo: vi.fn(),
      reset: vi.fn(),
      clearResult: vi.fn(),
    });

    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.getByText('剪辑失败：网络错误')).toBeDefined();
  });

  it('displays video title when provided', () => {
    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        videoTitle="我的视频作品"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.getByText('我的视频作品')).toBeDefined();
  });

  it('shows progress bar when clipping', () => {
    vi.mocked(useVideoClip).mockReturnValueOnce({
      startTime: 0,
      endTime: 30,
      duration: 30,
      isClipping: true,
      progress: 65,
      error: null,
      clipResult: null,
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setDuration: vi.fn(),
      clipVideo: vi.fn(),
      reset: vi.fn(),
      clearResult: vi.fn(),
    });

    render(
      <VideoClipEditor
        videoUrl="https://example.com/video.mp4"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    const progressEl = screen.getByTestId('clip-progress');
    expect(progressEl).toBeDefined();
    expect(progressEl.getAttribute('data-value')).toBe('65');
  });
});
