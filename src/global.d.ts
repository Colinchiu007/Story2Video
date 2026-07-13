// global types

// 鐧惧害鍦板浘GL鐗堟湰鍏ㄥ眬绫诲瀷澹版槑
/// <reference types="bmapgl" />

// jieba-js 娌℃湁绫诲瀷澹版槑锛屾墜鍔ㄥ０鏄庝互閬垮厤 tsc 瑙ｆ瀽鍏?.ts 婧愮爜
declare module 'jieba-js' {
  export function cut(text: string, hmm?: boolean): string[];
  const _default: { cut: typeof cut };
  export default _default;
}

// video-react 绫诲瀷鐢?@types/video-react 鎻愪緵

// qrcode 娌℃湁绫诲瀷澹版槑
declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: any): Promise<void>;
  const _default: { toDataURL: typeof toDataURL; toCanvas: typeof toCanvas };
  export default _default;
}
