import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Type, Image, Wand2, Mic, Upload, Play, Pause, ArrowRight, Trash2, Volume2, SlidersHorizontal, User, Download, Save, RotateCcw, FileCheck, Film, Layers, Music, ListOrdered, GripVertical, Plus, X, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { createVideoTask, startTextToVideo, startImageToVideo, startRemixVideo } from '@/services/video-generation';
import { generateTTS } from '@/services/tts';
import { getUserVoices } from '@/services/voice-clone';
import { useJimengForVideo, batchParallel, useViduForVideo, isImageGenerationAvailable } from '@/services/api-config';
import { startImageGeneration, queryImageGeneration } from '@/services/image-generation';
import { createGalleryImage } from '@/services/gallery';
import { createSlideshowVideo, mapSubtitleStyle, getVideoExtension } from '@/lib/slideshow';
import type { SubtitleSegment } from '@/lib/slideshow';
import { getDoubaoVoiceId, getDoubaoVoiceName } from '@/components/ApiSettingsDialog';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import VoiceCloneDialog from '@/components/VoiceCloneDialog';
import BgmSettings from '@/components/BgmSettings';
import SubtitleSettings from '@/components/SubtitleSettings';
import VideoTemplatePicker, { TemplateSelectButton } from '@/components/VideoTemplatePicker';
import EffectPicker, { EffectSettingsButton } from '@/components/EffectPicker';
import { getTemplateById } from '@/lib/template-library';
import { splitTextToScenes, buildSubtitleTimelineV2 } from '@/lib/text-segmentation';
import { generateImagePrompts } from '@/lib/history-prompt';
import { mixAudio, uploadMixedAudio } from '@/lib/audio-mixer';
import type { CreateMode, UserVoice } from '@/types';
import type { VideoTemplate } from '@/types/template';
import type { BgmConfig } from '@/components/BgmSettings';
import type { SubtitleConfig } from '@/components/SubtitleSettings';

// ── 从常量文件导入 ──────────────────────────────────────────────────
import { MODES } from '@/constants/modes';
import { VOICE_CATEGORIES, EMOTION_OPTIONS } from '@/constants/voices';
import { IMAGE_EFFECTS, TRANSITION_EFFECTS } from '@/constants/effects';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';
import { useFileUploads } from '@/hooks/useFileUploads';
import { useTTSPreview } from '@/hooks/useTTSPreview';

import { useAutoSaveDraft, useRestoreDraft, useClearDraft } from '@/hooks/useCreateDraft';
import type { CreateDraftState, CreateDraftSetters } from '@/hooks/useCreateDraft';







