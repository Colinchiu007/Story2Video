import React from 'react';
import { User, SlidersHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import VoiceCloneDialog from '@/components/VoiceCloneDialog';
import { VOICE_CATEGORIES, MIMO_PRESET_VOICES, DEFAULT_VOICE_ID, EMOTION_OPTIONS } from '@/constants/voices';
import type { UserVoice } from '@/types';

interface VoiceSectionProps {
  voiceId: string;
  setVoiceId: (v: string) => void;
  saveLastVoice: (id: string) => void;
  voiceProvider: 'doubao' | 'mimo';
  doubaoVoice: { id: string; name: string } | null;
  userVoices: UserVoice[];
  handleSelectClonedVoice: (voiceId: string, name: string, provider?: 'doubao' | 'mimo') => void;
  speed: number;
  setSpeed: (v: number) => void;
  vol: number;
  setVol: (v: number) => void;
  pitch: number;
  setPitch: (v: number) => void;
  emotion: string;
  setEmotion: (v: string) => void;
  showVoiceSettings: boolean;
  setShowVoiceSettings: (v: boolean) => void;
}

export default function VoiceSection({
  voiceId, setVoiceId, saveLastVoice, voiceProvider, doubaoVoice, userVoices,
  handleSelectClonedVoice,
  speed, setSpeed, vol, setVol, pitch, setPitch, emotion, setEmotion,
  showVoiceSettings, setShowVoiceSettings,
}: VoiceSectionProps) {
  const presetList = voiceProvider === 'mimo' ? MIMO_PRESET_VOICES : VOICE_CATEGORIES;
  const clonedVoices = userVoices.filter((voice) => {
    // provider 列缺失时（migration 00021 未部署），显示所有音色
    if (voice.provider == null) return true;
    return voice.provider === voiceProvider;
  });
  const visibleLegacyVoice = voiceProvider === 'doubao' ? doubaoVoice : null;

  React.useEffect(() => {
    const isKnownMimoClone = userVoices.some((voice) => voice.provider === 'mimo' && voice.id === voiceId);
    const isMimoPreset = voiceId.startsWith('mimo_default_');
    const looksLikeRecordId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(voiceId);

    if (voiceProvider === 'mimo' && (isMimoPreset || isKnownMimoClone || looksLikeRecordId)) return;
    if (voiceProvider === 'doubao' && !isMimoPreset && !isKnownMimoClone) return;

    const defaultVoiceId = voiceProvider === 'mimo'
      ? MIMO_PRESET_VOICES[0].voices[0].value
      : DEFAULT_VOICE_ID;
    setVoiceId(defaultVoiceId);
    saveLastVoice(defaultVoiceId);
  }, [voiceProvider, voiceId, userVoices, setVoiceId, saveLastVoice]);

  return (
    <>
      {/* Voice Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>音色选择</Label>
          <VoiceCloneDialog
            defaultProvider={voiceProvider}
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
            {visibleLegacyVoice && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                  我的音色
                </div>
                <SelectItem key={visibleLegacyVoice.id} value={visibleLegacyVoice.id}>
                  {visibleLegacyVoice.name}
                </SelectItem>
              </>
            )}
            {clonedVoices.length > 0 && (
              <>
                {!visibleLegacyVoice && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                    我的音色
                  </div>
                )}
                {clonedVoices.map((v) => (
                  <SelectItem key={v.id} value={voiceProvider === 'mimo' ? v.id : (v.voice_id ?? v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </>
            )}
            {presetList.map((cat) => (
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
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>音调</Label>
              <span className="text-muted-foreground tabular-nums">{pitch > 0 ? '+'+pitch : pitch}</span>
            </div>
            <Slider
              value={[pitch]}
              min={-10}
              max={10}
              step={1}
              onValueChange={(v) => setPitch(v[0])}
            />
          </div>
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
    </>
  );
}
