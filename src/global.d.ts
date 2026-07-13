// global types

// 百度地图GL版本全局类型声明
/// <reference types="bmapgl" />

// jieba-js 没有类型声明，手动声明以避免 tsc 解析其 .ts 源码
declare module 'jieba-js' {
  export function cut(text: string, hmm?: boolean): string[];
  const _default: { cut: typeof cut };
  export default _default;
}

// video-react 类型由 @types/video-react 提供

// qrcode 没有类型声明
declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: any): Promise<void>;
  const _default: { toDataURL: typeof toDataURL; toCanvas: typeof toCanvas };
  export default _default;
}

// miaoda 插件没有类型声明
declare module 'miaoda-sc-plugin' {
  const plugin: (options?: any) => any;
  export default plugin;
}
