import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { CreateMode } from '@/types';
import type { BgmConfig } from '@/components/BgmSettings';
import type { SubtitleConfig } from '@/components/SubtitleSettings';

const DRAFT_KEY = 'create_page_draft';

export interface CreateDraftState {
  mode: CreateMode;
  prompt: string;
  audioText: string;
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  emotion: string;
  size: string;
  seconds: string;
  uploadedImageUrl: string;
  remixVideoUrl: string;
  remixVideoFileName: string;
  imageEffect: string;
  transitionEffect: string;
  bgmConfig: BgmConfig;
  subtitleConfig: SubtitleConfig;
  generateBase: boolean;
  generateMerged: boolean;
  perImageDuration: number;
  uploadedAudioUrl: string;
  uploadedAudioName: string;
  batchSegments: Array<{ id: string; text: string; audioUrl: string; audioName: string }>;
  batchInputText: string;
}

export interface CreateDraftSetters {
  setMode: (v: CreateMode) => void;
  setPrompt: (v: string) => void;
  setAudioText: (v: string) => void;
  setVoiceId: (v: string) => void;
  setSpeed: (v: number) => void;
  setVol: (v: number) => void;
  setPitch: (v: number) => void;
  setEmotion: (v: string) => void;
  setSize: (v: string) => void;
  setSeconds: (v: string) => void;
  setUploadedImageUrl: (v: string) => void;
  setRemixVideoUrl: (v: string) => void;
  setRemixVideoFileName: (v: string) => void;
  setImageEffect: (v: string) => void;
  setTransitionEffect: (v: string) => void;
  setBgmConfig: (v: BgmConfig) => void;
  setSubtitleConfig: (v: SubtitleConfig) => void;
  setGenerateBase: (v: boolean) => void;
  setGenerateMerged: (v: boolean) => void;
  setPerImageDuration: (v: number) => void;
  setUploadedAudioUrl: (v: string) => void;
  setUploadedAudioName: (v: string) => void;
  setBatchSegments: (v: Array<{ id: string; text: string; audioUrl: string; audioName: string }>) => void;
  setBatchInputText: (v: string) => void;
  setSelectedTemplateId: (v: string | undefined) => void;
  setUploadedAudioFile?: (v: File | null) => void;
}

/**
 * Save current form state to localStorage as draft.
 * Call this in the main component's render to auto-save.
 */
