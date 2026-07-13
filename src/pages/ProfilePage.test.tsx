import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { listVideoTasks } from '@/services/video-generation';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', phone: '13800138000' },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/services/video-generation', () => ({
  listVideoTasks: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, disabled }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/db/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(listVideoTasks).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders empty state when no tasks', async () => {
    vi.mocked(listVideoTasks).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Wait for loading to complete
    await vi.waitFor(() => {
      expect(screen.getByText('还没有完成的作品')).toBeTruthy();
    });
  });

  it('renders user phone number', async () => {
    vi.mocked(listVideoTasks).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getByText('13800138000')).toBeTruthy();
    });
  });

  it('renders task count stats', async () => {
    vi.mocked(listVideoTasks).mockResolvedValue([
      { id: '1', mode: 'text', status: 'completed', video_url: 'https://example.com/1.mp4', created_at: '2026-01-01T00:00:00Z', prompt: 'Test video', size: '1920x1080', seconds: 10 },
    ]);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // count of completed
    });
  });
});
