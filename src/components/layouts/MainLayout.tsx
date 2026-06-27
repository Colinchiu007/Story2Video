import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Film, Menu, Clock, Home, LogIn, LogOut, Settings, Settings2, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import ApiSettingsDialog from '@/components/ApiSettingsDialog';
import WatermarkPicker from "@/components/WatermarkPicker";

const navItems = [
  { path: '/', label: '创作', icon: Home },
  { path: '/history', label: '历史', icon: Clock },
  { path: '/profile', label: '我的', icon: User },
];

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [watermarkOpen, setWatermarkOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const userDisplay = user?.phone ?? user?.email?.split('@')[0] ?? '';

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <Film className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">视频创作工具</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {/* User section moved here from bottom */}
          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user ? userDisplay : '未登录'}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-3.5 w-3.5 mr-1" />
                设置
              </Button>
              {user ? (
              <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => setWatermarkOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                水印
              </Button>
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  退出
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => navigate('/login')}>
                  <LogIn className="h-3.5 w-3.5 mr-1" />
                  登录
                </Button>
              )}
            </div>
          </div>
        </nav>
      </aside>

      {/* Mobile Header + Content */}
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r border-border">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                <Film className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold tracking-tight">视频创作工具</span>
              </div>
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-sm text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="pt-4 border-t border-border">
                  <ThemeToggle />
                </div>
              </nav>
              <div className="p-4 border-t border-border space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user ? userDisplay : '未登录'}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => { setSettingsOpen(true); setMobileOpen(false); }}>
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    设置
                  </Button>
                  {user ? (
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => { handleLogout(); setMobileOpen(false); }}>
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      退出
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={() => { navigate('/login'); setMobileOpen(false); }}>
                      <LogIn className="h-3.5 w-3.5 mr-1" />
                      登录
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Film className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold flex-1 min-w-0 truncate">视频创作工具</span>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            {user ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/login')}>
                <LogIn className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>

        {/* Version footer */}
        <div className="shrink-0 py-2 px-4 text-center">
          <span className="text-[10px] text-muted-foreground">v0.15</span>
        </div>
      </div>

      <ApiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={() => {
          window.dispatchEvent(new CustomEvent('api-settings-saved'));
        }}
      />
      <WatermarkPicker
        open={watermarkOpen}
        onOpenChange={setWatermarkOpen}
      />
    </div>
  );
};

export default MainLayout;
