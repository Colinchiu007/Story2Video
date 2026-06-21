import { describe, it, expect } from 'vitest';
import { segmentTextByCount, segmentTextBySemantics, segmentSubtitleText, buildSubtitleTimeline, getTextWidth } from './segment';

describe('segmentTextBySemantics', () => {
  it('should return single segment for short text', () => {
    expect(segmentTextBySemantics('你好')).toEqual(['你好']);
  });

  it('should split by strong punctuation (period)', () => {
    // Use maxLength=30 to force splitting at sentence boundaries
    const text = '春天悄悄地来到了人间。大地回暖，万物复苏。蝴蝶在花丛中翩翩起舞。鸟儿在歌唱。';
    const result = segmentTextBySemantics(text, 30, 15);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain('春天');
    // First segment should end with a strong punctuation
    expect(/[。！？]/.test(result[0].slice(-1))).toBe(true);
  });

  it('should respect maxLength and merge short trailing segments', () => {
    const text = '第一段文字内容。第二段文字内容。第三段。';
    const result = segmentTextBySemantics(text, 50, 20);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // No segment should exceed maxLength
    result.forEach((seg) => expect(seg.length).toBeLessThanOrEqual(50));
  });
});

describe('segmentTextByCount', () => {
  it('should return single segment for count <= 1', () => {
    expect(segmentTextByCount('你好世界', 1)).toEqual(['你好世界']);
  });

  it('should return single segment for short text', () => {
    expect(segmentTextByCount('你好', 4)).toEqual(['你好']);
  });

  it('should split into specified count segments', () => {
    // Long enough text (over 60 chars for count=4) to force splitting
    const text = '第一段内容描述了春天的景象。第二段内容讲述了夏天的故事。第三段内容描绘了秋天的画面。第四段内容记录了冬天的情景。这是一段额外的文字，用来确保总字数超过分割阈值。';
    const result = segmentTextByCount(text, 4);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('should merge trailing short segments', () => {
    const text = '这是一段很长的文字，需要被分成多段来测试分段函数是否正确工作。春天来了，万物复苏，花开满园，蝴蝶飞舞，鸟儿歌唱。';
    const result = segmentTextByCount(text, 8);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getTextWidth', () => {
  it('should count Chinese chars as 1', () => {
    expect(getTextWidth('你好')).toBe(2);
    expect(getTextWidth('中华人民共和国')).toBe(7);
  });

  it('should count English/numbers as 0.5', () => {
    expect(getTextWidth('hello')).toBe(2.5);
    expect(getTextWidth('1949')).toBe(2);
  });

  it('should handle mixed text', () => {
    expect(getTextWidth('成立于1949年')).toBe(6); // 3中文 + 4数字*0.5 = 3+2
    expect(getTextWidth('hello世界')).toBe(4.5); // 5英文*0.5 + 2中文 = 2.5+2
  });
});

describe('segmentSubtitleText', () => {
  it('should return single segment for short text', () => {
    expect(segmentSubtitleText('你好世界')).toEqual(['你好世界']);
  });

  it('should remove all punctuation from output', () => {
    const text = '春天来了。花儿开了。蝴蝶在飞舞。';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(line).not.toMatch(/[，。！？；、,.!?;:\s]/);
    });
    expect(result.join('')).toBe('春天来了花儿开了蝴蝶在飞舞');
  });

  it('should keep each line within 12 char width', () => {
    const text = '今天天气真好啊，阳光明娚，万里无云，非常适合出去走走活动活动筋骨呢';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(getTextWidth(line)).toBeLessThanOrEqual(12);
    });
  });

  it('should not split words across lines (token-based)', () => {
    const text = '我喜欢吃妈妈做的红烧肉';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(getTextWidth(line)).toBeLessThanOrEqual(12);
    });
    const joined = result.join('');
    expect(joined).toContain('红烧肉');
    let foundIntact = false;
    for (const line of result) {
      if (line.includes('红烧肉')) foundIntact = true;
    }
    expect(foundIntact).toBe(true);
  });

  it('should split long sentence without punctuation by tokens', () => {
    const text = '春天悄悄地来到了人间大地回暖万物复苏蝴蝶在花丛中美丽地跳跳起舞';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(getTextWidth(line)).toBeLessThanOrEqual(12);
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle English words with 2:1 ratio', () => {
    const text = 'hello world this is test 今天天气';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(getTextWidth(line)).toBeLessThanOrEqual(12);
    });
  });

  it('should split by comma and 顿号 punctuation', () => {
    const text = '苹果，香蕉，橙子，葡萄和西瓜';
    const result = segmentSubtitleText(text);
    result.forEach((line) => {
      expect(getTextWidth(line)).toBeLessThanOrEqual(12);
    });
    result.forEach((line) => {
      expect(line).not.toMatch(/[，。！？；、,.!?;:\s]/);
    });
  });

  it('should handle empty text', () => {
    expect(segmentSubtitleText('')).toEqual([]);
    expect(segmentSubtitleText('   ')).toEqual([]);
  });
});

describe('buildSubtitleTimeline', () => {
  it('should build timeline with correct durations', () => {
    const text = '春天来了。花儿开了。';
    const result = buildSubtitleTimeline(text, 10);
    expect(result.length).toBe(2);
    expect(result[0].startTime).toBe(0);
    expect(result[1].endTime).toBeCloseTo(10, 1);
    expect(result[0].endTime).toBeCloseTo((5 / 10) * 10, 1);
    // charTimings should exist and be proportional
    expect(result[0].charTimings.length).toBeGreaterThan(0);
    expect(result[0].charTimings[result[0].charTimings.length - 1]).toBeCloseTo(result[0].endTime, 1);
  });

  it('should handle single line', () => {
    const text = '你好';
    const result = buildSubtitleTimeline(text, 5);
    expect(result.length).toBe(1);
    expect(result[0].startTime).toBe(0);
    expect(result[0].endTime).toBe(5);
    expect(result[0].charTimings.length).toBe(2);
  });

  it('should handle empty text', () => {
    expect(buildSubtitleTimeline('', 10)).toEqual([]);
  });
});
