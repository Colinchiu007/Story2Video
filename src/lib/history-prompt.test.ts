import { describe, it, expect } from 'vitest';
import {
  splitTextForImages,
  generateImagePrompts,
  generateImagePromptsWithNegative,
  getStrategyVersion,
  getSegmentDebugInfo,
  _internal,
  EraDetector,
  DynastyDetector,
  DiversePromptGeneratorV10,
  VisualStyleSelector,
} from './history-prompt';

const {
  extractHistoricalContext,
  analyzeSentiment,
  getColorTone,
  isSemanticallySufficientForImage,
  buildPromptForSegment,
  PERSPECTIVES,
  COMPOSITIONS,
  STYLES,
  ANTI_AI_PROMPTS,
  DOCUMENTARY_PROMPTS,
  REALISM_PROMPTS,
  NEGATIVE_PROMPTS,
} = _internal;

describe('history-prompt v9.0', () => {
  describe('版本', () => {
    it('getStrategyVersion 应返回 v10.0', () => {
      expect(getStrategyVersion()).toBe('v10.0');
    });
  });

  describe('EraDetector', () => {
    it('应识别现代内容', () => {
      const result = EraDetector.detect('台风过境后，居民在社区服务中心领取物资。');
      expect(result.era).toBe('modern');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('应识别古代内容', () => {
      const result = EraDetector.detect('如果清军在甲午战争中死磕到底');
      expect(result.era).toBe('ancient');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('无关键词时返回 mixed', () => {
      const result = EraDetector.detect('今天天气真好');
      expect(result.era).toBe('mixed');
    });
  });

  describe('DynastyDetector', () => {
    it('应识别清朝', () => {
      const result = DynastyDetector.detect('清军在甲午战争中');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('清朝');
    });

    it('应识别唐朝', () => {
      const result = DynastyDetector.detect('李白写下了静夜思');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('唐朝');
    });
  });

  describe('extractHistoricalContext', () => {
    it('应识别长安古地名映射', () => {
      const ctx = extractHistoricalContext('玄奘从长安出发，前往天竺取经。');
      expect(ctx.period).toBe('唐朝');
      expect(ctx.location).toBe('中国');
      expect(ctx.visual_style).toContain('唐代建筑');
    });

    it('应识别唐朝和地点', () => {
      const ctx = extractHistoricalContext('唐朝的长安城门前，玄奘踏上了征途。');
      expect(ctx.period).toBe('唐朝');
      expect(ctx.visual_style).toContain('唐代建筑');
    });

    it('应识别明朝', () => {
      const ctx = extractHistoricalContext('明朝的紫禁城在北京。');
      expect(ctx.period).toBe('明朝');
      expect(ctx.visual_style).toContain('明代建筑');
    });

    it('未找到朝代时返回古代中国', () => {
      const ctx = extractHistoricalContext('一只猫在草地上奔跑。');
      expect(ctx.period).toBe('古代中国');
    });

    it('现代内容返回现代', () => {
      const ctx = extractHistoricalContext('台风过境后，居民在社区服务中心领取物资。');
      expect(ctx.period).toBe('现代');
      expect(ctx.visual_style).toContain('现代建筑');
    });
  });

  describe('analyzeSentiment', () => {
    it('应识别 positive 情感', () => {
      expect(analyzeSentiment('胜利了，成功了，多么美好')).toBe('positive');
    });

    it('应识别 negative 情感', () => {
      expect(analyzeSentiment('失败了，死亡和战争带来痛苦')).toBe('negative');
    });

    it('无关键词时默认 peaceful', () => {
      expect(analyzeSentiment('这是一只猫。')).toBe('peaceful');
    });
  });

  describe('getColorTone', () => {
    it('positive 对应明亮色调', () => {
      expect(getColorTone('positive')).toContain('温暖');
    });

    it('negative 对应暗沉色调', () => {
      expect(getColorTone('negative')).toContain('阴沉');
    });
  });

  describe('isSemanticallySufficientForImage', () => {
    it('以的结尾应判不完整', () => {
      expect(isSemanticallySufficientForImage('我喜欢吃的')).toBe(false);
    });

    it('以其他内容结尾应判完整', () => {
      expect(isSemanticallySufficientForImage('我喜欢吃红烧肉。')).toBe(true);
    });

    it('极短片段应判不完整', () => {
      expect(isSemanticallySufficientForImage('是')).toBe(false);
    });
  });

  describe('v9.0 提示词生成策略', () => {
    it('视角列表包含纪录片风格', () => {
      expect(PERSPECTIVES).toContain('手持镜头，轻微抖动，纪录片感');
      expect(PERSPECTIVES).toContain('肩扛摄影，动态感，真实感');
    });

    it('构图列表包含不规则构图', () => {
      expect(COMPOSITIONS).toContain('不规则构图，纪录片感，抓拍感');
    });

    it('风格列表包含纪录片和胶片摄影', () => {
      expect(STYLES).toContain('纪录片风格，纪实摄影，真实感');
      expect(STYLES).toContain('胶片摄影，film grain，噪点，真实感');
    });

    it('包含减少AI味的提示词', () => {
      expect(ANTI_AI_PROMPTS.length).toBeGreaterThan(0);
      expect(ANTI_AI_PROMPTS.some((p) => p.includes('真实'))).toBe(true);
    });

    it('包含纪录片风格提示词', () => {
      expect(DOCUMENTARY_PROMPTS.length).toBeGreaterThan(0);
      expect(DOCUMENTARY_PROMPTS.some((p) => p.includes('纪录片'))).toBe(true);
    });

    it('包含真实感提示词', () => {
      expect(REALISM_PROMPTS.length).toBeGreaterThan(0);
      expect(REALISM_PROMPTS.some((p) => p.includes('realistic'))).toBe(true);
    });

    it('负面提示词包含AI相关词汇', () => {
      expect(NEGATIVE_PROMPTS).toContain('ai-generated');
      expect(NEGATIVE_PROMPTS).toContain('perfect face');
    });

    it('buildPromptForSegment 生成 v9.0 格式提示词', () => {
      const ctx = extractHistoricalContext('唐朝长安，玄奘西行。');
      const { prompt, negative } = buildPromptForSegment('玄奘从长安出发', ctx, 0);

      expect(prompt).toContain('唐朝');
      expect(prompt).toContain('玄奘从长安出发');
      expect(negative).toContain('ai-generated');
    });

    it('不同索引使用不同视角', () => {
      const ctx = extractHistoricalContext('唐朝长安。');
      const { prompt: p0 } = buildPromptForSegment('测试', ctx, 0);
      const { prompt: p1 } = buildPromptForSegment('测试', ctx, 1);
      expect(p0).not.toBe(p1);
    });
  });

  describe('DiversePromptGeneratorV10', () => {
    it('古代内容生成含历史时期标记的提示词', () => {
      const ctx = DynastyDetector.buildContext('唐朝长安');
      const styleSelector = new VisualStyleSelector();
      const gen = new DiversePromptGeneratorV10(ctx, styleSelector, false);
      const visualElements = styleSelector.selectStructured('玄奘西行', '唐朝', false);
      const { prompt } = gen.generate('玄奘西行', '唐朝', visualElements);
      expect(prompt).toContain('唐朝');
      expect(prompt).toContain('玄奘西行');
      expect(prompt).toContain('古风');
    });

    it('现代内容生成含现代标记的提示词', () => {
      const ctx = { period: '现代', location: '中国', visual_style: '现代建筑，现代服饰，都市感', era_style: '现代' };
      const styleSelector = new VisualStyleSelector();
      const gen = new DiversePromptGeneratorV10(ctx, styleSelector, true);
      const visualElements = styleSelector.selectStructured('居民领取物资', '现代', true);
      const { prompt } = gen.generate('居民领取物资', '现代', visualElements);
      expect(prompt).toContain('现代');
      expect(prompt).toContain('现代风格');
    });
  });

  describe('splitTextForImages', () => {
    it('空文本返回空数组', () => {
      expect(splitTextForImages('', 3)).toEqual([]);
    });

    it('应返回等于 targetCount 的分段', () => {
      const text = '明朝万历间，万贞和与大秦交锋。尸横遍野，血流成河。后日子不能划然而已。';
      const result = splitTextForImages(text, 2);
      expect(result).toHaveLength(2);
    });

    it('零目标数返回单片段', () => {
      expect(splitTextForImages('一个测试', 0)).toHaveLength(1);
    });
  });

  describe('generateImagePrompts', () => {
    it('空片段返回空数组', () => {
      expect(generateImagePrompts([], '文本')).toEqual([]);
    });

    it('单个片段生成提示词', () => {
      const prompts = generateImagePrompts(['玄奘从长安出发'], '唐朝玄奘从长安出发，前往天竺取经。');
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain('唐朝');
      expect(prompts[0]).toContain('玄奘从长安出发');
    });

    it('多个片段生成不同提示词', () => {
      const segments = ['玄奘出发', '历经艰险', '终达天竺'];
      const prompts = generateImagePrompts(segments, '玄奘从长安出发取经。');
      expect(prompts).toHaveLength(3);
      expect(prompts[0]).not.toBe(prompts[1]);
    });
  });

  describe('generateImagePromptsWithNegative', () => {
    it('返回包含负面提示词的结果', () => {
      const results = generateImagePromptsWithNegative(
        ['玄奘从长安出发'],
        '唐朝玄奘从长安出发，前往天竺取经。',
      );
      expect(results).toHaveLength(1);
      expect(results[0].prompt).toContain('唐朝');
      expect(results[0].negative).toContain('ai-generated');
      expect(results[0].sentiment).toBeDefined();
      expect(results[0].isComplete).toBeDefined();
    });

    it('不同片段使用不同提示词', () => {
      const results = generateImagePromptsWithNegative(
        ['片段一', '片段二'],
        '唐朝长安。',
      );
      expect(results).toHaveLength(2);
      expect(results[0].prompt).not.toBe(results[1].prompt);
    });

    it('现代内容使用现代风格', () => {
      const results = generateImagePromptsWithNegative(
        ['居民领取物资'],
        '台风过境后，居民在社区服务中心领取救济物资。',
      );
      expect(results[0].prompt).toContain('现代');
      expect(results[0].prompt).toContain('现代风格');
    });
  });

  describe('getSegmentDebugInfo', () => {
    it('返回包含调试信息的数组', () => {
      const info = getSegmentDebugInfo(['玄奘出发'], '玄奘从长安出发');
      expect(info).toHaveLength(1);
      expect(info[0].index).toBe(0);
      expect(info[0].sentiment).toBeDefined();
      expect(info[0].isComplete).toBeDefined();
      expect(info[0].prompt).toBeDefined();
      expect(info[0].negative).toBeDefined();
    });
  });
});
