import React, { useState, useCallback } from 'react';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { shareVideo } from '@/lib/share';

interface ShareButtonProps {
  url: string;
  title?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export default function ShareButton({
  url,
  title,
  className,
  variant = 'outline',
  size = 'sm',
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, [url]);

  const handleWebShare = useCallback(async () => {
    try {
      await shareVideo({
        url,
        title: title ?? 'AI 视频',
        text: `我用AI生成的视频${title ? `「${title}」` : ''}，来看看吧！`,
      });
      setOpen(false);
    } catch {
      // Fallback: open dialog
    }
  }, [url, title]);

  const handleOpenInBrowser = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4 mr-1" />
          分享
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>分享视频</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {title && (
            <p className="text-sm text-muted-foreground text-pretty">{title}</p>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={url}
              readOnly
              className="bg-background border-border text-sm flex-1"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="复制链接"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              className="w-full"
              onClick={handleWebShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              分享到其他应用
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenInBrowser}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              在浏览器中打开
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
