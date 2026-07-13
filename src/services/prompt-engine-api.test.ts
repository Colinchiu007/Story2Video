import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiOptimizePrompt,
  apiBatchOptimize,
  apiStoryboardCompose,
  checkPromptEngineHealth,
  type OptimizeResult,
  type StoryboardComposeResult,
} from './prompt-engine-api';

// Mock external-config
vi.mock('@/services/external-config', () => ({
  getPromptEngineUrl: vi.fn(() => 'http://localhost:8013'),
}));

// Mock api-client
vi.mock('./api-client', () => ({
  apiPost: vi.fn(),
}));

import { apiPost } from './api-client';
const mockApiPost = vi.mocked(apiPost);

const mockOptimizeResult: OptimizeResult = {
  optimized_prompt: 'A beautiful cat sitting on a windowsill, cinematic lighting, 4K',
  platform: 'generic',
  style: null,
  model_used: 'gpt-4',
  tokens_used: 150,
  duration_ms: 1200,
  candidates: [],
  key_source: 'config',
};

const mockStoryboardResult: StoryboardComposeResult = {
  strategy: 'xiaohei_storyboard',
  prompts: [
    '广角镜头，春天的田野，万物复苏，电影感',
    '中景镜头，城市街头，人来人往，纪录片风格',
  ],
  metaphors: [
    { composition_type: '概念隐喻', metaphor: '春天=希望', visual_description: '田野' },
    { composition_type: '对比隐喻', metaphor: '城市=忙碌', visual_description: '街头' },
  ],
};

describe('prompt-engine-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiOptimizePrompt', () => {
    it('调用 POST /v1/optimize', async () => {
      mockApiPost.mockResolvedValue(mockOptimizeResult);

      const result = await apiOptimizePrompt('一只猫');

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8013',
        '/v1/optimize',
        expect.objectContaining({
          prompt: '一只猫',
          platform: 'generic',
          creative_level: 5,
        }),
      );
      expect(result.optimized_prompt).toContain('cat');
    });

    it('传递平台和风格选项', async () => {
      mockApiPost.mockResolvedValue(mockOptimizeResult);

      await apiOptimizePrompt('测试', {
        platform: 'midjourney',
        style: 'realistic',
        creativeLevel: 8,
        negativePrompt: 'blurry',
      });

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8013',
        '/v1/optimize',
        expect.objectContaining({
          platform: 'midjourney',
          style: 'realistic',
          creative_level: 8,
          negative_prompt: 'blurry',
        }),
      );
    });
  });

  describe('apiBatchOptimize', () => {
    it('调用 POST /v1/batch', async () => {
      mockApiPost.mockResolvedValue({ results: [mockOptimizeResult, mockOptimizeResult] });

      const requests = [
        { prompt: '提示词1' },
        { prompt: '提示词2' },
      ];
      const results = await apiBatchOptimize(requests);

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8013',
        '/v1/batch',
        expect.objectContaining({
          requests: [
            { prompt: '提示词1' },
            { prompt: '提示词2' },
          ],
        }),
      );
      expect(results).toHaveLength(2);
    });

    it('最多发送 10 条请求', async () => {
      mockApiPost.mockResolvedValue({ results: [] });

      const requests = Array.from({ length: 15 }, (_, i) => ({ prompt: `提示词${i}` }));
      await apiBatchOptimize(requests);

      const callBody = mockApiPost.mock.calls[0][2] as { requests: unknown[] };
      expect(callBody.requests).toHaveLength(10);
    });
  });

  describe('apiStoryboardCompose', () => {
    it('调用 POST /v1/storyboard/compose', async () => {
      mockApiPost.mockResolvedValue(mockStoryboardResult);

      const result = await apiStoryboardCompose(
        ['春天的田野', '城市街头'],
        '春天来了，城市里的人们也开始忙碌起来',
      );

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8013',
        '/v1/storyboard/compose',
        expect.objectContaining({
          scenes: ['春天的田野', '城市街头'],
          full_text: '春天来了，城市里的人们也开始忙碌起来',
          strategy: 'xiaohei_storyboard',
        }),
      );
      expect(result.prompts).toHaveLength(2);
      expect(result.strategy).toBe('xiaohei_storyboard');
    });

    it('支持自定义策略', async () => {
      mockApiPost.mockResolvedValue(mockStoryboardResult);

      await apiStoryboardCompose(['测试'], '测试', { strategy: 'custom', creativeLevel: 7 });

      expect(mockApiPost).toHaveBeenCalledWith(
        'http://localhost:8013',
        '/v1/storyboard/compose',
        expect.objectContaining({
          strategy: 'custom',
          options: { creative_level: 7 },
        }),
      );
    });
  });

  describe('checkPromptEngineHealth', () => {
    it('服务正常返回 ok', async () => {
      mockApiPost.mockResolvedValue(mockOptimizeResult);

      const result = await checkPromptEngineHealth();
      expect(result.ok).toBe(true);
    });

    it('服务异常返回 error', async () => {
      mockApiPost.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await checkPromptEngineHealth();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });
  });
});