export function useAutoSaveDraft(
  state: CreateDraftState,
  draftRestored: boolean,
): void {
  useEffect(() => {
    if (!draftRestored) return;
    const draft: CreateDraftState = {
      mode: state.mode, prompt: state.prompt, audioText: state.audioText,
      voiceId: state.voiceId, speed: state.speed, vol: state.vol,
      pitch: state.pitch, emotion: state.emotion, size: state.size,
      seconds: state.seconds, uploadedImageUrl: state.uploadedImageUrl,
      remixVideoUrl: state.remixVideoUrl, remixVideoFileName: state.remixVideoFileName,
      imageEffect: state.imageEffect, transitionEffect: state.transitionEffect,
      bgmConfig: state.bgmConfig, subtitleConfig: state.subtitleConfig,
      generateBase: state.generateBase, generateMerged: state.generateMerged,
      perImageDuration: state.perImageDuration,
      uploadedAudioUrl: state.uploadedAudioUrl, uploadedAudioName: state.uploadedAudioName,
      batchSegments: state.batchSegments, batchInputText: state.batchInputText,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    state.mode, state.prompt, state.audioText, state.voiceId, state.speed,
    state.vol, state.pitch, state.emotion, state.size, state.seconds,
    state.uploadedImageUrl, state.remixVideoUrl, state.remixVideoFileName,
    state.imageEffect, state.transitionEffect, state.bgmConfig, state.subtitleConfig,
    state.generateBase, state.generateMerged, state.perImageDuration,
    draftRestored, state.uploadedAudioUrl, state.uploadedAudioName,
    state.batchSegments, state.batchInputText,
  ]);
}

/**
 * Restore draft from localStorage on mount.
 * Returns draftRestored boolean.
 */
export function useRestoreDraft(setters: CreateDraftSetters): boolean {
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { setDraftRestored(true); return; }
      const d = JSON.parse(raw) as Partial<CreateDraftState>;
      if (d.mode) setters.setMode(d.mode);
      if (d.prompt !== undefined) setters.setPrompt(d.prompt);
      if (d.audioText !== undefined) setters.setAudioText(d.audioText);
      if (d.voiceId) setters.setVoiceId(d.voiceId);
      if (d.speed !== undefined) setters.setSpeed(d.speed);
      if (d.vol !== undefined) setters.setVol(d.vol);
      if (d.pitch !== undefined) setters.setPitch(d.pitch);
      if (d.emotion) setters.setEmotion(d.emotion);
      if (d.size) setters.setSize(d.size);
      if (d.seconds) setters.setSeconds(d.seconds);
      if (d.uploadedImageUrl) setters.setUploadedImageUrl(d.uploadedImageUrl);
      if (d.remixVideoUrl) setters.setRemixVideoUrl(d.remixVideoUrl);
      if (d.remixVideoFileName) setters.setRemixVideoFileName(d.remixVideoFileName);
      if (d.imageEffect) setters.setImageEffect(d.imageEffect);
      if (d.transitionEffect) setters.setTransitionEffect(d.transitionEffect);
      if (d.bgmConfig) setters.setBgmConfig(d.bgmConfig);
      if (d.subtitleConfig) setters.setSubtitleConfig(d.subtitleConfig);
      if (typeof d.generateBase === 'boolean') setters.setGenerateBase(d.generateBase);
      if (typeof d.generateMerged === 'boolean') setters.setGenerateMerged(d.generateMerged);
      if (typeof d.perImageDuration === 'number') setters.setPerImageDuration(d.perImageDuration);
      if (d.uploadedAudioUrl) setters.setUploadedAudioUrl(d.uploadedAudioUrl);
      if (d.uploadedAudioName) setters.setUploadedAudioName(d.uploadedAudioName);
      if (d.batchSegments) setters.setBatchSegments(d.batchSegments);
      if (d.batchInputText !== undefined) setters.setBatchInputText(d.batchInputText);
      if (d.prompt || d.audioText || d.uploadedAudioUrl || d.batchInputText || (d.batchSegments && d.batchSegments.length > 0)) {
        toast.info('已自动恢复上次未提交的草稿', {
          action: { label: '清除', onClick: () => { localStorage.removeItem(DRAFT_KEY); window.location.reload(); } },
        });
      }
    } catch { /* ignore */ }
    setDraftRestored(true);
  }, []);

  return draftRestored;
}

/**
 * Clear draft from localStorage and reset all form state.
 */
export function useClearDraft(setters: CreateDraftSetters): () => void {
  return useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setters.setMode('gallery' as CreateMode);
    setters.setPrompt('');
    setters.setAudioText('');
    setters.setVoiceId('zh_female_qingxinnvsheng_uranus_bigtts');
    setters.setSpeed(1.0);
    setters.setVol(1.0);
    setters.setPitch(0);
    setters.setEmotion('default');
    setters.setSize('720x1280');
    setters.setSeconds('8');
    setters.setUploadedImageUrl('');
    setters.setRemixVideoUrl('');
    setters.setRemixVideoFileName('');
    setters.setImageEffect('zoom-in');
    setters.setTransitionEffect('fade');
    setters.setBgmConfig({ enabled: false, url: '', volume: 5, name: '' });
    setters.setSubtitleConfig({
      enabled: false,
      font: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      size: 'size3',
      style: 'style1',
    });
    setters.setPerImageDuration(6);
    if (setters.setUploadedAudioFile) setters.setUploadedAudioFile(null);
    setters.setUploadedAudioUrl('');
    setters.setUploadedAudioName('');
    setters.setBatchSegments([]);
    setters.setBatchInputText('');
    setters.setSelectedTemplateId(undefined);
    toast.success('草稿已清除');
  }, [setters]);
}
