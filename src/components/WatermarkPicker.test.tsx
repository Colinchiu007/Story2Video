import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WatermarkPicker from './WatermarkPicker';

// Mock the watermark lib module
vi.mock('@/lib/watermark', () => {
  let storedConfig = {
    enabled: false,
    text: '',
    position: 'bottom-right' as const,
    fontSize: 24,
    opacity: 0.6,
    color: '#ffffff',
  };
  return {
    loadWatermarkConfig: vi.fn(() => storedConfig),
    saveWatermarkConfig: vi.fn((config: any) => {
      storedConfig = config;
    }),
  };
});

// Mock shadcn/ui components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button data-testid="ui-button" data-variant={variant} data-size={size} className={className} onClick={onClick}>
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

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid={`input-${props.id}`} {...props} />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id, disabled }: any) => (
    <input
      type="checkbox"
      data-testid={`switch-${id}`}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
    />
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, id, disabled, min, max, step }: any) => (
    <input
      type="range"
      data-testid={`slider-${id}`}
      value={value?.[0]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-wrapper">
      {children}
      <select data-testid="select-hidden" value={value} onChange={(e) => onValueChange(e.target.value)} aria-hidden="true">
        <option value="top-left">左上</option>
        <option value="top-right">右上</option>
        <option value="bottom-left">左下</option>
        <option value="bottom-right">右下</option>
        <option value="center">居中</option>
      </select>
    </div>
  ),
  SelectTrigger: ({ children, id }: any) => (
    <button data-testid={`select-trigger-${id}`}>{children}</button>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
  SelectValue: () => <span>选择位置</span>,
}));

describe('WatermarkPicker Component', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <WatermarkPicker open={false} onOpenChange={mockOnOpenChange} />,
    );
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders dialog with title and description when open', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('视频水印设置');
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });

  it('shows enable switch and toggles it', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    const switchEl = screen.getByTestId('switch-watermark-enabled');
    expect(switchEl).toBeDefined();
    expect((switchEl as HTMLInputElement).checked).toBe(false);

    fireEvent.click(switchEl);
    expect((switchEl as HTMLInputElement).checked).toBe(true);
  });

  it('disables controls when watermark is disabled', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    const textInput = screen.getByTestId('input-watermark-text');
    expect((textInput as HTMLInputElement).disabled).toBe(true);
  });

  it('enables controls when watermark is enabled', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByTestId('switch-watermark-enabled'));

    const textInput = screen.getByTestId('input-watermark-text');
    expect((textInput as HTMLInputElement).disabled).toBe(false);
  });

  it('updates text input value', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByTestId('switch-watermark-enabled'));

    const textInput = screen.getByTestId('input-watermark-text') as HTMLInputElement;
    fireEvent.change(textInput, { target: { value: '@MyChannel' } });
    expect(textInput.value).toBe('@MyChannel');
  });

  it('updates font size via slider', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByTestId('switch-watermark-enabled'));

    const slider = screen.getByTestId('slider-watermark-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '36' } });
    expect(slider.value).toBe('36');
  });

  it('updates opacity via slider', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByTestId('switch-watermark-enabled'));

    const slider = screen.getByTestId('slider-watermark-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(slider.value).toBe('0.8');
  });

  it('calls onOpenChange(false) when cancel is clicked', () => {
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);
    const cancelBtn = screen.getByText('取消');
    fireEvent.click(cancelBtn);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves config and closes dialog when save is clicked', () => {
    const { saveWatermarkConfig } = require('@/lib/watermark');
    render(<WatermarkPicker open={true} onOpenChange={mockOnOpenChange} />);

    const saveBtn = screen.getByText('保存设置');
    fireEvent.click(saveBtn);

    expect(saveWatermarkConfig).toHaveBeenCalledOnce();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
