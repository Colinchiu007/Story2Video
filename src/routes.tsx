import CreatePage from './pages/CreatePage';
import LoginPage from './pages/LoginPage';
import ProgressPage from './pages/ProgressPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import GalleryPage from './pages/GalleryPage';
import SegmentManagerPage from './pages/SegmentManagerPage';
import ProfilePage from './pages/ProfilePage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: '创作',
    path: '/',
    element: <CreatePage />,
    public: true,
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: '进度',
    path: '/progress/:id',
    element: <ProgressPage />,
    public: true,
  },
  {
    name: '结果',
    path: '/result/:id',
    element: <ResultPage />,
    public: true,
  },
  {
    name: '历史',
    path: '/history',
    element: <HistoryPage />,
    public: true,
  },
  {
    name: '图片管理',
    path: '/gallery/:id',
    element: <GalleryPage />,
    public: true,
  },
  {
    name: '分段管理',
    path: '/segments/:id',
    element: <SegmentManagerPage />,
    public: true,
  },
  {
    name: '个人主页',
    path: '/profile',
    element: <ProfilePage />,
  },
];
