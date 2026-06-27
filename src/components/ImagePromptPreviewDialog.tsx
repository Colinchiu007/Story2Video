import { useState, useRef, useCallback } from 'react';
import { Wand2, Image, X, Upload, FileText, ExternalLink, Loader2, Sparkles, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { generateImagePrompts } from '@/lib/history-prompt';
import { startImageGenerationWithProfile, queryImageGenerationWithProfile } from '@/services/image-generation';
import type { CustomApiProfile } from '@/types';

const STRATEGY_STORAGE_KEY = 'image_prompt_optimization_strategy';

const DEFAULT_STRATEGY = `你是一个专业的 AI 绘画提示词优化师。你的任务是将用户提供的简短文案片段，转化为适合 AI 绘画模型使用的高质量、详细的英文提示词。

规则：
1. 保留原片段的核心主题和意境
2. 添加摄影/绘画风格描述（如 cinematic lighting, professional photography, 8k resolution, masterpiece, highly detailed）
3. 添加构图、光影、色彩、氛围等细节
4. 输出必须是纯英文提示词，不要包含中文或解释
5. 每个片段只输出一条优化后的提示词，不要有多余内容
6. 提示词长度控制在 100-200 个英文单词之间`;

const EXAMPLE_STRATEGY_URL = 'https://github.com/example/prompt-optimization-strategy.md';

function getStoredStrategy(): string {
  try {
    return localStorage.getItem(STRATEGY_STORAGE_KEY) || DEFAULT_STRATEGY;
  } catch {
    return DEFAULT_STRATEGY;
  }
}

function setStoredStrategy(strategy: string): void {
  localStorage.setItem(STRATEGY_STORAGE_KEY, strategy);
}

interface ImagePromptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateImage?: (prompt: string) => void;
}

interface CompareResult {
  id: string;
  provider: string;
  providerLabel: string;
  profileName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  imageUrl?: string;
  error?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  kimi: 'Kimi',
  doubao: '豆包',
  jimeng: '即梦',
  kling: '可灵',
  vidu: 'Vidu',
  sensenova: '商汤SenseNova',
  other: '其他',
};

/** 获取多模型对比需要的模型列表（始终包含内置可灵 + 所有已配置自定义API） */
function getCompareProfiles(): Array<{ id: string; provider: string; providerLabel: string; profileName: string; apiKey?: string; apiBaseUrl?: string; modelName?: string; extra?: Record<string, string> }> {
  const stored = localStorage.getItem('api_config');
  const results: Array<{ id: string; provider: string; providerLabel: string; profileName: string; apiKey?: string; apiBaseUrl?: string; modelName?: string; extra?: Record<string, string> }> = [];

  // 始终加入内置可灵（平台内置AI）
  results.push({
    id: 'builtin-kling',
    provider: 'kling',
    providerLabel: PROVIDER_LABELS.kling,
    profileName: '可灵内置AI',
  });

  if (!stored) return results;
  try {
    const cfg = JSON.parse(stored) as { modelConfig?: { image?: { profiles?: CustomApiProfile[] } } };
    const profiles = cfg.modelConfig?.image?.profiles ?? [];

    // 自定义API profiles：按 provider 去重，保留最新一个
    const latestByProvider = new Map<string, CustomApiProfile>();
    for (const p of profiles) {
      latestByProvider.set(p.provider, p); // 后面的覆盖前面的，保留最新
    }
    for (const p of latestByProvider.values()) {
      results.push({
        id: p.id,
        provider: p.provider,
        providerLabel: PROVIDER_LABELS[p.provider] || p.provider,
        profileName: p.name || PROVIDER_LABELS[p.provider] || p.provider,
        apiKey: p.apiKey,
        apiBaseUrl: p.apiBaseUrl,
        modelName: p.modelName,
        extra: p.extra,
      });
    }
  } catch { /* ignore */ }
  return results;
}

