import { readFileSync, writeFileSync } from 'fs';
const content = readFileSync('D:/Data/projects/Story2Video/AGENTS.md', 'utf8');

const needle = '测试套件稳定性';
const idx = content.indexOf(needle);
if (idx === -1) {
  console.error('Not found');
  process.exit(1);
}

// Find the end of the current section (next ### or end of file)
const afterSection = content.indexOf('\n## 当前测试状态', idx);
if (afterSection === -1) {
  console.error('Section end not found');
  process.exit(1);
}

const appendText = `\n### 🟡 外部 API 无重试

外部 API 调用（TTS/图片生成）必须有 3 次指数退避重试机制。禁止直接 fetch 无重试。
参考 \`src/services/tts-mimo.ts\` 和 \`supabase/functions/tts-mimo/index.ts\`。

### 🟡 Supabase 并发调用 token lock

批量模式中 \`batchParallel\` 并发任务同时调用 \`supabase.functions.invoke\` 会触发 auth token refresh 竞争。
解决：TTS 调用间添加 \`TTS_STAGGER_MS\`（2秒）错开延迟。参考 \`src/pages/CreatePage.tsx\`。

### 🟡 UTF-8 BOM 导致解析失败

PowerShell \`WriteAllText\` 默认添加 BOM，导致 PostCSS/Vite oxc 解析失败。
必须使用 \`[System.Text.UTF8Encoding]::new($false)\` 写入无 BOM 文件。\n`;

const result = content.slice(0, afterSection) + appendText + content.slice(afterSection);
writeFileSync('D:/Data/projects/Story2Video/AGENTS.md', result, 'utf8');
console.log('Done: AGENTS.md updated');