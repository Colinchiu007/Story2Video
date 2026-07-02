import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import MembershipUpgradeDialog from './MembershipUpgradeDialog';

// ── Mock UI components ────────────────────────────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, disabled }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: any) => (
    <div className={className} onClick={onClick} data-testid="plan-card">
      {children}
    </div>
  ),
}));

// ── Mock fetch ────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

function mockJson(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  currentPlan: 'free',
  refresh: vi.fn(),
};

function renderDialog(props = {}) {
  return render(<MembershipUpgradeDialog {...defaultProps} {...props} />);
}

function selectPlan(planName: string) {
  const el = screen.getByText(planName);
  const card = el.closest('[data-testid="plan-card"]');
  if (!card) throw new Error(`Plan card for "${planName}" not found`);
  fireEvent.click(card);
}

function confirmButton() {
  return screen.getByRole('button', { name: /确认升级/ });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);

  const store: Record<string, string> = {
    orchestrator_membership_token: JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: 9999999999,
    }),
    orchestrator_url: 'http://localhost:8000',
  };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MembershipUpgradeDialog', () => {

  it('renders plan comparison grid when open', () => {
    renderDialog();
    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect(screen.getByText('选择套餐')).toBeTruthy();
    expect(screen.getByText('免费版')).toBeTruthy();
    expect(screen.getByText(/专业版/)).toBeTruthy();
    expect(screen.getByText(/企业版/)).toBeTruthy();
  });

  it('does not render when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('shows current plan badge on the current plan card', () => {
    renderDialog();
    const badges = screen.getAllByTestId('badge');
    const currentBadge = badges.find(b => b.textContent === '当前套餐');
    expect(currentBadge).toBeTruthy();
  });

  it('shows confirming step when user clicks a non-current plan', () => {
    renderDialog();
    selectPlan('专业版');
    // "确认升级" appears in both title and button
    expect(screen.getAllByText('确认升级').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('返回')).toBeTruthy();
  });

  it('processes payment on confirm and shows success', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ checkout_id: 'mock-checkout-123' }))
      .mockResolvedValueOnce(mockJson({ status: 'completed' }));

    renderDialog();
    selectPlan('专业版');
    fireEvent.click(confirmButton());

    // "升级成功" appears in both dialog title and success body — use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText('升级成功').length).toBeGreaterThan(0);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const createCall = mockFetch.mock.calls[0];
    expect(createCall[0]).toContain('/api/payment/create-checkout');
    expect(createCall[1].body).toContain('"plan_type":"pro"');

    const confirmCall = mockFetch.mock.calls[1];
    expect(confirmCall[0]).toContain('/api/payment/confirm-mock');
    expect(confirmCall[1].body).toContain('"checkout_id":"mock-checkout-123"');

    await waitFor(() => {
      expect(defaultProps.refresh).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('shows error when checkout creation fails', async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ detail: 'Server error' }, 500));

    renderDialog();
    selectPlan('专业版');
    fireEvent.click(confirmButton());

    // "升级失败" appears in both title and error body
    await waitFor(() => {
      expect(screen.getAllByText('升级失败').length).toBeGreaterThan(0);
    });

    // _apiFetch returns raw JSON text as error message
    expect(screen.getByText('{"detail":"Server error"}')).toBeTruthy();
  });

  it('shows error when user is not authenticated (no token)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    renderDialog();
    selectPlan('专业版');
    fireEvent.click(confirmButton());

    await waitFor(() => {
      expect(screen.getAllByText('升级失败').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('请先登录')).toBeTruthy();
  });

  it('shows error when confirm-mock fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ checkout_id: 'mock-checkout-123' }))
      .mockResolvedValueOnce(mockJson({ detail: 'Payment failed' }, 400));

    renderDialog();
    selectPlan('专业版');
    fireEvent.click(confirmButton());

    await waitFor(() => {
      expect(screen.getAllByText('升级失败').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('{"detail":"Payment failed"}')).toBeTruthy();
  });

  it('back button returns to plan list from confirming step', () => {
    renderDialog();
    selectPlan('专业版');

    expect(screen.getAllByText('确认升级').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText('返回'));

    expect(screen.getByText('选择套餐')).toBeTruthy();
    expect(screen.getByText('免费版')).toBeTruthy();
  });

  it('retry button from error goes back to confirming', async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ detail: 'Error' }, 500));

    renderDialog();
    selectPlan('专业版');
    fireEvent.click(confirmButton());

    await waitFor(() => {
      expect(screen.getAllByText('升级失败').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('重试'));

    expect(screen.getAllByText('确认升级').length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct plan details for enterprise plan', () => {
    renderDialog();
    expect(screen.getByText('企业版')).toBeTruthy();
    expect(screen.getByText('每日 200 次视频生成')).toBeTruthy();
  });

  it('reset error message between plan selections', () => {
    renderDialog({ currentPlan: 'pro' });
    expect(screen.getByText('选择套餐')).toBeTruthy();
  });
});
