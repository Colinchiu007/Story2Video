import React from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface RemixVideoUploadProps {
  remixVideoUrl: string;
  setRemixVideoUrl: (v: string) => void;
  remixVideoFileName: string;
  setRemixVideoFileName: (v: string) => void;
  isUploading: boolean;
  dragOverVideo: boolean;
  setDragOverVideo: (v: boolean) => void;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  handleVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleVideoDrop: (e: React.DragEvent) => Promise<void>;
}

export default function RemixVideoUpload({
  remixVideoUrl, setRemixVideoUrl, remixVideoFileName, setRemixVideoFileName,
  isUploading, dragOverVideo, setDragOverVideo,
  videoInputRef, handleVideoUpload, handleVideoDrop,
}: RemixVideoUploadProps) {
  return (
    <div className="space-y-2">
      <Label>上传源视频 <span className="text-destructive">*</span></Label>
      {remixVideoUrl ? (
        <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-2">
          <video src={remixVideoUrl} className="w-full aspect-video rounded-sm" controls muted />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{remixVideoFileName}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRemixVideoUrl(''); setRemixVideoFileName(''); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              移除
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-sm border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-muted/30 ${
            dragOverVideo ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
          }`}
          onClick={() => videoInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOverVideo(true); }}
          onDragLeave={() => setDragOverVideo(false)}
          onDrop={handleVideoDrop}
        >
          <Upload className={`h-8 w-8 transition-colors ${dragOverVideo ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm transition-colors ${dragOverVideo ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {dragOverVideo ? '松开即可上传视频' : '点击或拖拽上传视频文件'}
          </span>
          <span className="text-xs text-muted-foreground">支持 MP4、MOV、WebM，最大 50MB</span>
        </div>
      )}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoUpload}
      />
      <p className="text-xs text-muted-foreground">上传已有视频，AI将基于此视频进行Remix编辑</p>
    </div>
  );
}
