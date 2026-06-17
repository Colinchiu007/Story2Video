import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { getVideoTask, queryVideoGeneration, updateVideoTask, listChildTasks } from '@/services/video';
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

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [children, setChildren] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!id) return;
    stopped.current = false;
    loadTask();
    return () => {
      stopped.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [id]);

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
      if (!isMulti && t.video_id && !['completed', 'failed', 'cancelled'].includes(t.status)) {
        pollStatus(t.video_id, t.id);
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
        if (!child.video_id) {
          updatedChildren.push(child);
          allCompleted = false;
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

      const refreshed = await listChildTasks(parentId);
      if (stopped.current) return;
      setChildren(refreshed);
      pollTimer.current = setTimeout(() => pollMultiStatus(parentId, refreshed), POLL_INTERVAL);
    } catch (err) {
      if (stopped.current) return;
      pollTimer.current = setTimeout(() => pollMultiStatus(parentId, children), POLL_INTERVAL);
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
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive text-center">{error}</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回创作
        </Button>
      </div>
    );
  }

  const isMulti = (task?.total_segments ?? 1) > 1;
  const statusLabel = task ? (STATUS_LABELS[task.status] || task.status) : '';
  const isDone = task ? ['completed', 'failed', 'cancelled'].includes(task.status) : false;

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
              <AlertCircle className="h-5 w-5 text-destructive" />
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
              {task?.progress ?? 0}%
            </div>
            <div className="text-sm text-muted-foreground uppercase tracking-wider">{statusLabel}</div>
            <Progress value={task?.progress ?? 0} className="w-full h-2" />
          </div>

          {/* Details */}
          <div className="space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">任务ID</span>
              <span className="font-mono text-foreground truncate max-w-[200px]">{task?.video_id || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">创作模式</span>
              <span className="text-foreground">
                {task?.mode === 'text' ? '文生视频' : task?.mode === 'image' ? '图生视频' : '视频Remix'}
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
                <div key={child.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">片段 {child.segment_index + 1}</span>
                    <span className={child.status === 'completed' ? 'text-success' : child.status === 'failed' ? 'text-destructive' : 'text-primary'}>
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
            <div className="flex items-start gap-3 p-3 border border-destructive/30 bg-destructive/10 rounded-sm text-sm">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-destructive">{error}</span>
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