export default function ImagePromptPreviewDialog({ open, onOpenChange, onGenerateImage }: ImagePromptPreviewDialogProps) {
  const [originalText, setOriginalText] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateStatusHint, setGenerateStatusHint] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showStrategyEditor, setShowStrategyEditor] = useState(false);
  const [strategy, setStrategy] = useState(getStoredStrategy);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 多模型对比状态
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [compareProgress, setCompareProgress] = useState(0);

  // 图片灯箱
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleOptimize = useCallback(async () => {
    const text = originalText.trim();
    if (!text) {
      toast.error('请输入原文');
      return;
    }
    if (text.length > 500) {
      toast.error('原文最多500字');
      return;
    }
    setIsOptimizing(true);
    setOptimizedPrompt('');
    try {
      // 使用默认策略时，优先调用前端 V9 策略（本地执行，无需网络请求）
      const isDefaultStrategy = strategy.trim() === DEFAULT_STRATEGY.trim();
      if (isDefaultStrategy) {
        const prompts = generateImagePrompts([text], text);
        if (prompts.length > 0 && prompts[0]) {
          setOptimizedPrompt(prompts[0]);
          toast.success('提示词优化完成（V9策略）');
        } else {
          throw new Error('V9策略未返回提示词');
        }
      } else {
        // 用户自定义策略时，通过 Edge Function 调用
        const { data, error } = await supabase.functions.invoke('optimize-prompt', {
          body: { text, systemPrompt: strategy },
        });
        if (error) {
          const errorMsg = await error?.context?.text();
          throw new Error(errorMsg || error.message);
        }
        const result = data as { prompt?: string; error?: string };
        if (result.error) throw new Error(result.error);
        if (result.prompt) {
          setOptimizedPrompt(result.prompt);
          toast.success('提示词优化完成（自定义策略）');
        } else {
          throw new Error('未返回优化后的提示词');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`优化失败: ${msg}`);
    } finally {
      setIsOptimizing(false);
    }
  }, [originalText, strategy]);

  const handleGenerateImage = useCallback(async () => {
    const prompt = optimizedPrompt.trim();
    if (!prompt) {
      toast.error('请先优化提示词');
      return;
    }
    if (onGenerateImage) {
      onGenerateImage(prompt);
      return;
    }
    setIsGeneratingImage(true);
    setGenerateProgress(5);
    setGenerateStatusHint('正在提交生成请求...');
    setGeneratedImageUrl(null);
    try {
      const { startImageGeneration, queryImageGeneration } = await import('@/services/video');
      const res = await startImageGeneration({ prompt, size: '1024x1024' });

      setGenerateProgress(15);
      setGenerateStatusHint('已提交，正在生成中...');

      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        const delayMs = attempts < 5 ? 1000 : 3000;
        await new Promise((r) => setTimeout(r, delayMs));

        const q = await queryImageGeneration(res.imageId);
        const progress = Math.min(15 + Math.round((attempts / maxAttempts) * 80), 95);
        setGenerateProgress(progress);
        setGenerateStatusHint(`生成中... ${progress}%`);

        if (q.status === 'completed' && q.publicUrl) {
          setGenerateProgress(100);
          setGenerateStatusHint('生成完成');
          setGeneratedImageUrl(q.publicUrl);
          toast.success('图片生成成功');
          return;
        }
        if (q.status === 'failed') {
          throw new Error(q.error || '图片生成失败');
        }
        attempts++;
      }
      throw new Error('图片生成超时');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`生成失败: ${msg}`);
    } finally {
      setIsGeneratingImage(false);
      setGenerateStatusHint('');
    }
  }, [optimizedPrompt, onGenerateImage]);

  const handleCompareGenerate = useCallback(async () => {
    const prompt = optimizedPrompt.trim();
    if (!prompt) {
      toast.error('请先优化提示词');
      return;
    }

    const profiles = getCompareProfiles();
    if (profiles.length === 0) {
      toast.error('未找到任何图片模型配置，请先在API设置中添加');
      return;
    }

    setIsComparing(true);
    setCompareProgress(5);

    // 初始化结果状态
    const initialResults: CompareResult[] = profiles.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerLabel: p.providerLabel,
      profileName: p.profileName,
      status: 'pending',
      progress: 0,
    }));
    setCompareResults(initialResults);

    // 并行提交所有生成请求
    const submitted = await Promise.all(
      profiles.map(async (p, idx) => {
        try {
          const res = await startImageGenerationWithProfile(
            { prompt, size: '1024x1024' },
            { provider: p.provider, apiKey: p.apiKey, apiBaseUrl: p.apiBaseUrl, modelName: p.modelName, extra: p.extra },
          );
          setCompareResults((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'in_progress', progress: 15 };
            return next;
          });
          return { idx, imageId: res.imageId, profile: p, error: null as string | null };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setCompareResults((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'failed', error: msg };
            return next;
          });
          return { idx, imageId: '', profile: p, error: msg };
        }
      }),
    );

    // 并行轮询查询
    const pending = submitted.filter((s) => !s.error);
    let attempts = 0;
    const maxAttempts = 60;

    while (pending.length > 0 && attempts < maxAttempts) {
      const delayMs = attempts < 5 ? 1000 : 3000;
      await new Promise((r) => setTimeout(r, delayMs));

      const completedThisRound: number[] = [];

      await Promise.all(
        pending.map(async (item) => {
          try {
            const q = await queryImageGenerationWithProfile(item.imageId, {
              provider: item.profile.provider,
              apiKey: item.profile.apiKey,
              apiBaseUrl: item.profile.apiBaseUrl,
              extra: item.profile.extra,
            });
            const progress = Math.min(15 + Math.round((attempts / maxAttempts) * 80), 95);

            if (q.status === 'completed' && q.publicUrl) {
              completedThisRound.push(item.idx);
              setCompareResults((prev) => {
                const next = [...prev];
                next[item.idx] = {
                  ...next[item.idx],
                  status: 'completed',
                  progress: 100,
                  imageUrl: q.publicUrl,
                };
                return next;
              });
            } else if (q.status === 'failed') {
              completedThisRound.push(item.idx);
              setCompareResults((prev) => {
                const next = [...prev];
                next[item.idx] = {
                  ...next[item.idx],
                  status: 'failed',
                  error: q.error || '图片生成失败',
                };
                return next;
              });
            } else {
              setCompareResults((prev) => {
                const next = [...prev];
                next[item.idx] = { ...next[item.idx], progress };
                return next;
              });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            completedThisRound.push(item.idx);
            setCompareResults((prev) => {
              const next = [...prev];
              next[item.idx] = { ...next[item.idx], status: 'failed', error: msg };
              return next;
            });
          }
        }),
      );

      // 移除已完成的
      for (let i = pending.length - 1; i >= 0; i--) {
        if (completedThisRound.includes(pending[i].idx)) {
          pending.splice(i, 1);
        }
      }

      const total = profiles.length;
      const done = total - pending.length;
      setCompareProgress(Math.round((done / total) * 100));
      attempts++;
    }

    // 超时未完成的
    if (pending.length > 0) {
      for (const item of pending) {
        setCompareResults((prev) => {
          const next = [...prev];
          next[item.idx] = { ...next[item.idx], status: 'failed', error: '生成超时' };
          return next;
        });
      }
    }

    setIsComparing(false);
    setCompareProgress(100);
    toast.success('多模型对比完成');
  }, [optimizedPrompt]);

  const handleSaveStrategy = useCallback(() => {
    setStoredStrategy(strategy);
    toast.success('提示词优化策略已保存');
    setShowStrategyEditor(false);
  }, [strategy]);

  const handleResetStrategy = useCallback(() => {
    setStrategy(DEFAULT_STRATEGY);
    setStoredStrategy(DEFAULT_STRATEGY);
    toast.success('已恢复默认策略');
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      toast.error('仅支持 .md 或 .txt 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setStrategy(content);
        toast.success('文件读取成功');
      }
    };
    reader.onerror = () => toast.error('文件读取失败');
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-balance flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              图片生成预览
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
          {/* Original text input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>输入原文</Label>
              <span className="text-xs text-muted-foreground">
                {originalText.length}/500
              </span>
            </div>
            <Textarea
              value={originalText}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setOriginalText(e.target.value);
                }
              }}
              rows={4}
              placeholder="输入您想要生成图片的原文描述，最多500字..."
              className="bg-background border-border resize-none"
            />
          </div>

          {/* Optimize button */}
          <Button
            variant="outline"
            onClick={handleOptimize}
            disabled={isOptimizing || !originalText.trim()}
            className="w-full"
          >
            {isOptimizing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在优化提示词...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                自动优化提示词
              </span>
            )}
          </Button>

          {/* Optimized prompt */}
          <div className="space-y-2">
            <Label>优化后的提示词（可手动修改）</Label>
            <Textarea
              value={optimizedPrompt}
              onChange={(e) => setOptimizedPrompt(e.target.value)}
              rows={5}
              placeholder="优化后的提示词将显示在这里，您也可以手动编辑..."
              className="bg-background border-border resize-none"
            />
          </div>

          {/* Generate image button */}
          <Button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage || !optimizedPrompt.trim()}
            className="w-full"
          >
            {isGeneratingImage ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在生成图片...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                生成图片
              </span>
            )}
          </Button>

          {/* Multi-model compare button */}
          <Button
            variant="outline"
            onClick={handleCompareGenerate}
            disabled={isComparing || !optimizedPrompt.trim()}
            className="w-full"
          >
            {isComparing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在多模型对比生成...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                多模型生成图片对比
              </span>
            )}
          </Button>

          {/* Generation progress */}
          {isGeneratingImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{generateStatusHint || '生成中...'}</span>
                <span>{generateProgress}%</span>
              </div>
              <Progress value={generateProgress} className="h-2" />
            </div>
          )}

          {/* Compare progress */}
          {isComparing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>多模型对比生成中...</span>
                <span>{compareProgress}%</span>
              </div>
              <Progress value={compareProgress} className="h-2" />
            </div>
          )}

          {/* Generated image preview */}
          {generatedImageUrl && (
            <div className="space-y-2">
              <Label>生成结果</Label>
              <div className="rounded-sm border border-border overflow-hidden relative group cursor-pointer" onClick={() => setLightboxUrl(generatedImageUrl)}>
                <img
                  src={generatedImageUrl}
                  alt="生成的图片"
                  className="w-full object-contain"
                  style={{ maxHeight: '300px' }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <Maximize2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Compare results */}
          {compareResults.length > 0 && (
            <div className="space-y-3">
              <Label>多模型对比结果</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compareResults.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-sm border border-border overflow-hidden flex flex-col"
                  >
                    <div className="px-3 py-1.5 bg-muted flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {r.providerLabel}
                        {r.profileName !== r.providerLabel && (
                          <span className="text-muted-foreground ml-1">({r.profileName})</span>
                        )}
                      </span>
                      {r.status === 'completed' && (
                        <span className="text-[10px] text-green-600">完成</span>
                      )}
                      {r.status === 'failed' && (
                        <span className="text-[10px] text-red-500">失败</span>
                      )}
                      {r.status === 'in_progress' && (
                        <span className="text-[10px] text-amber-500">生成中...</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-[160px] bg-background relative group cursor-pointer" onClick={() => r.imageUrl && setLightboxUrl(r.imageUrl)}>
                      {r.status === 'completed' && r.imageUrl ? (
                        <>
                          <img
                            src={r.imageUrl}
                            alt={`${r.providerLabel}生成的图片`}
                            className="w-full h-full object-contain"
                            style={{ maxHeight: '220px' }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <Maximize2 className="h-6 w-6 text-white" />
                          </div>
                        </>
                      ) : r.status === 'failed' ? (
                        <div className="text-xs text-red-500 text-center px-3 py-4">
                          {r.error || '生成失败'}
                        </div>
                      ) : (
                        <div className="w-full px-3 py-4">
                          <Progress value={r.progress} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground text-center mt-1.5">生成中 {r.progress}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy management */}
          <div className="border-t border-border pt-4 space-y-3">
            {!showStrategyEditor ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStrategyEditor(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  修改提示词优化策略
                </Button>
                <a
                  href={EXAMPLE_STRATEGY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  查看示例
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>提示词优化策略</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      上传 .md
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetStrategy}
                      className="text-muted-foreground"
                    >
                      恢复默认
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowStrategyEditor(false)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Textarea
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  rows={12}
                  placeholder="输入您的提示词优化策略..."
                  className="bg-background border-border resize-none text-sm font-mono"
                />
                <div className="flex items-center gap-2">
                  <a
                    href={EXAMPLE_STRATEGY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    查看示例策略
                  </a>
                </div>
                <Button onClick={handleSaveStrategy} className="w-full">
                  保存策略
                </Button>
              </div>
            )}
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox - click image to view original */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => { open || setLightboxUrl(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl p-2 bg-background/95 backdrop-blur-sm border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>查看原图</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <div className="flex items-center justify-center">
              <img
                src={lightboxUrl}
                alt="原图"
                className="max-w-full max-h-[80dvh] object-contain rounded-sm"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}