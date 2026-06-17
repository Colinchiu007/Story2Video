import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Sparkles, Plus, Pencil, Trash2, Star, Check, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { ModelConfig, ModelProviderConfig, CustomApiProfile } from '@/types';
import { invokeFunction } from '@/services/video';
import ApiHelpDialog from './ApiHelpDialog';
import ImagePromptPreviewDialog from './ImagePromptPreviewDialog';

export interface ApiConfig {
  aiSource: 'builtin' | 'custom';
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  doubaoApiKey: string;
  jimengApiKey: string;
  doubaoVoiceId: string;
  doubaoVoiceName: string;
  modelConfig: ModelConfig;
}

const LLM_OPTIONS = [
  { value: 'openai', label: 'OpenAI / 兼容' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: '通义千问' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'other', label: '其他' },
];

const TTS_OPTIONS = [
  { value: 'doubao', label: '豆包语音' },
  { value: 'other', label: '其他' },
];

const VIDEO_OPTIONS = [
  { value: 'jimeng', label: '即梦' },
  { value: 'kling', label: '可灵' },
  { value: 'vidu', label: 'Vidu' },
  { value: 'other', label: '其他' },
];

const IMAGE_OPTIONS = [
  { value: 'jimeng', label: '即梦' },
  { value: 'kling', label: '可灵' },
  { value: 'vidu', label: 'Vidu' },
  { value: 'sensenova', label: '商汤SenseNova' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'other', label: '其他' },
];

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  llm: { source: 'builtin', provider: 'openai' },
  tts: { source: 'builtin', provider: 'doubao' },
  video: { source: 'builtin', provider: 'jimeng' },
  image: { source: 'builtin', provider: 'jimeng' },
};

interface ApiSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (config: ApiConfig) => void;
}

