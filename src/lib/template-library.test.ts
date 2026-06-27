import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  getAllTemplates,
  getTemplateById,
  loadCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
} from './template-library';
import type { VideoTemplate } from '@/types/template';

const STORAGE_KEY = 'video_templates_custom';

describe('BUILT_IN_TEMPLATES', () => {
  it('has at least 6 built-in templates', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('each template has required fields', () => {
    for (const tpl of BUILT_IN_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.imageEffect).toBeTruthy();
      expect(tpl.transitionEffect).toBeTruthy();
      expect(typeof tpl.perImageDuration).toBe('number');
    }
  });

  it('templates have unique IDs', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getAllTemplates', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('returns built-in templates when no custom saved', () => {
    const all = getAllTemplates();
    expect(all.length).toBe(BUILT_IN_TEMPLATES.length);
  });

  it('includes custom templates when saved', () => {
    const custom: VideoTemplate = {
      id: 'custom-test-1',
      name: 'Test Custom',
      description: 'A custom template',
      category: 'custom',
      imageEffect: 'zoom-in',
      transitionEffect: 'fade',
      perImageDuration: 4,
    };
    saveCustomTemplate(custom);
    const all = getAllTemplates();
    expect(all.length).toBe(BUILT_IN_TEMPLATES.length + 1);
    expect(all.find((t) => t.id === 'custom-test-1')).toBeTruthy();
  });

  it('filters by category when specified', () => {
    const business = getAllTemplates('business');
    expect(business.every((t) => t.category === 'business')).toBe(true);
  });

  it('returns all templates when category is "all"', () => {
    const all = getAllTemplates('all');
    expect(all.length).toBe(BUILT_IN_TEMPLATES.length);
  });

  it('returns empty array for non-existent category', () => {
    const result = getAllTemplates('nonexistent');
    expect(result).toEqual([]);
  });
});

describe('getTemplateById', () => {
  it('finds a built-in template by ID', () => {
    const tpl = getTemplateById('tpl-quick');
    expect(tpl).toBeTruthy();
    expect(tpl?.name).toBe('快速成片');
  });

  it('returns undefined for unknown ID', () => {
    const tpl = getTemplateById('nonexistent');
    expect(tpl).toBeUndefined();
  });
});

describe('loadCustomTemplates', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('returns empty array when nothing stored', () => {
    expect(loadCustomTemplates()).toEqual([]);
  });

  it('returns stored templates', () => {
    const templates: VideoTemplate[] = [
      { id: 'c1', name: 'C1', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    expect(loadCustomTemplates()).toEqual(templates);
  });

  it('returns empty array on JSON parse error', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json');
    expect(loadCustomTemplates()).toEqual([]);
  });
});

describe('saveCustomTemplate', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('saves a template to localStorage', () => {
    const tpl: VideoTemplate = {
      id: 'my-tpl',
      name: 'My Template',
      description: 'desc',
      category: 'creative',
      imageEffect: 'zoom-out',
      transitionEffect: 'slide-left',
      perImageDuration: 5,
    };
    saveCustomTemplate(tpl);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('my-tpl');
  });

  it('appends to existing custom templates', () => {
    saveCustomTemplate({ id: 'a', name: 'A', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 });
    saveCustomTemplate({ id: 'b', name: 'B', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 });
    expect(loadCustomTemplates()).toHaveLength(2);
  });
});

describe('deleteCustomTemplate', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('deletes a custom template by ID', () => {
    saveCustomTemplate({ id: 'del-me', name: 'X', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 });
    saveCustomTemplate({ id: 'keep-me', name: 'Y', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 });
    deleteCustomTemplate('del-me');
    const remaining = loadCustomTemplates();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('keep-me');
  });

  it('does nothing when ID does not exist', () => {
    saveCustomTemplate({ id: 'only', name: 'Only', description: '', category: 'custom', imageEffect: 'none', transitionEffect: 'none', perImageDuration: 3 });
    deleteCustomTemplate('nonexistent');
    expect(loadCustomTemplates()).toHaveLength(1);
  });
});
