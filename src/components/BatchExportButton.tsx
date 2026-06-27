import React, { useState, useCallback } from 'react';
import { Download, Package, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createZip, downloadZip } from '@/lib/zip-utils';

export interface ExportItem {
  url: string;
  name: string;
}

interface BatchExportButtonProps {
  items: ExportItem[];
  filename?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

/** 批量导出按钮：依次下载所有视频文件并打包为 ZIP */
export default function BatchExportButton({
  items,
  filename = 'video-export.zip',
  variant = 'default',
  size = 'default',
  className = '',
  disabled = false,
}: BatchExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = useCallback(async () => {
    if (items.length === 0) {
      toast.error('没有可导出的文件');
      return;
    }

    setExporting(true);
    try {
      // Download all files in parallel
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error(`下载失败: ${item.name}`);
          const blob = await response.blob();
          return { name: item.name, data: blob };
        }),
      );

      const files: Array<{ name: string; data: Blob }> = [];
      let failCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          files.push(result.value);
        } else {
          failCount++;
        }
      }

      if (files.length === 0) {
        toast.error('所有文件下载失败');
        setExporting(false);
        return;
      }

      // Create ZIP
      const zipBlob = await createZip(files);

      // Trigger download
      downloadZip(zipBlob, filename);

      if (failCount > 0) {
        toast.warning(`已导出 ${files.length} 个文件，${failCount} 个下载失败`);
      } else {
        toast.success(`已导出 ${files.length} 个文件`);
      }

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败';
      toast.error(`导出失败: ${msg}`);
    } finally {
      setExporting(false);
    }
  }, [items, filename]);

  const isDisabled = disabled || exporting || items.length === 0;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleExport}
      disabled={isDisabled}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          打包中...
        </>
      ) : done ? (
        <>
          <Check className="h-4 w-4 mr-1.5 text-green-500" />
          已导出
        </>
      ) : (
        <>
          <Package className="h-4 w-4 mr-1.5" />
          <Download className="h-3 w-3 mr-1" />
          批量导出 ({items.length})
        </>
      )}
    </Button>
  );
}
