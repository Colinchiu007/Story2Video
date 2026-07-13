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
import { generateMimoTTS, getMimoVoiceNameFromId } from '@/services/tts-mimo';
import { getUserVoices } from '@/services/voice-clone';
import { extractErrorMessage, useJimengForVideo, batchParallel, useViduForVideo, isImageGenerationAvailable } from '@/services/api-config';
import { startImageGeneration, queryImageGeneration } from '@/services/image-generation';
import { createGalleryImage } from '@/services/gallery';
import { createSlideshowVideo, mapSubtitleStyle, getVideoExtension } from '@/lib/slideshow';
import type { SubtitleSegment } from '@/lib/slideshow';
import { getDoubaoVoiceId, getDoubaoVoiceName, getTtsProvider } from '@/components/ApiSettingsDialog';
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

// 閳光偓閳光偓 娴犲骸鐖堕柌蹇旀瀮娴犺泛顕遍崗?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
import { MODES } from '@/constants/modes';
import { VOICE_CATEGORIES, EMOTION_OPTIONS } from '@/constants/voices';
import { IMAGE_EFFECTS, TRANSITION_EFFECTS } from '@/constants/effects';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';
import { useFileUploads } from '@/hooks/useFileUploads';
import { useTTSPreview } from '@/hooks/useTTSPreview';

