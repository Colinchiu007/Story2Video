import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { generateTTS } from '@/services/tts';
import { generateMimoTTS, getMimoVoiceNameFromId } from '@/services/tts-mimo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { extractErrorMessage } from '@/services/api-config';

interface CachedTts {
  audioUrl: string;
  audioDuration: number;
  text: string;
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  emotion: string;
  voiceProvider: 'doubao' | 'mimo';
}

interface UseTTSPreviewOptions {
  audioText: string;
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  emotion: string;
  voiceProvider: 'doubao' | 'mimo';
  isDoubaoClonedVoice: (id: string) => boolean;
  isMimoClonedVoice: (id: string) => boolean;
}

interface UseTTSPreviewReturn {
  audioPreview: string;
  isPreviewingAudio: boolean;
  isPlayingPreview: boolean;
  audioDuration: number;
  cachedTts: CachedTts | null;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  setAudioPreview: (v: string) => void;
  setAudioDuration: (v: number) => void;
  setCachedTts: (v: CachedTts | null) => void;
  setIsPlayingPreview: (v: boolean) => void;
  blobToBase64: (blob: Blob) => Promise<string>;
  recognizeAudio: (audioBlob: Blob, format?: 'wav' | 'm4a') => Promise<string>;
  handlePreviewAudio: () => Promise<void>;
}

export function useTTSPreview(options: UseTTSPreviewOptions): UseTTSPreviewReturn {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [audioPreview, setAudioPreview] = useState('');
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [cachedTts, setCachedTts] = useState<CachedTts | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    audioText, voiceId, speed, vol, pitch, emotion, voiceProvider,
    isDoubaoClonedVoice, isMimoClonedVoice,
  } = options;

  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const recognizeAudio = useCallback(async (audioBlob: Blob, format: 'wav' | 'm4a' = 'wav'): Promise<string> => {
    const speechBase64 = await blobToBase64(audioBlob);
    const len = audioBlob.size;
    const { data, error } = await supabase.functions.invoke('short-speech-recognition', {
      body: { speech: speechBase64, len, format, rate: 16000, cuid: 'web-user-cuid' },
    });
    if (error) throw new Error(extractErrorMessage(error));
    if (data?.err_no !== 0) throw new Error(data?.err_msg || `语音识别失败 ${data?.err_no}`);
    return data.result?.[0] ?? '';
  }, [blobToBase64]);

  const handlePreviewAudio = useCallback(async () => {
    if (!user) {
      toast.error('请先登录后再使用语音合成功能');
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    if (!audioText.trim()) {
      toast.error('请先输入音频文本');
      return;
    }
    if (audioRef.current && isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }
    if (audioRef.current && audioPreview && !isPlayingPreview) {
      // 如果文字或参数有变化，重新生成而非播放旧缓存
      if (cachedTts && (
        cachedTts.text !== audioText.trim() ||
        cachedTts.voiceId !== voiceId ||
        cachedTts.speed !== speed ||
        cachedTts.vol !== vol ||
        cachedTts.pitch !== pitch ||
        cachedTts.emotion !== emotion
      )) {
        audioRef.current = null;
        setAudioPreview('');
        setCachedTts(null);
      } else {
        audioRef.current.play().catch(() => toast.error('播放失败'));
        setIsPlayingPreview(true);
        return;
      }
    }
    setIsPreviewingAudio(true);
    try {
      const mimoCloned = voiceProvider === 'mimo' && isMimoClonedVoice(voiceId);
      const result = voiceProvider === 'mimo'
        ? await generateMimoTTS({
            text: audioText.trim(),
            voice: mimoCloned ? undefined : getMimoVoiceNameFromId(voiceId),
            voiceRecordId: mimoCloned ? voiceId : undefined,
            model: mimoCloned ? 'mimo-v2.5-tts-voiceclone' : 'mimo-v2.5-tts',
            speed,
          })
        : await generateTTS({
            text: audioText.trim(),
            voiceId,
            speed,
            vol,
            pitch,
            emotion: emotion === 'default' ? undefined : emotion,
            cluster: isDoubaoClonedVoice(voiceId) ? 'volcano_icl' : undefined,
          });
      setAudioPreview(result.audioUrl);
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
      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
      audio.onpause = () => setIsPlayingPreview(false);
      audio.onplay = () => setIsPlayingPreview(true);
      audio.play().catch(() => toast.error('播放失败'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '音频生成失败';
      toast.error(`音频预览失败: ${msg}`);
    } finally {
      setIsPreviewingAudio(false);
    }
  }, [user, navigate, audioText, voiceId, speed, vol, pitch, emotion, voiceProvider, isDoubaoClonedVoice, isMimoClonedVoice, isPlayingPreview, audioPreview]);

  return {
    audioPreview, isPreviewingAudio, isPlayingPreview, audioDuration, cachedTts,
    audioRef,
    setAudioPreview, setAudioDuration, setCachedTts, setIsPlayingPreview,
    blobToBase64, recognizeAudio, handlePreviewAudio,
  };
}
