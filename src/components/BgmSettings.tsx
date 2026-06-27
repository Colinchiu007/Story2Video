import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Upload, Volume2, Play, Pause, X, Edit2, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { getAllBgmTracks, saveCustomBgmTracks, type BgmTrack } from '@/lib/bgm-library';

export interface BgmConfig {
  enabled: boolean;
  url: string;
  volume: number; // 1-10
  name: string;
}

export interface BgmLibraryItem {
  id: string;
  name: string;
  url: string;
  isBuiltIn: boolean;
}

interface BgmSettingsProps {
  config: BgmConfig;
  onChange: (config: BgmConfig) => void;
  disabled?: boolean;
}

// Built-in BGM library - 由 src/lib/bgm-library.ts 管理（生产 Audio CDN）
// 如需更改 BGM 源，修改 src/lib/bgm-library.ts 中的 DEFAULT_BGMS
const getDefaultBuiltIn = (): BgmLibraryItem[] =>
  getAllBgmTracks().map((t) => ({ ...t, isBuiltIn: true }));

// 自定义 BGM 通过 bgm-library 模块存取
const MAX_UPLOAD_MB = 15;

function getStoredLibrary(): BgmLibraryItem[] {
  // Load from bgm-library module (built-in + custom from localStorage)
  const all = getAllBgmTracks();
  // Reset built-in tracks if any have empty URLs (legacy data)
  const hasEmptyBuiltIn = all.some((item) => item.isBuiltIn && !item.url);
  if (!hasEmptyBuiltIn) return all.map((t) => ({ ...t }));
  return getDefaultBuiltIn();
}

function saveLibrary(lib: BgmLibraryItem[]) {
  saveCustomBgmTracks(lib.filter((t) => !t.isBuiltIn));
}