export default function CreatePage() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const [mode, setMode] = useState<CreateMode>('gallery');
  const [prompt, setPrompt] = useState('');
  const [audioText, setAudioText] = useState('');
  const [voiceId, setVoiceId] = useState('zh_female_qingxinnvsheng_uranus_bigtts');
  const [speed, setSpeed] = useState(1.0);
  const [vol, setVol] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [emotion, setEmotion] = useState('default');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [size, setSize] = useState('720x1280');
  const [seconds, setSeconds] = useState('8');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [remixVideoUrl, setRemixVideoUrl] = useState('');
  const [remixVideoFileName, setRemixVideoFileName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // ── UI 状态 ────────────────────────────────────────────────────
  const [dragOverImage, setDragOverImage] = useState(false);
  const [dragOverVideo, setDragOverVideo] = useState(false);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState('');
  const [uploadedAudioName, setUploadedAudioName] = useState('');
  const [isRecognizingAudio, setIsRecognizingAudio] = useState(false);
  const [batchSegments, setBatchSegments] = useState<Array<{ id: string; text: string; audioUrl: string; audioName: string }>>([]);
  const [batchInputText, setBatchInputText] = useState('');
  const [bgmConfig, setBgmConfig] = useState<BgmConfig>({ enabled: false, url: '', volume: 5, name: '' });
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({
    enabled: false,
    font: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    size: 'size3',
    style: 'style1',
  });
  const [imageEffect, setImageEffect] = useState('zoom-in');
  const [transitionEffect, setTransitionEffect] = useState('fade');
  const [perImageDuration, setPerImageDuration] = useState(6);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [generateBase, setGenerateBase] = useState(true);
  const [generateMerged, setGenerateMerged] = useState(true);

  // ── Refs ─────────────────────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── 音色相关 ────────────────────────────────────────────────────
  const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
  const [doubaoVoice, setDoubaoVoice] = useState<{ id: string; name: string } | null>(null);

  const isDoubaoClonedVoice = useCallback((id: string): boolean => {
    return !!doubaoVoice && id === doubaoVoice.id;
  }, [doubaoVoice]);
  // isUploading moved to useFileUploads hook
  // ── TTS 预览（通过 useTTSPreview hook） ─────────────────────────
  const {
    audioPreview, isPreviewingAudio, isPlayingPreview, audioDuration, cachedTts,
    audioRef,
    setAudioPreview, setAudioDuration, setCachedTts, setIsPlayingPreview,
    blobToBase64, recognizeAudio, handlePreviewAudio,
  } = useTTSPreview({
    audioText, voiceId, speed, vol, pitch, emotion, isDoubaoClonedVoice,
  });


  // ── 进度状态（通过 useGenerationProgress hook） ─────────────────
  const {
    progressOpen, setProgressOpen, progressSteps, progressError,
    updateStep, initProgress, setProgressError,
  } = useGenerationProgress();

  // ── 文件上传（通过 useFileUploads hook） ────────────────────────
  const { isUploading, setIsUploading, uploadToStorage, processImageFile, processVideoFile, processAudioFile } = useFileUploads();

  // ── 上传处理函数 ──────────────────────────────────────────────
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file, setUploadedImageUrl);
  }, [processImageFile, setUploadedImageUrl]);

  const handleImageDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverImage(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processImageFile(file, setUploadedImageUrl);
  }, [processImageFile, setUploadedImageUrl]);

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processVideoFile(file, setRemixVideoUrl, setRemixVideoFileName);
  }, [processVideoFile, setRemixVideoUrl, setRemixVideoFileName]);

  const handleVideoDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverVideo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processVideoFile(file, setRemixVideoUrl, setRemixVideoFileName);
  }, [processVideoFile, setRemixVideoUrl, setRemixVideoFileName]);

  const handleAudioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAudioFile(file, setUploadedAudioUrl, setUploadedAudioName, setUploadedAudioFile);
  }, [processAudioFile, setUploadedAudioUrl, setUploadedAudioName, setUploadedAudioFile]);

  // ── 音色管理 ──────────────────────────────────────────────────
  const loadVoices = useCallback(async () => {
    try {
      const id = getDoubaoVoiceId();
      if (id) {
        setDoubaoVoice({ id, name: getDoubaoVoiceName() });
      } else {
        setDoubaoVoice(null);
      }
      const voices = await getUserVoices();
      setUserVoices(voices || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadVoices(); }, [loadVoices]);

  const saveLastVoice = useCallback((id: string) => {
    localStorage.setItem('last_voice_id', id);
  }, []);

  const handleSelectClonedVoice = useCallback((voice: UserVoice) => {
    setVoiceId(voice.voice_id ?? voice.id);
    saveLastVoice(voice.voice_id ?? voice.id);
  }, [setVoiceId, saveLastVoice]);

  const handleTemplateSelect = useCallback((templateId: string | undefined) => {
    setSelectedTemplateId(templateId);
    setTemplateOpen(false);
  }, []);

  // ── 音频时长模式 ──────────────────────────────────────────────
  const isAudioDurationMode = seconds === 'audio';

  // ── 草稿恢复与自动保存 ───────────────────────────────────────
  const draftSetters: CreateDraftSetters = {
    setMode, setPrompt, setAudioText, setVoiceId, setSpeed, setVol, setPitch, setEmotion,
    setSize, setSeconds, setUploadedImageUrl, setRemixVideoUrl, setRemixVideoFileName,
    setImageEffect, setTransitionEffect, setBgmConfig, setSubtitleConfig,
    setGenerateBase, setGenerateMerged, setPerImageDuration,
    setUploadedAudioUrl, setUploadedAudioName, setBatchSegments, setBatchInputText,
    setSelectedTemplateId, setUploadedAudioFile,
  };
  const draftRestored = useRestoreDraft(draftSetters);
  const clearDraft = useClearDraft(draftSetters);

  // Auto-save draft on state changes
  const draftState: CreateDraftState = {
    mode, prompt, audioText, voiceId, speed, vol, pitch, emotion,
    size, seconds, uploadedImageUrl, remixVideoUrl, remixVideoFileName,
    imageEffect, transitionEffect, bgmConfig, subtitleConfig,
    generateBase, generateMerged, perImageDuration,
    uploadedAudioUrl, uploadedAudioName, batchSegments, batchInputText,
  };
  useAutoSaveDraft(draftState, draftRestored);

  // ── 草稿状态 ────────────────────────────────────────────────────
  const hasContent = prompt.trim().length > 0 || audioText.trim().length > 0;
  const hasAudioText = audioText.trim().length > 0;

  const handleGenerate = () => {
    if (!user) {
      toast.error('请先登录后再使用 AI 生成功能');
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    if (mode === 'text' && !hasContent) {
      toast.error('请至少填写视频描述或语音合成文案');
      return;
    }
    if (mode === 'image' && !uploadedImageUrl) {
      toast.error('请上传参考图片');
      return;
    }
    if (mode === 'remix' && !remixVideoUrl) {
      toast.error('请上传源视频文件');
      return;
    }
    if (mode === 'remix' && !prompt.trim()) {
      toast.error('请输入编辑说明');
      return;
    }
    if (mode === 'gallery' && !audioText.trim()) {
      toast.error('请输入语音合成文案');
      return;
    }
    if (mode === 'audio' && !uploadedAudioUrl) {
      toast.error('请上传音频文件');
      return;
    }
    if (mode === 'batch' && batchSegments.length === 0 && !batchInputText.trim()) {
      toast.error('请至少输入一段文案或上传一个音频');
      return;
    }
    setShowConfirmDialog(true);
  };

  const executeGenerate = async () => {
    if (!generateBase && !generateMerged) {
      toast.error('请至少选择一个视频版本（基础版或整合版）');
      return;
    }
    setIsGenerating(true);
    setShowConfirmDialog(false);
    try {
      let audioUrl = '';
      let finalAudioDuration = 0;
      let mixedAudioUrl = '';

      // For non-gallery modes, generate TTS & BGM upfront
      if (mode !== 'gallery') {
        if (audioText.trim()) {
          try {
            const result = await generateTTS({
              text: audioText.trim(),
              voiceId,
              speed,
              vol,
              pitch,
              emotion: emotion === 'default' ? undefined : emotion,
              cluster: isDoubaoClonedVoice(voiceId) ? 'volcano_icl' : undefined,
            });
            audioUrl = result.audioUrl;
            finalAudioDuration = result.audioLength;
            setAudioDuration(result.audioLength);
          } catch (err) {
            const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '语音合成失败';
            toast.warning(`语音合成失败: ${msg}，将继续生成无音频视频`);
          }
        }
        if (audioUrl && bgmConfig.enabled && bgmConfig.url) {
          try {
            const targetSeconds = isAudioDurationMode
              ? (finalAudioDuration > 0 ? Math.ceil(finalAudioDuration) : 8)
              : Number(seconds);
            const mixedBlobUrl = await mixAudio(audioUrl, bgmConfig.url, bgmConfig.volume, targetSeconds);
            audioUrl = await uploadMixedAudio(mixedBlobUrl, uploadToStorage);
            toast.success('背景音乐混音完成');
          } catch (err) {
            const msg = err instanceof Error ? err.message : '混音失败';
            toast.warning(`背景音乐混音失败: ${msg}，将使用原音频`);
          }
        }
      }

      // Step 3: Segment text by semantics ONLY when "audio duration" mode is selected
      let segments: string[] = [];
      if (isAudioDurationMode && audioText.trim()) {
        segments = splitTextToScenes(audioText.trim());
      }
      const totalSegments = segments.length > 0 ? segments.length : 1;
      const totalSeconds = isAudioDurationMode
        ? (finalAudioDuration > 0 ? Math.ceil(finalAudioDuration) : 8)
        : Number(seconds);
      const segmentDuration = totalSegments > 1
        ? Math.ceil(totalSeconds / totalSegments)
        : totalSeconds;

      const effectivePrompt = prompt.trim() || audioText.trim() || 'AI 生成视频';
      const bgmPayload = {
        bgm_enabled: bgmConfig.enabled,
        bgm_url: bgmConfig.url || null,
        bgm_volume: bgmConfig.volume,
      };
      const subtitlePayload = {
        subtitle_enabled: subtitleConfig.enabled,
        subtitle_font: subtitleConfig.font,
        subtitle_size: subtitleConfig.size,
        subtitle_style: subtitleConfig.style,
      };
      const versionPayload = {
        generate_base_enabled: generateBase,
        generate_merged_enabled: generateMerged,
        per_image_duration: perImageDuration,
      };

      // --- Gallery / Audio mode: auto-generate TTS (gallery only), images, then synthesize slideshow video ---
      if (mode === 'gallery' || mode === 'audio') {
        if (!isImageGenerationAvailable()) {
          toast.error('图片轮播视频需要使用图片生成功能，请在「API设置」→「图片模型」中选择一个可用的模型（可灵内置AI、Vidu自定义API、商汤SenseNova自定义API等）');
          setIsGenerating(false);
          return;
        }

        initProgress(bgmConfig.enabled && !!bgmConfig.url, true);

        const task = await createVideoTask({
          mode,
          prompt: audioText.trim() || (mode === 'audio' ? '音频生成视频' : ''),
          size,
          seconds: totalSeconds,
          audioUrl: mode === 'audio' ? uploadedAudioUrl : undefined,
        });
        updateStep(0, 'completed');

        // Step 1: TTS (gallery) or use uploaded audio (audio mode)
        updateStep(1, 'active');
        let ttsReused = false;
        if (mode === 'audio') {
          if (uploadedAudioUrl) {
            audioUrl = uploadedAudioUrl;
            // Estimate duration from audioText if not already known
            finalAudioDuration = audioDuration > 0
              ? audioDuration
              : Math.max(8, audioText.trim().length / 3.3);
            setAudioDuration(finalAudioDuration);
            updateStep(1, 'completed', '使用上传的音频文件');
            toast.success(`使用上传音频，预估时长 ${finalAudioDuration.toFixed(1)} 秒`);
          } else {
            updateStep(1, 'failed', '未上传音频');
            setProgressError('未上传音频文件');
            setIsGenerating(false);
            return;
          }
        } else if (audioText.trim()) {
          const canReuse = cachedTts
            && cachedTts.text === audioText.trim()
            && cachedTts.voiceId === voiceId
            && cachedTts.speed === speed
            && cachedTts.vol === vol
            && cachedTts.pitch === pitch
            && cachedTts.emotion === emotion;
          if (canReuse) {
            audioUrl = cachedTts.audioUrl;
            finalAudioDuration = cachedTts.audioDuration;
            setAudioDuration(cachedTts.audioDuration);
            ttsReused = true;
          } else {
            try {
              const result = await generateTTS({
                text: audioText.trim(),
                voiceId,
                speed,
                vol,
                pitch,
                emotion: emotion === 'default' ? undefined : emotion,
                cluster: isDoubaoClonedVoice(voiceId) ? 'volcano_icl' : undefined,
              });
              audioUrl = result.audioUrl;
              finalAudioDuration = result.audioLength;
              setAudioDuration(result.audioLength);
              setCachedTts({
                audioUrl: result.audioUrl,
                audioDuration: result.audioLength,
                text: audioText.trim(),
                voiceId,
                speed,
                vol,
                pitch,
                emotion,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '语音合成失败';
              toast.warning(`语音合成失败: ${msg}，将继续生成无音频视频`);
            }
          }
        }
        // 若语音合成失败（gallery）或无音频时长（audio），按文案字数估算音频时长（中文约3.3字/秒）
        const estimatedDuration = finalAudioDuration > 0
          ? finalAudioDuration
          : Math.max(8, audioText.trim().length / 3.3 / Math.max(0.5, speed));
        const imageCount = Math.max(1, Math.ceil(estimatedDuration / perImageDuration));
        const durationLabel = finalAudioDuration > 0
          ? `${finalAudioDuration.toFixed(1)} 秒`
          : `约 ${estimatedDuration.toFixed(1)} 秒（按字数估算）`;
        updateStep(1, 'completed', `时长 ${durationLabel}，将生成 ${imageCount} 张图片${ttsReused ? '（复用已试听音频）' : ''}`);
        if (audioText.trim()) {
          toast.success(`语音${mode === 'audio' ? '文件' : (ttsReused ? '复用已生成音频' : finalAudioDuration > 0 ? '合成完成' : '失败，按字数估算')}，时长 ${durationLabel}，将生成 ${imageCount} 张图片（每${perImageDuration}秒1张）`);
        }

        // Step 2: BGM mixing
        mixedAudioUrl = audioUrl;
        let bgmStepIndex = -1;
        if (audioUrl && bgmConfig.enabled && bgmConfig.url) {
          bgmStepIndex = 2;
          updateStep(bgmStepIndex, 'active');
          try {
            const mixedBlobUrl = await mixAudio(audioUrl, bgmConfig.url, bgmConfig.volume, Math.ceil(finalAudioDuration || 8));
            mixedAudioUrl = await uploadMixedAudio(mixedBlobUrl, uploadToStorage);
            updateStep(bgmStepIndex, 'completed');
            toast.success('背景音乐混音完成');
          } catch (err) {
            const msg = err instanceof Error ? err.message : '混音失败';
            updateStep(bgmStepIndex, 'failed', msg);
            toast.warning(`背景音乐混音失败: ${msg}，将使用原音频`);
            mixedAudioUrl = audioUrl;
          }
        }

        // Save task config after TTS/BGM
        await supabase.from('video_tasks').update({
          ...bgmPayload,
          ...subtitlePayload,
          ...versionPayload,
          image_effect: imageEffect,
          transition_effect: transitionEffect,
          audio_url: audioUrl || null,
          tts_audio_url: mixedAudioUrl || null,
          tts_duration_seconds: finalAudioDuration > 0 ? Math.ceil(finalAudioDuration) : null,
        }).eq('id', task.id);

        // Step 3: Text segmentation with independent text-segmentation module
        const segIndex = bgmStepIndex >= 0 ? 3 : 2;
        updateStep(segIndex, 'active');
        const imgSegments = splitTextToScenes(audioText.trim(), { targetCount: imageCount });
        const actualCount = imgSegments.length;
        updateStep(segIndex, 'completed', `语义分断为 ${actualCount} 段 (text-seg v1.0)`);

        // Step 4: Generate image prompts with v9.0 strategy (client-side, no LLM)
        const optIndex = segIndex + 1;
        updateStep(optIndex, 'active');
        const optimizedPrompts = generateImagePrompts(imgSegments, audioText.trim());
        updateStep(optIndex, 'completed', `共 ${optimizedPrompts.length} 条提示词 (prompt v9.0)`);
        toast.success(`提示词优化完成，共 ${optimizedPrompts.length} 杢`);

        // Step 5: Generate images with optimized prompts
        const imgIndex = optIndex + 1;
        updateStep(imgIndex, 'active', `0/${actualCount}`);

        // Pre-create gallery image records (status='pending') so GalleryPage can show placeholders for failures
        const galleryImageRecords = await Promise.all(
          optimizedPrompts.map((prompt, i) =>
            createGalleryImage({
              taskId: task.id,
              prompt,
              originalPrompt: imgSegments[i] || undefined,
              index: i,
              status: 'pending',
            })
          )
        );

        let completedCount = 0;
        const imagePromises = optimizedPrompts.map(async (prompt, i) => {
          const record = galleryImageRecords[i];
          try {
            const res = await startImageGeneration({ prompt, size });
            let attempts = 0;
            const maxAttempts = 60;
            while (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 3000));
              const q = await queryImageGeneration(res.imageId);
              if (q.status === 'completed' && q.publicUrl) {
                await supabase.from('gallery_images').update({
                  image_url: q.publicUrl,
                  status: 'success',
                  error_message: null,
                }).eq('id', record.id);
                completedCount++;
                updateStep(imgIndex, 'active', `${completedCount}/${actualCount}`);
                return { success: true, index: i };
              }
              if (q.status === 'failed') {
                const errMsg = q.error || '图片生成失败';
                await supabase.from('gallery_images').update({
                  status: 'failed',
                  error_message: errMsg,
                }).eq('id', record.id);
                return { success: false, index: i, error: errMsg };
              }
              attempts++;
            }
            const errMsg = '图片生成超时';
            await supabase.from('gallery_images').update({
              status: 'failed',
              error_message: errMsg,
            }).eq('id', record.id);
            return { success: false, index: i, error: errMsg };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await supabase.from('gallery_images').update({
              status: 'failed',
              error_message: msg,
            }).eq('id', record.id);
            return { success: false, index: i, error: msg };
          }
        });

        const results = await Promise.all(imagePromises);
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          const failReasons = failed.map((r) => `第${(r as { index: number }).index + 1}张: ${(r as { error?: string }).error || '未知错误'}`).join('；');
          updateStep(imgIndex, 'failed', `${completedCount}/${actualCount}，${failReasons}`);
          toast.warning(`${failed.length} 张图片生成失败: ${failReasons}`);
        } else {
          updateStep(imgIndex, 'completed', `${completedCount}/${actualCount}`);
        }

        const successCount = results.filter((r) => (r as { success: boolean }).success).length;
        if (successCount === 0) {
          const allErrors = results.map((r, i) => !(r as { success: boolean }).success ? `第${i + 1}张: ${(r as { error?: string }).error || '未知错误'}` : '').filter(Boolean).join('；');
          setProgressError(`所有图片生成失败，无法合成视频。错误详情: ${allErrors}`);
          setIsGenerating(false);
          return;
        }

        // If some images failed, stop auto-synthesis and guide user to GalleryPage
        if (failed.length > 0) {
          await supabase.from('video_tasks').update({
            status: 'images_ready',
            error_message: `${failed.length} 张图片生成失败`,
          }).eq('id', task.id);
          updateStep(imgIndex, 'failed', `${completedCount}/${actualCount}，已停止自动合成。请前往任务详情页重新生成失败的图片，然后手动合并视频。`);
          toast.error(`${failed.length} 张图片生成失败，已停止自动合成。请前往「任务详情」页面重新生成失败的图片。`);
          setIsGenerating(false);
          setTimeout(() => { setProgressOpen(false); navigate(`/gallery/${task.id}`); }, 1500);
          return;
        }

        // Step 6: Auto-synthesize slideshow video (base + merged versions)
        const vidIndex = imgIndex + 1;
        const estSeconds = Math.ceil(finalAudioDuration);

        // Fetch all successfully generated gallery images from DB
        const { data: dbImages } = await supabase
          .from('gallery_images')
          .select('image_url, prompt')
          .eq('task_id', task.id)
          .eq('status', 'success')
          .order('index', { ascending: true });
        const validImages = (Array.isArray(dbImages) ? dbImages : []).filter(
          (img): img is { image_url: string; prompt: string } => !!img.image_url
        );

        // Mark task as synthesizing so state survives page refresh / navigation
        await supabase.from('video_tasks').update({
          status: 'synthesizing_video',
          video_url: null,
          merged_video_url: null,
        }).eq('id', task.id);

        updateStep(vidIndex, 'active', `视频渲染中，预计纯渲染约 ${estSeconds} 秒。注：视频由浏览器实时录制合成，时长与音频一致；生成完成后可前往「历史记录」查看结果`);
        try {
          // 6a: Base version (voice + images only)
          let baseVideoUrl: string | null = null;
          if (generateBase) {
            updateStep(vidIndex, 'active', `正在合成基础版视频（语音+画面）${estSeconds} 秒`);
            const baseBlob = await createSlideshowVideo(
              validImages,
              audioUrl || null,
              imageEffect,
              transitionEffect,
              30,
              (progress) => {
                updateStep(vidIndex, 'active', `基础版视频渲染中 ${progress}%`);
              },
            );
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

          // 6b: Merged version (voice + BGM + subtitles) if configured
          let mergedVideoUrl: string | null = null;
          if (generateMerged && (bgmConfig.enabled || subtitleConfig.enabled)) {
            updateStep(vidIndex, 'active', `正在合成整合版视频（语音+背景音乐+字幕）${estSeconds} 秒`);

            // Build subtitle timeline synchronized with voice duration
            // Each subtitle line is 1-12 chars, timed proportionally by char count
            const subtitles = buildSubtitleTimelineV2(audioText, finalAudioDuration).map((s) => ({
              text: s.text,
              startTime: s.startTime,
              endTime: s.endTime,
            }));

            const mergedBlob = await createSlideshowVideo(
              validImages,
              mixedAudioUrl || null,
              imageEffect,
              transitionEffect,
              30,
              (progress) => {
                updateStep(vidIndex, 'active', `整合版视频渲染中 ${progress}%`);
              },
              {
                subtitles: subtitleConfig.enabled ? subtitles : undefined,
                subtitleStyle: subtitleConfig.enabled
                  ? mapSubtitleStyle(subtitleConfig.font, subtitleConfig.size, subtitleConfig.style)
                  : undefined,
              },
            );
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

          const { error: dbErr } = await supabase.from('video_tasks').update({
            status: 'completed',
            video_url: baseVideoUrl,
            merged_video_url: mergedVideoUrl,
            progress: 100,
          }).eq('id', task.id);
          if (dbErr) {
            console.error('DB update failed:', dbErr);
            toast.error('视频已生成，但状态更新失败，请刷新历史记录查看');
          }

          const completedMsg = baseVideoUrl && mergedVideoUrl
            ? '基础版与整合版均已完成'
            : baseVideoUrl
              ? '基础版已完成'
              : mergedVideoUrl
                ? '整合版已完成'
                : '视频生成完成';
          updateStep(vidIndex, 'completed', completedMsg);
          toast.success(completedMsg + '！');
          setTimeout(() => setProgressOpen(false), 800);
          navigate(`/gallery/${task.id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from('video_tasks').update({
            status: 'failed',
            error_message: msg,
            progress: 66,
          }).eq('id', task.id);
          updateStep(vidIndex, 'failed', msg);
          setProgressError(`视频合成失败: ${msg}，已保存图片，您可以进入图片管理页面手动合成`);
          toast.error(`视频合成失败: ${msg}，已保存图片，您可以进入图片管理页面手动合成`);
          setTimeout(() => { setProgressOpen(false); navigate(`/gallery/${task.id}`); }, 1200);
        }
        setIsGenerating(false);
        return;
      }

      // --- Batch mode: create parent + child tasks, generate TTS and images for each segment ---
      if (mode === 'batch') {
        if (!isImageGenerationAvailable()) {
          toast.error('分段视频需要使用图片生成功能，请在「API设置」→「图片模型」中选择一个可用的模型');
          setIsGenerating(false);
          return;
        }

        initProgress(false, false);
        const lines = batchInputText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        const segments: Array<{ text: string; audioUrl: string; audioName: string }> = [];
        for (const line of lines) {
          segments.push({ text: line, audioUrl: '', audioName: '' });
        }
        for (const seg of batchSegments) {
          segments.push({ text: seg.text, audioUrl: seg.audioUrl, audioName: seg.audioName });
        }
        if (segments.length === 0) {
          toast.error('请至少输入一段文案或上传一个音频');
          setIsGenerating(false);
          return;
        }

        updateStep(0, 'active');
        const parentTask = await createVideoTask({
          mode: 'batch',
          prompt: batchInputText.trim() || '分段视频',
          size,
          seconds: 0,
          totalSegments: segments.length,
        });
        await supabase.from('video_tasks').update({
          ...bgmPayload,
          ...subtitlePayload,
          ...versionPayload,
          image_effect: imageEffect,
          transition_effect: transitionEffect,
        }).eq('id', parentTask.id);
        updateStep(0, 'completed');

        // Create child tasks
        const childTasks: Array<{ id: string; index: number; text: string; audioUrl: string }> = [];
        for (let i = 0; i < segments.length; i++) {
          const seg = await createVideoTask({
            mode: 'gallery',
            prompt: segments[i].text,
            size,
            seconds: 0,
            parentId: parentTask.id,
            segmentIndex: i,
            totalSegments: segments.length,
            segmentText: segments[i].text,
            audioUrl: segments[i].audioUrl || undefined,
          });
          childTasks.push({ id: seg.id, index: i, text: segments[i].text, audioUrl: segments[i].audioUrl });
        }
        updateStep(1, 'completed', `已创建 ${segments.length} 个分段任务`);

        // Parallel TTS + image generation for each child task
        updateStep(2, 'active', `正在生成各分段的语音与图片 0/${segments.length}`);
        let completedSegments = 0;
        const CONCURRENCY = 2;
        const segmentResults = await batchParallel(
          childTasks,
          async (child) => {
            try {
              let segAudioUrl = '';
              let segAudioDuration = 0;

              // TTS for text segments, or use uploaded audio
              if (child.audioUrl) {
                segAudioUrl = child.audioUrl;
                segAudioDuration = Math.max(8, child.text.length / 3.3);
              } else {
                try {
                  const ttsResult = await generateTTS({
                    text: child.text,
                    voiceId,
                    speed,
                    vol,
                    pitch,
                    emotion: emotion === 'default' ? undefined : emotion,
                    cluster: isDoubaoClonedVoice(voiceId) ? 'volcano_icl' : undefined,
                  });
                  segAudioUrl = ttsResult.audioUrl;
                  segAudioDuration = ttsResult.audioLength;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : '语音合成失败';
                  console.error(`[Batch] Segment ${child.index} TTS failed:`, msg);
                }
              }

              const segDuration = segAudioDuration > 0 ? segAudioDuration : Math.max(8, child.text.length / 3.3 / Math.max(0.5, speed));
              const segImageCount = Math.max(1, Math.ceil(segDuration / perImageDuration));

              // Update task with audio
              await supabase.from('video_tasks').update({
                audio_url: segAudioUrl || null,
                tts_audio_url: segAudioUrl || null,
                tts_duration_seconds: segAudioDuration > 0 ? Math.ceil(segAudioDuration) : null,
                seconds: Math.ceil(segDuration),
              }).eq('id', child.id);

              // Generate image prompts
              const segSegments = splitTextToScenes(child.text, { targetCount: segImageCount });
              const segPrompts = generateImagePrompts(segSegments, child.text);

              // Pre-create gallery image records
              const galleryRecords = await Promise.all(
                segPrompts.map((p, idx) =>
                  createGalleryImage({ taskId: child.id, prompt: p, originalPrompt: segSegments[idx] || undefined, index: idx, status: 'pending' })
                )
              );

              // Generate images
              for (let i = 0; i < segPrompts.length; i++) {
                const record = galleryRecords[i];
                try {
                  const res = await startImageGeneration({ prompt: segPrompts[i], size });
                  let attempts = 0;
                  const maxAttempts = 60;
                  while (attempts < maxAttempts) {
                    await new Promise((r) => setTimeout(r, 3000));
                    const q = await queryImageGeneration(res.imageId);
                    if (q.status === 'completed' && q.publicUrl) {
                      await supabase.from('gallery_images').update({ image_url: q.publicUrl, status: 'success' }).eq('id', record.id);
                      break;
                    }
                    if (q.status === 'failed') {
                      await supabase.from('gallery_images').update({ status: 'failed', error_message: q.error || '图片生成失败' }).eq('id', record.id);
                      break;
                    }
                    attempts++;
                  }
                  if (attempts >= maxAttempts) {
                    await supabase.from('gallery_images').update({ status: 'failed', error_message: '图片生成超时' }).eq('id', record.id);
                  }
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  await supabase.from('gallery_images').update({ status: 'failed', error_message: msg }).eq('id', record.id);
                }
              }

              // Update child task status
              const { data: successImages } = await supabase.from('gallery_images').select('count').eq('task_id', child.id).eq('status', 'success').single();
              const successCount = (successImages?.count as number) || 0;
              const { data: failedImages } = await supabase.from('gallery_images').select('count').eq('task_id', child.id).eq('status', 'failed').single();
              const failCount = (failedImages?.count as number) || 0;

              let childStatus = 'images_ready';
              if (successCount === 0 && failCount > 0) childStatus = 'failed';
              else if (successCount > 0) childStatus = 'images_ready';

              await supabase.from('video_tasks').update({
                status: childStatus,
                error_message: failCount > 0 ? `${failCount} 张图片生成失败` : null,
              }).eq('id', child.id);

              completedSegments++;
              updateStep(2, 'active', `正在生成各分段的语音与图片 ${completedSegments}/${segments.length}`);
              return { success: true, childId: child.id };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[Batch] Segment ${child.index} failed:`, msg);
              await supabase.from('video_tasks').update({ status: 'failed', error_message: msg }).eq('id', child.id);
              return { success: false, childId: child.id, error: msg };
            }
          },
          CONCURRENCY,
        );

        const allFailed = segmentResults.every((r) => (r as { success?: boolean }).success === false);
        if (allFailed) {
          const firstErr = (segmentResults.find((r) => (r as { error?: string }).error) as { error?: string })?.error || '所有分段生成失败';
          await supabase.from('video_tasks').update({ status: 'failed', error_message: firstErr }).eq('id', parentTask.id);
          updateStep(2, 'failed', firstErr);
          setProgressError(`生成失败: ${firstErr}`);
          toast.error(`生成失败: ${firstErr}`);
        } else {
          updateStep(2, 'completed', `${completedSegments}/${segments.length} 个分段已完成语音与图片生成`);
          toast.success(`已生成 ${completedSegments} 个分段，请前往分段管理页面合成视频`);
          setTimeout(() => setProgressOpen(false), 600);
          navigate(`/segments/${parentTask.id}`);
        }
        setIsGenerating(false);
        return;
      }

      // Single segment (no text segmentation or only 1 segment)
      if (totalSegments <= 1) {
        initProgress(false, false);

        const task = await createVideoTask({
          mode,
          prompt: effectivePrompt,
          size,
          seconds: totalSeconds,
          audioUrl: mixedAudioUrl || undefined,
          inputReferenceUrl: uploadedImageUrl || undefined,
          remixSourceId: remixVideoUrl || undefined,
        });
        updateStep(0, 'completed');

        // Update with bgm/subtitle/version settings
        await supabase.from('video_tasks').update({
          ...bgmPayload,
          ...subtitlePayload,
          ...versionPayload,
        }).eq('id', task.id);

        updateStep(1, 'active');
        let videoId = '';
        let status = '';
        if (mode === 'text') {
          const res = await startTextToVideo({ prompt: effectivePrompt, size, seconds: totalSeconds });
          videoId = res.videoId; status = res.status;
        } else if (mode === 'image') {
          const res = await startImageToVideo({ prompt: effectivePrompt, inputReferenceUrl: uploadedImageUrl, size });
          videoId = res.videoId; status = res.status;
        } else if (mode === 'remix') {
          if (!remixVideoUrl) throw new Error('缺少源视频');
          const res = await startRemixVideo({ videoUrl: remixVideoUrl, prompt: effectivePrompt });
          videoId = res.videoId; status = res.status;
        }
        await supabase.from('video_tasks').update({ video_id: videoId, status }).eq('id', task.id);
        updateStep(1, 'completed');
        updateStep(2, 'active', '视频生成中，通常需要3-10分钟...');
        toast.success('任务已提交，开始生成视频');
        setTimeout(() => setProgressOpen(false), 600);
        navigate(`/progress/${task.id}`);
        return;
      }

      // Multi-segment generation based on text semantics
      initProgress(false, false);

      const parentTask = await createVideoTask({
        mode,
        prompt: effectivePrompt,
        size,
        seconds: totalSeconds,
        audioUrl: mixedAudioUrl || undefined,
        inputReferenceUrl: uploadedImageUrl || undefined,
        remixSourceId: remixVideoUrl || undefined,
        totalSegments,
      });
      updateStep(0, 'completed');
      // Update parent with bgm/subtitle/version settings
      await supabase.from('video_tasks').update({
        ...bgmPayload,
        ...subtitlePayload,
        ...versionPayload,
      }).eq('id', parentTask.id);

      const segmentTasks: { taskId: string; index: number; text: string }[] = [];
      for (let i = 0; i < totalSegments; i++) {
        const segPrompt = segments[i] || effectivePrompt;
        const seg = await createVideoTask({
          mode,
          prompt: segPrompt,
          size,
          seconds: segmentDuration,
          audioUrl: mixedAudioUrl || undefined,
          inputReferenceUrl: uploadedImageUrl || undefined,
          remixSourceId: remixVideoUrl || undefined,
          parentId: parentTask.id,
          segmentIndex: i,
          totalSegments,
          segmentText: segPrompt,
        });
        segmentTasks.push({ taskId: seg.id, index: i, text: segPrompt });
      }

      // Batch parallel generation with concurrency limit (max 3 at a time)
      const CONCURRENCY = 3;
      const ESTIMATED_SECONDS_PER_SEGMENT = 300; // ~5 min per segment

      const results = await batchParallel(
        segmentTasks,
        async (seg, index) => {
          try {
            // Update queue position for remaining segments
            const batchIndex = Math.floor(index / CONCURRENCY);
            for (let i = index; i < segmentTasks.length; i++) {
              const pos = Math.floor(i / CONCURRENCY) - batchIndex + 1;
              const total = Math.ceil(segmentTasks.length / CONCURRENCY);
              const remaining = (Math.floor(i / CONCURRENCY) - batchIndex) * ESTIMATED_SECONDS_PER_SEGMENT;
              await supabase.from('video_tasks').update({
                queue_position: pos,
                queue_total: total,
                estimated_seconds_remaining: remaining,
              }).eq('id', segmentTasks[i].taskId);
            }

            let res: { videoId: string; status: string };
            if (mode === 'text') {
              res = await startTextToVideo({ prompt: seg.text, size, seconds: segmentDuration });
            } else if (mode === 'image') {
              res = await startImageToVideo({ prompt: seg.text, inputReferenceUrl: uploadedImageUrl, size });
            } else {
              if (!remixVideoUrl) throw new Error('缺少源视频');
              res = await startRemixVideo({ videoUrl: remixVideoUrl, prompt: seg.text });
            }
            await supabase.from('video_tasks').update({
              video_id: res.videoId,
              status: res.status,
              queue_position: null,
              queue_total: null,
              estimated_seconds_remaining: ESTIMATED_SECONDS_PER_SEGMENT,
            }).eq('id', seg.taskId);
            return { success: true, taskId: seg.taskId, videoId: res.videoId };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[CreatePage] Segment ${seg.index} failed:`, msg);
            const { error: updateErr } = await supabase.from('video_tasks').update({
              status: 'failed',
              error_message: msg || '未知错误',
            }).eq('id', seg.taskId);
            if (updateErr) console.error('[CreatePage] Failed to update segment status:', updateErr);
            return { success: false, taskId: seg.taskId, error: msg };
          }
        },
        CONCURRENCY,
      );

      updateStep(1, 'completed');

      // Sync parent status: if all children failed, mark parent as failed too
      const allFailed = results.every((r) => {
        const rec = r as { success?: boolean } | undefined;
        return rec && rec.success === false;
      });
      if (allFailed) {
        const firstError = (results.find((r) => (r as { error?: string })?.error) as { error?: string })?.error || '所有片段生成失败';
        await supabase.from('video_tasks').update({
          status: 'failed',
          error_message: firstError,
        }).eq('id', parentTask.id);
        updateStep(2, 'failed', firstError);
        setProgressError(`生成失败: ${firstError}`);
        toast.error(`生成失败: ${firstError}`);
      } else {
        updateStep(2, 'active', `${totalSegments} 个片段并行生成中，请耐心等待...`);
        toast.success(`已提交 ${totalSegments} 个片段任务，每批最多 ${CONCURRENCY} 个并行生成`);
        setTimeout(() => setProgressOpen(false), 600);
      }
      navigate(`/progress/${parentTask.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      console.error('Generate error:', err);
      toast.error(`提交失败: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="relative rounded-sm overflow-hidden mb-8 aspect-[16/6] md:aspect-[16/5]">
        <img
          src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_84235796-312b-463e-b768-99b46e02e834.jpg"
          alt="AI 视频创作"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-balance mb-2">视频创作</h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-md text-pretty">选择创作模式，输入描述或上传素材，AI 将为您生成视频</p>
            </div>
            {(prompt || audioText) && (
              <button
                type="button"
                onClick={clearDraft}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="清除当前草稿"
              >
                <RotateCcw className="h-3 w-3" />
                清除草稿
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as CreateMode)} className="mb-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full bg-muted h-auto p-1">
          {MODES.map((m) => (
            <TabsTrigger
              key={m.key}
              value={m.key}
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <m.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{m.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="border border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <currentMode.icon className="h-5 w-5 text-primary" />
            {currentMode.label}
          </CardTitle>
          <CardDescription className="text-pretty">{currentMode.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt - hidden for gallery mode */}
          {mode !== 'gallery' && (
            <div className="space-y-2">
              <Label>
                {mode === 'remix' ? '编辑说明' : '视频描述（可选）'}
                {mode === 'remix' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Textarea
                placeholder={
                  mode === 'text'
                    ? '此处不填时，以语音文本内容生成对应画面的视频；有语音的同时，如有自定义视频内容要求，可在此填写，但尽量与语音文案相关'
                    : mode === 'image'
                      ? '描述视频中期望的画面动态效果（可选）'
                      : '描述希望做出的修改，如：将场景变为夜晚，增加霓虹灯光'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="bg-background border-border resize-none focus-visible:ring-primary"
              />
            </div>
          )}

          {/* Image Upload for Image mode */}
          {mode === 'image' && (
            <div className="space-y-2">
              <Label>参考图片 <span className="text-destructive">*</span></Label>
              {uploadedImageUrl ? (
                <div className="relative rounded-sm overflow-hidden border border-border">
                  <img src={uploadedImageUrl} alt="参考图" className="w-full aspect-video object-cover" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 bg-black/60 text-white hover:bg-black/80 border border-white/30"
                    onClick={() => { setUploadedImageUrl(''); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-muted/30 ${
                    dragOverImage ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
                  }`}
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverImage(true); }}
                  onDragLeave={() => setDragOverImage(false)}
                  onDrop={handleImageDrop}
                >
                  <Upload className={`h-8 w-8 transition-colors ${dragOverImage ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm transition-colors ${dragOverImage ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {dragOverImage ? '松开即可上传图片' : '点击或拖拽上传参考图片'}
                  </span>
                  <span className="text-xs text-muted-foreground">支持 JPEG/PNG/WebP，≤ 10MB</span>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          )}

          {/* Remix Video Upload */}
          {mode === 'remix' && (
            <div className="space-y-2">
              <Label>上传源视频 <span className="text-destructive">*</span></Label>
              {remixVideoUrl ? (
                <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-2">
                  <video src={remixVideoUrl} className="w-full aspect-video rounded-sm" controls muted />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{remixVideoFileName}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setRemixVideoUrl(''); setRemixVideoFileName(''); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      移除
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-sm border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-muted/30 ${
                    dragOverVideo ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
                  }`}
                  onClick={() => videoInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverVideo(true); }}
                  onDragLeave={() => setDragOverVideo(false)}
                  onDrop={handleVideoDrop}
                >
                  <Upload className={`h-8 w-8 transition-colors ${dragOverVideo ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm transition-colors ${dragOverVideo ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {dragOverVideo ? '松开即可上传视频' : '点击或拖拽上传视频文件'}
                  </span>
                  <span className="text-xs text-muted-foreground">支持 MP4、MOV、WebM，最大 50MB</span>
                </div>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
              />
              <p className="text-xs text-muted-foreground">上传已有视频，AI将基于此视频进行Remix编辑</p>
            </div>
          )}

          {/* Audio / Text Input Section - mode dependent */}
          <div className="border-t border-border pt-6 space-y-4">
            {mode === 'audio' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <Label className="font-medium">音频文件</Label>
                </div>
                {!uploadedAudioUrl ? (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={handleAudioDrop}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,.wav,.m4a,.mp3';
                      input.onchange = (e) => handleAudioUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                      input.click();
                    }}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">点击或拖拽上传音频文件</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 WAV、M4A、MP3 格式，最大 20MB</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedAudioName || '已上传音频'}</p>
                      <p className="text-xs text-muted-foreground">{uploadedAudioUrl ? '上传成功' : ''}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUploadedAudioUrl('');
                        setUploadedAudioName('');
                        setUploadedAudioFile(null);
                        setAudioText('');
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                {uploadedAudioUrl && !audioText && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!uploadedAudioFile) {
                        toast.error('未找到音频文件');
                        return;
                      }
                      setIsRecognizingAudio(true);
                      try {
                        const ext = uploadedAudioFile.name.slice(uploadedAudioFile.name.lastIndexOf('.')).toLowerCase();
                        const format: 'wav' | 'm4a' = ext === '.m4a' ? 'm4a' : 'wav';
                        const text = await recognizeAudio(uploadedAudioFile, format);
                        setAudioText(text);
                        toast.success('语音识别完成');
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : '识别失败';
                        toast.error(`语音识别失败: ${msg}`);
                      } finally {
                        setIsRecognizingAudio(false);
                      }
                    }}
                    disabled={isRecognizingAudio}
                    className="w-full"
                  >
                    {isRecognizingAudio ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        识别中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        识别音频内容
                      </span>
                    )}
                  </Button>
                )}
                {audioText && (
                  <div className="relative">
                    <Textarea
                      placeholder="识别结果，可编辑修正"
                      value={audioText}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.length <= 5000) setAudioText(v);
                      }}
                      rows={4}
                      className="bg-background border-border resize-none focus-visible:ring-primary"
                    />
                    <span className={`absolute bottom-2 right-2 text-xs ${audioText.length > 4800 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {audioText.length}/5000
                    </span>
                  </div>
                )}
              </div>
            )}

            {mode === 'batch' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-primary" />
                  <Label className="font-medium">分段文案</Label>
                </div>
                <div className="relative">
                  <Textarea
                    placeholder="每行输入一段文案，每段将生成一个独立的视频片段&#10;示例：&#10;第一段文案内容&#10;第二段文案内容&#10;第三段文案内容"
                    value={batchInputText}
                    onChange={(e) => setBatchInputText(e.target.value)}
                    rows={6}
                    className="bg-background border-border resize-none focus-visible:ring-primary"
                  />
                </div>
                {batchInputText.trim() && (
                  <div className="text-xs text-muted-foreground">
                    共 <span className="font-medium text-foreground">{batchInputText.split('\n').filter((l) => l.trim()).length}</span> 个分段
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">或</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">批量上传音频（每个音频对应一个分段）</Label>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,.wav,.m4a,.mp3';
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (!files) return;
                        const newSegments = [...batchSegments];
                        for (const file of Array.from(files)) {
                          try {
                            const url = await uploadToStorage(file, 'generated-media');
                            newSegments.push({ id: crypto.randomUUID(), text: '', audioUrl: url, audioName: file.name });
                          } catch (err) {
                            toast.error(`上传失败: ${file.name}`);
                          }
                        }
                        setBatchSegments(newSegments);
                        toast.success(`已上传 ${files.length} 个音频`);
                      };
                      input.click();
                    }}
                    disabled={isUploading}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? '上传中...' : '选择音频文件'}
                  </Button>
                  {batchSegments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {batchSegments.map((seg, idx) => (
                        <div key={seg.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/20">
                          <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{seg.audioName || '音频片段'}</p>
                            {seg.text && <p className="text-xs text-muted-foreground truncate">{seg.text}</p>}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBatchSegments((prev) => prev.filter((s) => s.id !== seg.id))}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(mode === 'gallery' || mode === 'text' || mode === 'image' || mode === 'remix') && (
              <>
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-primary" />
                  <Label className="font-medium">语音合成文案</Label>
                </div>
                <div className="relative">
                  <Textarea
                    placeholder="输入需要合成的语音文本，生成的音频将用于视频配音（限5000字符）"
                    value={audioText}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.length <= 5000) setAudioText(v);
                    }}
                    rows={3}
                    className="bg-background border-border resize-none focus-visible:ring-primary"
                  />
                  <span className={`absolute bottom-2 right-2 text-xs ${audioText.length > 4800 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {audioText.length}/5000
                  </span>
                </div>
              </>
            )}
            {/* Stats bar */}
            {audioText.trim() && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  字数 <span className="font-medium text-foreground tabular-nums">{audioText.trim().length}</span>
                </span>
                <span className="text-muted-foreground">
                  预估时长 <span className="font-medium text-foreground tabular-nums">{Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed))} 秒</span>
                </span>
                <span className="text-muted-foreground">
                  语速 <span className="font-medium text-foreground tabular-nums">{speed.toFixed(1)}x</span>
                </span>
                {mode === 'gallery' && (
                  <span className="text-muted-foreground">
                    预计生成 <span className="font-medium text-foreground tabular-nums">{Math.max(1, Math.ceil(Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed)) / 6))} 张</span> 图片
                  </span>
                )}
              </div>
            )}
            {/* Voice Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>音色选择</Label>
                <VoiceCloneDialog
                  onSelectVoice={handleSelectClonedVoice}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <User className="h-3.5 w-3.5 mr-1" />
                      克隆音色
                    </button>
                  }
                />
              </div>
              <Select
                value={voiceId}
                onValueChange={(id) => {
                  setVoiceId(id);
                  saveLastVoice(id);
                }}
              >
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="选择音色" />
                </SelectTrigger>
                <SelectContent>
                  {/* Configured Doubao voice (first) */}
                  {doubaoVoice && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                        我的音色
                      </div>
                      <SelectItem key={doubaoVoice.id} value={doubaoVoice.id}>
                        {doubaoVoice.name}
                      </SelectItem>
                    </>
                  )}
                  {/* User cloned voices from this app */}
                  {userVoices.length > 0 && (
                    <>
                      {!doubaoVoice && (
                        <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                          我的音色
                        </div>
                      )}
                      {userVoices.map((v) => (
                        <SelectItem key={v.voice_id ?? v.id} value={v.voice_id ?? v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {VOICE_CATEGORIES.map((cat) => (
                    <React.Fragment key={cat.label}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {cat.label}
                      </div>
                      {cat.voices.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voice Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`w-full flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-sm border transition-colors ${
                showVoiceSettings
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary'
              }`}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                语音参数调节（语速、音量、音调、情绪）
              </span>
              <span className={`text-xs transition-transform duration-200 ${showVoiceSettings ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Voice Settings Panel */}
            {showVoiceSettings && (
              <div className="space-y-5 p-4 border border-border rounded-sm bg-muted/20">
                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>语速</Label>
                    <span className="text-muted-foreground tabular-nums">{speed.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    onValueChange={(v) => setSpeed(v[0])}
                  />
                </div>
                {/* Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>音量</Label>
                    <span className="text-muted-foreground tabular-nums">{vol.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[vol]}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    onValueChange={(v) => setVol(v[0])}
                  />
                </div>
                {/* Pitch */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>音调</Label>
                    <span className="text-muted-foreground tabular-nums">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  </div>
                  <Slider
                    value={[pitch]}
                    min={-10}
                    max={10}
                    step={1}
                    onValueChange={(v) => setPitch(v[0])}
                  />
                </div>
                {/* Emotion */}
                <div className="space-y-2">
                  <Label>情绪</Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="选择情绪" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOTION_OPTIONS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePreviewAudio}
                disabled={isPreviewingAudio || !audioText.trim()}
                className="shrink-0"
              >
                {isPreviewingAudio ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : isPlayingPreview ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {isPreviewingAudio ? '生成中...' : isPlayingPreview ? '暂停' : '生成&试听'}
                </span>
              </Button>
              {audioPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!audioPreview) return;
                    try {
                      const response = await fetch(audioPreview);
                      const blob = await response.blob();
                      const objUrl = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = objUrl;
                      a.download = `tts-preview-${Date.now()}.mp3`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(objUrl);
                      document.body.removeChild(a);
                      toast.success('下载已开始');
                    } catch {
                      toast.error('下载失败，请直接右键音频保存');
                    }
                  }}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载音频
                </Button>
              )}
            </div>
            {audioPreview && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span>音频时长 {audioDuration.toFixed(1)} 秒</span>
                {isPlayingPreview && <span className="text-primary animate-pulse">播放中...</span>}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="flex items-center justify-between rounded-sm border border-border p-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedTemplateId
                  ? getTemplateById(selectedTemplateId)?.name ?? '已选模板'
                  : '视频模板'}
              </span>
            </div>
            <TemplateSelectButton
              onClick={() => setTemplateOpen(true)}
              hasSelection={!!selectedTemplateId}
            />
            <VideoTemplatePicker
              open={templateOpen}
              onOpenChange={setTemplateOpen}
              selectedId={selectedTemplateId}
              onSelect={handleTemplateSelect}
            />
          </div>

          {/* BGM Settings - always visible */}
          <BgmSettings
            config={bgmConfig}
            onChange={setBgmConfig}
            disabled={isGenerating}
          />

          {/* Version selection */}
          <div className="space-y-3 border border-border rounded-sm p-4 bg-muted/20">
            <Label className="font-medium flex items-center gap-1">
              <Layers className="h-4 w-4 text-primary" />
              视频版本
            </Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="generate-base"
                  checked={generateBase}
                  onCheckedChange={(v) => setGenerateBase(v === true)}
                  disabled={isGenerating}
                />
                <Label htmlFor="generate-base" className="text-sm cursor-pointer">
                  基础版（语音+画面）
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="generate-merged"
                  checked={generateMerged}
                  onCheckedChange={(v) => setGenerateMerged(v === true)}
                  disabled={isGenerating}
                />
                <Label htmlFor="generate-merged" className="text-sm cursor-pointer">
                  整合版（语音+背景音乐+字幕）
                </Label>
              </div>
            </div>
            {!generateBase && !generateMerged && (
              <p className="text-xs text-destructive">请至少选择一个视频版本</p>
            )}
          </div>

          {/* Subtitle Settings */}
          {hasAudioText && (
            <SubtitleSettings
              config={subtitleConfig}
              onChange={setSubtitleConfig}
              disabled={isGenerating}
              audioText={audioText}
            />
          )}

          {/* Settings */}
          <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>分辨率</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: '720x1280', label: '720P', desc: '竖屏', ratio: 'aspect-[9/16]' },
                  { value: '1080x1920', label: '1080P', desc: '竖屏', ratio: 'aspect-[9/16]' },
                  { value: '1280x720', label: '720P', desc: '横屏', ratio: 'aspect-[16/9]' },
                  { value: '1920x1080', label: '1080P', desc: '横屏', ratio: 'aspect-[16/9]' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSize(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-sm border transition-colors ${
                      size === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-8 ${opt.ratio} rounded-[2px] border-2 ${size === opt.value ? 'border-primary' : 'border-muted-foreground/30'}`} />
                    <span className={`text-xs font-medium ${size === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {mode === 'gallery' ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>图片动态效果</Label>
                    <Select value={imageEffect} onValueChange={setImageEffect}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_EFFECTS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>图片切换特效</Label>
                    <Select value={transitionEffect} onValueChange={setTransitionEffect}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSITION_EFFECTS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end pt-1">
                    <EffectSettingsButton
                      onClick={() => setEffectOpen(true)}
                      imageEffect={imageEffect}
                      transitionEffect={transitionEffect}
                    />
                  </div>
                </div>
                <EffectPicker
                  open={effectOpen}
                  onOpenChange={setEffectOpen}
                  imageEffect={imageEffect}
                  transitionEffect={transitionEffect}
                  onImageEffectChange={setImageEffect}
                  onTransitionEffectChange={setTransitionEffect}
                />
                <div className="space-y-2">
                  <Label>每张图片展示时长</Label>
                  <Select value={String(perImageDuration)} onValueChange={(v) => setPerImageDuration(Number(v))}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 秒</SelectItem>
                      <SelectItem value="6">6 秒</SelectItem>
                      <SelectItem value="8">8 秒</SelectItem>
                      <SelectItem value="10">10 秒</SelectItem>
                      <SelectItem value="15">15 秒</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">根据语音时长自动计算图片数量</p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>时长</Label>
                <Select value={seconds} onValueChange={setSeconds}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 秒</SelectItem>
                    <SelectItem value="8">8 秒</SelectItem>
                    <SelectItem value="12">12 秒</SelectItem>
                    <SelectItem value="30">30 秒</SelectItem>
                    <SelectItem value="60">60 秒</SelectItem>
                    <SelectItem value="audio">根据语音时长</SelectItem>
                  </SelectContent>
                </Select>
                {isAudioDurationMode && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    先生成语音，再根据语音时长生成对应时长的视频
                  </p>
                )}
                {!isAudioDurationMode && Number(seconds) > 12 && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    长视频将拆分为 {Math.ceil(Number(seconds) / 12)} 个 12 秒片段并行生成
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 space-y-2">
            <div className="text-xs text-muted-foreground space-y-1">
              {useJimengForVideo() ? (
                <p className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                  当前使用即梦 API 生成视频
                </p>
              ) : useViduForVideo() ? (
                <p className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                  当前使用 Vidu API 生成视频
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    当前使用系统内置大模型生成视频
                  </p>
                  <p className="text-xs text-muted-foreground">
                    系统内置额度有限，如遇额度不足请在「设置」中配置自定义 API Key 或即梦 API Key
                  </p>
                </>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating || isUploading ||
                (mode === 'text' && !hasContent) ||
                (mode === 'gallery' && !audioText.trim()) ||
                (mode === 'audio' && !uploadedAudioUrl) ||
                (mode === 'batch' && batchSegments.length === 0 && !batchInputText.trim())
              }
              className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  提交中...
                </span>
              ) : isUploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  上传中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  立即创作
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog before generation */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              确认创作配置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">创作模式</span>
              <span className="font-medium">{MODES.find((m) => m.key === mode)?.label}</span>
            </div>
            {(mode === 'gallery' || mode === 'audio') && (
              <>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">{mode === 'audio' ? '音频文件' : '语音文案'}</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {mode === 'audio' ? (uploadedAudioName || '已上传') : `${audioText.trim().slice(0, 20)}${audioText.trim().length > 20 ? '...' : ''}`}
                  </span>
                </div>
                {mode === 'audio' && (
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">识别文案</span>
                    <span className="font-medium truncate max-w-[200px]">{audioText.trim().slice(0, 20) || '（未识别）'}{audioText.trim().length > 20 ? '...' : ''}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">预估时长</span>
                  <span className="font-medium">{Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed))} 秒</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">图片数量</span>
                  <span className="font-medium">{Math.max(1, Math.ceil(Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed)) / 6))} 张</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">音色</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {VOICE_CATEGORIES.flatMap((c) => c.voices).find((v) => v.value === voiceId)?.label || voiceId}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">背景音乐</span>
                  <span className="font-medium">{bgmConfig.enabled ? (bgmConfig.name || '已启用') : '无'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">字幕</span>
                  <span className="font-medium">{subtitleConfig.enabled ? '已启用' : '无'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">生成版本</span>
                  <span className="font-medium">
                    {generateBase && generateMerged ? '基础版 + 整合版' : generateBase ? '仅基础版' : generateMerged ? '仅整合版' : '未选择'}
                  </span>
                </div>
              </>
            )}
            {mode === 'batch' && (
              <>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">分段数量</span>
                  <span className="font-medium">{Math.max(batchSegments.length, batchInputText.split('\n').filter((l) => l.trim()).length)} 段</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">音色</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {VOICE_CATEGORIES.flatMap((c) => c.voices).find((v) => v.value === voiceId)?.label || voiceId}
                  </span>
                </div>
              </>
            )}
            {(mode === 'text' || mode === 'image' || mode === 'remix') && (
              <>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">视频描述</span>
                  <span className="font-medium truncate max-w-[200px]">{prompt.trim().slice(0, 20) || '（未填写）'}{prompt.trim().length > 20 ? '...' : ''}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">时长</span>
                  <span className="font-medium">{isAudioDurationMode ? '按音频时长' : `${seconds} 秒`}</span>
                </div>
                {audioText.trim() && (
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">语音合成</span>
                    <span className="font-medium">已启用</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">视频尺寸</span>
              <span className="font-medium">{size}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirmDialog(false)}
            >
              取消
            </Button>
            <Button
              className="flex-1"
              onClick={executeGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  生成中...
                </span>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  确认生成
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
