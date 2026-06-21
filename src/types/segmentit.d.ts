declare module 'segmentit' {
  export interface SegmentResult {
    w: string;
    p: number;
  }

  export class Segment {
    constructor();
    doSegment(text: string): SegmentResult[];
  }

  export function useDefault(segmenter: Segment): void;
}