function truncateName(name: string, maxLen = 8): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + '…';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BgmSettings({ config, onChange, disabled }: BgmSettingsProps) {
  const [library, setLibrary] = useState<BgmLibraryItem[]>(getStoredLibrary);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  // Global play state with progress
  const [playState, setPlayState] = useState<{
    id: string | null;
    name: string;
    progress: number; // 0-1
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  }>({ id: null, name: '', progress: 0, currentTime: 0, duration: 0, isPlaying: false });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Update progress periodically
  useEffect(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (playState.isPlaying && audioRef.current) {
      progressTimerRef.current = window.setInterval(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const dur = audio.duration || 0;
        const cur = audio.currentTime || 0;
        setPlayState((prev) => ({
          ...prev,
          progress: dur > 0 ? cur / dur : 0,
          currentTime: cur,
          duration: dur,
        }));
      }, 250);
    }
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, [playState.isPlaying]);

  const syncToDb = useCallback(async (lib: BgmLibraryItem[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        bgm_config: lib,
      }, { onConflict: 'user_id' });
    } catch { /* ignore */ }
  }, []);

  const handleToggle = (checked: boolean) => {
    onChange({ ...config, enabled: checked });
  };

  const playPreview = (id: string, url: string, name: string) => {
    if (!url) {
      toast.info('该背景音乐暂未上传音频文件');
      return;
    }
    if (playState.id === id && playState.isPlaying) {
      audioRef.current?.pause();
      setPlayState((prev) => ({ ...prev, isPlaying: false }));
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.volume = config.volume / 10;
    audioRef.current = audio;
    audio.play().catch(() => toast.error('播放失败'));
    audio.onended = () => {
      setPlayState({ id: null, name: '', progress: 0, currentTime: 0, duration: 0, isPlaying: false });
    };
    audio.onloadedmetadata = () => {
      setPlayState({
        id,
        name,
        progress: 0,
        currentTime: 0,
        duration: audio.duration || 0,
        isPlaying: true,
      });
    };
    setPlayState({
      id,
      name,
      progress: 0,
      currentTime: 0,
      duration: audio.duration || 0,
      isPlaying: true,
    });
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !playState.duration) return;
    const newTime = value[0] * playState.duration;
    audio.currentTime = newTime;
    setPlayState((prev) => ({
      ...prev,
      progress: value[0],
      currentTime: newTime,
    }));
  };

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !playState.id) return;
    if (playState.isPlaying) {
      audio.pause();
      setPlayState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audio.play().catch(() => toast.error('播放失败'));
      setPlayState((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('仅支持音频文件（MP3/WAV）');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`音频文件不能超过 ${MAX_UPLOAD_MB}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? 'mp3';
      const path = `bgm-uploads/${crypto.randomUUID()}.${ext}`;
      // Simulate progress since supabase-js storage upload doesn't support onUploadProgress
      const progressTimer = window.setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 8) + 2;
        });
      }, 300);
      const { error } = await supabase.storage.from('generated-audio').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      window.clearInterval(progressTimer);
      if (error) throw error;
      const { data } = supabase.storage.from('generated-audio').getPublicUrl(path);
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      const newItem: BgmLibraryItem = {
        id: crypto.randomUUID(),
        name: truncateName(rawName, 12),
        url: data.publicUrl,
        isBuiltIn: false,
      };
      const updated = [...library, newItem];
      setLibrary(updated);
      saveLibrary(updated);
      await syncToDb(updated);
      onChange({ ...config, url: data.publicUrl, name: newItem.name });
      toast.success('背景音乐上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败';
      toast.error(`上传失败: ${msg}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetId) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('仅支持音频文件（MP3/WAV）');
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`音频文件不能超过 ${MAX_UPLOAD_MB}MB`);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? 'mp3';
      const path = `bgm-uploads/${crypto.randomUUID()}.${ext}`;
      const progressTimer = window.setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 8) + 2;
        });
      }, 300);
      const { error } = await supabase.storage.from('generated-audio').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      window.clearInterval(progressTimer);
      if (error) throw error;
      const { data } = supabase.storage.from('generated-audio').getPublicUrl(path);
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      const newName = truncateName(rawName, 10);

      const updated = library.map((item) =>
        item.id === replaceTargetId
          ? { ...item, name: newName, url: data.publicUrl }
          : item
      );
      setLibrary(updated);
      saveLibrary(updated);
      await syncToDb(updated);

      // If currently selected, update config
      if (config.url === library.find((i) => i.id === replaceTargetId)?.url) {
        onChange({ ...config, url: data.publicUrl, name: newName });
      }

      toast.success('音频替换成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '替换失败';
      toast.error(`替换失败: ${msg}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setReplaceTargetId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleSelect = (item: BgmLibraryItem) => {
    if (!item.url) {
      toast.info('该背景音乐暂未配置音频文件');
      return;
    }
    onChange({ ...config, url: item.url, name: item.name });
  };

  const startEdit = (item: BgmLibraryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    const updated = library.map((i) => (i.id === editingId ? { ...i, name: editName.trim() } : i));
    setLibrary(updated);
    saveLibrary(updated);
    syncToDb(updated);
    if (config.url === library.find((i) => i.id === editingId)?.url) {
      onChange({ ...config, name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleDeleteCustom = (id: string) => {
    const item = library.find((i) => i.id === id);
    if (item?.url && config.url === item.url) {
      onChange({ ...config, url: '', name: '' });
    }
    const updated = library.filter((i) => i.id !== id);
    setLibrary(updated);
    saveLibrary(updated);
    syncToDb(updated);
  };

  const isCustomSelected = config.url && !library.some((b) => b.isBuiltIn && b.url === config.url);

  const handleReplaceClick = (itemId: string) => {
    setReplaceTargetId(itemId);
    replaceInputRef.current?.click();
  };

  return (
    <div className="space-y-4 border border-border rounded-sm p-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Checkbox
          id="bgm-enabled"
          checked={config.enabled}
          onCheckedChange={(v) => handleToggle(v === true)}
          disabled={disabled}
        />
        <Label htmlFor="bgm-enabled" className="font-medium cursor-pointer">
          <Music className="h-4 w-4 inline mr-1 text-primary" />
          添加背景音乐
        </Label>
      </div>

      {config.enabled && (
        <div className="space-y-4 pt-2">
          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">背景音乐音量</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{config.volume}</span>
            </div>
            <Slider
              value={[config.volume]}
              onValueChange={(v) => onChange({ ...config, volume: v[0] })}
              min={1}
              max={10}
              step={1}
              disabled={disabled}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>轻</span>
              <span>响</span>
            </div>
          </div>

          {/* Global Player with progress */}
          {playState.id && (
            <div className="border border-primary/30 bg-primary/5 rounded-sm p-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="shrink-0 p-1.5 rounded-sm hover:bg-primary/10 transition-colors"
                >
                  {playState.isPlaying ? (
                    <Pause className="h-4 w-4 text-primary" />
                  ) : (
                    <Play className="h-4 w-4 text-primary" />
                  )}
                </button>
                <span className="text-xs font-medium truncate flex-1 min-w-0">{playState.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {formatTime(playState.currentTime)} / {formatTime(playState.duration)}
                </span>
              </div>
              <Slider
                value={[playState.progress]}
                onValueChange={handleSeek}
                min={0}
                max={1}
                step={0.001}
                disabled={!playState.duration}
              />
            </div>
          )}

          {/* Music library */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">音乐库</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {library.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-sm border transition-colors ${
                    config.url === item.url
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled || !item.url}
                    onClick={() => handleSelect(item)}
                    className="flex-1 text-left truncate disabled:opacity-50"
                  >
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.stopPropagation(); saveEdit(); }
                            if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 text-xs px-1 py-0"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                          className="shrink-0 p-0.5 hover:bg-muted rounded"
                        >
                          <Save className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className="truncate block"
                        onDoubleClick={() => startEdit(item)}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    )}
                  </button>

                  {/* Play button */}
                  {item.url && (
                    <button
                      type="button"
                      className="shrink-0 p-0.5 hover:bg-muted rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPreview(item.id, item.url, item.name);
                      }}
                    >
                      {playState.id === item.id && playState.isPlaying ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                  )}

                  {/* Replace upload button for all items */}
                  <button
                    type="button"
                    className="shrink-0 p-0.5 hover:bg-muted rounded text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplaceClick(item.id);
                    }}
                    title="替换音频"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>

                  {/* Delete for custom */}
                  {!item.isBuiltIn && editingId !== item.id && (
                    <button
                      type="button"
                      className="shrink-0 p-0.5 hover:bg-muted rounded text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustom(item.id);
                      }}
                      title="删除"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}

                  {/* Edit name for built-in */}
                  {item.isBuiltIn && editingId !== item.id && (
                    <button
                      type="button"
                      className="shrink-0 p-0.5 hover:bg-muted rounded text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(item);
                      }}
                      title="修改名称"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Replace upload hidden input */}
          <input
            ref={replaceInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/*"
            className="hidden"
            onChange={handleReplaceUpload}
          />

          {/* Custom upload */}
          <div className="space-y-2">
            <Label className="text-sm">上传自定义音频（MP3/WAV，≤{MAX_UPLOAD_MB}MB）</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-1" />
                {isUploading ? '上传中...' : '上传音频'}
              </Button>
              {isCustomSelected && config.name && (
                <div className="flex items-center gap-1 text-xs text-primary">
                  <span className="truncate max-w-[120px]">{config.name}</span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, url: '', name: '' })}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {isUploading && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="w-full h-1.5" />
                <p className="text-xs text-muted-foreground text-right">{uploadProgress}%</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
}
