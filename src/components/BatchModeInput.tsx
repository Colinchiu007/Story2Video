import React from 'react';
import { ListOrdered, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface BatchSegment {
  id: string;
  text: string;
  audioUrl: string;
  audioName: string;
}

interface BatchModeInputProps {
  batchSegments: BatchSegment[];
  setBatchSegments: (v: BatchSegment[] | ((prev: BatchSegment[]) => BatchSegment[])) => void;
  batchInputText: string;
  setBatchInputText: (v: string) => void;
  isUploading: boolean;
  uploadToStorage: (file: File, bucket: string) => Promise<string>;
}

export default function BatchModeInput({
  batchSegments, setBatchSegments, batchInputText, setBatchInputText,
  isUploading, uploadToStorage,
}: BatchModeInputProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-primary" />
        <Label className="font-medium">分段文案</Label>
      </div>
      <div className="relative">
        <Textarea
          placeholder={"每行输入一段文案，每段将生成一个独立的视频片段\n示例：\n第一段文案内容\n第二段文案内容\n第三段文案内容"}
          value={batchInputText}
          onChange={(e) => setBatchInputText(e.target.value)}
          rows={6}
          className="bg-background border-border resize-none focus-visible:ring-primary"
        />
      </div>
      {batchInputText.trim() && (
        <div className="text-xs text-muted-foreground">
          共 <span className="font-medium text-foreground">{batchInputText.split('\n').filter((l) => l.trim()).length}</span> 个分段
        </div>
      )}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">或</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm">批量上传音频（每个音频对应一个分段）</Label>
        <Button
          variant="outline"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,.wav,.m4a,.mp3';
            input.multiple = true;
            input.onchange = async (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (!files) return;
              const newSegments = [...batchSegments];
              for (const file of Array.from(files)) {
                try {
                  const url = await uploadToStorage(file, 'generated-media');
                  newSegments.push({ id: crypto.randomUUID(), text: '', audioUrl: url, audioName: file.name });
                } catch {
                  toast.error('上传失败: ' + file.name);
                }
              }
              setBatchSegments(newSegments);
              toast.success('已上传 ' + files.length + ' 个音频');
            };
            input.click();
          }}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? '上传中...' : '选择音频文件'}
        </Button>
        {batchSegments.length > 0 && (
          <div className="space-y-2 mt-2">
            {batchSegments.map((seg, idx) => (
              <div key={seg.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{seg.audioName || '音频片段'}</p>
                  {seg.text && <p className="text-xs text-muted-foreground truncate">{seg.text}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchSegments((prev) => prev.filter((s) => s.id !== seg.id))}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
