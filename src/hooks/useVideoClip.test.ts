import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoClip } from './useVideoClip';

describe('useVideoClip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态为默认值', () => {
    const { result } = renderHook(() => useVideoClip());

    expect(result.current.startTime).toBe(0);
    expect(result.current.endTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isClipping).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.clipResult).toBeNull();
  });

  it('setStartTime 更新开始时间', () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setStartTime(5);
    });

    expect(result.current.startTime).toBe(5);
  });

  it('setEndTime 更新结束时间', () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setEndTime(15);
    });

    expect(result.current.endTime).toBe(15);
  });

  it('setDuration 更新视频时长', () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setDuration(30);
    });

    expect(result.current.duration).toBe(30);
  });

  it('reset 将所有状态恢复为默认值', () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setStartTime(3);
      result.current.setEndTime(10);
      result.current.setDuration(20);
    });

    expect(result.current.startTime).toBe(3);

    act(() => {
      result.current.reset();
    });

    expect(result.current.startTime).toBe(0);
    expect(result.current.endTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isClipping).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.clipResult).toBeNull();
  });

  it('clearResult 清除剪辑结果', () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      // Simulate having a clip result
      result.current['clipResult' as keyof typeof result.current] = {
        blob: new Blob(),
        url: 'blob:test',
        startTime: 0,
        endTime: 10,
        duration: 10,
      } as any;
    });

    act(() => {
      result.current.clearResult();
    });

    expect(result.current.clipResult).toBeNull();
  });

  it('startTime >= endTime 时 clipVideo 抛出错误', async () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setStartTime(10);
      result.current.setEndTime(5);
      result.current.setDuration(20);
    });

    await expect(result.current.clipVideo('https://example.com/video.mp4')).rejects.toThrow(
      '开始时间必须小于结束时间',
    );
  });

  it('endTime > duration 时 clipVideo 抛出错误', async () => {
    const { result } = renderHook(() => useVideoClip());

    act(() => {
      result.current.setStartTime(0);
      result.current.setEndTime(25);
      result.current.setDuration(20);
    });

    await expect(result.current.clipVideo('https://example.com/video.mp4')).rejects.toThrow(
      '结束时间不能超过视频时长',
    );
  });
});
