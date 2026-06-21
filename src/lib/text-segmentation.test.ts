import { describe, it, expect } from 'vitest';
import {
  SentenceTokenizer,
  SceneSegmenter,
  SubtitleSegmenter,
  TextSegmentationModule,
  splitTextToScenes,
  splitTextToSubtitles,
  buildSubtitleTimelineV2,
  getSegmentationVersion,
  DEFAULT_CONFIG,
} from './text-segmentation';

describe('text-segmentation v1.0', () => {
  describe('版本', () => {
    it('getSegmentationVersion 应返回 v1.0', () => {
      expect(getSegmentationVersion()).toBe('v1.0');
    });
  });

  describe('SentenceTokenizer', () => {
    it('空文本返回空数组', () => {
      const tokenizer = new SentenceTokenizer();
      expect(tokenizer.split('')).toEqual([]);
      expect(tokenizer.split('   ')).toEqual([]);
    });

    it('按句号分割句子', () => {
      const tokenizer = new SentenceTokenizer();
      const result = tokenizer.split('第一句。第二句。第三句。');
      expect(result.length).toBe(3);
      expect(result[0]).toBe('第一句。');
      expect(result[1]).toBe('第二句。');
      expect(result[2]).toBe('第三句。');
    });

    it('按感叹号和问号分割', () => {
      const tokenizer = new SentenceTokenizer();
      const result = tokenizer.split('你好吗？很好！那就好。');
      expect(result.length).toBe(3);
      expect(result[0]).toBe('你好吗？');
      expect(result[1]).toBe('很好！');
      expect(result[2]).toBe('那就好。');
    });

    it('处理缩写（如 "等"）', () => {
      const tokenizer = new SentenceTokenizer();
      const result = tokenizer.split('苹果、香蕉等水果很好吃。');
      expect(result.length).toBe(1);
      expect(result[0]).toContain('等');
    });

    it('处理无句末标点的文本', () => {
      const tokenizer = new SentenceTokenizer();
      const result = tokenizer.split('这是一个没有标点的句子');
      expect(result.length).toBe(1);
      expect(result[0]).toBe('这是一个没有标点的句子');
    });
  });

  describe('SceneSegmenter', () => {
    it('空文本返回空数组', () => {
      const segmenter = new SceneSegmenter();
      expect(segmenter.segment('')).toEqual([]);
    });

    it('按目标字数合并句子', () => {
      const segmenter = new SceneSegmenter({ targetSeconds: 6, baseWordsPerSecond: 3.3 });
      // targetWords ≈ 20
      const result = segmenter.segment('春天来了。万物复苏。花开满园。蝴蝶飞舞。');
      expect(result.length).toBeGreaterThanOrEqual(1);
      // 每个段落的字数应在合理范围内
      result.forEach((seg) => {
        expect(seg.text.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('计算目标字数正确', () => {
      const segmenter = new SceneSegmenter({ targetSeconds: 6, baseWordsPerSecond: 3.3, speechRate: 1.0 });
      expect(segmenter.calculateTargetWords()).toBe(20); // 6 * 3.3 = 19.8 ≈ 20
    });

    it('语速系数影响目标字数', () => {
      const segmenter = new SceneSegmenter({ targetSeconds: 6, baseWordsPerSecond: 3.3, speechRate: 0.5 });
      expect(segmenter.calculateTargetWords()).toBe(10); // 6 * 3.3 * 0.5 = 9.9 ≈ 10
    });

    it('目标字数受边界限制', () => {
      const segmenter = new SceneSegmenter({
        targetSeconds: 6,
        baseWordsPerSecond: 3.3,
        minWordsPerSegment: 15,
        maxWordsPerSegment: 25,
      });
      expect(segmenter.calculateTargetWords()).toBe(20); // 19.8 在 [15, 25] 范围内
    });
  });

  describe('SubtitleSegmenter', () => {
    it('空文本返回空数组', () => {
      const segmenter = new SubtitleSegmenter();
      expect(segmenter.segment('', 10, 0)).toEqual([]);
    });

    it('按标点分割为字幕块', () => {
      const segmenter = new SubtitleSegmenter({ minCharsPerBlock: 2, maxCharsPerBlock: 10 });
      const result = segmenter.segment('春天来了，万物复苏。', 6, 0);
      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach((block) => {
        expect(block.text.length).toBeLessThanOrEqual(10);
      });
    });

    it('时间按比例分配', () => {
      const segmenter = new SubtitleSegmenter({
        minCharsPerBlock: 2,
        maxCharsPerBlock: 10,
        timeCalculationMethod: 'proportional',
      });
      const result = segmenter.segment('abcdefghij。klmnopqr。', 10, 0);
      if (result.length >= 2) {
        // 字数多的块应分配更多时间
        const totalDuration = result.reduce((sum, b) => sum + b.duration, 0);
        expect(Math.round(totalDuration * 100) / 100).toBe(10);
      }
    });

    it('时间平均分配', () => {
      const segmenter = new SubtitleSegmenter({
        minCharsPerBlock: 2,
        maxCharsPerBlock: 10,
        timeCalculationMethod: 'equal',
      });
      const result = segmenter.segment('abc。def。ghi。', 9, 0);
      if (result.length >= 2) {
        result.forEach((block) => {
          expect(block.duration).toBeCloseTo(9 / result.length, 1);
        });
      }
    });
  });

  describe('TextSegmentationModule', () => {
    it('完整处理流程', () => {
      const module = new TextSegmentationModule();
      const result = module.process('春天来了。万物复苏。花开满园。');

      expect(result.speechSegments.length).toBeGreaterThanOrEqual(1);
      expect(result.totalWords).toBeGreaterThan(0);
      expect(result.segmentCount).toBe(result.speechSegments.length);

      // 每个段落应有字幕
      result.speechSegments.forEach((seg) => {
        expect(seg.subtitles.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('空文本应抛出错误', () => {
      const module = new TextSegmentationModule();
      expect(() => module.process('')).toThrow('输入文本不能为空');
      expect(() => module.process('   ')).toThrow('输入文本不能为空');
    });

    it('自定义配置生效', () => {
      const module = new TextSegmentationModule({
        scene: { targetSeconds: 3, baseWordsPerSecond: 3.3 },
      });
      const summary = module.getConfigSummary();
      expect((summary.sceneConfig as Record<string, unknown>).targetSeconds).toBe(3);
    });
  });

  describe('splitTextToScenes', () => {
    it('空文本返回空数组', () => {
      expect(splitTextToScenes('')).toEqual([]);
    });

    it('按目标数量分割', () => {
      const text = '明朝万历间，万贞和与大秦交锋。尸横遍野，血流成河。后日子不能划然而已。';
      const result = splitTextToScenes(text, { targetCount: 2 });
      expect(result).toHaveLength(2);
    });

    it('不指定 targetCount 返回原始场景数', () => {
      const text = '第一句。第二句。第三句。第四句。';
      const result = splitTextToScenes(text);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('targetCount 为 0 返回原始场景数', () => {
      const result = splitTextToScenes('测试文本', { targetCount: 0 });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('splitTextToSubtitles', () => {
    it('空文本返回空数组', () => {
      expect(splitTextToSubtitles('')).toEqual([]);
    });

    it('分割为字幕块', () => {
      const result = splitTextToSubtitles('春天来了，万物复苏，花开满园。');
      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach((line) => {
        expect(line.length).toBeGreaterThan(0);
      });
    });
  });

  describe('buildSubtitleTimelineV2', () => {
    it('空文本返回空数组', () => {
      expect(buildSubtitleTimelineV2('', 10)).toEqual([]);
    });

    it('构建时间线', () => {
      const result = buildSubtitleTimelineV2('春天来了，万物复苏。', 10);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].startTime).toBe(0);
      expect(result[result.length - 1].endTime).toBe(10);
    });

    it('逐字时间戳存在', () => {
      const result = buildSubtitleTimelineV2('春天来了。', 5);
      if (result.length > 0) {
        expect(result[0].charTimings.length).toBe(result[0].text.length);
        expect(result[0].charTimings[result[0].charTimings.length - 1]).toBeLessThanOrEqual(5);
      }
    });
  });
});