function emptyProviderConfig(): ModelProviderConfig {
  return { source: 'builtin', provider: '', apiBaseUrl: '', apiKey: '', modelName: '' };
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyProfile(): CustomApiProfile {
  return { id: genId(), name: '', provider: '', apiBaseUrl: '', apiKey: '', modelName: '', isDefault: false, extra: {} };
}

// 提供商默认配置映射（按模型类型区分）
const PROVIDER_DEFAULTS: Record<string, { url: string; model: string }> = {
  openai:   { url: 'https://api.openai.com/v1',   model: 'gpt-4o-mini' },
  deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen:     { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
  kimi:     { url: 'https://api.moonshot.cn/v1',   model: 'moonshot-v1-8k' },
  doubao:   { url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k' },
  jimeng:   { url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'jimeng-t2i-v40' },
  kling:    { url: 'https://api.klingai.com/v1',   model: '' },
  vidu:     { url: 'https://api.vidu.cn',          model: 'viduq2' },
  sensenova:{ url: 'https://token.sensenova.cn/v1', model: 'sensenova-u1-fast' },
  minimax:  { url: 'https://api.minimaxi.com/v1',  model: 'image-01' },
};

/** 获取某供应商在指定模型类型下的默认配置 */
function getProviderDefaults(provider: string, type: keyof ModelConfig): { url: string; model: string } | undefined {
  const base = PROVIDER_DEFAULTS[provider];
  if (!base) return undefined;
  // 图片模型个性化默认值
  if (type === 'image') {
    if (provider === 'jimeng') return { url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'jimeng-t2i-v40' };
    if (provider === 'vidu') return { url: 'https://api.vidu.cn', model: 'viduq2' };
    if (provider === 'sensenova') return { url: 'https://token.sensenova.cn/v1', model: 'sensenova-u1-fast' };
    if (provider === 'minimax') return { url: 'https://api.minimaxi.com/v1', model: 'image-01' };
    if (provider === 'kling') return { url: '', model: '' };
  }
  // 视频模型个性化默认值
  if (type === 'video') {
    if (provider === 'jimeng') return { url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'jimeng-video-generate-3.0' };
    if (provider === 'vidu') return { url: 'https://api.vidu.cn', model: '' };
    if (provider === 'kling') return { url: '', model: '' };
  }
  return base;
}

// ─── Profile List Item ─────────────────────────────────────────────────────
interface ProfileListItemProps {
  profile: CustomApiProfile;
  isActive: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
}

function ProfileListItem({ profile, isActive, onSelect, onSetDefault, onEdit, onDelete, onTest, isTesting }: ProfileListItemProps) {
  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{profile.name || '未命名配置'}</span>
          {profile.isDefault && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
              <Star className="h-2.5 w-2.5" />默认
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {profile.provider === 'jimeng'
            ? (profile.extra?.accessKeyId ? 'AK 已设置' : 'AK 未设置')
            : (profile.apiBaseUrl || '未设置地址')}
        </p>
      </div>
      {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
      <button
        className="shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
        title="设为默认"
      >
        <Star className="h-3.5 w-3.5" />
      </button>
      <button
        className={`shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ${isTesting ? 'animate-pulse' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTest(); }}
        title="测试连通性"
        disabled={isTesting}
      >
        <Plug className="h-3.5 w-3.5" />
      </button>
      <button
        className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        title="编辑"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Profile Editor ────────────────────────────────────────────────────────
interface ProfileEditorProps {
  profile: CustomApiProfile;
  options: { value: string; label: string }[];
  onChange: (patch: Partial<CustomApiProfile>) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isNew: boolean;
  showKey: boolean;
  onToggleKey: () => void;
}

function ProfileEditor({ profile, options, onChange, onCancel, onConfirm, isNew, showKey, onToggleKey, type }: ProfileEditorProps & { type: keyof ModelConfig }) {
  const handleProviderChange = (newProvider: string) => {
    const oldDef = getProviderDefaults(profile.provider, type);
    const newDef = getProviderDefaults(newProvider, type);
    const patch: Partial<CustomApiProfile> = { provider: newProvider };
    // 如果地址为空或是旧提供商的默认值，则自动填充新提供商的默认值
    if (!profile.apiBaseUrl || (oldDef && profile.apiBaseUrl === oldDef.url)) {
      patch.apiBaseUrl = newDef?.url ?? '';
    }
    // 同理自动填充默认模型名
    if (!profile.modelName || (oldDef && profile.modelName === oldDef.model)) {
      patch.modelName = newDef?.model ?? '';
    }
    // 切换供应商时清空extra
    patch.extra = {};
    onChange(patch);
  };

  const provider = profile.provider;
  const isJimeng = provider === 'jimeng';
  // 固定地址的供应商不需要用户填写Base URL
  const fixedUrlProviders = ['vidu', 'kling', 'jimeng', 'sensenova'];
  const showBaseUrl = !fixedUrlProviders.includes(provider);
  // 图片模型中部分供应商模型名是固定的或有默认值
  const showModelName = type !== 'image' || (provider !== 'vidu' && provider !== 'jimeng');

  return (
    <div className="space-y-3 border border-primary/30 rounded-md p-4 bg-primary/5">
      <p className="text-sm font-medium text-foreground">{isNew ? '新增 API 配置' : '编辑 API 配置'}</p>
      <div className="space-y-2">
        <Label className="text-xs">配置名称</Label>
        <Input
          placeholder="例如：我的 DeepSeek 账号"
          value={profile.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">模型提供商</Label>
        <select
          value={profile.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full h-8 px-2 text-sm rounded-md border border-input bg-background"
        >
          <option value="" disabled>请选择您的模型提供商</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {showBaseUrl && (
        <div className="space-y-2">
          <Label className="text-xs">接口基础地址</Label>
          <Input
            placeholder="例如：https://api.deepseek.com/v1"
            value={profile.apiBaseUrl}
            onChange={(e) => onChange({ apiBaseUrl: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      )}
      {isJimeng ? (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Access Key ID（AK）</Label>
            <Input
              placeholder="形如 AKTPxxxxxxxx"
              value={profile.extra?.accessKeyId ?? ''}
              onChange={(e) => onChange({ extra: { ...(profile.extra || {}), accessKeyId: e.target.value } })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Secret Access Key（SK）</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="创建后只显示一次"
                value={profile.extra?.secretAccessKey ?? ''}
                onChange={(e) => onChange({ extra: { ...(profile.extra || {}), secretAccessKey: e.target.value } })}
                className="h-8 text-sm pr-9"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={onToggleKey}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">API KEY</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              value={profile.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className="h-8 text-sm pr-9"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={onToggleKey}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
      {showModelName && (
        <div className="space-y-2">
          <Label className="text-xs">模型名称</Label>
          <Input
            placeholder="例如：deepseek-chat"
            value={profile.modelName}
            onChange={(e) => onChange({ modelName: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onConfirm} disabled={!provider} className="flex-1 h-8">确认</Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 h-8">取消</Button>
      </div>
    </div>
  );
}

export default function ApiSettingsDialog({ open, onOpenChange, onSave }: ApiSettingsDialogProps) {
  const [aiSource, setAiSource] = useState<'builtin' | 'custom'>('builtin');
  const [doubaoApiKey, setDoubaoApiKey] = useState('');
  const [jimengApiKey, setJimengApiKey] = useState('');
  const [doubaoVoiceId, setDoubaoVoiceId] = useState('');
  const [doubaoVoiceName, setDoubaoVoiceName] = useState('');

  const [modelConfig, setModelConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [activeTab, setActiveTab] = useState<'llm' | 'tts' | 'video' | 'image'>('llm');

  const [showDoubaoKey, setShowDoubaoKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // per-type profile editor state
  const [editingProfile, setEditingProfile] = useState<{ type: keyof ModelConfig; profile: CustomApiProfile; isNew: boolean } | null>(null);
  const [editorShowKey, setEditorShowKey] = useState(false);

  // testing state: profileId -> boolean
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let storedCfg: Partial<ApiConfig> = {};
    const stored = localStorage.getItem('api_config');
    if (stored) {
      try { storedCfg = JSON.parse(stored) as Partial<ApiConfig>; } catch { /* ignore */ }
    }

    if (user) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          storedCfg = {
            aiSource: (data.ai_source as 'builtin' | 'custom') ?? 'builtin',
            apiBaseUrl: data.api_base_url ?? '',
            apiKey: data.api_key ?? '',
            modelName: data.model_name ?? '',
            doubaoApiKey: data.doubao_api_key ?? '',
            jimengApiKey: data.jimeng_api_key ?? '',
            doubaoVoiceId: data.doubao_voice_id ?? '',
            doubaoVoiceName: data.doubao_voice_name ?? '',
            modelConfig: data.model_config ?? { ...DEFAULT_MODEL_CONFIG },
          };
        }
      } catch { /* ignore */ }
    }

    setAiSource(storedCfg.aiSource ?? 'builtin');
    setDoubaoApiKey(storedCfg.doubaoApiKey ?? '');
    setJimengApiKey(storedCfg.jimengApiKey ?? '');
    setDoubaoVoiceId(storedCfg.doubaoVoiceId ?? '');
    setDoubaoVoiceName(storedCfg.doubaoVoiceName ?? '');
    setModelConfig({
      llm: { ...DEFAULT_MODEL_CONFIG.llm, ...(storedCfg.modelConfig?.llm || {}), source: (storedCfg.modelConfig?.llm?.source as 'builtin' | 'custom') ?? 'builtin', provider: storedCfg.modelConfig?.llm?.provider ?? 'openai' },
      tts: { ...DEFAULT_MODEL_CONFIG.tts, ...(storedCfg.modelConfig?.tts || {}), source: (storedCfg.modelConfig?.tts?.source as 'builtin' | 'custom') ?? 'builtin', provider: storedCfg.modelConfig?.tts?.provider ?? 'doubao' },
      video: { ...DEFAULT_MODEL_CONFIG.video, ...(storedCfg.modelConfig?.video || {}), source: (storedCfg.modelConfig?.video?.source as 'builtin' | 'custom') ?? 'builtin', provider: storedCfg.modelConfig?.video?.provider ?? 'jimeng' },
      image: { ...DEFAULT_MODEL_CONFIG.image, ...(storedCfg.modelConfig?.image || {}), source: (storedCfg.modelConfig?.image?.source as 'builtin' | 'custom') ?? 'builtin', provider: storedCfg.modelConfig?.image?.provider ?? 'jimeng' },
    });
  }, []);

  useEffect(() => {
    if (open) loadSettings();
  }, [open, loadSettings]);

  const updateModelConfig = (type: keyof ModelConfig, patch: Partial<ModelProviderConfig>) => {
    setModelConfig((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...patch },
    }));
  };

  // Profile CRUD helpers
  const getProfiles = (type: keyof ModelConfig): CustomApiProfile[] =>
    modelConfig[type]?.profiles ?? [];

  const getActiveProfileId = (type: keyof ModelConfig): string | null =>
    modelConfig[type]?.activeProfileId ?? null;

  const handleAddProfile = (type: keyof ModelConfig) => {
    const np = emptyProfile();
    setEditorShowKey(false);
    setEditingProfile({ type, profile: np, isNew: true });
  };

  const handleEditProfile = (type: keyof ModelConfig, profile: CustomApiProfile) => {
    setEditorShowKey(false);
    setEditingProfile({ type, profile: { ...profile }, isNew: false });
  };

  const handleDeleteProfile = (type: keyof ModelConfig, id: string) => {
    const profiles = getProfiles(type).filter((p) => p.id !== id);
    // if deleted profile was default, assign default to first remaining
    const hadDefault = getProfiles(type).find((p) => p.id === id)?.isDefault;
    if (hadDefault && profiles.length > 0) profiles[0].isDefault = true;
    const newActiveId = getActiveProfileId(type) === id ? (profiles[0]?.id ?? null) : getActiveProfileId(type);
    updateModelConfig(type, { profiles, activeProfileId: newActiveId });
  };

  const handleSetDefault = (type: keyof ModelConfig, id: string) => {
    const profiles = getProfiles(type).map((p) => ({ ...p, isDefault: p.id === id }));
    updateModelConfig(type, { profiles, activeProfileId: id });
  };

  const handleSelectProfile = (type: keyof ModelConfig, id: string) => {
    updateModelConfig(type, { activeProfileId: id });
  };

  const handleTestProfile = async (type: keyof ModelConfig, profile: CustomApiProfile) => {
    setTestingIds((prev) => new Set(prev).add(profile.id));
    try {
      let result: { success: boolean; message: string };
      if (profile.provider === 'jimeng') {
        const ak = profile.extra?.accessKeyId?.trim();
        const sk = profile.extra?.secretAccessKey?.trim();
        if (!ak || !sk) {
          toast.error('请先填写 Access Key ID 和 Secret Access Key');
          return;
        }
        result = await invokeFunction('jimeng-test-connection', {
          access_key_id: ak,
          secret_access_key: sk,
        }) as { success: boolean; message: string };
      } else {
        const key = profile.apiKey?.trim();
        const url = profile.apiBaseUrl?.trim();
        if (!key) {
          toast.error('请先填写鉴权密钥');
          return;
        }
        result = await invokeFunction('api-health-check', {
          provider: profile.provider,
          api_key: key,
          api_base_url: url,
        }) as { success: boolean; message: string };
      }
      if (result.success) {
        toast.success(result.message || '连接测试成功');
      } else {
        toast.error(result.message || '连接测试失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`测试失败: ${msg}`);
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.id);
        return next;
      });
    }
  };

  const handleConfirmEditor = async () => {
    if (!editingProfile) return;
    const { type, profile, isNew } = editingProfile;

    // 供应商差异化字段验证
    if (profile.provider === 'jimeng') {
      const ak = profile.extra?.accessKeyId?.trim();
      const sk = profile.extra?.secretAccessKey?.trim();
      if (!ak) { toast.error('请填写 Access Key ID（AK）'); return; }
      if (!sk) { toast.error('请填写 Secret Access Key（SK）'); return; }
      // 自动预设即梦固定 endpoint（Edge Function 内部已硬编码，此处保证数据完整性）
      if (!profile.apiBaseUrl?.trim()) {
        profile.apiBaseUrl = 'https://visual.volcengineapi.com';
      }
    } else {
      if (!profile.apiKey.trim()) { toast.error('请填写鉴权密钥'); return; }
    }

    let profiles = [...getProfiles(type)];
    if (isNew) {
      // if it's the first profile, mark as default
      if (profiles.length === 0) profile.isDefault = true;
      profiles.push(profile);
    } else {
      profiles = profiles.map((p) => p.id === profile.id ? profile : p);
    }
    // ensure only one default
    if (profile.isDefault) {
      profiles = profiles.map((p) => ({ ...p, isDefault: p.id === profile.id }));
    }
    const newActiveId = isNew ? profile.id : (getActiveProfileId(type) ?? profile.id);
    updateModelConfig(type, { profiles, activeProfileId: newActiveId });
    setEditingProfile(null);
    toast.success(isNew ? '已添加 API' : '已更新 API');
    await doSave();
  };

  const doSave = async (opts?: { close?: boolean }) => {
    const config: ApiConfig = {
      aiSource,
      apiBaseUrl: '',
      apiKey: '',
      modelName: '',
      doubaoApiKey: doubaoApiKey.trim(),
      jimengApiKey: jimengApiKey.trim(),
      doubaoVoiceId: doubaoVoiceId.trim(),
      doubaoVoiceName: doubaoVoiceName.trim(),
      modelConfig,
    };

    setIsSaving(true);
    try {
      localStorage.setItem('api_config', JSON.stringify(config));

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('user_settings').upsert({
          user_id: user.id,
          ai_source: aiSource,
          api_base_url: null,
          api_key: null,
          model_name: null,
          doubao_api_key: doubaoApiKey.trim() || null,
          jimeng_api_key: jimengApiKey.trim() || null,
          doubao_voice_id: doubaoVoiceId.trim() || null,
          doubao_voice_name: doubaoVoiceName.trim() || null,
          model_config: modelConfig,
        }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      toast.success('API 配置已保存');
      onSave?.(config);
      if (opts?.close) {
        onOpenChange(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      toast.error(`保存失败: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => doSave({ close: true });

  const getOptionsForType = (type: keyof ModelConfig) => {
    if (type === 'llm') return LLM_OPTIONS;
    if (type === 'tts') return TTS_OPTIONS;
    if (type === 'video') return VIDEO_OPTIONS;
    return IMAGE_OPTIONS;
  };

  const renderProviderOptions = (type: keyof ModelConfig) => {
    const cfg = modelConfig[type] || emptyProviderConfig();
    const isBuiltin = cfg.source === 'builtin';
    const profiles = getProfiles(type);
    const activeId = getActiveProfileId(type);
    const defaultProfile = profiles.find((p) => p.isDefault);
    const activeProfile = profiles.find((p) => p.id === activeId) ?? defaultProfile ?? profiles[0] ?? null;
    const isEditingThisType = editingProfile?.type === type;

    return (
      <div className="space-y-3">
        <RadioGroup
          value={cfg.source}
          onValueChange={(v) => updateModelConfig(type, { source: v as 'builtin' | 'custom' })}
          className="space-y-2"
        >
          <div className="flex items-start gap-3 p-3 border border-border rounded-sm cursor-pointer hover:border-primary transition-colors">
            <RadioGroupItem value="builtin" id={`${type}-builtin`} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor={`${type}-builtin`} className="font-medium cursor-pointer">使用内置 AI</Label>
              <p className="text-xs text-muted-foreground">使用平台提供的 AI 算力，无需额外配置</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 border border-border rounded-sm cursor-pointer hover:border-primary transition-colors">
            <RadioGroupItem value="custom" id={`${type}-custom`} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor={`${type}-custom`} className="font-medium cursor-pointer">使用我自己的 API</Label>
              <p className="text-xs text-muted-foreground">使用您自己的 API 密钥进行算力调用</p>
            </div>
          </div>
        </RadioGroup>

        {!isBuiltin && (
          <div className="space-y-2">
            {/* Profile list */}
            {profiles.length > 0 && !isEditingThisType && (
              <div className="space-y-1.5">
                {profiles.map((p) => (
                  <ProfileListItem
                    key={p.id}
                    profile={p}
                    isActive={activeProfile?.id === p.id}
                    onSelect={() => handleSelectProfile(type, p.id)}
                    onSetDefault={() => handleSetDefault(type, p.id)}
                    onEdit={() => handleEditProfile(type, p)}
                    onDelete={() => handleDeleteProfile(type, p.id)}
                    onTest={() => handleTestProfile(type, p)}
                    isTesting={testingIds.has(p.id)}
                  />
                ))}
              </div>
            )}

            {/* Editor */}
            {isEditingThisType && editingProfile && (
              <ProfileEditor
                profile={editingProfile.profile}
                type={type}
                options={getOptionsForType(type)}
                onChange={(patch) => setEditingProfile((prev) => prev ? { ...prev, profile: { ...prev.profile, ...patch } } : null)}
                onCancel={() => setEditingProfile(null)}
                onConfirm={handleConfirmEditor}
                isNew={editingProfile.isNew}
                showKey={editorShowKey}
                onToggleKey={() => setEditorShowKey((v) => !v)}
              />
            )}

            {/* Add button */}
            {!isEditingThisType && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 border-dashed gap-1.5"
                onClick={() => handleAddProfile(type)}
              >
                <Plus className="h-3.5 w-3.5" />
                添加 API
              </Button>
            )}

            {profiles.length === 0 && !isEditingThisType && (
              <p className="text-xs text-muted-foreground text-center py-1">
                尚未添加任何 API 配置，请点击上方按钮添加
              </p>
            )}
          </div>
        )}

        {isBuiltin && (
          <p className="text-xs text-muted-foreground">使用内置 AI 时，平台自动选择默认模型，无需手动切换</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-balance">API 设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setEditingProfile(null); }} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="llm">推理模型</TabsTrigger>
              <TabsTrigger value="tts">语音模型</TabsTrigger>
              <TabsTrigger value="video">视频模型</TabsTrigger>
              <TabsTrigger value="image">图片模型</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === 'llm' && renderProviderOptions('llm')}
          {activeTab === 'tts' && renderProviderOptions('tts')}
          {activeTab === 'video' && renderProviderOptions('video')}
          {activeTab === 'image' && (
            <div className="space-y-3">
              {renderProviderOptions('image')}
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                预览效果
              </Button>
            </div>
          )}

          {/* Legacy Doubao Speech section */}
          {activeTab === 'tts' && (
            <div className="space-y-4 border border-border rounded-sm p-4 bg-muted/20">
              <span className="text-sm font-medium">豆包语音 API 密钥</span>
              <div className="space-y-2">
                <Label htmlFor="doubao-api-key">API Key <span className="text-muted-foreground font-normal">（可选）</span></Label>
                <div className="relative">
                  <Input
                    id="doubao-api-key"
                    type={showDoubaoKey ? 'text' : 'password'}
                    placeholder="请输入火山引擎豆包语音 API Key"
                    value={doubaoApiKey}
                    onChange={(e) => setDoubaoApiKey(e.target.value)}
                    className="bg-background border-border pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowDoubaoKey(!showDoubaoKey)}
                  >
                    {showDoubaoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  用于音色克隆和语音合成。如不填写，将使用平台内置额度（如有）。
                </p>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label htmlFor="doubao-voice-id">已有豆包音色ID <span className="text-muted-foreground font-normal">（可选）</span></Label>
                  <Input
                    id="doubao-voice-id"
                    placeholder="例如：S_kXWl9zS22"
                    value={doubaoVoiceId}
                    onChange={(e) => setDoubaoVoiceId(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doubao-voice-name">音色名称 <span className="text-muted-foreground font-normal">（可选）</span></Label>
                  <Input
                    id="doubao-voice-name"
                    placeholder="例如：我的专属音色"
                    value={doubaoVoiceName}
                    onChange={(e) => setDoubaoVoiceName(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </DialogContent>

      <ApiHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <ImagePromptPreviewDialog open={showPreview} onOpenChange={setShowPreview} />
    </Dialog>
  );
}

export function getApiConfig(): ApiConfig | null {
  const stored = localStorage.getItem('api_config');
  if (stored) {
    try {
      return JSON.parse(stored) as ApiConfig;
    } catch { /* ignore */ }
  }
  return null;
}

export function getModelConfig(): ModelConfig {
  const cfg = getApiConfig();
  return cfg?.modelConfig ?? { ...DEFAULT_MODEL_CONFIG };
}

/**
 * 获取指定类型下活跃的自定义 API profile，包含 provider / apiBaseUrl / apiKey / modelName
 * 如果未配置自定义 API 或无活跃 profile，返回 null
 */
export function getActiveProfile(type: keyof ModelConfig): CustomApiProfile | null {
  const cfg = getModelConfig()[type];
  if (!cfg || cfg.source !== 'custom') return null;
  const profiles = cfg.profiles ?? [];
  // 优先从 profiles 中查找
  if (profiles.length > 0) {
    const activeId = cfg.activeProfileId;
    if (activeId) {
      const found = profiles.find((p) => p.id === activeId);
      if (found) return found;
    }
    const def = profiles.find((p) => p.isDefault);
    return def ?? profiles[0] ?? null;
  }
  // 向下兼容：无 profiles 时从直接属性构建 fallback profile
  return {
    id: 'fallback',
    name: '旧配置',
    provider: cfg.provider || '',
    apiBaseUrl: cfg.apiBaseUrl || '',
    apiKey: cfg.apiKey || '',
    modelName: cfg.modelName || '',
    isDefault: true,
  };
}

export function getDoubaoApiKey(): string | null {
  const cfg = getApiConfig();
  return cfg?.doubaoApiKey?.trim() || null;
}

export function getJimengApiKey(): string | null {
  const cfg = getApiConfig();
  return cfg?.jimengApiKey?.trim() || null;
}

export function getDoubaoVoiceId(): string | null {
  const cfg = getApiConfig();
  return cfg?.doubaoVoiceId?.trim() || null;
}

export function getDoubaoVoiceName(): string | null {
  const cfg = getApiConfig();
  return cfg?.doubaoVoiceName?.trim() || null;
}

export function getVideoProvider(): string {
  const cfg = getModelConfig().video;
  if (cfg?.source === 'custom') {
    const p = getActiveProfile('video');
    return p?.provider || cfg?.provider || 'jimeng';
  }
  return cfg?.provider || 'jimeng';
}

export function getImageProvider(): string {
  const cfg = getModelConfig().image;
  if (cfg?.source === 'custom') {
    const p = getActiveProfile('image');
    return p?.provider || cfg?.provider || 'kling';
  }
  return cfg?.provider || 'kling';
}

export function getVideoApiKey(): string | null {
  const p = getActiveProfile('video');
  if (p?.apiKey) return p.apiKey.trim();
  return getJimengApiKey();
}

export function getImageApiKey(): string | null {
  const p = getActiveProfile('image');
  return p?.apiKey?.trim() || null;
}

export function getLlmApiConfig(): { apiBaseUrl: string; apiKey: string; modelName: string; provider: string } | null {
  const p = getActiveProfile('llm');
  if (!p) return null;
  return {
    apiBaseUrl: p.apiBaseUrl.trim(),
    apiKey: p.apiKey.trim(),
    modelName: p.modelName.trim(),
    provider: p.provider,
  };
}
