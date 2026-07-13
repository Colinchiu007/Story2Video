import { useState, useRef, useCallback } from 'react';
import { extractErrorMessage } from '@/services/api-config';

export interface VideoClipResult {
  blob: Blob;
  url: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface UseVideoClipReturn {
  startTime: number;
  endTime: number;
  duration: number;
  isClipping: boolean;
  progress: number;
  error: string | null;
  clipResult: VideoClipResult | null;
  setStartTime: (time: number) => void;
  setEndTime: (time: number) => void;
  setDuration: (duration: number) => void;
  clipVideo: (videoUrl: string) => Promise<VideoClipResult>;
  reset: () => void;
  clearResult: () => void;
}

function getSupportedMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.64001F,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

export function useVideoClip(): UseVideoClipReturn {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clipResult, setClipResult] = useState<VideoClipResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
    setIsClipping(false);
    setProgress(0);
    setError(null);
    setClipResult(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearResult = useCallback(() => {
    setClipResult(null);
  }, []);

  const clipVideo = useCallback(async (videoUrl: string): Promise<VideoClipResult> => {
    if (startTime >= endTime) {
      throw new Error('开始时间必须小于结束时间');
    }
    if (endTime > duration) {
      throw new Error('结束时间不能超过视频时长');
    }

    setIsClipping(true);
    setProgress(0);
    setError(null);
    setClipResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Fetch the video blob
      const response = await fetch(videoUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('无法获取视频文件');
      const videoBlob = await response.blob();

      // Create video element for seeking
      const video = document.createElement('video');
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';

      const videoLoaded = new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('视频加载失败'));
        const timeout = setTimeout(() => reject(new Error('视频加载超时')), 30000);
        video.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });

      video.src = URL.createObjectURL(videoBlob);
      await videoLoaded;

      const clipDuration = endTime - startTime;
      const mimeType = getSupportedMimeType();
      const chunks: Blob[] = [];

      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;

      // Set up MediaRecorder
      const canvasStream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });

      const recordingDone = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        mediaRecorder.onerror = () => reject(new Error('录制失败'));
      });

      // Seek to start and begin recording
      video.currentTime = startTime;

      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        if (Math.abs(video.currentTime - startTime) < 0.05) resolve();
      });

      mediaRecorder.start();
      video.play();

      const startRealTime = performance.now();
      let lastReport = 0;

      const frameLoop = () => {
        if (controller.signal.aborted) {
          video.pause();
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          return;
        }

        const elapsed = video.currentTime - startTime;
        const pct = Math.min(100, Math.round((elapsed / clipDuration) * 100));
        if (pct !== lastReport) {
          setProgress(pct);
          lastReport = pct;
        }

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (video.currentTime >= endTime || elapsed >= clipDuration) {
          video.pause();
          mediaRecorder.stop();
          return;
        }

        // Safety timeout: real-world elapsed exceeds 2x clip duration
        if (performance.now() - startRealTime > clipDuration * 2000 + 5000) {
          video.pause();
          mediaRecorder.stop();
          return;
        }

        requestAnimationFrame(frameLoop);
      };

      requestAnimationFrame(frameLoop);

      const blob = await recordingDone;
      const url = URL.createObjectURL(blob);

      const result: VideoClipResult = {
        blob,
        url,
        startTime,
        endTime,
        duration: clipDuration,
      };

      setClipResult(result);
      setProgress(100);
      setIsClipping(false);

      return result;
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '剪辑已取消'
        : extractErrorMessage(err);
      setError(msg);
      setIsClipping(false);
      throw err;
    }
  }, [startTime, endTime, duration]);

  return {
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
  };
}
