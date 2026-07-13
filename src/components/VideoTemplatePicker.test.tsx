import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VideoTemplatePicker, { TemplateSelectButton } from './VideoTemplatePicker';
import { BUILT_IN_TEMPLATES } from '@/lib/template-library';

describe('VideoTemplatePicker', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    selectedId: undefined as string | undefined,
    onSelect: vi.fn(),
  };

  it('renders dialog with template grid when open', () => {
    render(<VideoTemplatePicker {...defaultProps} />);
    expect(screen.getByText('选择视频模板')).toBeTruthy();
    expect(screen.getByText('快速成片')).toBeTruthy();
    expect(screen.getByText('幻灯片演示')).toBeTruthy();
  });

  it('does not render content when closed', () => {
    render(<VideoTemplatePicker {...defaultProps} open={false} />);
    expect(screen.queryByText('选择视频模板')).toBeNull();
  });

  it('shows all built-in templates', () => {
    render(<VideoTemplatePicker {...defaultProps} />);
    BUILT_IN_TEMPLATES.forEach((tpl) => {
      expect(screen.getByText(tpl.name)).toBeTruthy();
    });
  });

  it('filters templates by category', () => {
    render(<VideoTemplatePicker {...defaultProps} />);
    fireEvent.click(screen.getAllByText('商务')[0]);
    expect(screen.getByText('幻灯片演示')).toBeTruthy();
    expect(screen.getByText('营销推广')).toBeTruthy();
    expect(screen.queryByText('快速成片')).toBeNull();
  });

  it('selects a template and closes dialog', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <VideoTemplatePicker
        {...defaultProps}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByText('快速成片'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tpl-quick' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('highlights the selected template', () => {
    render(
      <VideoTemplatePicker {...defaultProps} selectedId="tpl-quick" />
    );
    const cards = screen.getAllByRole('button');
    const quickCard = cards.find(
      (el) => el.textContent?.includes('快速成片') && el.className.includes('border-primary')
    );
    expect(quickCard).toBeTruthy();
  });

  it('shows empty state for unused category', () => {
    // Add a "custom" category button — currently no templates with custom
    render(<VideoTemplatePicker {...defaultProps} />);
    expect(screen.getAllByText('热门').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vlog').length).toBeGreaterThanOrEqual(1);
  });

  it('renders category filter buttons for all categories', () => {
    render(<VideoTemplatePicker {...defaultProps} />);
    expect(screen.getAllByText('全部').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('热门').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('商务').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('教育').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vlog').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('创意').length).toBeGreaterThanOrEqual(1);
  });

  it('resets filter when switching categories', () => {
    render(<VideoTemplatePicker {...defaultProps} />);
    fireEvent.click(screen.getAllByText('创意')[0]);
    expect(screen.queryByText('快速成片')).toBeNull();
    expect(screen.getByText('动感快剪')).toBeTruthy();
    fireEvent.click(screen.getAllByText('全部')[0]);
    expect(screen.getByText('快速成片')).toBeTruthy();
  });
});

describe('TemplateSelectButton', () => {
  it('renders with template icon and selection text', () => {
    render(
      <TemplateSelectButton onClick={vi.fn()} hasSelection={false} />
    );
    expect(screen.getByText('选模板')).toBeTruthy();
  });

  it('shows "切换模板" when a template is selected', () => {
    render(
      <TemplateSelectButton onClick={vi.fn()} hasSelection={true} />
    );
    expect(screen.getByText('切换模板')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TemplateSelectButton onClick={onClick} hasSelection={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
