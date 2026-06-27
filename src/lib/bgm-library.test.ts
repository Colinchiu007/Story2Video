import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDefaultBgmTracks,
  loadCustomBgmTracks,
  saveCustomBgmTracks,
  getAllBgmTracks,
  validateBgmUrl,
} from './bgm-library';

describe('bgm-library', () => {
  describe('getDefaultBgmTracks', () => {
    it('returns 10 default tracks', () => {
      const tracks = getDefaultBgmTracks();
      expect(tracks.length).toBe(10);
    });

    it('all tracks have required fields', () => {
      const tracks = getDefaultBgmTracks();
      for (const track of tracks) {
        expect(track.id).toBeTruthy();
        expect(track.name).toBeTruthy();
        expect(track.url).toBeTruthy();
        expect(track.isBuiltIn).toBe(true);
      }
    });

    it('tracks do not contain soundhelix URLs', () => {
      const tracks = getDefaultBgmTracks();
      for (const track of tracks) {
        expect(track.url).not.toContain('soundhelix');
      }
    });

    it('returns a copy, not the original array', () => {
      const tracks = getDefaultBgmTracks();
      tracks[0].name = 'modified';
      const tracks2 = getDefaultBgmTracks();
      expect(tracks2[0].name).not.toBe('modified');
    });
  });

  describe('custom tracks (localStorage)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('loadCustomBgmTracks returns empty array when nothing stored', () => {
      const custom = loadCustomBgmTracks();
      expect(custom).toEqual([]);
    });

    it('save and load roundtrip', () => {
      const custom: BgmTrack[] = [
        { id: 'custom1', name: '我的 BGM', url: 'https://example.com/music.mp3', isBuiltIn: false },
      ];
      saveCustomBgmTracks(custom);
      const loaded = loadCustomBgmTracks();
      expect(loaded).toEqual(custom);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('bgm_library_config', 'not-json');
      const custom = loadCustomBgmTracks();
      expect(custom).toEqual([]);
    });
  });

  describe('getAllBgmTracks', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns only defaults when no custom tracks', () => {
      const all = getAllBgmTracks();
      expect(all.length).toBe(10);
      expect(all.every((t) => t.isBuiltIn)).toBe(true);
    });

    it('includes custom tracks after saving', () => {
      saveCustomBgmTracks([
        { id: 'custom1', name: 'Custom', url: 'https://example.com/m.mp3', isBuiltIn: false },
      ]);
      const all = getAllBgmTracks();
      expect(all.length).toBe(11);
      expect(all.some((t) => !t.isBuiltIn)).toBe(true);
    });
  });

  describe('validateBgmUrl', () => {
    it('returns false for invalid URLs', async () => {
      const result = await validateBgmUrl('https://invalid-url-that-does-not-exist.example/audio.mp3');
      expect(result).toBe(false);
    });
  });
});
