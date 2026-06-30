import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Upload, Loader2, CheckCircle, XCircle, Globe, Clock } from 'lucide-react';
import { publishVideo, pollPublishStatus, PLATFORMS, type Platform, type PlatformMeta, type PublishProgress } from '@/services/orchestrator-api';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  taskTitle: string;
}

type PublishPhase = 'idle' | 'publishing' | 'success' | 'failed';

/** Return a datetime-local value string for "now" (local time, min granularity). */
function nowLocalDateTimeString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function PublishDialog({ open, onOpenChange, videoUrl, taskTitle }: PublishDialogProps) {
  const [platform, setPlatform] = useState<Platform>('bilibili');
  const [title, setTitle] = useState(taskTitle);
  const [desc, setDesc] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [phase, setPhase] = useState<PublishPhase>('idle');
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [error, setError] = useState('');
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  // Reset state when dialog opens
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setTimeout(() => {
        setPhase('idle');
        setProgress(null);
        setError('');
        setDesc('');
        setTagsStr('');
        setPlatform('bilibili');
        setScheduleMode(false);
        setScheduledDate('');
      }, 200);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  // Sync title when taskTitle changes
  React.useEffect(() => {
    if (open) {
      setTitle(taskTitle);
    }
  }, [taskTitle, open]);

  const handlePublish = useCallback(async () => {
    if (!videoUrl || !title.trim()) return;

    setPhase('publishing');
    setError('');

    const tags = tagsStr
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    let scheduledAt: string | undefined;
    if (scheduleMode && scheduledDate) {
      // Convert local datetime-local to ISO 8601 with timezone offset
      const d = new Date(scheduledDate);
      if (!isNaN(d.getTime())) {
        scheduledAt = d.toISOString();
      }
    }

    const result = await publishVideo({
      video_url: videoUrl,
      title: title.trim(),
      platform,
      desc: desc.trim(),
      tags,
      scheduled_at: scheduledAt,
    });

    if (!result.success || !result.task_id) {
      setPhase('failed');
      setError(result.error || '发布请求失败');
      return;
    }

    // Start polling
    await pollPublishStatus(
      result.task_id,
      (p) => {
        setProgress(p);
        if (p.status === 'success') {
          setPhase('success');
        } else if (p.status === 'failed') {
          setPhase('failed');
          setError(p.error || '发布失败');
        }
      },
    );
  }, [videoUrl, title, platform, desc, tagsStr, scheduleMode, scheduledDate]);

  const platformMeta = PLATFORMS.find((p) => p.key === platform);
  const platformLabel = platformMeta?.label || platform;

  // Format scheduled time for display
  const formattedSchedule = React.useMemo(() => {
    if (!progress?.output?.scheduled_at) return '';
    const d = new Date(progress.output.scheduled_at as string);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [progress]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            发布视频
          </DialogTitle>
          <DialogDescription>
            将视频发布到第三方平台（视频将上传到云端服务器进行处理）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Platform Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">选择平台</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p: PlatformMeta) => (
                <Button
                  key={p.key}
                  type="button"
                  variant={platform === p.key ? 'default' : 'outline'}
                  className={'flex-1 min-w-[100px] relative ' + (p.disabled ? 'opacity-50 cursor-not-allowed' : '')}
                  onClick={() => { if (!p.disabled) setPlatform(p.key); }}
                  disabled={phase !== 'idle'}
                  title={p.comingSoon ? '即将支持' : p.desc}
                >
                  <Globe className="h-4 w-4 mr-1.5" />
                  {p.label}
                  {p.comingSoon && (
                    <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-4 leading-none">
                      <Clock className="h-2.5 w-2.5 mr-0.5 inline" />
                      即将
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="publish-title" className="text-sm font-medium">
              视频标题
            </Label>
            <Input
              id="publish-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入视频标题"
              maxLength={80}
              disabled={phase !== 'idle'}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{title.length}/80</p>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="publish-desc" className="text-sm font-medium">
              视频简介
            </Label>
            <Textarea
              id="publish-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="选填，视频描述或简介"
              rows={3}
              disabled={phase !== 'idle'}
              className="mt-1 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="publish-tags" className="text-sm font-medium">
              标签
            </Label>
            <Input
              id="publish-tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="用逗号分隔，如：AI视频, 科技, 创意"
              disabled={phase !== 'idle'}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">最多 12 个标签，留空则不添加</p>
          </div>

          {/* ── Scheduled publishing ── */}
          <div className="rounded-sm border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="schedule-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                定时发布
              </Label>
              <Switch
                id="schedule-toggle"
                checked={scheduleMode}
                onCheckedChange={setScheduleMode}
                disabled={phase !== 'idle'}
              />
            </div>
            {scheduleMode && (
              <div>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={nowLocalDateTimeString()}
                  disabled={phase !== 'idle'}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">设置视频自动发布时间（本地时间）</p>
              </div>
            )}
          </div>

          {/* Progress / Status */}
          {phase === 'publishing' && (
            <div className="space-y-3 rounded-sm border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm">
                {progress?.status === 'scheduled' ? (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="font-medium">
                  {progress?.status === 'scheduled' ? '等待定时发布...' : '发布中...'}
                </span>
              </div>
              {progress && progress.status !== 'scheduled' && (
                <>
                  <Progress value={progress.percent} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{progress.message}</p>
                </>
              )}
              {progress?.status === 'scheduled' && formattedSchedule && (
                <p className="text-xs text-muted-foreground">
                  预定发布时间: {formattedSchedule}
                </p>
              )}
              {!progress && (
                <p className="text-xs text-muted-foreground">正在连接到 orchestrator...</p>
              )}
            </div>
          )}

          {phase === 'success' && (
            <div className="rounded-sm border border-success/30 bg-success/5 p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">发布成功</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  视频已提交到 {platformLabel}，可在该平台查看发布状态。
                  {progress?.output?.publish_id && (
                    <span className="block mt-0.5">发布 ID: {progress.output.publish_id as string}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {phase === 'failed' && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">发布失败</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error || '未知错误，请重试'}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={phase === 'publishing'}
            >
              取消
            </Button>
            {phase !== 'success' ? (
              <Button
                className="flex-1"
                onClick={handlePublish}
                disabled={
                  phase === 'publishing' || !videoUrl || !title.trim() ||
                  (platformMeta?.disabled ?? false) ||
                  (scheduleMode && !scheduledDate)
                }
              >
                {phase === 'publishing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    发布中
                  </>
                ) : (
                  <>
                    {scheduleMode ? <Clock className="h-4 w-4 mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                    {platformMeta?.comingSoon ? '即将支持' : scheduleMode ? '定时发布' : `发布到 ${platformLabel}`}
                  </>
                )}
              </Button>
            ) : (
              <Button className="flex-1" variant="default" onClick={() => handleOpenChange(false)}>
                完成
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
