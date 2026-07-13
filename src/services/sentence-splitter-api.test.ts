import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiSplitText,
  adaptToSceneSegments,
  adaptToSubtitleLines,
  checkSentenceSplitterHealth,
  type ApiSplitResult,
} from './sentence-splitter-api';

// Mock external-config
vi.mock('@/services/external-config', () => ({
  getSentenceSplitterUrl: vi.fn(() => 'http://localhost:8014'),
}));

// Mock api-client
vi.mock('./api-client', () => ({
  apiPost: vi.fn(),
}));

import { apiPost } from './api-client';
const mockApiPost = vi.mocked(apiPost);

const mockSplitResult: ApiSplitResult = {
  sentences: [
    { index: 0, text: '春天来了。', language: 'zh', tier: 'tier2_texttiling', confidence: 0.9, char_count: 5 },
    { index: 1, text: '万物复苏。', language: 'zh', tier: 'tier2_texttiling', confidence: 0.85, char_count: 5 },
  ],
  scenes: [
    {
      text: '春天来了。',
      estimated_duration: 3.0,
      subtitles: [{ text: '春天来了。', start: 0, end: 3 }],
    },
    {
      text: '万物复苏。',
      estimated_duration: 3.0,
      subtitles: [{ text: '万物复苏。', start: 3, end: 6 }],
    },
  ],
  tier_used: 'tier2_texttiling',
  language: 'zh',
  total_duration: 6.0,
  total_words: 10,
  total_scenes: 2,
};

describe('sentence-splitter-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiSplitText', () => {
    it('调用 POST /v1/split 并返回结果', async () => {
      mockApiPost.mockResolvedValue(mockSplitResult);

      const result = await apiSplitText('春天来了。万物复苏。');

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8014',
        '/v1/split',
        expect.objectContaining({
          text: '春天来了。万物复苏。',
          language: 'auto',
          mode: 'balanced',
        }),
      );
      expect(result.scenes).toHaveLength(2);
      expect(result.tier_used).toBe('tier2_texttiling');
    });

    it('传递自定义选项', async () => {
      mockApiPost.mockResolvedValue(mockSplitResult);

      await apiSplitText('测试', { language: 'zh', mode: 'precise', enableLlm: true, enableEra: true });

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8014',
        '/v1/split',
        expect.objectContaining({
          language: 'zh',
          mode: 'precise',
          enable_llm: true,
          enable_era: true,
        }),
      );
    });

    it('URL 未配置时抛出错误', async () => {
      const { getSentenceSplitterUrl } = await import('@/services/external-config');
      vi.mocked(getSentenceSplitterUrl).mockReturnValueOnce('');

      await expect(apiSplitText('测试')).rejects.toThrow('not configured');
    });
  });

  describe('adaptToSceneSegments', () => {
    it('将 API scenes 转换为 string[]', () => {
      const result = adaptToSceneSegments(mockSplitResult);
      expect(result).toEqual(['春天来了。', '万物复苏。']);
    });

    it('过滤空文本', () => {
      const result = adaptToSceneSegments({
        ...mockSplitResult,
        scenes: [
          { text: '有效文本', estimated_duration: 3, subtitles: [] },
          { text: '  ', estimated_duration: 0, subtitles: [] },
        ],
      });
      expect(result).toEqual(['有效文本']);
    });
  });

  describe('adaptToSubtitleLines', () => {
    it('提取字幕块文本', () => {
      const result = adaptToSubtitleLines(mockSplitResult);
      expect(result).toEqual(['春天来了。', '万物复苏。']);
    });

    it('无字幕时使用场景文本', () => {
      const result = adaptToSubtitleLines({
        ...mockSplitResult,
        scenes: [{ text: '场景文本', estimated_duration: 3, subtitles: [] }],
      });
      expect(result).toEqual(['场景文本']);
    });
  });

  describe('checkSentenceSplitterHealth', () => {
    it('服务正常返回 ok', async () => {
      mockApiPost.mockResolvedValue(mockSplitResult);

      const result = await checkSentenceSplitterHealth();
      expect(result.ok).toBe(true);
      expect(result.tier).toBe('tier2_texttiling');
    });

    it('服务异常返回 error', async () => {
      mockApiPost.mockRejectedValue(new Error('Connection refused'));

      const result = await checkSentenceSplitterHealth();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });
});
