/**
 * 外部服务 URL 配置
 *
 * 读取优先级：localStorage > import.meta.env > 默认值（空字符串 = 未配置）
 * localStorage key 与 orchestrator_url 模式一致
 */

const LS_SENTENCE_SPLITTER = 'sentence_splitter_url';
const LS_PROMPT_ENGINE = 'prompt_engine_url';

// ── Sentence Splitter ──────────────────────────────────────────────────────

export function getSentenceSplitterUrl(): string {
  return (
    localStorage.getItem(LS_SENTENCE_SPLITTER) ||
    import.meta.env.VITE_SENTENCE_SPLITTER_URL ||
    ''
  );
}

export function setSentenceSplitterUrl(url: string): void {
  if (url) {
    localStorage.setItem(LS_SENTENCE_SPLITTER, url);
  } else {
    localStorage.removeItem(LS_SENTENCE_SPLITTER);
  }
}

export function isSentenceSplitterAvailable(): boolean {
  return getSentenceSplitterUrl().length > 0;
}

// ── Prompt Engine ───────────────────────────────────────────────────────────

export function getPromptEngineUrl(): string {
  return (
    localStorage.getItem(LS_PROMPT_ENGINE) ||
    import.meta.env.VITE_PROMPT_ENGINE_URL ||
    ''
  );
}

export function setPromptEngineUrl(url: string): void {
  if (url) {
    localStorage.setItem(LS_PROMPT_ENGINE, url);
  } else {
    localStorage.removeItem(LS_PROMPT_ENGINE);
  }
}

export function isPromptEngineAvailable(): boolean {
  return getPromptEngineUrl().length > 0;
}
