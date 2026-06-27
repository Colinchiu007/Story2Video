import { describe, it, expect } from 'vitest';
import {
  IMAGE_EFFECTS,
  TRANSITION_EFFECTS,
  getImageEffectById,
  getTransitionEffectById,
  getImageEffectLabel,
  getTransitionEffectLabel,
  getRecommendedTransitions,
} from './effects-library';

describe('IMAGE_EFFECTS', () => {
  it('has 10 image effects', () => {
    expect(IMAGE_EFFECTS).toHaveLength(10);
  });

  it('each effect has required fields', () => {
    for (const effect of IMAGE_EFFECTS) {
      expect(effect.id).toBeTruthy();
      expect(effect.label).toBeTruthy();
      expect(effect.description).toBeTruthy();
      expect(Array.isArray(effect.suitable)).toBe(true);
    }
  });

  it('includes none effect', () => {
    const none = IMAGE_EFFECTS.find((e) => e.id === 'none');
    expect(none).toBeTruthy();
    expect(none?.label).toBe('无效果');
  });

  it('is immutable', () => {
    const original = IMAGE_EFFECTS[0].label;
    (IMAGE_EFFECTS[0] as any).label = 'hacked';
    expect(IMAGE_EFFECTS[0].label).toBe(original);
  });
});

describe('TRANSITION_EFFECTS', () => {
  it('has 6 transition effects', () => {
    expect(TRANSITION_EFFECTS).toHaveLength(6);
  });

  it('each transition has required fields', () => {
    for (const effect of TRANSITION_EFFECTS) {
      expect(effect.id).toBeTruthy();
      expect(effect.label).toBeTruthy();
      expect(effect.description).toBeTruthy();
    }
  });

  it('includes fade and none', () => {
    const fade = TRANSITION_EFFECTS.find((e) => e.id === 'fade');
    const none = TRANSITION_EFFECTS.find((e) => e.id === 'none');
    expect(fade).toBeTruthy();
    expect(none).toBeTruthy();
  });
});

describe('getImageEffectById', () => {
  it('finds zoom-in', () => {
    const effect = getImageEffectById('zoom-in');
    expect(effect).toBeTruthy();
    expect(effect?.label).toBe('放大');
  });

  it('returns undefined for unknown', () => {
    expect(getImageEffectById('unknown')).toBeUndefined();
  });
});

describe('getTransitionEffectById', () => {
  it('finds fade', () => {
    const effect = getTransitionEffectById('fade');
    expect(effect).toBeTruthy();
    expect(effect?.label).toBe('渐隐');
  });

  it('returns undefined for unknown', () => {
    expect(getTransitionEffectById('unknown')).toBeUndefined();
  });
});

describe('getImageEffectLabel', () => {
  it('returns label for known effect', () => {
    expect(getImageEffectLabel('zoom-in')).toBe('放大');
  });

  it('returns id for unknown effect', () => {
    expect(getImageEffectLabel('unknown')).toBe('unknown');
  });
});

describe('getTransitionEffectLabel', () => {
  it('returns label for known transition', () => {
    expect(getTransitionEffectLabel('fade')).toBe('渐隐');
  });

  it('returns id for unknown transition', () => {
    expect(getTransitionEffectLabel('unknown')).toBe('unknown');
  });
});

describe('getRecommendedTransitions', () => {
  it('returns fade and none for dynamic effects', () => {
    const recs = getRecommendedTransitions('zoom-in');
    expect(recs).toEqual(['fade', 'none']);
  });

  it('returns more options for static effects', () => {
    const recs = getRecommendedTransitions('none');
    expect(recs).toContain('fade');
    expect(recs).toContain('slide-left');
    expect(recs).toContain('none');
  });
});
