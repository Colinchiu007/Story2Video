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
import { splitTextToScenes, splitTextToScenesSmart, buildSubtitleTimelineV2 } from '@/lib/text-segmentation';
import { generateImagePrompts, generateImagePromptsSmart } from '@/lib/history-prompt';
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
// ── JSX 子组件 ──────────────────────────────────────────────────
import HeaderSection from '@/components/HeaderSection';
import PromptInput from '@/components/PromptInput';
import ImageUploadSection from '@/components/ImageUploadSection';
import RemixVideoUpload from '@/components/RemixVideoUpload';
import AudioModeUpload from '@/components/AudioModeUpload';
import BatchModeInput from '@/components/BatchModeInput';
import TTSTextarea from '@/components/TTSTextarea';
import VoiceSection from '@/components/VoiceSection';
import AudioPreviewButtons from '@/components/AudioPreviewButtons';
import TemplateSection from '@/components/TemplateSection';
import VersionSelection from '@/components/VersionSelection';
import SettingsGrid from '@/components/SettingsGrid';
import SubmitSection from '@/components/SubmitSection';
import ConfirmDialog from '@/components/ConfirmDialog';








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
        setDoubaoVoice({ id, name: getDoubaoVoiceName() || id });
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

  const handleSelectClonedVoice = useCallback((voiceId: string, _name: string) => {
    setVoiceId(voiceId);
    saveLastVoice(voiceId);
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
        segments = await splitTextToScenesSmart(audioText.trim());
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
        const imgSegments = await splitTextToScenesSmart(audioText.trim(), { targetCount: imageCount });
        const actualCount = imgSegments.length;
        updateStep(segIndex, 'completed', `语义分断为 ${actualCount} 段 (text-seg v1.0)`);

        // Step 4: Generate image prompts with v9.0 strategy (client-side, no LLM)
        const optIndex = segIndex + 1;
        updateStep(optIndex, 'active');
        const optimizedPrompts = await generateImagePromptsSmart(imgSegments, audioText.trim());
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
              const segSegments = await splitTextToScenesSmart(child.text, { targetCount: segImageCount });
              const segPrompts = await generateImagePromptsSmart(segSegments, child.text);

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
      <HeaderSection
        mode={mode}
        prompt={prompt}
        audioText={audioText}
        clearDraft={clearDraft}
      />

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
          <PromptInput
            mode={mode}
            prompt={prompt}
            setPrompt={setPrompt}
          />

          {mode === 'image' && (
            <ImageUploadSection
              uploadedImageUrl={uploadedImageUrl}
              setUploadedImageUrl={setUploadedImageUrl}
              isUploading={isUploading}
              dragOverImage={dragOverImage}
              setDragOverImage={setDragOverImage}
              imageInputRef={imageInputRef}
              handleImageUpload={handleImageUpload}
              handleImageDrop={handleImageDrop}
            />
          )}

          {mode === 'remix' && (
            <RemixVideoUpload
              remixVideoUrl={remixVideoUrl}
              setRemixVideoUrl={setRemixVideoUrl}
              remixVideoFileName={remixVideoFileName}
              setRemixVideoFileName={setRemixVideoFileName}
              isUploading={isUploading}
              dragOverVideo={dragOverVideo}
              setDragOverVideo={setDragOverVideo}
              videoInputRef={videoInputRef}
              handleVideoUpload={handleVideoUpload}
              handleVideoDrop={handleVideoDrop}
            />
          )}

          {/* Audio / Text Input Section - mode dependent */}
          <div className="border-t border-border pt-6 space-y-4">
            {mode === 'audio' && (
              <AudioModeUpload
                uploadedAudioUrl={uploadedAudioUrl}
                uploadedAudioName={uploadedAudioName}
                uploadedAudioFile={uploadedAudioFile}
                setUploadedAudioUrl={setUploadedAudioUrl}
                setUploadedAudioName={setUploadedAudioName}
                setUploadedAudioFile={setUploadedAudioFile}
                audioText={audioText}
                setAudioText={setAudioText}
                isRecognizingAudio={isRecognizingAudio}
                setIsRecognizingAudio={setIsRecognizingAudio}
                recognizeAudio={recognizeAudio}
                handleAudioUpload={handleAudioUpload}
              />
            )}

            {mode === 'batch' && (
              <BatchModeInput
                batchSegments={batchSegments}
                setBatchSegments={setBatchSegments}
                batchInputText={batchInputText}
                setBatchInputText={setBatchInputText}
                isUploading={isUploading}
                uploadToStorage={uploadToStorage}
              />
            )}

            {(mode === 'gallery' || mode === 'text' || mode === 'image' || mode === 'remix') && (
              <TTSTextarea
                audioText={audioText}
                setAudioText={setAudioText}
                speed={speed}
                mode={mode}
              />
            )}

            <VoiceSection
              voiceId={voiceId}
              setVoiceId={setVoiceId}
              saveLastVoice={saveLastVoice}
              doubaoVoice={doubaoVoice}
              userVoices={userVoices}
              handleSelectClonedVoice={handleSelectClonedVoice}
              speed={speed}
              setSpeed={setSpeed}
              vol={vol}
              setVol={setVol}
              pitch={pitch}
              setPitch={setPitch}
              emotion={emotion}
              setEmotion={setEmotion}
              showVoiceSettings={showVoiceSettings}
              setShowVoiceSettings={setShowVoiceSettings}
            />

            <AudioPreviewButtons
              audioText={audioText}
              audioPreview={audioPreview}
              isPreviewingAudio={isPreviewingAudio}
              isPlayingPreview={isPlayingPreview}
              audioDuration={audioDuration}
              handlePreviewAudio={handlePreviewAudio}
              setIsPlayingPreview={setIsPlayingPreview}
              setAudioPreview={setAudioPreview}
            />
          </div>

          <TemplateSection
            selectedTemplateId={selectedTemplateId}
            templateOpen={templateOpen}
            setTemplateOpen={setTemplateOpen}
            handleTemplateSelect={handleTemplateSelect}
          />

          {/* BGM Settings - always visible */}
          <BgmSettings
            config={bgmConfig}
            onChange={setBgmConfig}
            disabled={isGenerating}
          />

          <VersionSelection
            generateBase={generateBase}
            setGenerateBase={setGenerateBase}
            generateMerged={generateMerged}
            setGenerateMerged={setGenerateMerged}
            isGenerating={isGenerating}
          />

          {hasAudioText && (
            <SubtitleSettings
              config={subtitleConfig}
              onChange={setSubtitleConfig}
              disabled={isGenerating}
              audioText={audioText}
            />
          )}

          <SettingsGrid
            size={size}
            setSize={setSize}
            mode={mode}
            imageEffect={imageEffect}
            setImageEffect={setImageEffect}
            transitionEffect={transitionEffect}
            setTransitionEffect={setTransitionEffect}
            perImageDuration={perImageDuration}
            setPerImageDuration={setPerImageDuration}
            seconds={seconds}
            setSeconds={setSeconds}
            isAudioDurationMode={isAudioDurationMode}
            effectOpen={effectOpen}
            setEffectOpen={setEffectOpen}
          />

          <SubmitSection
            isGenerating={isGenerating}
            isUploading={isUploading}
            handleGenerate={handleGenerate}
            mode={mode}
            hasContent={hasContent}
            audioText={audioText}
            uploadedAudioUrl={uploadedAudioUrl}
            batchSegments={batchSegments}
            batchInputText={batchInputText}
            useJimengForVideo={useJimengForVideo}
            useViduForVideo={useViduForVideo}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        showConfirmDialog={showConfirmDialog}
        setShowConfirmDialog={setShowConfirmDialog}
        executeGenerate={executeGenerate}
        isGenerating={isGenerating}
        mode={mode}
        audioText={audioText}
        uploadedAudioName={uploadedAudioName}
        uploadedAudioUrl={uploadedAudioUrl}
        voiceId={voiceId}
        speed={speed}
        bgmConfig={bgmConfig}
        subtitleConfig={subtitleConfig}
        generateBase={generateBase}
        generateMerged={generateMerged}
        size={size}
        prompt={prompt}
        seconds={seconds}
        isAudioDurationMode={isAudioDurationMode}
        batchSegments={batchSegments}
        batchInputText={batchInputText}
      />
    </div>
  );
}
