import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Image, Wand2, Music, ListOrdered, Clock, ArrowRight, Trash2, XCircle, Download, Play, Headphones, Search, RotateCw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { listVideoTasks, deleteVideoTask, startTextToVideo, startImageToVideo, startRemixVideo } from '@/services/video-generation';
import { supabase } from '@/db/supabase';
import type { VideoTask } from '@/types';

/** Effective status that considers timeout for stuck tasks */
type EffectiveStatus = 'completed' | 'failed' | 'processing';

const TAB_CONFIG: { key: EffectiveStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已成功' },
  { key: 'processing', label: '处理中' },
  { key: 'failed', label: '失败' },
];

function getEffectiveStatus(task: VideoTask): EffectiveStatus {
  // Gallery fallback: if video_url exists but status wasn't updated (DB update failed), treat as completed
  if (task.status === 'completed' || (task.mode === 'gallery' && task.video_url)) return 'completed';
  if (task.status === 'failed' || task.status === 'cancelled') return 'failed';
  const elapsed = getElapsedMinutes(task.created_at);
  if (elapsed > 30) return 'failed'; // timeout treated as failed for better UX
  return 'processing';
}

const MODE_ICONS = {
  text: Film,
  image: Image,
  remix: Wand2,
  gallery: Image,
  audio: Music,
  batch: ListOrdered,
};

const MODE_LABELS: Record<string, string> = {
  text: '文生视频',
  image: '图生视频',
  audio: '音频生成视频',
  batch: '分段视频',
  remix: '视频Remix',
  gallery: '图片轮播视频',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: '等待中', className: 'bg-muted text-muted-foreground' },
  queued: { label: '排队中', className: 'bg-muted text-muted-foreground' },
  started: { label: '已开始', className: 'bg-info/20 text-info' },
  in_progress: { label: '生成中', className: 'bg-primary/20 text-primary' },
  synthesizing_video: { label: '视频合成中', className: 'bg-primary/20 text-primary' },
  completed: { label: '已完成', className: 'bg-success/20 text-success' },
  failed: { label: '失败', className: 'bg-destructive/20 text-destructive' },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
};

/** Calculate how long a task has been running */
function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