import { useAutoSaveDraft, useRestoreDraft, useClearDraft } from '@/hooks/useCreateDraft';
import type { CreateDraftState, CreateDraftSetters } from '@/hooks/useCreateDraft';
// 閳光偓閳光偓 JSX 鐎涙劗绮嶆禒?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
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
  const [voiceProvider, setVoiceProvider] = useState<'doubao' | 'mimo'>(() => getTtsProvider());
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
  // 閳光偓閳光偓 UI 閻樿埖鈧?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
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

  // 閳光偓閳光偓 Refs 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 閳光偓閳光偓 闂婂疇澹婇惄绋垮彠 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
  const [doubaoVoice, setDoubaoVoice] = useState<{ id: string; name: string } | null>(null);
  const [mimoVoice, setMimoVoice] = useState<{ id: string; name: string } | null>(null);

  const isDoubaoClonedVoice = useCallback((id: string): boolean => {
    if (doubaoVoice && id === doubaoVoice.id) return true;
    return userVoices.some((voice) =>
      (voice.provider ?? 'doubao') === 'doubao' && (voice.voice_id ?? voice.id) === id,
    );
  }, [doubaoVoice, userVoices]);

  const isMimoClonedVoice = useCallback((id: string): boolean => {
    if (mimoVoice && mimoVoice.id === id) return true;
    return userVoices.some((voice) => {
      if (voice.provider === 'mimo') return voice.id === id;
      // provider 姘撹仮鑱磋幗褰曟綖姘撻檱鍗ゅ繖鑱撮湶鑼呰仚鑱风尗椹磋仭 voice_id 蹇欒仺绡撳繖纰岃仴鑼傚綍鑱峰繖鑱磋伣 voice_id 鐩茶祩鑱拌幗鑱ら湶蹇欒仚鑱涚洸璧傛綖 ready 鑾借伔鑱炲繖鑱电倝 MiMo
      return voice.provider == null && voice.voice_id == null && voice.status === 'ready' && voice.id === id;
    });
  }, [mimoVoice, userVoices]);
  // isUploading moved to useFileUploads hook
  // 閳光偓閳光偓 TTS 妫板嫯顫嶉敍鍫モ偓姘崇箖 useTTSPreview hook閿?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const {
    audioPreview, isPreviewingAudio, isPlayingPreview, audioDuration, cachedTts,
    audioRef,
    setAudioPreview, setAudioDuration, setCachedTts, setIsPlayingPreview,
    blobToBase64, recognizeAudio, handlePreviewAudio,
  } = useTTSPreview({
    audioText, voiceId, speed, vol, pitch, emotion, voiceProvider,
    isDoubaoClonedVoice, isMimoClonedVoice,
  });


  // 閳光偓閳光偓 鏉╂稑瀹抽悩鑸碘偓渚婄礄闁俺绻?useGenerationProgress hook閿?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const {
    progressOpen, setProgressOpen, progressSteps, progressError,
    updateStep, initProgress, setProgressError,
  } = useGenerationProgress();

  // 閳光偓閳光偓 閺傚洣娆㈡稉濠佺炊閿涘牓鈧俺绻?useFileUploads hook閿?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const { isUploading, setIsUploading, uploadToStorage, processImageFile, processVideoFile, processAudioFile } = useFileUploads();

  // 閳光偓閳光偓 娑撳﹣绱舵径鍕倞閸戣姤鏆?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
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

  // 閳光偓閳光偓 闂婂疇澹婄粻锛勬倞 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
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

  useEffect(() => {
    const syncTtsProvider = () => setVoiceProvider(getTtsProvider());
    window.addEventListener('api-settings-saved', syncTtsProvider);
    window.addEventListener('voice-clone-updated', loadVoices);
    return () => {
      window.removeEventListener('api-settings-saved', syncTtsProvider);
      window.removeEventListener('voice-clone-updated', loadVoices);
    };
  }, [loadVoices]);

  const saveLastVoice = useCallback((id: string) => {
    localStorage.setItem('last_voice_id', id);
  }, []);

  const handleSelectClonedVoice = useCallback((selectedVoiceId: string, name: string, provider?: 'doubao' | 'mimo') => {
    if (provider) setVoiceProvider(provider);
    if (provider === 'mimo') setMimoVoice({ id: selectedVoiceId, name });
    setVoiceId(selectedVoiceId);
    saveLastVoice(selectedVoiceId);
  }, [setVoiceId, saveLastVoice]);

  const dispatchTTS = useCallback(async (text: string) => {
    if (voiceProvider === 'mimo') {
      const cloned = isMimoClonedVoice(voiceId);
      return generateMimoTTS({
        text,
        voice: cloned ? undefined : getMimoVoiceNameFromId(voiceId),
        voiceRecordId: cloned ? voiceId : undefined,
        model: cloned ? 'mimo-v2.5-tts-voiceclone' : 'mimo-v2.5-tts',
        speed,
      });
    }
    return generateTTS({
      text,
      voiceId,
      speed,
      vol,
      pitch,
      emotion: emotion === 'default' ? undefined : emotion,
      cluster: isDoubaoClonedVoice(voiceId) ? 'volcano_icl' : undefined,
    });
  }, [voiceProvider, voiceId, speed, vol, pitch, emotion, isDoubaoClonedVoice, isMimoClonedVoice]);

  const handleTemplateSelect = useCallback((templateId: string | undefined) => {
    setSelectedTemplateId(templateId);
    setTemplateOpen(false);
  }, []);

  // 閳光偓閳光偓 闂婃娊顣堕弮鍫曟毐濡€崇础 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const isAudioDurationMode = seconds === 'audio';

  // 閳光偓閳光偓 閼藉顭堥幁銏狀槻娑撳氦鍤滈崝銊ょ箽鐎?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
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

  // 閳光偓閳光偓 閼藉顭堥悩鑸碘偓?閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const hasContent = prompt.trim().length > 0 || audioText.trim().length > 0;
  const hasAudioText = audioText.trim().length > 0;

  const handleGenerate = () => {
    if (!user) {
      toast.error('鐠囧嘲鍘涢惂璇茬秿閸氬骸鍟€娴ｈ法鏁?AI 閻㈢喐鍨氶崝鐔诲厴');
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    if (mode === 'text' && !hasContent) {
      toast.error('鐠囩柉鍤︾亸鎴濓綖閸愭瑨顫嬫０鎴炲伎鏉╃増鍨ㄧ拠顓㈢叾閸氬牊鍨氶弬鍥攳');
      return;
    }
    if (mode === 'image' && !uploadedImageUrl) {
      toast.error('鐠囪渹绗傛导鐘插棘閼板啫娴橀悧?);
      return;
    }
    if (mode === 'remix' && !remixVideoUrl) {
      toast.error('鐠囪渹绗傛导鐘崇爱鐟欏棝顣堕弬鍥︽');
      return;
    }
    if (mode === 'remix' && !prompt.trim()) {
      toast.error('鐠囩柉绶崗銉х椽鏉堟垼顕╅弰?);
      return;
    }
    if (mode === 'gallery' && !audioText.trim()) {
      toast.error('鐠囩柉绶崗銉嚔闂婂啿鎮庨幋鎰瀮濡?);
      return;
    }
    if (mode === 'audio' && !uploadedAudioUrl) {
      toast.error('鐠囪渹绗傛导鐘荤叾妫版垶鏋冩禒?);
      return;
    }
    if (mode === 'batch' && batchSegments.length === 0 && !batchInputText.trim()) {
      toast.error('鐠囩柉鍤︾亸鎴ｇ翻閸忋儰绔村▓鍨瀮濡楀牊鍨ㄦ稉濠佺炊娑撯偓娑擃亪鐓舵０?);
      return;
    }
    setShowConfirmDialog(true);
  };

  const executeGenerate = async () => {
    if (!generateBase && !generateMerged) {
      toast.error('鐠囩柉鍤︾亸鎴︹偓澶嬪娑撯偓娑擃亣顫嬫０鎴犲閺堫剨绱欓崺铏诡攨閻楀牊鍨ㄩ弫鏉戞値閻楀牞绱?);
      return;
    }
    setIsGenerating(true);
    setShowConfirmDialog(false);
    try {
      let audioUrl = '';
      let finalAudioDuration = 0;
      let mixedAudioUrl = '';
      const IMAGE_DELAY_MS = 1500;
      const TTS_STAGGER_MS = 2000;

      // For non-gallery modes, generate TTS & BGM upfront
      if (mode !== 'gallery') {
        if (audioText.trim()) {
          try {
            const result = await dispatchTTS(audioText.trim());
            audioUrl = result.audioUrl;
            finalAudioDuration = result.audioLength;
            setAudioDuration(result.audioLength);
          } catch (err) {
            const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '鐠囶參鐓堕崥鍫熷灇婢惰精瑙?;
            toast.warning(`鐠囶參鐓堕崥鍫熷灇婢惰精瑙? ${msg}閿涘苯鐨㈢紒褏鐢婚悽鐔稿灇閺冪娀鐓舵０鎴ｎ潒妫版叢);
          }
        }
        if (audioUrl && bgmConfig.enabled && bgmConfig.url) {
          try {
            const targetSeconds = isAudioDurationMode
              ? (finalAudioDuration > 0 ? Math.ceil(finalAudioDuration) : 8)
              : Number(seconds);
            const mixedBlobUrl = await mixAudio(audioUrl, bgmConfig.url, bgmConfig.volume, targetSeconds);
            audioUrl = await uploadMixedAudio(mixedBlobUrl, uploadToStorage);
            toast.success('閼冲本娅欓棅鍏呯濞ｇ兘鐓剁€瑰本鍨?);
          } catch (err) {
            const msg = extractErrorMessage(err);
            toast.warning(`閼冲本娅欓棅鍏呯濞ｇ兘鐓舵径杈Е: ${msg}閿涘苯鐨㈡担璺ㄦ暏閸樼喖鐓舵０鎱?;
          }
        }
      }

      // Step 3: Segment text by semantics ONLY when "audio duration" mode is selected
      let segments: string[] = [];
      if (isAudioDurationMode && audioText.trim()) {
        const splitResult = await splitTextToScenesSmart(audioText.trim());
        segments = splitResult.segments;
      }
      const totalSegments = segments.length > 0 ? segments.length : 1;
      const totalSeconds = isAudioDurationMode
        ? (finalAudioDuration > 0 ? Math.ceil(finalAudioDuration) : 8)
        : Number(seconds);
      const segmentDuration = totalSegments > 1
        ? Math.ceil(totalSeconds / totalSegments)
        : totalSeconds;

      const effectivePrompt = prompt.trim() || audioText.trim() || 'AI 閻㈢喐鍨氱憴鍡涱暥';
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
          toast.error('閸ュ墽澧栨潪顔芥尡鐟欏棝顣堕棁鈧憰浣峰▏閻劌娴橀悧鍥╂晸閹存劕濮涢懗鏂ょ礉鐠囧嘲婀妴瀛塒I鐠佸墽鐤嗛妴宥佸晪閵嗗苯娴橀悧鍥侀崹瀣ㄢ偓宥勮厬闁瀚ㄦ稉鈧稉顏勫讲閻劎娈戝Ο鈥崇€烽敍鍫濆讲閻忛潧鍞寸純鐡礗閵嗕礁宓嗗锕€鍞寸純鐡礗閵嗕箓idu閼奉亜鐣炬稊鍫縋I閵嗕府iniMax閼奉亜鐣炬稊鍫縋I閵嗕礁鏅㈠Ч顥筫nseNova閼奉亜鐣炬稊鍫縋I缁涘绱?);
          setIsGenerating(false);
          return;
        }

        initProgress(bgmConfig.enabled && !!bgmConfig.url, true);

        const task = await createVideoTask({
          mode,
          prompt: audioText.trim() || (mode === 'audio' ? '闂婃娊顣堕悽鐔稿灇鐟欏棝顣? : ''),
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
            updateStep(1, 'completed', '娴ｈ法鏁ゆ稉濠佺炊閻ㄥ嫰鐓舵０鎴炴瀮娴?);
            toast.success(`娴ｈ法鏁ゆ稉濠佺炊闂婃娊顣堕敍宀勵暕娴肩増妞傞梹?${finalAudioDuration.toFixed(1)} 缁夋妶);
          } else {
            updateStep(1, 'failed', '閺堫亙绗傛导鐘荤叾妫?);
            setProgressError('閺堫亙绗傛导鐘荤叾妫版垶鏋冩禒?);
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
            && cachedTts.emotion === emotion
            && cachedTts.voiceProvider === voiceProvider;
          if (canReuse) {
            audioUrl = cachedTts.audioUrl;
            finalAudioDuration = cachedTts.audioDuration;
            setAudioDuration(cachedTts.audioDuration);
            ttsReused = true;
          } else {
            try {
              const result = await dispatchTTS(audioText.trim());
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
                voiceProvider,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '鐠囶參鐓堕崥鍫熷灇婢惰精瑙?;
              toast.warning(`鐠囶參鐓堕崥鍫熷灇婢惰精瑙? ${msg}閿涘苯鐨㈢紒褏鐢婚悽鐔稿灇閺冪娀鐓舵０鎴ｎ潒妫版叢);
            }
          }
        }
        // 閼汇儴顕㈤棅鍐叉値閹存劕銇戠拹銉礄gallery閿涘鍨ㄩ弮鐘荤叾妫版垶妞傞梹鍖＄礄audio閿涘绱濋幐澶嬫瀮濡楀牆鐡ч弫棰佸強缁犳鐓舵０鎴炴闂€鍖＄礄娑擃厽鏋冪痪?.3鐎?缁夋帪绱?
        const estimatedDuration = finalAudioDuration > 0
          ? finalAudioDuration
          : Math.max(8, audioText.trim().length / 3.3 / Math.max(0.5, speed));
        const imageCount = Math.max(1, Math.ceil(estimatedDuration / perImageDuration));
        const durationLabel = finalAudioDuration > 0
          ? `${finalAudioDuration.toFixed(1)} 缁夋妶
          : `缁?${estimatedDuration.toFixed(1)} 缁夋帪绱欓幐澶婄摟閺侀鍙婄粻妤嬬礆`;
        updateStep(1, 'completed', `閺冨爼鏆?${durationLabel}閿涘苯鐨㈤悽鐔稿灇 ${imageCount} 瀵姴娴橀悧?{ttsReused ? '閿涘牆顦查悽銊ュ嚒鐠囨洖鎯夐棅鎶筋暥閿? : ''}`);
        if (audioText.trim()) {
          toast.success(`鐠囶參鐓?{mode === 'audio' ? '閺傚洣娆? : (ttsReused ? '婢跺秶鏁ゅ鑼晸閹存劙鐓舵０? : finalAudioDuration > 0 ? '閸氬牊鍨氱€瑰本鍨? : '婢惰精瑙﹂敍灞惧瘻鐎涙鏆熸导鎵暬')}閿涘本妞傞梹?${durationLabel}閿涘苯鐨㈤悽鐔稿灇 ${imageCount} 瀵姴娴橀悧鍥风礄濮?{perImageDuration}缁?瀵媴绱歚);
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
            toast.success('閼冲本娅欓棅鍏呯濞ｇ兘鐓剁€瑰本鍨?);
          } catch (err) {
            const msg = extractErrorMessage(err);
            updateStep(bgmStepIndex, 'failed', msg);
            toast.warning(`閼冲本娅欓棅鍏呯濞ｇ兘鐓舵径杈Е: ${msg}閿涘苯鐨㈡担璺ㄦ暏閸樼喖鐓舵０鎱?;
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
        const segResult = await splitTextToScenesSmart(audioText.trim(), { targetCount: imageCount });
        const imgSegments = segResult.segments;
        const splitTier = segResult.tier;
        const actualCount = imgSegments.length;
        updateStep(segIndex, 'completed', `鐠囶厺绠熼崚鍡樻焽娑?${actualCount} 濞?(text-seg v1.0)`);

        // Step 4: Generate image prompts with v9.0 strategy (client-side, no LLM)
        const optIndex = segIndex + 1;
        updateStep(optIndex, 'active');
        const promptResult = await generateImagePromptsSmart(imgSegments, audioText.trim());
        const optimizedPrompts = promptResult.prompts;
        const promptTier = promptResult.tier;
        updateStep(optIndex, 'completed', `閸?${optimizedPrompts.length} 閺夆剝褰佺粈楦跨槤 (prompt v9.0)`);
        toast.success(`閹绘劗銇氱拠宥勭喘閸栨牕鐣幋鎰剁礉閸?${optimizedPrompts.length} 閺夘晢);

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
        const CONCURRENCY = 2;
        const results = await batchParallel(
          optimizedPrompts,
          async (prompt, i) => {
            const record = galleryImageRecords[i];
            try {
              const res = await startImageGeneration({ prompt, size });
              let attempts = 0;
              const maxAttempts = 60;
              while (attempts < maxAttempts) {
                await new Promise((r) => setTimeout(r, 3000));
                const q = await queryImageGeneration(res.imageId);
                if (q.status === "completed" && q.publicUrl) {
                  await supabase.from("gallery_images").update({
                    image_url: q.publicUrl,
                    status: "success",
                    error_message: null,
                  }).eq("id", record.id);
                  completedCount++;
                  updateStep(imgIndex, "active", `${completedCount}/${actualCount}`);
                  return { success: true, index: i };
                }
                if (q.status === "failed") {
                  const errMsg = q.error || "??????";
                  await supabase.from("gallery_images").update({
                    status: "failed",
                    error_message: errMsg,
                  }).eq("id", record.id);
                  return { success: false, index: i, error: errMsg };
                }
                attempts++;
              }
              const errMsg = "??????";
              await supabase.from("gallery_images").update({
                status: "failed",
                error_message: errMsg,
              }).eq("id", record.id);
              return { success: false, index: i, error: errMsg };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await supabase.from("gallery_images").update({
                status: "failed",
                error_message: msg,
              }).eq("id", record.id);
              return { success: false, index: i, error: msg };
            }
          },
          CONCURRENCY,
          IMAGE_DELAY_MS,
        );
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          const failReasons = failed.map((r) => `缁?{(r as { index: number }).index + 1}瀵? ${(r as { error?: string }).error || '閺堫亞鐓￠柨娆掝嚖'}`).join('閿?);
          updateStep(imgIndex, 'failed', `${completedCount}/${actualCount}閿?{failReasons}`);
          toast.warning(`${failed.length} 瀵姴娴橀悧鍥╂晸閹存劕銇戠拹? ${failReasons}`);
        } else {
          updateStep(imgIndex, 'completed', `${completedCount}/${actualCount}`);
        }

        const successCount = results.filter((r) => (r as { success: boolean }).success).length;
        if (successCount === 0) {
          const allErrors = results.map((r, i) => !(r as { success: boolean }).success ? `缁?{i + 1}瀵? ${(r as { error?: string }).error || '閺堫亞鐓￠柨娆掝嚖'}` : '').filter(Boolean).join('閿?);
          setProgressError(`閹碘偓閺堝娴橀悧鍥╂晸閹存劕銇戠拹銉礉閺冪姵纭堕崥鍫熷灇鐟欏棝顣堕妴鍌炴晩鐠囶垵顕涢幆? ${allErrors}`);
          setIsGenerating(false);
          return;
        }

        // If some images failed, stop auto-synthesis and guide user to GalleryPage
        if (failed.length > 0) {
          await supabase.from('video_tasks').update({
            status: 'images_ready',
            error_message: `${failed.length} 瀵姴娴橀悧鍥╂晸閹存劕銇戠拹顧?
          }).eq('id', task.id);
          updateStep(imgIndex, 'failed', `${completedCount}/${actualCount}閿涘苯鍑￠崑婊勵剾閼奉亜濮╅崥鍫熷灇閵嗗倽顕崜宥呯窔娴犺濮熺拠锔藉剰妞ょ敻鍣搁弬鎵晸閹存劕銇戠拹銉ф畱閸ュ墽澧栭敍宀€鍔ч崥搴㈠閸斻劌鎮庨獮鎯邦潒妫版垯鈧繖);
          toast.error(`${failed.length} 瀵姴娴橀悧鍥╂晸閹存劕銇戠拹銉礉瀹告彃浠犲銏ｅ殰閸斻劌鎮庨幋鎰┾偓鍌濐嚞閸撳秴绶氶妴灞兼崲閸斅ゎ嚊閹懌鈧秹銆夐棃銏ゅ櫢閺傛壆鏁撻幋鎰亼鐠愩儳娈戦崶鍓у閵嗕繖);
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

        updateStep(vidIndex, 'active', `鐟欏棝顣跺〒鍙夌厠娑擃叏绱濇０鍕吀缁绢垱瑕嗛弻鎾跺 ${estSeconds} 缁夋帇鈧倹鏁為敍姘愁潒妫版垹鏁卞ù蹇氼潔閸ｃ劌鐤勯弮璺虹秿閸掕泛鎮庨幋鎰剁礉閺冨爼鏆辨稉搴ㄧ叾妫版垳绔撮懛杈剧幢閻㈢喐鍨氱€瑰本鍨氶崥搴″讲閸撳秴绶氶妴灞藉坊閸欒尪顔囪ぐ鏇樷偓宥嗙叀閻绮ㄩ弸娓€);
        try {
          // 6a: Base version (voice + images only)
          let baseVideoUrl: string | null = null;
          if (generateBase) {
            updateStep(vidIndex, 'active', `濮濓絽婀崥鍫熷灇閸╄櫣顢呴悧鍫ｎ潒妫版埊绱欑拠顓㈢叾+閻㈠娼伴敍?{estSeconds} 缁夋妶);
            const baseBlob = await createSlideshowVideo(
              validImages,
              audioUrl || null,
              imageEffect,
              transitionEffect,
              30,
              (progress) => {
                updateStep(vidIndex, 'active', `閸╄櫣顢呴悧鍫ｎ潒妫版垶瑕嗛弻鎾茶厬 ${progress}%`);
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
            updateStep(vidIndex, 'active', `濮濓絽婀崥鍫熷灇閺佹潙鎮庨悧鍫ｎ潒妫版埊绱欑拠顓㈢叾+閼冲本娅欓棅鍏呯+鐎涙绠烽敍?{estSeconds} 缁夋妶);

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
                updateStep(vidIndex, 'active', `閺佹潙鎮庨悧鍫ｎ潒妫版垶瑕嗛弻鎾茶厬 ${progress}%`);
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
            toast.error('鐟欏棝顣跺鑼晸閹存劧绱濇担鍡欏Ц閹焦娲块弬鏉裤亼鐠愩儻绱濈拠宄板煕閺傛澘宸婚崣鑼额唶瑜版洘鐓￠惇?);
          }

          const completedMsg = baseVideoUrl && mergedVideoUrl
            ? '閸╄櫣顢呴悧鍫滅瑢閺佹潙鎮庨悧鍫濇綆瀹告彃鐣幋?
            : baseVideoUrl
              ? '閸╄櫣顢呴悧鍫濆嚒鐎瑰本鍨?
              : mergedVideoUrl
                ? '閺佹潙鎮庨悧鍫濆嚒鐎瑰本鍨?
                : '鐟欏棝顣堕悽鐔稿灇鐎瑰本鍨?;
          updateStep(vidIndex, 'completed', completedMsg);
          toast.success(completedMsg + '閿?);
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
          setProgressError(`鐟欏棝顣堕崥鍫熷灇婢惰精瑙? ${msg}閿涘苯鍑℃穱婵嗙摠閸ュ墽澧栭敍灞惧亶閸欘垯浜掓潻娑樺弳閸ュ墽澧栫粻锛勬倞妞ょ敻娼伴幍瀣З閸氬牊鍨歚);
          toast.error(`鐟欏棝顣堕崥鍫熷灇婢惰精瑙? ${msg}閿涘苯鍑℃穱婵嗙摠閸ュ墽澧栭敍灞惧亶閸欘垯浜掓潻娑樺弳閸ュ墽澧栫粻锛勬倞妞ょ敻娼伴幍瀣З閸氬牊鍨歚);
          setTimeout(() => { setProgressOpen(false); navigate(`/gallery/${task.id}`); }, 1200);
        }
        setIsGenerating(false);
        return;
      }

      // --- Batch mode: create parent + child tasks, generate TTS and images for each segment ---
      if (mode === 'batch') {
        if (!isImageGenerationAvailable()) {
          toast.error('閸掑棙顔岀憴鍡涱暥闂団偓鐟曚椒濞囬悽銊ユ禈閻楀洨鏁撻幋鎰閼虫枻绱濈拠宄版躬閵嗗瓑PI鐠佸墽鐤嗛妴宥佸晪閵嗗苯娴橀悧鍥侀崹瀣ㄢ偓宥勮厬闁瀚ㄦ稉鈧稉顏勫讲閻劎娈戝Ο鈥崇€烽敍鍫濆讲閻忛潧鍞寸純鐡礗閵嗕礁宓嗗锕€鍞寸純鐡礗閵嗕箓idu閼奉亜鐣炬稊鍫縋I閵嗕府iniMax閼奉亜鐣炬稊鍫縋I閵嗕礁鏅㈠Ч顥筫nseNova閼奉亜鐣炬稊鍫縋I缁涘绱?);
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
          toast.error('鐠囩柉鍤︾亸鎴ｇ翻閸忋儰绔村▓鍨瀮濡楀牊鍨ㄦ稉濠佺炊娑撯偓娑擃亪鐓舵０?);
          setIsGenerating(false);
          return;
        }

        updateStep(0, 'active');
        const parentTask = await createVideoTask({
          mode: 'batch',
          prompt: batchInputText.trim() || '閸掑棙顔岀憴鍡涱暥',
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
        updateStep(1, 'completed', `瀹告彃鍨卞?${segments.length} 娑擃亜鍨庡▓鍏告崲閸旑摝);

        // Parallel TTS + image generation for each child task
        updateStep(2, 'active', `濮濓絽婀悽鐔稿灇閸氬嫬鍨庡▓鐢垫畱鐠囶參鐓舵稉搴℃禈閻?0/${segments.length}`);
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
                // Stagger TTS calls to avoid Supabase auth token lock conflicts
                if (child.index > 0) {
                  await new Promise(r => setTimeout(r, TTS_STAGGER_MS));
                }
                try {
                  const ttsResult = await dispatchTTS(child.text);
                  segAudioUrl = ttsResult.audioUrl;
                  segAudioDuration = ttsResult.audioLength;
                } catch (err) {
            const msg = extractErrorMessage(err);
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
                      await supabase.from('gallery_images').update({ status: 'failed', error_message: q.error || '閸ュ墽澧栭悽鐔稿灇婢惰精瑙? }).eq('id', record.id);
                      break;
                    }
                    attempts++;
                  }
                  if (attempts >= maxAttempts) {
                    await supabase.from('gallery_images').update({ status: 'failed', error_message: '閸ュ墽澧栭悽鐔稿灇鐡掑懏妞? }).eq('id', record.id);
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
                error_message: failCount > 0 ? `${failCount} 瀵姴娴橀悧鍥╂晸閹存劕銇戠拹顧?: null,
              }).eq('id', child.id);

              completedSegments++;
              updateStep(2, 'active', `濮濓絽婀悽鐔稿灇閸氬嫬鍨庡▓鐢垫畱鐠囶參鐓舵稉搴℃禈閻?${completedSegments}/${segments.length}`);
              return { success: true, childId: child.id };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[Batch] Segment ${child.index} failed:`, msg);
              await supabase.from('video_tasks').update({ status: 'failed', error_message: msg }).eq('id', child.id);
              return { success: false, childId: child.id, error: msg };
            }
          },
          CONCURRENCY,
          IMAGE_DELAY_MS,
        );

        const allFailed = segmentResults.every((r) => (r as { success?: boolean }).success === false);
        if (allFailed) {
          const firstErr = (segmentResults.find((r) => (r as { error?: string }).error) as { error?: string })?.error || '閹碘偓閺堝鍨庡▓鐢垫晸閹存劕銇戠拹?;
          await supabase.from('video_tasks').update({ status: 'failed', error_message: firstErr }).eq('id', parentTask.id);
          updateStep(2, 'failed', firstErr);
          setProgressError(`閻㈢喐鍨氭径杈Е: ${firstErr}`);
          toast.error(`閻㈢喐鍨氭径杈Е: ${firstErr}`);
        } else {
          updateStep(2, 'completed', `${completedSegments}/${segments.length} 娑擃亜鍨庡▓闈涘嚒鐎瑰本鍨氱拠顓㈢叾娑撳骸娴橀悧鍥╂晸閹存亝);
          toast.success(`瀹歌尙鏁撻幋?${completedSegments} 娑擃亜鍨庡▓纰夌礉鐠囧嘲澧犲鈧崚鍡橆唽缁狅紕鎮婃い鐢告桨閸氬牊鍨氱憴鍡涱暥`);
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
          if (!remixVideoUrl) throw new Error('缂傚搫鐨┃鎰潒妫?);
          const res = await startRemixVideo({ videoUrl: remixVideoUrl, prompt: effectivePrompt });
          videoId = res.videoId; status = res.status;
        }
        await supabase.from('video_tasks').update({ video_id: videoId, status }).eq('id', task.id);
        updateStep(1, 'completed');
        updateStep(2, 'active', '鐟欏棝顣堕悽鐔稿灇娑擃叏绱濋柅姘埗闂団偓鐟?-10閸掑棝鎸?..');
        toast.success('娴犺濮熷鍙夊絹娴溿倧绱濆鈧慨瀣晸閹存劘顫嬫０?);
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
              if (!remixVideoUrl) throw new Error('缂傚搫鐨┃鎰潒妫?);
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
              error_message: msg || '閺堫亞鐓￠柨娆掝嚖',
            }).eq('id', seg.taskId);
            if (updateErr) console.error('[CreatePage] Failed to update segment status:', updateErr);
            return { success: false, taskId: seg.taskId, error: msg };
          }
        },
        CONCURRENCY,
        IMAGE_DELAY_MS,
      );

      updateStep(1, 'completed');

      // Sync parent status: if all children failed, mark parent as failed too
      const allFailed = results.every((r) => {
        const rec = r as { success?: boolean } | undefined;
        return rec && rec.success === false;
      });
      if (allFailed) {
        const firstError = (results.find((r) => (r as { error?: string })?.error) as { error?: string })?.error || '閹碘偓閺堝澧栧▓鐢垫晸閹存劕銇戠拹?;
        await supabase.from('video_tasks').update({
          status: 'failed',
          error_message: firstError,
        }).eq('id', parentTask.id);
        updateStep(2, 'failed', firstError);
        setProgressError(`閻㈢喐鍨氭径杈Е: ${firstError}`);
        toast.error(`閻㈢喐鍨氭径杈Е: ${firstError}`);
      } else {
        updateStep(2, 'active', `${totalSegments} 娑擃亞澧栧▓闈涜嫙鐞涘瞼鏁撻幋鎰厬閿涘矁顕懓鎰妇缁涘绶?..`);
        toast.success(`瀹稿弶褰佹禍?${totalSegments} 娑擃亞澧栧▓鍏告崲閸斺槄绱濆В蹇斿閺堚偓婢?${CONCURRENCY} 娑擃亜鑻熺悰宀€鏁撻幋鎭?;
        setTimeout(() => setProgressOpen(false), 600);
      }
      navigate(`/progress/${parentTask.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      console.error('Generate error:', err);
      toast.error(`閹绘劒姘︽径杈Е: ${msg}`);
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
              voiceProvider={voiceProvider}
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
