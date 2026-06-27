import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Play, Film, Download, Wand2, Image, ImageOff, CheckCircle, Volume2, Clock, Upload, Plus, Trash2, Layers, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { listGalleryImages, updateGalleryImage, createGalleryImage, deleteGalleryImage } from '@/services/gallery';
import { startImageGeneration, queryImageGeneration } from '@/services/image-generation';
import { createSlideshowVideo, mapSubtitleStyle, getVideoExtension } from '@/lib/slideshow';
import { buildSubtitleTimelineV2 } from '@/lib/text-segmentation';
import type { GalleryImage, VideoTask } from '@/types';
import type { SubtitleSegment } from '@/lib/slideshow';

const REGENERATING_STORAGE_KEY = 'gallery_regenerating_tasks';

interface RegeneratingTask {
  imageId: string;
  taskId: string;
  prompt: string;
  originalPrompt: string;
  timestamp: number;
}

function readRegeneratingTasks(): RegeneratingTask[] {
  try {
    const raw = sessionStorage.getItem(REGENERATING_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RegeneratingTask[];
  } catch {
    return [];
  }
}

function writeRegeneratingTasks(tasks: RegeneratingTask[]): void {
  sessionStorage.setItem(REGENERATING_STORAGE_KEY, JSON.stringify(tasks));
}

function addRegeneratingTask(task: RegeneratingTask): void {
  const tasks = readRegeneratingTasks().filter((t) => t.imageId !== task.imageId);
  tasks.push(task);
  writeRegeneratingTasks(tasks);
}

function removeRegeneratingTask(imageId: string): void {
  const tasks = readRegeneratingTasks().filter((t) => t.imageId !== imageId);
  writeRegeneratingTasks(tasks);
}

/** Minutes elapsed since task creation */
function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusHint, setVideoStatusHint] = useState('');
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [regenerateProgress, setRegenerateProgress] = useState<Record<string, number>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editImage, setEditImage] = useState<GalleryImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editOriginalPrompt, setEditOriginalPrompt] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isReplacingImage, setIsReplacingImage] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const pendingGenerateRef = useRef<(() => Promise<void>) | null>(null);
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Warn user when leaving page during video synthesis
  useEffect(() => {
    if (!isGeneratingVideo) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '视频正在合成中，离开页面将中断生成。确定要离开吗？';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGeneratingVideo]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: taskData, error: taskErr } = await supabase
        .from('video_tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (taskErr) throw taskErr;

      let resolvedTask = taskData as VideoTask;

      // Auto-mark stuck tasks as failed if they have been processing for too long
      const isTerminal = ['completed', 'failed', 'cancelled'].includes(resolvedTask.status);
      if (!isTerminal && getElapsedMinutes(resolvedTask.created_at) > 30) {
        const { error: updateErr } = await supabase
          .from('video_tasks')
          .update({
            status: 'failed',
            error_message: '任务处理超时（超过30分钟未完成）',
          })
          .eq('id', id);
        if (!updateErr) {
          resolvedTask = { ...resolvedTask, status: 'failed', error_message: '任务处理超时（超过30分钟未完成）' };
        }
      }

      setTask(resolvedTask);

      const gallery = await listGalleryImages(id);
      setImages(gallery);
    } catch (err) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // On load: restore UI state based on persisted task status
  useEffect(() => {
    if (!task) return;
    if (task.video_url) {
      setVideoProgress(100);
    } else if (task.status === 'failed' && task.error_message) {
      toast.error(`上次生成失败: ${task.error_message}`);
    }
    // If task was left in synthesizing state, show a hint (do not auto-start as we can't track server progress)
  }, [task]);

  // Restore pending image regeneration tasks from sessionStorage after data loads
  useEffect(() => {
    if (loading || images.length === 0) return;

    const pendingTasks = readRegeneratingTasks();
    if (pendingTasks.length === 0) return;

    // Only restore tasks that belong to current images and are not too old (>10min)
    const now = Date.now();
    const restorable = pendingTasks.filter((t) => {
      const belongs = images.some((img) => img.id === t.imageId);
      const fresh = now - t.timestamp < 10 * 60 * 1000;
      return belongs && fresh;
    });

    if (restorable.length === 0) {
      // Clean up stale entries
      const validImageIds = new Set(images.map((img) => img.id));
      const cleaned = pendingTasks.filter((t) => validImageIds.has(t.imageId) && now - t.timestamp < 10 * 60 * 1000);
      writeRegeneratingTasks(cleaned);
      return;
    }

    toast.info(`恢复 ${restorable.length} 张图片的生成进度`);

    restorable.forEach((taskInfo) => {
      const { imageId, taskId } = taskInfo;
      setIsRegenerating((current) => current ?? imageId);
      setRegenerateProgress((prev) => ({ ...prev, [imageId]: 5 }));

      const abortController = new AbortController();
      abortControllersRef.current[imageId] = abortController;

      // Resume polling in background
      (async () => {
        let attempts = 0;
        const maxAttempts = 60;
        try {
          while (attempts < maxAttempts) {
            if (abortController.signal.aborted) return;

            const delayMs = attempts < 5 ? 1000 : 3000;
            await new Promise((r) => setTimeout(r, delayMs));
            if (abortController.signal.aborted) return;

            const q = await queryImageGeneration(taskId);
            const progress = Math.min(15 + Math.round((attempts / maxAttempts) * 80), 95);
            setRegenerateProgress((prev) => ({ ...prev, [imageId]: progress }));

            if (q.status === 'completed' && q.publicUrl) {
              await updateGalleryImage(imageId, {
                image_url: q.publicUrl,
                status: 'success',
                error_message: null,
              });
              await loadData();
              toast.success('图片重新生成成功');
              removeRegeneratingTask(imageId);
              return;
            }
            if (q.status === 'failed') {
              throw new Error(q.error || '图片生成失败');
            }
            attempts++;
          }
          throw new Error('图片生成超时');
        } catch (err) {
          if (abortController.signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`重新生成失败: ${msg}`);
          await updateGalleryImage(imageId, { status: 'failed', error_message: msg });
          await loadData();
        } finally {
          delete abortControllersRef.current[imageId];
          setIsRegenerating((current) => (current === imageId ? null : current));
          setRegenerateProgress((prev) => {
            const next = { ...prev };
            delete next[imageId];
            return next;
          });
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, images.length]);

  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteGalleryImage(imageId);
      toast.success('图片已删除');
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      toast.error(`删除失败: ${msg}`);
    }
  };

  const handleReplaceWithUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPEG、PNG、WebP 格式图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }
    setIsReplacingImage(imageId);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `gallery-uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('generated-media').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('generated-media').getPublicUrl(path);
      // 只替换图片文件，保留原有的 prompt 和 original_prompt
      await updateGalleryImage(imageId, {
        image_url: data.publicUrl,
      });
      toast.success('图片替换成功');
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '替换失败';
      toast.error(`替换失败: ${msg}`);
    } finally {
      setIsReplacingImage(null);
      // 清空当前触发的 input，确保下次同一 input 仍能触发 change
      e.target.value = '';
    }
  };

  const handleRegenerate = async (imageId: string, prompt: string, originalPrompt?: string) => {
    if (!user) {
      toast.error('请先登录后再重新生成图片');
      navigate('/login', { state: { from: { pathname: location.pathname } } });
      return;
    }

    // 先保存修改后的提示词到数据库（即使后续取消，提示词也已保留）
    try {
      await updateGalleryImage(imageId, {
        prompt,
        ...(originalPrompt !== undefined ? { original_prompt: originalPrompt } : {}),
      });
      // 乐观更新本地状态
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, prompt, ...(originalPrompt !== undefined ? { original_prompt: originalPrompt } : {}) }
            : img,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`保存提示词失败: ${msg}`);
      return;
    }

    const abortController = new AbortController();
    abortControllersRef.current[imageId] = abortController;
    setIsRegenerating(imageId);
    setRegenerateProgress((prev) => ({ ...prev, [imageId]: 5 }));

    try {
      // 阶段1：提交生成请求（显示"正在提交..."）
      const res = await startImageGeneration({ prompt, size: task?.size || '720x1280' });

      // 记录到 sessionStorage，支持页面切换后恢复进度
      addRegeneratingTask({
        imageId,
        taskId: res.imageId,
        prompt,
        originalPrompt: originalPrompt || prompt,
        timestamp: Date.now(),
      });

      // 阶段2：已提交，开始轮询（显示"正在生成..."）
      setRegenerateProgress((prev) => ({ ...prev, [imageId]: 15 }));

      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        if (abortController.signal.aborted) {
          toast.info('已取消图片生成');
          return;
        }

        // 前5次轮询间隔1秒，后续3秒，加快早期进度感知
        const delayMs = attempts < 5 ? 1000 : 3000;
        await new Promise((r) => setTimeout(r, delayMs));
        if (abortController.signal.aborted) {
          toast.info('已取消图片生成');
          return;
        }

        const q = await queryImageGeneration(res.imageId);

        // 更新进度：15%起步，按attempts比例增长到95%
        const progress = Math.min(15 + Math.round((attempts / maxAttempts) * 80), 95);
        setRegenerateProgress((prev) => ({ ...prev, [imageId]: progress }));

        if (q.status === 'completed' && q.publicUrl) {
          await updateGalleryImage(imageId, {
            image_url: q.publicUrl,
            status: 'success',
            error_message: null,
          });
          await loadData();
          toast.success('图片重新生成成功');
          removeRegeneratingTask(imageId);
          return;
        }
        if (q.status === 'failed') {
          throw new Error(q.error || '图片生成失败');
        }
        attempts++;
      }
      throw new Error('图片生成超时');
    } catch (err) {
      if (abortController.signal.aborted) {
        toast.info('已取消图片生成');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`重新生成失败: ${msg}`);
      // 标记为失败
      await updateGalleryImage(imageId, { status: 'failed', error_message: msg });
      await loadData();
    } finally {
      delete abortControllersRef.current[imageId];
      setIsRegenerating(null);
      setRegenerateProgress((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
    }
  };

  const cancelRegenerate = (imageId: string) => {
    const controller = abortControllersRef.current[imageId];
    if (controller) {
      controller.abort();
    }
    removeRegeneratingTask(imageId);
    setIsRegenerating((current) => (current === imageId ? null : current));
    setRegenerateProgress((prev) => {
      const next = { ...prev };
      delete next[imageId];
      return next;
    });
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPEG、PNG、WebP 格式图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }
    setIsUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `gallery-uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('generated-media').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('generated-media').getPublicUrl(path);
      const nextIndex = images.length;
      await createGalleryImage({
        taskId: id!,
        imageUrl: data.publicUrl,
        prompt: `用户上传图片：${file.name}`,
        originalPrompt: file.name,
        index: nextIndex,
      });
      toast.success('图片上传成功');
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败';
      toast.error(`上传失败: ${msg}`);
    } finally {
      setIsUploadingImage(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const handleGenerateVideo = async () => {
    if (!user) {
      toast.error('请先登录后再生成视频');
      navigate('/login', { state: { from: { pathname: location.pathname } } });
      return;
    }
    if (images.length === 0) {
      toast.error('没有图片，无法生成视频');
      return;
    }

    // Conflict detection: query the latest DB state before starting
    if (id) {
      try {
        const { data: latestTask } = await supabase
          .from('video_tasks')
          .select('status, video_url, updated_at')
          .eq('id', id)
          .maybeSingle();
        if (latestTask?.status === 'synthesizing_video' && !latestTask?.video_url) {
          const updatedAt = latestTask.updated_at ? new Date(latestTask.updated_at).getTime() : 0;
          const elapsedMin = Math.floor((Date.now() - updatedAt) / 60000);
          if (elapsedMin < 10) {
            setConfirmDialogMessage(
              `检测到该任务的视频可能正在合成中（${elapsedMin} 分钟前启动）。\n如果另一个浏览器标签页正在生成，继续操作可能导致冲突。\n是否强制重新生成？`,
            );
            setConfirmDialogOpen(true);
            pendingGenerateRef.current = async () => {
              setConfirmDialogOpen(false);
              await runVideoGeneration();
            };
            return;
          }
        }
      } catch {
        // ignore query errors, continue with generation
      }
    }

    runVideoGeneration();
  };

  const runVideoGeneration = async (target?: 'base' | 'merged') => {
    setIsGeneratingVideo(true);
    setVideoProgress(0);
    setVideoStatusHint('正在加载图片素材...');
    try {
      const shouldGenerateBase = target === 'base' || (!target && task?.generate_base_enabled !== false);
      const shouldGenerateMerged = target === 'merged' || (!target && task?.generate_merged_enabled !== false);

      // Filter only successfully generated images with valid URLs
      const validImages = images
        .filter((img) => img.status === 'success' && img.image_url)
        .map((img) => ({ image_url: img.image_url!, prompt: img.prompt }));

      // Mark task as synthesizing so state survives page refresh
      if (id) {
        const updatePayload: Record<string, unknown> = { status: 'synthesizing_video' };
        if (shouldGenerateBase) updatePayload.video_url = null;
        if (shouldGenerateMerged) updatePayload.merged_video_url = null;
        await supabase.from('video_tasks').update(updatePayload).eq('id', id);
      }

      let baseVideoUrl: string | null = null;
      let mergedVideoUrl: string | null = null;

      // Step 1: Generate base version (voice + images only)
      if (shouldGenerateBase) {
        setVideoStatusHint('正在合成基础版视频（语音+画面）...');
        const baseBlob = await createSlideshowVideo(
          validImages,
          task?.audio_url || task?.tts_audio_url || null,
          task?.image_effect || 'zoom-in',
          task?.transition_effect || 'fade',
          30,
          (progress) => {
            setVideoProgress(Math.round(progress / 2));
            if (progress < 30) setVideoStatusHint('基础版：正在渲染图片动态效果...');
            else if (progress < 60) setVideoStatusHint('基础版：正在合成转场动画...');
            else if (progress < 90) setVideoStatusHint('基础版：正在合并音频与视频...');
            else setVideoStatusHint('基础版编码中...');
          },
        );

        // Upload base version
        setVideoStatusHint('正在上传基础版视频...');
        const baseExt = getVideoExtension(baseBlob.type || 'video/webm');
        const basePath = `uploads/${crypto.randomUUID()}.${baseExt}`;
        const { error: baseUploadErr } = await supabase.storage.from('generated-videos').upload(basePath, baseBlob, {
          contentType: baseBlob.type || 'video/webm',
          upsert: false,
        });
        if (baseUploadErr) throw baseUploadErr;
        const { data: baseUrlData } = supabase.storage.from('generated-videos').getPublicUrl(basePath);
        baseVideoUrl = baseUrlData.publicUrl;
      }

      // Step 2: Generate merged version (voice + BGM + subtitles) if configured
      // Note: task.tts_audio_url already contains mixed audio (TTS+BGM) from CreatePage,
      // so we only add subtitles here; BGM is already embedded in the audio.
      const hasMergedAudio = !!task?.tts_audio_url;
      const hasSubtitle = task?.subtitle_enabled;

      if (shouldGenerateMerged && hasMergedAudio && hasSubtitle) {
        setVideoStatusHint('正在合成整合版视频（语音+背景音乐+字幕）...');

        // Build subtitle timeline synchronized with voice duration
        const totalDuration = task?.tts_duration_seconds ?? 8;
        const subtitles = buildSubtitleTimelineV2(task?.prompt || '', totalDuration).map((s) => ({
          text: s.text,
          startTime: s.startTime,
          endTime: s.endTime,
        }));

        const mergedBlob = await createSlideshowVideo(
          validImages,
          task.tts_audio_url,
          task?.image_effect || 'zoom-in',
          task?.transition_effect || 'fade',
          30,
          (progress) => {
            setVideoProgress(shouldGenerateBase ? 50 + Math.round(progress / 2) : Math.round(progress));
            if (progress < 30) setVideoStatusHint('整合版：正在渲染图片+字幕...');
            else if (progress < 60) setVideoStatusHint('整合版：正在合成转场动画...');
            else if (progress < 90) setVideoStatusHint('整合版：正在合并音频与视频...');
            else setVideoStatusHint('整合版编码中...');
          },
          {
            subtitles,
            subtitleStyle: mapSubtitleStyle(
              task?.subtitle_font || undefined,
              task?.subtitle_size || undefined,
              task?.subtitle_style || undefined,
            ),
          },
        );

        setVideoStatusHint('正在上传整合版视频...');
        const mergedExt = getVideoExtension(mergedBlob.type || 'video/webm');
        const mergedPath = `uploads/${crypto.randomUUID()}.${mergedExt}`;
        const { error: mergedUploadErr } = await supabase.storage.from('generated-videos').upload(mergedPath, mergedBlob, {
          contentType: mergedBlob.type || 'video/webm',
          upsert: false,
        });
        if (mergedUploadErr) throw mergedUploadErr;
        const { data: mergedUrlData } = supabase.storage.from('generated-videos').getPublicUrl(mergedPath);
        mergedVideoUrl = mergedUrlData.publicUrl;
      }

      // Update task status - preserve existing URLs if not regenerated
      const updatePayload: Record<string, unknown> = { status: 'completed' };
      if (baseVideoUrl !== null) updatePayload.video_url = baseVideoUrl;
      if (mergedVideoUrl !== null) updatePayload.merged_video_url = mergedVideoUrl;

      const { error: dbErr } = await supabase.from('video_tasks').update(updatePayload).eq('id', id);
      if (dbErr) {
        console.error('DB update failed:', dbErr);
      }

      // Reload task to reflect updated status
      const { data: updatedTask } = await supabase.from('video_tasks').select('*').eq('id', id).maybeSingle();
      if (updatedTask) setTask(updatedTask as VideoTask);

      setVideoProgress(100);
      setVideoStatusHint('');
      const successMsg = baseVideoUrl && mergedVideoUrl
        ? '基础版与整合版视频均已生成成功'
        : baseVideoUrl
          ? '基础版视频生成成功'
          : mergedVideoUrl
            ? '整合版视频生成成功'
            : '视频生成成功';
      toast.success(successMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (id) {
        await supabase.from('video_tasks').update({
          status: 'failed',
          error_message: msg,
        }).eq('id', id);
      }
      toast.error(`视频生成失败: ${msg}`);
    } finally {
      setIsGeneratingVideo(false);
      setVideoStatusHint('');
    }
  };

  const handleDownloadFile = async (url: string, filename: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      // 根据响应的 Content-Type 修正扩展名
      const ext = getVideoExtension(blob.type || 'video/webm');
      const finalName = filename.replace(/\.[^.]+$/, `.${ext}`);
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast.success('下载已开始');
    } catch {
      toast.error('下载失败，请直接右键链接保存');
    }
  };

  const openEditDialog = (img: GalleryImage) => {
    setEditImage(img);
    setEditPrompt(img.prompt);
    // Show Chinese description as default; fallback to prompt if original_prompt is empty (legacy data)
    setEditOriginalPrompt(img.original_prompt || img.prompt || '');
    setEditDialogOpen(true);
  };

  const confirmRegenerate = async () => {
    if (!editImage) return;
    setEditDialogOpen(false);
    await handleRegenerate(editImage.id, editPrompt, editOriginalPrompt);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-sm w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-video bg-muted rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-balance">任务详情</h1>
        {task?.video_url && task?.merged_video_url && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-success/20 text-success border border-success/30">
            <CheckCircle className="h-3 w-3" />
            视频已生成
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4 text-pretty">
        共 {images.length} 张图片。您可以重新生成任意一张图片，也可以修改提示词后重新生成。确认所有图片满意后，点击下方按钮生成轮播视频。
        {task?.tts_duration_seconds && task.tts_duration_seconds > 0 && (
          <span className="block mt-1">
            预计合成时间约 {task.tts_duration_seconds} 秒（与音频时长大致相同）。
          </span>
        )}
      </p>

      {images.length === 0 && (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-sm">暂无图片，请返回创作页面重新生成</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {images.map((img, idx) => {
          const isFailed = img.status === 'failed';
          return (
            <Card key={img.id} className="border border-border overflow-hidden group">
              <div className={`relative aspect-video bg-muted overflow-hidden ${isFailed ? '' : 'cursor-pointer'}`}
                onClick={() => { if (!isFailed) { setPreviewImageUrl(img.image_url); setPreviewImageOpen(true); } }}
              >
                {isFailed ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-destructive/5">
                    <ImageOff className="h-10 w-10 text-destructive/40" />
                    <span className="text-xs text-destructive/70 font-medium">图片生成失败</span>
                    {img.error_message && (
                      <span className="text-[10px] text-muted-foreground px-3 text-center line-clamp-2">{img.error_message}</span>
                    )}
                  </div>
                ) : (
                  <img src={img.image_url || undefined} alt={img.original_prompt || img.prompt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                )}
                {/* Index badge */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm bg-black/60 text-white text-xs font-medium tabular-nums">
                  {idx + 1}
                </div>
                {!isFailed && (
                  <>
                    {/* Replace button - 每个卡片使用独立的 input，避免共享 ref 导致指向最后一张 */}
                    <label
                      className="absolute top-2 right-9 p-1 rounded-sm bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80 cursor-pointer"
                      title="替换为自定义图片"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isReplacingImage === img.id}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleReplaceWithUpload(e, img.id);
                        }}
                      />
                    </label>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(img.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-sm bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                      title="删除此图片"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground line-clamp-2 text-pretty">{img.original_prompt || img.prompt}</p>
                {isRegenerating === img.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>图片生成中...</span>
                      <span>{regenerateProgress[img.id] ?? 0}%</span>
                    </div>
                    <Progress value={regenerateProgress[img.id] ?? 0} className="h-1.5" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => cancelRegenerate(img.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      取消生成
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {isFailed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRegenerate(img.id, img.prompt, img.original_prompt || undefined)}
                        disabled={isRegenerating !== null}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        重新生成
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => openEditDialog(img)}
                        disabled={isRegenerating !== null}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        修改提示词并重新生成
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {/* Upload custom image card */}
        <Card
          className="border border-dashed border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
          onClick={() => uploadInputRef.current?.click()}
        >
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUploadImage}
          />
          <div className="aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploadingImage ? (
              <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8 opacity-50" />
                <span className="text-xs">上传自定义图片</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Video result — show available versions */}
      {(task?.video_url || task?.merged_video_url) && (
        <div className="mb-6 space-y-6">
          {/* Merged version */}
          {task?.merged_video_url && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <h2 className="text-lg font-semibold">整合版视频</h2>
                <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                  含背景音乐与字幕
                </span>
              </div>
              <video
                ref={videoRef}
                src={task.merged_video_url}
                controls
                className="w-full rounded-sm border border-border"
                style={{ maxHeight: '60vh' }}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadFile(task.merged_video_url!, `slideshow-merged-${Date.now()}.webm`)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载整合版
                </Button>
                <Button variant="outline" onClick={() => navigate('/history')}>
                  查看历史
                </Button>
              </div>
            </div>
          )}

          {/* Base version */}
          {task?.video_url && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <h2 className="text-lg font-semibold">基础版视频</h2>
                <span className="text-xs px-2 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border">
                  仅语音与画面
                </span>
              </div>
              <video
                src={task.video_url}
                controls
                className="w-full rounded-sm border border-border"
                style={{ maxHeight: '60vh' }}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadFile(task.video_url!, `slideshow-base-${Date.now()}.webm`)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载基础版
                </Button>
                {task?.tts_audio_url && (
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile(task.tts_audio_url!, `audio-${task.id}.wav`)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    下载音频
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failed images hint */}
      {(() => {
        const failedCount = images.filter((img) => img.status === 'failed').length;
        if (failedCount > 0) {
          return (
            <Card className="border border-destructive/30 mb-6 bg-destructive/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-destructive">
                    {failedCount} 张图片生成失败，无法合成视频。请先点击失败的卡片中的「重新生成」按钮，修复所有失败图片后再合并视频。
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Previous synthesizing / failed hint */}
      {((task?.status === 'synthesizing_video' && !task?.video_url) || (task?.status === 'failed' && !task?.video_url)) && (
        <Card className="border border-border mb-6 bg-warning/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span>
                {task?.status === 'failed' && task?.error_message
                  ? `上次生成失败：${task.error_message}。请重新点击「生成轮播视频」尝试。`
                  : '上次视频生成似乎未完成或已中断，请重新点击「生成轮播视频」继续。'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {images.length > 0 && (
        <div className="flex flex-col gap-3 sticky bottom-4 bg-card border border-border rounded-sm p-4 shadow-md z-10">
          {isGeneratingVideo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{videoStatusHint || '视频生成中...'}</span>
                <span>{videoProgress}%</span>
              </div>
              <Progress value={videoProgress} className="h-2" />
            </div>
          )}
          {(() => {
            const hasFailedImages = images.some((img) => img.status === 'failed');
            return (
              <div className="flex flex-wrap gap-3 w-full">
                <Button
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo || hasFailedImages}
                  className="flex-1 h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 min-w-0"
                >
                  {isGeneratingVideo ? (
                    <span className="flex items-center gap-2">
                      <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      视频生成中...
                    </span>
                  ) : hasFailedImages ? (
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      有失败图片，请修复后再合并
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Film className="h-5 w-5 shrink-0" />
                      {(task?.video_url || task?.merged_video_url) ? '重新生成轮播视频' : '生成轮播视频'}
                    </span>
                  )}
                </Button>
            {/* Generate missing version */}
            {task?.video_url && !task?.merged_video_url && task?.tts_audio_url && task?.subtitle_enabled && !isGeneratingVideo && (
              <Button
                variant="outline"
                onClick={() => runVideoGeneration('merged')}
                className="h-12 font-medium"
              >
                <Layers className="h-4 w-4 mr-1" />
                生成整合版
              </Button>
            )}
            {task?.merged_video_url && !task?.video_url && !isGeneratingVideo && (
              <Button
                variant="outline"
                onClick={() => runVideoGeneration('base')}
                className="h-12 font-medium"
              >
                <Film className="h-4 w-4 mr-1" />
                生成基础版
              </Button>
            )}
          </div>
          )})()}
        </div>
      )}

      {/* Edit Prompt Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>重新生成图片</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>中文描述（显示用）</Label>
              <Textarea
                value={editOriginalPrompt}
                onChange={(e) => setEditOriginalPrompt(e.target.value)}
                rows={3}
                className="bg-background border-border resize-none"
                placeholder="输入中文图片描述..."
              />
            </div>
            <div className="space-y-2">
              <Label>优化后提示词（提交给AI生图模型）</Label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                className="bg-background border-border resize-none"
                placeholder="输入优化后的生图提示词..."
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={confirmRegenerate} disabled={isRegenerating !== null}>
                <Wand2 className="h-4 w-4 mr-1" />
                确认重新生成
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>检测到可能冲突</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground whitespace-pre-line">{confirmDialogMessage}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDialogOpen(false)}>
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (pendingGenerateRef.current) {
                    pendingGenerateRef.current();
                    pendingGenerateRef.current = null;
                  }
                }}
              >
                强制重新生成
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={previewImageOpen} onOpenChange={setPreviewImageOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <div className="flex items-center justify-center">
            {previewImageUrl && (
              <img
                src={previewImageUrl}
                alt="预览"
                className="max-w-full max-h-[80vh] object-contain rounded-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