/** Format date with yyyy-MM-dd HH:mm:ss */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EffectiveStatus | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<VideoTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const data = await listVideoTasks(50);
      setTasks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '加载失败';
      toast.error(`加载失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Auto-refresh every 5s when there are incomplete tasks
  useEffect(() => {
    const hasIncomplete = tasks.some((t) => !['completed', 'failed', 'cancelled'].includes(t.status));
    if (!hasIncomplete) return;
    const timer = setInterval(() => {
      loadTasks();
    }, 5000);
    return () => clearInterval(timer);
  }, [tasks]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVideoTask(deleteTarget.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id && t.parent_id !== deleteTarget.id));
      toast.success('已删除');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      toast.error(`删除失败: ${msg}`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast.success('下载已开始');
    } catch {
      toast.error('下载失败，请直接右键保存');
      window.open(url, '_blank');
    }
  };

  /** Return human-readable status hint */
  const getStatusHint = (task: VideoTask): string => {
    const elapsed = getElapsedMinutes(task.created_at);
    if (elapsed > 30 && !['completed', 'failed', 'cancelled'].includes(task.status)) {
      return '任务已超时（超过30分钟未完成），建议重新创作';
    }
    if (task.status === 'pending') {
      return '任务已提交，等待调度中';
    }
    if (task.status === 'queued') {
      if (task.queue_position && task.queue_total) {
        return `排在 ${task.queue_position}/${task.queue_total} 位`;
      }
      return '任务排队中，请稍候';
    }
    if (task.status === 'in_progress' || task.status === 'started') {
      if (task.estimated_seconds_remaining && task.estimated_seconds_remaining > 0) {
        const min = Math.ceil(task.estimated_seconds_remaining / 60);
        return `生成中，预计还需约 ${min} 分钟`;
      }
      if (elapsed > 60) return '生成时间较长，请耐心等待，如超过2小时建议查看详情';
      return '视频生成中，请稍候';
    }
    if (task.status === 'synthesizing_video') {
      if (elapsed > 30) {
        return '视频合成超时（超过30分钟），可能已中断，建议进入图片管理页面重新生成';
      }
      if (elapsed > 10) {
        return `视频已合成 ${elapsed} 分钟，如浏览器页面被关闭或刷新可能导致中断，建议进入图片管理页面检查`;
      }
      return '视频正在浏览器中合成渲染，请保持页面打开，完成后可下载';
    }
    if (task.status === 'failed') {
      if (task.mode === 'gallery' && task.tts_audio_url) {
        return `${task.error_message || '视频合成失败'}，可进入图片管理手动合成`;
      }
      return task.error_message || '生成失败';
    }
    return '';
  };

  const handleRetry = async (task: VideoTask) => {
    if (task.mode === 'gallery') {
      // Gallery: navigate to gallery page for manual re-synthesis
      navigate(`/gallery/${task.id}`);
      return;
    }
    setRetryingId(task.id);
    try {
      let res: { videoId: string; status: string } | null = null;
      if (task.mode === 'text') {
        res = await startTextToVideo({ prompt: task.prompt, size: task.size, seconds: task.seconds });
      } else if (task.mode === 'image') {
        res = await startImageToVideo({ prompt: task.prompt, inputReferenceUrl: task.input_reference_url || undefined, size: task.size });
      } else if (task.mode === 'remix') {
        if (!task.remix_source_id) { toast.error('缺少源视频，无法重试'); return; }
        res = await startRemixVideo({ videoUrl: task.remix_source_id, prompt: task.prompt });
      }
      if (res) {
        await supabase.from('video_tasks').update({ video_id: res.videoId, status: res.status, error_message: null }).eq('id', task.id);
        toast.success('已重新提交生成');
        loadTasks();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '重试失败';
      toast.error(`重试失败: ${msg}`);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesTab = activeTab === 'all' || getEffectiveStatus(t) === activeTab;
    if (!searchQuery.trim()) return matchesTab;
    const q = searchQuery.trim().toLowerCase();
    return matchesTab && (
      t.prompt.toLowerCase().includes(q) ||
      MODE_LABELS[t.mode].includes(q) ||
      t.size.includes(q)
    );
  });

  const tabCounts = TAB_CONFIG.map((tab) => ({
    ...tab,
    count: tab.key === 'all' ? tasks.length : tasks.filter((t) => getEffectiveStatus(t) === tab.key).length,
  }));

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

      {/* Search + filter */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文案、模式、尺寸..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabCounts.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-sm border transition-colors ${
                activeTab === tab.key
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            该分类下暂无任务
          </div>
        )}
        {filteredTasks.map((task) => {
          const ModeIcon = MODE_ICONS[task.mode];
          const status = STATUS_BADGE[task.status] || { label: task.status, className: 'bg-muted text-muted-foreground' };
          const canView = task.status === 'completed' && task.video_url;
          const hint = getStatusHint(task);
          const isSub = task.parent_id !== null;
          const effStatus = getEffectiveStatus(task);

          const isGalleryManual = task.mode === 'gallery' && (task.status === 'failed' || task.status === 'in_progress' || task.status === 'started');
          const galleryClickable = task.mode === 'gallery' && task.status !== 'cancelled';

          return (
            <Card key={task.id} className="border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => {
                const targetId = task.parent_id || task.id;
                if (task.mode === 'gallery') {
                  // Gallery mode: always go to gallery management page
                  navigate(`/gallery/${targetId}`);
                } else if (canView) {
                  navigate(`/result/${targetId}`);
                } else if (!['completed', 'failed', 'cancelled'].includes(task.status)) {
                  navigate(`/progress/${targetId}`);
                }
              }}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
                  <ModeIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium truncate">{MODE_LABELS[task.mode]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-sm ${status.className}`}>{status.label}</span>
                    {isSub && (
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-500">
                        分段子视频 {task.segment_index + 1}/{task.total_segments}
                      </span>
                    )}

                    {isGalleryManual && (
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-warning/20 text-warning flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        可手动合成
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{task.prompt}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{task.size}</span>
                    <span>{task.seconds}秒{task.total_segments > 1 && `(${task.total_segments}段)`}</span>
                    <span>{task.audio_url ? '有配音' : '无配音'}</span>
                    <span>{formatDateTime(task.created_at)}</span>
                  </div>
                  {hint && (
                    <p className={`text-xs mt-1 ${task.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {hint}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(task);
                    }}
                    className="p-2 rounded-sm hover:bg-muted text-muted-foreground transition-colors"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {(task.status === 'failed' || task.status === 'cancelled') && !task.parent_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(task);
                      }}
                      disabled={retryingId === task.id}
                      className="p-2 rounded-sm hover:bg-muted text-primary transition-colors disabled:opacity-50"
                      title={task.mode === 'gallery' ? '进入图片管理重新合成' : '重新提交生成'}
                    >
                      {retryingId === task.id ? (
                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <RotateCw className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {task.status === 'completed' && task.video_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const filename = isSub
                          ? `segment-${task.segment_index + 1}-${task.id}.mp4`
                          : `video-${task.id}.mp4`;
                        handleDownload(task.video_url!, filename);
                      }}
                      className="p-2 rounded-sm hover:bg-muted text-primary transition-colors"
                      title="下载视频"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  {task.mode === 'gallery' && task.audio_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(task.audio_url!, `audio-${task.id}.mp3`);
                      }}
                      className="p-2 rounded-sm hover:bg-muted text-primary transition-colors"
                      title="下载原始语音"
                    >
                      <Headphones className="h-4 w-4" />
                    </button>
                  )}
                  {task.mode === 'gallery' && task.status === 'completed' && task.video_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/gallery/${task.id}`);
                      }}
                      className="p-2 rounded-sm hover:bg-muted text-primary transition-colors"
                      title="进入图片管理"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {canView || galleryClickable ? (
                    <div className="flex items-center justify-center w-8 h-8 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : task.status === 'failed' || task.status === 'cancelled' ? (
                    <span className="flex items-center justify-center w-8 h-8" aria-label="失败">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </span>
                  ) : (
                    <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条创作记录吗？{deleteTarget?.total_segments && deleteTarget.total_segments > 1 ? '将同时删除所有关联的分段子视频。' : ''}此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
