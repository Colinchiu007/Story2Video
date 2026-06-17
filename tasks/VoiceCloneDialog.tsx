import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Upload, X, Play, Pause, Trash2, User, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cloneVoice, getUserVoices, deleteUserVoice } from '@/services/video';
import { supabase } from '@/db/supabase';
import type { UserVoice } from '@/types';

interface VoiceCloneDialogProps {
  onSelectVoice?: (voiceId: string, name: string) => void;
  trigger?: React.ReactNode;
}

export default function VoiceCloneDialog({ onSelectVoice, trigger }: VoiceCloneDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'clone' | 'list'>('clone');
  const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Clone form state
  const [voiceName, setVoiceName] = useState('');
  const [voiceDesc, setVoiceDesc] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCloning, setIsCloning] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const voices = await getUserVoices();
      setUserVoices(voices);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchVoices();
    }
  }, [open, fetchVoices]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Estimate duration
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          setAudioDuration(audio.duration);
        };
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      toast.error('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('仅支持音频文件');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('音频文件不能超过 50MB');
      return;
    }

    try {
      const ext = file.name.split('.').pop() ?? 'webm';
      const path = `voice-clone/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('generated-audio').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('generated-audio').getPublicUrl(path);
      setAudioUrl(data.publicUrl);

      // Get duration
      const audio = new Audio(data.publicUrl);
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };
      toast.success('音频上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败';
      toast.error(`上传失败: ${msg}`);
    }
  };

  const handleClone = async () => {
    if (!voiceName.trim()) {
      toast.error('请为音色命名');
      return;
    }
    if (!audioUrl) {
      toast.error('请先上传或录制音频样本');
      return;
    }
    if (audioDuration > 0 && audioDuration < 8) {
      toast.error('音频样本需至少 8 秒，建议 15-60 秒以获得更好效果');
      return;
    }

    setIsCloning(true);
    try {
      const result = await cloneVoice({
        name: voiceName.trim(),
        description: voiceDesc.trim(),
        audioUrl,
        duration: Math.round(audioDuration),
      });

      if (result.status === 'forbidden') {
        toast.error(result.message, { duration: 8000 });
      } else if (result.status === 'error') {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        setVoiceName('');
        setVoiceDesc('');
        setAudioUrl('');
        setAudioDuration(0);
        setActiveTab('list');
        fetchVoices();
        if (onSelectVoice && result.voiceId) {
          onSelectVoice(result.voiceId, voiceName.trim());
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '克隆失败';
      toast.error(`克隆失败: ${msg}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserVoice(id);
      setUserVoices((prev) => prev.filter((v) => v.id !== id));
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="h-3 w-3" /> 可用
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <Clock className="h-3 w-3" /> 处理中
          </span>
        );
      case 'forbidden':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-orange-400">
            <AlertCircle className="h-3 w-3" /> 权限不足
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> 失败
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            <User className="h-4 w-4 mr-1" />
            我的音色
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">音色克隆</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              activeTab === 'clone'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('clone')}
          >
            克隆新音色
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              activeTab === 'list'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('list')}
          >
            我的音色 ({userVoices.length})
          </button>
        </div>

        {activeTab === 'clone' && (
          <div className="space-y-5 pt-2">
            {/* Audio input */}
            <div className="space-y-3">
              <Label>音频样本 <span className="text-muted-foreground font-normal">(建议 15-60 秒)</span></Label>

              {!audioUrl ? (
                <div className="flex flex-col gap-3">
                  {/* Record */}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={isRecording ? 'default' : 'outline'}
                      onClick={isRecording ? stopRecording : startRecording}
                      className={isRecording ? 'bg-destructive hover:bg-destructive/90' : ''}
                    >
                      {isRecording ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          停止录制 ({formatTime(recordingTime)})
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-1" />
                          开始录音
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Upload */}
                  <div
                    className="border border-dashed border-border rounded-sm p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary transition-colors bg-muted/20"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">点击上传音频文件</span>
                    <span className="text-xs text-muted-foreground">支持 MP3 / WAV / M4A / WEBM，≤ 50MB</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 border border-border rounded-sm bg-muted/20">
                  <audio ref={audioRef} src={audioUrl} controls className="flex-1 h-9" />
                  <button
                    type="button"
                    className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground shrink-0"
                    onClick={() => {
                      setAudioUrl('');
                      setAudioDuration(0);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>音色名称 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="例如：我的声音"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>备注说明</Label>
              <Textarea
                placeholder="可选：描述这个音色的特点"
                value={voiceDesc}
                onChange={(e) => setVoiceDesc(e.target.value)}
                rows={2}
                className="bg-background border-border resize-none"
              />
            </div>

            {/* Duration hint */}
            {audioDuration > 0 && (
              <p className="text-xs text-muted-foreground">
                音频时长: {formatTime(Math.round(audioDuration))}
                {audioDuration < 15 && '（建议 15 秒以上以获得更好效果）'}
              </p>
            )}

            {/* Clone button */}
            <Button
              onClick={handleClone}
              disabled={isCloning || !voiceName.trim() || !audioUrl}
              className="w-full"
            >
              {isCloning ? '克隆中...' : '开始克隆'}
            </Button>

            <p className="text-xs text-muted-foreground leading-relaxed">
              首次使用克隆音色进行语音合成时，MiniMax 将扣除音色解锁费用。请确保音频为清晰的人声干声，避免背景音乐和噪音。
            </p>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-3 pt-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">加载中...</p>
            ) : userVoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无克隆音色</p>
            ) : (
              userVoices.map((voice) => (
                <div
                  key={voice.id}
                  className="flex items-center gap-3 p-3 border border-border rounded-sm bg-muted/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{voice.name}</span>
                      {statusBadge(voice.status)}
                    </div>
                    {voice.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{voice.description}</p>
                    )}
                    {voice.duration_seconds && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        时长: {formatTime(voice.duration_seconds)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {voice.status === 'ready' && voice.voice_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onSelectVoice?.(voice.voice_id!, voice.name);
                          setOpen(false);
                        }}
                      >
                        选用
                      </Button>
                    )}
                    {voice.sample_audio_url && (
                      <a
                        href={voice.sample_audio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground"
                        title="试听样本"
                      >
                        <Play className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground"
                      onClick={() => handleDelete(voice.id)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
