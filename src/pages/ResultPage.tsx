import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, RefreshCw, Film, AlertCircle, Clapperboard, Edit3, Save, X, Wand2, Scissors, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getVideoTask, listChildTasks, updateVideoTask, startTextToVideo, startImageToVideo, startRemixVideo, publishVideo } from '@/services/video-generation';
import { getSubtitleStyleClasses } from '@/components/SubtitleSettings';
import ShareButton from '@/components/ShareButton';
import VideoClipEditor from '@/components/VideoClipEditor';
import type { VideoTask } from '@/types';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [children, setChildren] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [clipVideoUrl, setClipVideoUrl] = useState<string | null>(null);
  const [clipEditorOpen, setClipEditorOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishPlatform, setPublishPlatform] = useState<'bilibili' | 'douyin'>('bilibili');

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

  const handlePublish = async () => {
    if (!task?.video_url) return;
    setPublishing(true);
    setPublishError('');
    setPublishSuccess(null);
    try {
      const videoUrl = task.video_url;
      const coverUrl = task.input_reference_url || undefined;
      const result = await publishVideo({
        videoUrl,
        title: task.prompt || '视频',
        platform: publishPlatform,
        desc: task.prompt || '',
        coverUrl,
      });
      const platformLabel = publishPlatform === 'bilibili' ? 'B站' : '抖音';
      setPublishSuccess(`已发布到 ${platformLabel}！任务ID: ${result.taskId}`);
      toast.success(`视频已提交到 ${platformLabel} 发布队列`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发布失败';
      setPublishError(msg);
      toast.error(msg);
    } finally {
      setPublishing(false);
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

  const handleEditSegment = (child: VideoTask) => {
    setEditingChildId(child.id);
    setEditText(child.prompt);
  };

  const handleSaveSegmentEdit = async (childId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      toast.error('文案不能为空');
      return;
    }
    try {
      await updateVideoTask(childId, { prompt: trimmed });
      setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, prompt: trimmed } : c)));
      setEditingChildId(null);
      toast.success('文案已保存');
    } catch (err) {
      toast.error('保存失败');
    }
  };

  const handleRegenerateSegment = async (child: VideoTask) => {
    setRegeneratingId(child.id);
    try {
      let res: { videoId: string; status: string };
      if (task?.mode === 'text') {
        res = await startTextToVideo({ prompt: child.prompt, size: child.size, seconds: child.seconds });
      } else if (task?.mode === 'image') {
        res = await startImageToVideo({ prompt: child.prompt, inputReferenceUrl: child.input_reference_url || undefined, size: child.size });
      } else {
        if (!task?.remix_source_id) throw new Error('缺少源视频ID');
        res = await startRemixVideo({ videoId: task.remix_source_id, prompt: child.prompt });
      }
      await updateVideoTask(child.id, { video_id: res.videoId, status: res.status });
      setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, video_id: res.videoId, status: res.status } : c)));
      toast.success('重新生成任务已提交');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '重新生成失败';
      toast.error(msg);
    } finally {
      setRegeneratingId(null);
    }
  };

  const renderVideoPlayer = (t: VideoTask, label?: string, isChild = false) => (
    <div key={t.id} className="w-full bg-black rounded-sm overflow-hidden">
      {label && (
        <div className="bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground border-b border-border flex items-center gap-1.5">
          <Clapperboard className="h-3 w-3 text-primary" />
          {label}
        </div>
      )}
      <div className="relative">
        <video
          src={t.video_url || undefined}
          controls
          className="w-full max-h-[55vh]"
          poster={t.input_reference_url || undefined}
        >
          您的浏览器不支持视频播放
        </video>
        {/* Subtitle overlay */}
        {task?.subtitle_enabled && isChild && t.segment_text && (
          <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
            <span
              className={`inline-block ${getSubtitleStyleClasses(task).className}`}
              style={{ fontSize: getSubtitleStyleClasses(task).fontSize }}
            >
              {t.segment_text}
            </span>
          </div>
        )}
      </div>
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
              .sort((a, b) => a.segment_index - b.segment_index)
              .map((child) => (
                <div key={child.id} className="border border-border rounded-sm overflow-hidden bg-card">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clapperboard className="h-4 w-4 text-primary" />
                      片段 {child.segment_index + 1}/{child.total_segments}
                    </div>
                    <div className="flex items-center gap-1">
                      {editingChildId === child.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleSaveSegmentEdit(child.id)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-muted-foreground"
                            onClick={() => setEditingChildId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleEditSegment(child)}
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            编辑文案
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-primary"
                            disabled={regeneratingId === child.id}
                            onClick={() => handleRegenerateSegment(child)}
                          >
                            <Wand2 className="h-3.5 w-3.5 mr-1" />
                            {regeneratingId === child.id ? '生成中...' : '重新生成'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Segment text editor */}
                  {editingChildId === child.id ? (
                    <div className="p-3 border-b border-border">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="bg-background border-border resize-none text-sm"
                        placeholder="输入新的视频描述文案..."
                      />
                    </div>
                  ) : (
                    child.prompt && (
                      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border bg-muted/10">
                        {child.prompt}
                      </div>
                    )
                  )}
                  {/* Video */}
                  {child.video_url && renderVideoPlayer(child, undefined, true)}
                  {!child.video_url && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      {child.status === 'pending' || child.status === 'processing'
                        ? '视频生成中...'
                        : child.status === 'failed'
                          ? '生成失败，点击「重新生成」重试'
                          : '等待生成...'}
                    </div>
                  )}
                </div>
              ))
          ) : (
            task?.video_url && renderVideoPlayer(task)
          )}

          {/* Audio Player & Download if exists */}
          {task?.audio_url && (
            <div className="px-4 md:px-6 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">配音音频</span>
                <button
                  onClick={() => handleDownload(task.audio_url!, `audio-${task.id}.mp3`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  下载 MP3
                </button>
              </div>
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
              {task?.bgm_enabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">背景音乐</span>
                  <span className="text-foreground">音量 {task.bgm_volume}/10</span>
                </div>
              )}
              {task?.subtitle_enabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">字幕</span>
                  <span className="text-foreground">已开启</span>
                </div>
              )}
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
              {task?.video_url && (
                <div className="flex gap-2 flex-1">
                  <select
                    value={publishPlatform}
                    onChange={(e) => setPublishPlatform(e.target.value as 'bilibili' | 'douyin')}
                    className="h-11 px-2 text-sm rounded-md border border-input bg-background shrink-0"
                    disabled={publishing || !!publishSuccess}
                  >
                    <option value="bilibili">B站</option>
                    <option value="douyin">抖音</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex-1 h-11"
                  >
                    {publishing ? (
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                    ) : publishSuccess ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {publishing ? '发布中...' : publishSuccess ? '已发布' : `发布到${publishPlatform === 'bilibili' ? 'B站' : '抖音'}`}
                  </Button>
                </div>
              )}
              {publishError && (
                <p className="text-xs text-destructive px-1">{publishError}</p>
              )}
              {task?.video_url && (
                <ShareButton
                  url={task.video_url}
                  title={task.prompt}
                  className="h-11"
                  variant="outline"
                />
              )}
              {task?.video_url && !isMulti && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setClipVideoUrl(task?.video_url || null);
                    setClipEditorOpen(true);
                  }}
                  className="flex-1 h-11"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  剪辑
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Clip Editor */}
      {clipVideoUrl && (
        <VideoClipEditor
          videoUrl={clipVideoUrl}
          videoTitle={task?.prompt || ''}
          open={clipEditorOpen}
          onOpenChange={setClipEditorOpen}
        />
      )}
    </div>
  );
}
