import React, { useState, useEffect } from 'react';
import { Watermark, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadWatermarkConfig, saveWatermarkConfig } from '@/lib/watermark';
import type { WatermarkConfig, WatermarkPosition } from '@/types';

interface WatermarkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const positionLabels: Record<WatermarkPosition, string> = {
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
  center: '居中',
};

export default function WatermarkPicker({ open, onOpenChange }: WatermarkPickerProps) {
  const [config, setConfig] = useState<WatermarkConfig>(() => loadWatermarkConfig());

  // Reload when dialog opens
  useEffect(() => {
    if (open) {
      setConfig(loadWatermarkConfig());
    }
  }, [open]);

  const handleSave = () => {
    saveWatermarkConfig(config);
    onOpenChange(false);
  };

  const update = (partial: Partial<WatermarkConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Watermark className="h-5 w-5 text-primary" />
            视频水印设置
          </DialogTitle>
          <DialogDescription>
            配置视频输出时显示的水印。水印将渲染在生成视频的画面之上。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="watermark-enabled">启用水印</Label>
              <p className="text-xs text-muted-foreground">
                开启后将在视频右上/下角显示水印文字
              </p>
            </div>
            <Switch
              id="watermark-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => update({ enabled: checked })}
            />
          </div>

          {/* Watermark text */}
          <div className="space-y-2">
            <Label htmlFor="watermark-text">水印文字</Label>
            <Input
              id="watermark-text"
              placeholder="例如：@MyChannel"
              value={config.text}
              onChange={(e) => update({ text: e.target.value })}
              disabled={!config.enabled}
            />
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label htmlFor="watermark-position">显示位置</Label>
            <Select
              value={config.position}
              onValueChange={(val) => update({ position: val as WatermarkPosition })}
              disabled={!config.enabled}
            >
              <SelectTrigger id="watermark-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(positionLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="watermark-size">字号</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{config.fontSize}px</span>
            </div>
            <Slider
              id="watermark-size"
              min={12}
              max={72}
              step={1}
              value={[config.fontSize]}
              onValueChange={([val]) => update({ fontSize: val })}
              disabled={!config.enabled}
            />
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="watermark-opacity">透明度</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(config.opacity * 100)}%</span>
            </div>
            <Slider
              id="watermark-opacity"
              min={0.1}
              max={1}
              step={0.1}
              value={[config.opacity]}
              onValueChange={([val]) => update({ opacity: val })}
              disabled={!config.enabled}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="watermark-color">文字颜色</Label>
            <div className="flex items-center gap-3">
              <input
                id="watermark-color"
                type="color"
                value={config.color}
                onChange={(e) => update({ color: e.target.value })}
                disabled={!config.enabled}
                className="h-9 w-16 rounded-sm border border-border bg-background cursor-pointer disabled:opacity-50"
              />
              <span className="text-xs font-mono text-muted-foreground">{config.color}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 触发水印操作的按钮组件，方便在界面中嵌入 */
export function WatermarkSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5">
      <Settings2 className="h-4 w-4" />
      水印
    </Button>
  );
}
