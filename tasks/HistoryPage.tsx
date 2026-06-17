import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Image, Wand2, Clock, ArrowRight, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { listVideoTasks } from '@/services/video';
import type { VideoTask } from '@/types';

const MODE_ICONS = {
  text: Film,
  image: Image,
  remix: Wand2,
};

const MODE_LABELS: Record<string, string> = {
  text: '文生视频',
  image: '图生视频',
  remix: '视频Remix',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: '等待中', className: 'bg-muted text-muted-foreground' },
  queued: { label: '排队中', className: 'bg-muted text-muted-foreground' },
  started: { label: '已开始', className: 'bg-info/20 text-info' },
  in_progress: { label: '生成中', className: 'bg-primary/20 text-primary' },
  completed: { label: '已完成', className: 'bg-success/20 text-success' },
  failed: { label: '失败', className: 'bg-destructive/20 text-destructive' },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await listVideoTasks(30);
      setTasks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '加载失败';
      toast.error(`加载失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">暂无创作记录</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          开始创作
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-balance mb-2">历史记录</h1>
        <p className="text-muted-foreground text-sm md:text-base">查看和管理您的视频创作记录</p>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const ModeIcon = MODE_ICONS[task.mode];
          const status = STATUS_BADGE[task.status] || { label: task.status, className: 'bg-muted text-muted-foreground' };
          const canView = task.status === 'completed' && task.video_url;

          return (
            <Card key={task.id} className="border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => {
                if (canView) navigate(`/result/${task.id}`);
                else if (!['completed', 'failed', 'cancelled'].includes(task.status)) navigate(`/progress/${task.id}`);
              }}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
                  <ModeIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{MODE_LABELS[task.mode]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-sm ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{task.prompt}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{task.size}</span>
                    <span>{task.seconds}秒{task.total_segments > 1 && `(${task.total_segments}段)`}</span>
                    <span>{task.audio_url ? '有配音' : '无配音'}</span>
                    <span>{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {canView ? (
                    <div className="flex items-center justify-center w-8 h-8 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : ['completed', 'failed', 'cancelled'].includes(task.status) ? (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
