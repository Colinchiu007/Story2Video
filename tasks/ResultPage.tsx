import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, RefreshCw, Film, AlertCircle, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getVideoTask, listChildTasks } from '@/services/video';
import type { VideoTask } from '@/types';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [children, setChildren] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadTask();
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
      if (t.total_segments > 1) {
        const childs = await listChildTasks(t.id);
        setChildren(childs);
      }
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      setError(msg);
      setLoading(false);
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
      toast.error('下载失败，请直接右键视频保存');
      window.open(url, '_blank');
    }
  };

  const renderVideoPlayer = (t: VideoTask, label?: string) => (
    <div key={t.id} className="w-full bg-black rounded-sm overflow-hidden">
      {label && (
        <div className="bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground border-b border-border flex items-center gap-1.5">
          <Clapperboard className="h-3 w-3 text-primary" />
          {label}
        </div>
      )}
      <video
        src={t.video_url || undefined}
        controls
        className="w-full max-h-[55vh]"
        poster={t.input_reference_url || undefined}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isMulti = (task?.total_segments ?? 1) > 1;
  const hasVideos = isMulti
    ? children.some((c) => c.video_url)
    : !!task?.video_url;

  if (error && !hasVideos) {
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

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回创作
      </Button>

      <Card className="border border-border bg-card overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            生成结果
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-2">
          {/* Multi-segment videos */}
          {isMulti ? (
            children
              .filter((c) => c.video_url)
              .sort((a, b) => a.segment_index - b.segment_index)
              .map((child) => renderVideoPlayer(child, `片段 ${child.segment_index + 1}/${child.total_segments}`))
          ) : (
            task?.video_url && renderVideoPlayer(task)
          )}

          {/* Audio Player if exists */}
          {task?.audio_url && (
            <div className="px-4 md:px-6 pt-4">
              <div className="text-sm text-muted-foreground mb-2">配音音频</div>
              <audio src={task.audio_url} controls className="w-full" />
            </div>
          )}

          {/* Info & Actions */}
          <div className="p-4 md:p-6 space-y-4">
            <div className="space-y-2 text-sm">
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
                <span className="text-muted-foreground">创建时间</span>
                <span className="text-foreground">{task?.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">完成时间</span>
                <span className="text-foreground">{task?.completed_at ? new Date(task.completed_at).toLocaleString('zh-CN') : '-'}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-border">
              {isMulti ? (
                <Button
                  onClick={() => {
                    children
                      .filter((c) => c.video_url)
                      .sort((a, b) => a.segment_index - b.segment_index)
                      .forEach((child, idx) => {
                        handleDownload(child.video_url!, `video-${task?.id}-part${idx + 1}.mp4`);
                      });
                  }}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载全部片段
                </Button>
              ) : (
                <Button
                  onClick={() => handleDownload(task?.video_url || '', `video-${task?.video_id || task?.id}.mp4`)}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载视频
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1 h-11"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重新创作
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
