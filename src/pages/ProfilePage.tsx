import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Film, Clock, Eye, Download, Grid3X3, List,
  Calendar, Trash2, LogOut, Settings, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { listVideoTasks } from '@/services/video-generation';
import type { VideoTask } from '@/types';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const all = await listVideoTasks(50);
      setTasks(all.filter((t) => t.video_url || t.merged_video_url));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      toast.error(`加载作品失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast.success('下载已开始');
    } catch {
      toast.error('下载失败');
    }
  };

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      text: '文生视频',
      image: '图生视频',
      audio: '音频生视频',
      batch: '分段视频',
      remix: '视频Remix',
      gallery: '图片管理',
    };
    return labels[mode] || mode;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-600 border-green-200',
      processing: 'bg-blue-500/10 text-blue-600 border-blue-200',
      failed: 'bg-red-500/10 text-red-600 border-red-200',
      pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    };
    const labels: Record<string, string> = {
      completed: '已完成',
      processing: '处理中',
      failed: '失败',
      pending: '排队中',
    };
    return (
      <Badge variant="outline" className={styles[status] || ''}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const totalViews = tasks.reduce((sum, t) => sum + (t as any).view_count || 0, 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Profile Header */}
      <Card className="border border-border bg-card mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background h-24" />
        <CardContent className="p-6 -mt-12">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">
                {user?.phone || user?.email || '用户'}
              </h1>
              <p className="text-sm text-muted-foreground">
                共 {tasks.length} 个作品
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
                <Clock className="h-4 w-4 mr-1" />
                历史记录
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" />
                退出登录
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="border border-border bg-card">
          <CardContent className="p-4 text-center">
            <Film className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{completedTasks.length}</p>
            <p className="text-xs text-muted-foreground">已完成作品</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground">全部作品</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="p-4 text-center">
            <Grid3X3 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalViews}</p>
            <p className="text-xs text-muted-foreground">总观看</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">
              {tasks.length > 0
                ? new Date(tasks[0].created_at).toLocaleDateString('zh-CN')
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">最近作品</p>
          </CardContent>
        </Card>
      </div>

      {/* Works Gallery */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          我的作品
        </h2>
        <div className="flex items-center gap-1 border border-border rounded-sm">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-12 text-center">
            <Film className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">还没有完成的作品</p>
            <Button onClick={() => navigate('/')}>
              开始创作
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const videoUrl = task.merged_video_url || task.video_url || '';
            return (
              <Card key={task.id} className="border border-border bg-card overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="relative aspect-video bg-black">
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      muted
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        const v = e.target as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Film className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/result/${task.id}`)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      查看
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1">
                      {task.prompt || getModeLabel(task.mode)}
                    </p>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{getModeLabel(task.mode)}</span>
                    <span>{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 text-xs"
                      onClick={() => navigate(`/result/${task.id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      查看
                    </Button>
                    {videoUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 text-xs"
                        onClick={() => handleDownload(videoUrl, `video-${task.id}.mp4`)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        下载
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {tasks.map((task) => {
            const videoUrl = task.merged_video_url || task.video_url || '';
            return (
              <Card key={task.id} className="border border-border bg-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-24 rounded-sm bg-black shrink-0 overflow-hidden">
                    {videoUrl ? (
                      <video src={videoUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Film className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {task.prompt || getModeLabel(task.mode)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{getModeLabel(task.mode)}</span>
                      <span>{task.size}</span>
                      <span>{task.seconds}s</span>
                      <span>{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(task.status)}
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate(`/result/${task.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {videoUrl && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDownload(videoUrl, `video-${task.id}.mp4`)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
