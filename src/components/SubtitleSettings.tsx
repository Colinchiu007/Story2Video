import React, { useMemo } from 'react';
import { Type, Palette, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { splitTextToSubtitles } from '@/lib/text-segmentation';

export interface SubtitleConfig {
  enabled: boolean;
  font: string;
  size: string;
  style: string;
}

interface SubtitleSettingsProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
  disabled?: boolean;
  /** 语音合成文案，用于实时展示字幕分断效果 */
  audioText?: string;
}

const FONT_OPTIONS = [
  { value: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', label: '思源黑体' },
  { value: '"Noto Serif SC", "Source Han Serif SC", serif', label: '思源宋体' },
  { value: '"Noto Serif SC", "Source Han Serif SC", serif', label: '思源粗宋', weightHint: '700' },
  { value: '"Smiley Sans Oblique", "Noto Sans SC", sans-serif', label: '得意黑' },
  { value: '"Alibaba PuHuiTi", "Noto Sans SC", sans-serif', label: '阿里巴巴普惠体' },
  { value: '"Douyin Sans", "Noto Sans SC", sans-serif', label: '抖音美好体' },
  { value: '"Glow Sans SC", "Noto Sans SC", sans-serif', label: '未来荧黑' },
  { value: '"vivo Sans", "Noto Sans SC", sans-serif', label: 'vivo Sans' },
  { value: '"优设标题黑", "YouSheBiaoTiHei", "Noto Sans SC", "PingFang SC", sans-serif', label: '优设标题黑' },
];

const SIZE_OPTIONS = [
  { value: 'size1', label: '小', px: '16px' },
  { value: 'size2', label: '较小', px: '18px' },
  { value: 'size3', label: '中', px: '22px' },
  { value: 'size4', label: '较大', px: '26px' },
  { value: 'size5', label: '大', px: '30px' },
];

const STYLE_OPTIONS = [
  { value: 'style1', label: '经典白字黑边', className: 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' },
  { value: 'style2', label: '现代黑字白边', className: 'text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]' },
  { value: 'style3', label: '醒目黄字红边', className: 'text-yellow-300 drop-shadow-[0_1px_2px_rgba(220,38,38,0.8)]' },
  { value: 'style4', label: '柔和蓝字白底', className: 'text-blue-600 bg-white/80 px-3 py-1 rounded' },
  { value: 'style5', label: '高亮绿字黑边', className: 'text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]' },
  { value: 'style6', label: '白字蓝底卡片', className: 'text-white bg-blue-600/90 px-3 py-1 rounded' },
  { value: 'style7', label: '优雅粉字白底', className: 'text-pink-500 bg-white/80 px-3 py-1 rounded' },
  { value: 'style8', label: '暗夜紫字白边', className: 'text-purple-300 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]' },
  { value: 'style9', label: '橙字黑底卡片', className: 'text-orange-400 bg-black/70 px-3 py-1 rounded' },
  { value: 'style10', label: '青字渐变背景', className: 'text-cyan-300 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 px-3 py-1 rounded' },
  { value: 'style11', label: '红字白底描边', className: 'text-red-600 bg-white/80 px-3 py-1 rounded border border-red-300' },
  { value: 'style12', label: '银灰金属字', className: 'text-gray-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] tracking-wider' },
];

export default function SubtitleSettings({ config, onChange, disabled, audioText }: SubtitleSettingsProps) {
  const handleToggle = (checked: boolean) => {
    onChange({ ...config, enabled: checked });
  };

  const previewText = '字幕预览：春眠不觉晓处处闻啼鸟';
  const selectedStyle = STYLE_OPTIONS.find((s) => s.value === config.style) ?? STYLE_OPTIONS[0];
  const selectedSize = SIZE_OPTIONS.find((s) => s.value === config.size) ?? SIZE_OPTIONS[2];

  // 实时分断预览
  const segmentedLines = useMemo(() => {
    if (!audioText || audioText.trim().length === 0) return [];
    return splitTextToSubtitles(audioText);
  }, [audioText]);

  const hasPreview = segmentedLines.length > 0;

  return (
    <div className="space-y-4 border border-border rounded-sm p-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Checkbox
          id="subtitle-enabled"
          checked={config.enabled}
          onCheckedChange={(v) => handleToggle(v === true)}
          disabled={disabled}
        />
        <Label htmlFor="subtitle-enabled" className="font-medium cursor-pointer">
          <Type className="h-4 w-4 inline mr-1 text-primary" />
          显示字幕
        </Label>
      </div>

      {config.enabled && (
        <div className="space-y-4 pt-2">
          {/* Style preview */}
          <div className="p-3 bg-black/80 rounded-sm text-center">
            <span
              className={`inline-block ${selectedStyle.className}`}
              style={{ fontSize: selectedSize.px, fontFamily: config.font }}
            >
              {previewText}
            </span>
          </div>

          {/* Real-time subtitle segmentation preview */}
          {hasPreview && (
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1 text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                字幕分断实时预览（共 {segmentedLines.length} 行）
              </Label>
              <div className="p-3 bg-black/80 rounded-sm space-y-1.5 max-h-40 overflow-y-auto">
                {segmentedLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                    <span
                      className={`inline-block ${selectedStyle.className}`}
                      style={{ fontSize: selectedSize.px, fontFamily: config.font }}
                    >
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Font */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1">
              <Palette className="h-3.5 w-3.5" />
              字体
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...config, font: f.value })}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    config.font === f.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <Label className="text-sm">字号</Label>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...config, size: s.value })}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    config.size === s.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <Label className="text-sm">样式</Label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...config, style: s.value })}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    config.style === s.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function getSubtitleStyleClasses(config: Pick<SubtitleConfig, 'size' | 'style'> | { subtitle_size?: string; subtitle_style?: string }): { fontSize: string; className: string } {
  const sizeKey = 'size' in config ? config.size : config.subtitle_size;
  const styleKey = 'style' in config ? config.style : config.subtitle_style;
  const size = SIZE_OPTIONS.find((s) => s.value === sizeKey) ?? SIZE_OPTIONS[2];
  const style = STYLE_OPTIONS.find((s) => s.value === styleKey) ?? STYLE_OPTIONS[0];
  return { fontSize: size.px, className: style.className };
}
