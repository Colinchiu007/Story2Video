import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Scissors, Play, Pause, Download, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useVideoClip } from '@/hooks/useVideoClip';

interface VideoClipEditorProps {
  videoUrl: string;
  videoTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClipComplete?: (clipUrl: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
}

export default function VideoClipEditor({
  videoUrl,
  videoTitle,
  open,
  onOpenChange,
  onClipComplete,
}: VideoClipEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    startTime,
    endTime,
    duration,
    isClipping,
    progress,
    error,
    clipResult,
    setStartTime,
    setEndTime,
    setDuration,
    clipVideo,
    reset,
    clearResult,
  } = useVideoClip();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize duration and end time when video metadata loads
  const handleMetadataLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    setDuration(dur);
    if (endTime === 0 || endTime > dur) {
      setEndTime(dur);
    }
  }, [setDuration, setEndTime, endTime]);

  // Sync current time with video playback
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  // Handle slider change
  const handleRangeChange = useCallback((values: number[]) => {
    const [newStart, newEnd] = values;
    setStartTime(newStart);
    setEndTime(newEnd);

    // Seek video to start time for preview
    const video = videoRef.current;
    if (video) {
      video.currentTime = newStart;
    }
  }, [setStartTime, setEndTime]);

  // Handle clip action
  const handleClip = useCallback(async () => {
    try {
      const result = await clipVideo(videoUrl);
      setShowPreview(true);
      onClipComplete?.(result.url);
    } catch {
      // Error is handled by the hook
    }
  }, [clipVideo, videoUrl, onClipComplete]);

  // Close handler - reset state
  const handleClose = useCallback(() => {
    reset();
    setIsPlaying(false);
    setCurrentTime(0);
    setShowPreview(false);
    onOpenChange(false);
  }, [reset, onOpenChange]);

  // Download clipped video
  const handleDownload = useCallback(() => {
    if (!clipResult) return;
    const a = document.createElement('a');
    a.href = clipResult.url;
    a.download = `clip-${videoTitle || 'video'}-${formatTime(startTime)}-${formatTime(endTime)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [clipResult, videoTitle, startTime, endTime]);

  // Preview the clipped result
  const handlePreviewClip = useCallback(() => {
    setShowPreview(true);
  }, []);

  const clipDuration = Math.max(0, endTime - startTime);
  const hasValidRange = clipDuration > 0.5 && endTime <= duration;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            视频剪辑
          </DialogTitle>
          <DialogDescription>
            选择视频片段的开始和结束时间，裁剪出你需要的部分
            {videoTitle && <span className="block text-xs text-muted-foreground mt-1">{videoTitle}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Preview */}
          <div className="bg-black rounded-sm overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleMetadataLoaded}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full max-h-[40vh]"
              controls={false}
              preload="auto"
            />
          </div>

          {/* Play/Pause controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) {
                  video.play();
                } else {
                  video.pause();
                }
              }}
              className="p-2 rounded-sm hover:bg-muted transition-colors"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Range Slider */}
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">裁剪范围</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                选中 {formatTime(clipDuration)}
              </span>
            </div>
            <Slider
              value={[startTime, endTime]}
              onValueChange={handleRangeChange}
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              disabled={isClipping}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>开始: {formatTime(startTime)}</span>
              <span>结束: {formatTime(endTime)}</span>
            </div>
          </div>

          {/* Clip result preview */}
          {clipResult && showPreview && (
            <div className="border border-border rounded-sm overflow-hidden">
              <div className="bg-muted/20 px-3 py-1.5 text-xs font-medium flex items-center justify-between">
                <span>剪辑结果</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3 mr-1" />
                  下载片段
                </Button>
              </div>
              <video
                src={clipResult.url}
                controls
                className="w-full max-h-[30vh]"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-sm text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Clipping progress */}
          {isClipping && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>正在剪辑视频...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 justify-end pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" />
              取消
            </Button>
            <Button
              size="sm"
              disabled={!hasValidRange || isClipping}
              onClick={handleClip}
              className="min-w-[100px]"
            >
              {isClipping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  剪辑中...
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4 mr-1" />
                  裁剪视频
                </>
              )}
            </Button>
            {clipResult && (
              <Button size="sm" variant="secondary" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
