import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, XCircle, CheckCircle2, ArrowLeft, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { getVideoTask, queryVideoGeneration, updateVideoTask, listChildTasks } from '@/services/video-generation';
import type { VideoTask } from '@/types';

const POLL_INTERVAL = 8000;
const STATUS_LABELS: Record<string, string> = {
  pending: '等待处理',
  queued: '排队中',
  started: '已开始',
  in_progress: '生成中',
  completed: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
};

const MODE_LABELS: Record<string, string> = {
  text: '文生视频',
  image: '图生视频',
  remix: '视频Remix',
  gallery: '图片轮播视频',
};

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [children, setChildren] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [galleryHint, setGalleryHint] = useState('');
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!id) return;
    stopped.current = false;
    loadTask();
    return () => {
      stopped.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (galleryTimer.current) clearInterval(galleryTimer.current);
    };
  }, [id]);

  // Gallery mode: simulate progress based on elapsed time since creation
  useEffect(() => {
    if (!task || task.mode !== 'gallery') return;
    if (['completed', 'failed', 'cancelled'].includes(task.status)) return;

    const updateGalleryProgress = () => {
      const elapsedSec = Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000);
      // Simulate 0% -> 90% over 3 minutes (180s)
      const progress = Math.min(90, Math.round((elapsedSec / 180) * 90));
      setSimulatedProgress(progress);

      // Dynamic hint based on elapsed time
      let hint = '';
      if (elapsedSec < 20) {
        hint = '正在合成语音，准备图片生成素材...';
      } else if (elapsedSec < 60) {
        hint = 'AI 正在根据文案生成图片，请稍候...';
      } else if (elapsedSec < 120) {
        hint = '图片生成进行中，即将合成轮播视频...';
      } else if (elapsedSec < 180) {
        hint = '正在合成最终视频并上传，马上完成...';
      } else if (elapsedSec < 300) {
        hint = '处理即将完成，正在做最后的确认...';
      } else {
        hint = '处理时间较长，任务仍在后台运行，您可返回继续创作，稍后从历史记录查看结果。';
      }
      setGalleryHint(hint);
    };

    updateGalleryProgress();
    galleryTimer.current = setInterval(updateGalleryProgress, 2000);
    return () => {
      if (galleryTimer.current) clearInterval(galleryTimer.current);
    };
  }, [task?.id, task?.mode, task?.status, task?.created_at]);

  const loadTask = async () => {
    if (!id) return;
    try {
      const t = await getVideoTask(id);
      if (!t) {
        setError('任务不存在');
        setLoading(false);
        return;
      }
      setTask(t);

      let childs: VideoTask[] = [];
      if (t.total_segments > 1) {
        childs = await listChildTasks(t.id);
        setChildren(childs);
      }
      setLoading(false);

      const isMulti = t.total_segments > 1;
      // Gallery fallback: if video_url exists but status wasn't updated to completed (DB update failed),
      // treat it as completed and navigate to result
      if (!isMulti && t.mode === 'gallery' && t.video_url) {
        navigate(`/result/${t.id}`, { replace: true });
        return;
      }
      if (!isMulti && t.video_id && !['completed', 'failed', 'cancelled'].includes(t.status)) {
        pollStatus(t.video_id, t.id);
      } else if (!isMulti && !t.video_id && !['completed', 'failed', 'cancelled'].includes(t.status)) {
        // No video_id (e.g. gallery mode processed locally): poll DB directly
        pollDbStatus(t.id);
      } else if (!isMulti && t.status === 'completed') {
        navigate(`/result/${t.id}`, { replace: true });
      } else if (isMulti) {
        pollMultiStatus(t.id, childs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      setError(msg);
      setLoading(false);
    }
  };

  const pollStatus = async (videoId: string, taskId: string) => {
    if (stopped.current) return;
    try {
      const data = await queryVideoGeneration(videoId);
      if (stopped.current) return;

      const updates: Partial<VideoTask> = {
        status: data.status,
        progress: data.progress ?? 0,
      };
      if (data.status === 'completed' && data.publicUrl) {
        updates.video_url = data.publicUrl;
        updates.completed_at = new Date().toISOString();
      }

      await updateVideoTask(taskId, updates);
      const updated = await getVideoTask(taskId);
      if (stopped.current) return;
      setTask(updated);

      if (data.status === 'completed') {
        toast.success('视频生成完成！');
        navigate(`/result/${taskId}`, { replace: true });
        return;
      }
      if (data.status === 'failed') {
        toast.error(`视频生成失败: ${data.error || '未知错误'}`);
        setError(`生成失败: ${data.error || '未知错误'}`);
        return;
      }
      if (data.status === 'cancelled') {
        toast.error('视频生成已取消');
        return;
      }

      pollTimer.current = setTimeout(() => pollStatus(videoId, taskId), POLL_INTERVAL);
    } catch (err) {
      if (stopped.current) return;
      pollTimer.current = setTimeout(() => pollStatus(videoId, taskId), POLL_INTERVAL);
    }
  };

  const pollMultiStatus = async (parentId: string, childTasks: VideoTask[]) => {
    if (stopped.current) return;
    try {
      const updatedChildren: VideoTask[] = [];
      let allCompleted = true;
      let anyFailed = false;
      let totalProgress = 0;

      for (const child of childTasks) {
        // Child already marked as failed (no video_id means creation failed)
        if (!child.video_id) {
          updatedChildren.push(child);
          if (child.status === 'failed') {
            anyFailed = true;
            totalProgress += 0;
          } else {
            allCompleted = false;
          }
          continue;
        }
        try {
          const data = await queryVideoGeneration(child.video_id);
          const updates: Partial<VideoTask> = {
            status: data.status,
            progress: data.progress ?? 0,
          };
          if (data.status === 'completed' && data.publicUrl) {
            updates.video_url = data.publicUrl;
            updates.completed_at = new Date().toISOString();
          }
          await updateVideoTask(child.id, updates);
          const updated = await getVideoTask(child.id);
          if (!updated) {
            updatedChildren.push(child);
            allCompleted = false;
            continue;
          }
          updatedChildren.push(updated);
          totalProgress += updated.progress ?? 0;
          if (!['completed', 'failed', 'cancelled'].includes(data.status)) {
            allCompleted = false;
          }
          if (data.status === 'failed') anyFailed = true;
        } catch {
          updatedChildren.push(child);
          allCompleted = false;
        }
      }

      setChildren(updatedChildren);
      const avgProgress = Math.round(totalProgress / Math.max(childTasks.length, 1));
      await updateVideoTask(parentId, { progress: avgProgress });
      const parentUpdated = await getVideoTask(parentId);
      if (stopped.current) return;
      setTask(parentUpdated);

      if (allCompleted) {
        if (anyFailed) {
          await updateVideoTask(parentId, { status: 'failed' });
          setTask(await getVideoTask(parentId));
          toast.error('部分片段生成失败');
          return;
        }
        await updateVideoTask(parentId, { status: 'completed', completed_at: new Date().toISOString() });
        setTask(await getVideoTask(parentId));
        toast.success('所有片段生成完成！');
        navigate(`/result/${parentId}`, { replace: true });
        return;
      }

      // If all children are failed (including those without video_id), stop polling
      const allChildrenFailed = updatedChildren.every((c) =>
        c.status === 'failed' || c.status === 'cancelled'
      );
      if (allChildrenFailed && childTasks.length > 0) {
        await updateVideoTask(parentId, { status: 'failed' });
        setTask(await getVideoTask(parentId));
        toast.error('所有片段生成均失败');
        return;
      }

      const refreshed = await listChildTasks(parentId);
      if (stopped.current) return;
      setChildren(refreshed);
      pollTimer.current = setTimeout(() => pollMultiStatus(parentId, refreshed), POLL_INTERVAL);
    } catch (err) {
      if (stopped.current) return;
      pollTimer.current = setTimeout(() => pollMultiStatus(parentId, children), POLL_INTERVAL);
    }
  };

  const pollDbStatus = async (taskId: string) => {
    if (stopped.current) return;
    try {
      const t = await getVideoTask(taskId);
      if (stopped.current) return;
      if (!t) return;
      setTask(t);

      // Gallery fallback: if video_url exists but status wasn't updated to completed (DB update failed)
      if (t.mode === 'gallery' && t.video_url) {
        navigate(`/result/${taskId}`, { replace: true });
        return;
      }

      if (t.status === 'completed') {
        navigate(`/result/${taskId}`, { replace: true });
        return;
      }
      if (t.status === 'failed') {
        toast.error(`生成失败: ${t.error_message || '未知错误'}`);
        setError(`生成失败: ${t.error_message || '未知错误'}`);
        return;
      }
      if (t.status === 'cancelled') {
        toast.error('任务已取消');
        return;
      }

      pollTimer.current = setTimeout(() => pollDbStatus(taskId), POLL_INTERVAL);
    } catch (err) {
      if (stopped.current) return;
      pollTimer.current = setTimeout(() => pollDbStatus(taskId), POLL_INTERVAL);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-1">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground">任务可能已被删除或出现了网络问题</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回创作
          </Button>
          <Button variant="outline" onClick={() => navigate('/history')}>
            <Clock className="h-4 w-4 mr-2" />
            查看历史
          </Button>
        </div>
      </div>
    );
  }

  const isMulti = (task?.total_segments ?? 1) > 1;
  const statusLabel = task ? (STATUS_LABELS[task.status] || task.status) : '';
  const isDone = task ? ['completed', 'failed', 'cancelled'].includes(task.status) : false;
  const displayProgress = task?.mode === 'gallery' && !isDone ? simulatedProgress : (task?.progress ?? 0);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto animate-fade-in">
      <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回创作
      </Button>

      <Card className="border border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-3">
            {task?.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : task?.status === 'failed' || task?.status === 'cancelled' ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
            任务状态
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status display */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-4xl md:text-5xl font-bold tabular-nums text-foreground">
              {displayProgress}%
            </div>
            <div className="text-sm text-muted-foreground uppercase tracking-wider">{statusLabel}</div>
            <Progress value={displayProgress} className="w-full h-2" />

            {/* Queue position / estimated time hints */}
            {!isDone && (
              <div className="text-xs text-muted-foreground text-center space-y-1 max-w-xs">
                {task?.queue_position && task?.queue_total && task.queue_total > 1 && (
                  <p className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    排队位置：{task.queue_position} / {task.queue_total}
                  </p>
                )}
                {task?.estimated_seconds_remaining && task.estimated_seconds_remaining > 0 && (
                  <p>预计剩余约 {Math.ceil(task.estimated_seconds_remaining / 60)} 分钟</p>
                )}
                {/* Gallery dynamic hint */}
                {task?.mode === 'gallery' && galleryHint && (
                  <p className="text-primary/80">{galleryHint}</p>
                )}
                {task?.status === 'pending' && task?.mode !== 'gallery' && (
                  <p>任务已提交，正在等待调度</p>
                )}
                {task?.status === 'in_progress' && task?.mode !== 'gallery' && (!task?.estimated_seconds_remaining) && (
                  <p>视频生成中，通常需要 3-10 分钟</p>
                )}
              </div>
            )}
          </div>

          {/* Background processing hint */}
          {!isDone && (
            <div className="text-xs text-center text-muted-foreground bg-muted/30 rounded-sm p-3 border border-border/50">
              <p>任务可以在后台处理，之后可以在历史任务中查看。</p>
              <p>您可以返回继续创作。</p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">任务ID</span>
              <span className="font-mono text-foreground truncate max-w-[200px]">{task?.video_id || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">创作模式</span>
              <span className="text-foreground">
                {task?.mode ? (MODE_LABELS[task.mode] || task.mode) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">分辨率</span>
              <span className="text-foreground">{task?.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">时长</span>
              <span className="text-foreground">{task?.seconds} 秒 {isMulti && `（${task?.total_segments} 个片段）`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">语音合成</span>
              <span className="text-foreground">{task?.audio_url ? '已添加' : '无'}</span>
            </div>
          </div>

          {/* Segment progress */}
          {isMulti && children.length > 0 && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="text-sm font-medium">片段进度</div>
              {children.map((child) => (
                <div key={child.id} className="space-y-1.5 p-2.5 border border-border rounded-sm bg-muted/10">
                  <div className="flex justify-between text-xs items-start">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">分段子视频 {child.segment_index + 1}/{child.total_segments}</span>
                      {child.segment_text && (
                        <p className="text-muted-foreground truncate mt-0.5">{child.segment_text}</p>
                      )}
                      {child.video_url && (
                        <a
                          href={child.video_url}
                          download={`segment-${child.segment_index + 1}.mp4`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline mt-0.5 inline-block"
                        >
                          下载此片段
                        </a>
                      )}
                    </div>
                    <span className={child.status === 'completed' ? 'text-success shrink-0 ml-2' : child.status === 'failed' ? 'text-destructive shrink-0 ml-2' : 'text-primary shrink-0 ml-2'}>
                      {STATUS_LABELS[child.status] || child.status} {child.progress ?? 0}%
                    </span>
                  </div>
                  <Progress value={child.progress ?? 0} className="h-1.5" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-3 p-4 border border-destructive/30 bg-destructive/10 rounded-sm">
              <div className="flex items-start gap-3 text-sm">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-destructive">{error}</span>
              </div>
              <div className="flex gap-2 pl-7">
                <Button size="sm" variant="outline" onClick={() => navigate('/history')}>
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  去历史记录重试
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  重新创作
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isDone && task?.status === 'completed' && (
              <Button onClick={() => navigate(`/result/${task.id}`)} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                查看结果
              </Button>
            )}
            {isDone && (
              <Button variant="outline" onClick={() => navigate('/')} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                重新创作
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
