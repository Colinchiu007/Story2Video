// jieba-js shim — prevents tsc from resolving jieba-js's .ts source files
export function cut(text: string, hmm?: boolean): string[];
declare const _default: { cut: typeof cut };
export default _default;
