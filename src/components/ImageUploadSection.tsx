import React from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ImageUploadSectionProps {
  uploadedImageUrl: string;
  setUploadedImageUrl: (v: string) => void;
  isUploading: boolean;
  dragOverImage: boolean;
  setDragOverImage: (v: boolean) => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImageDrop: (e: React.DragEvent) => Promise<void>;
}

export default function ImageUploadSection({
  uploadedImageUrl, setUploadedImageUrl, isUploading, dragOverImage,
  setDragOverImage, imageInputRef, handleImageUpload, handleImageDrop,
}: ImageUploadSectionProps) {
  return (
    <div className="space-y-2">
      <Label>参考图片 <span className="text-destructive">*</span></Label>
      {uploadedImageUrl ? (
        <div className="relative rounded-sm overflow-hidden border border-border">
          <img src={uploadedImageUrl} alt="参考图" className="w-full aspect-video object-cover" />
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 bg-black/60 text-white hover:bg-black/80 border border-white/30"
            onClick={() => { setUploadedImageUrl(''); if (imageInputRef.current) imageInputRef.current.value = ''; }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-muted/30 ${
            dragOverImage ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
          }`}
          onClick={() => imageInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOverImage(true); }}
          onDragLeave={() => setDragOverImage(false)}
          onDrop={handleImageDrop}
        >
          <Upload className={`h-8 w-8 transition-colors ${dragOverImage ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm transition-colors ${dragOverImage ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {dragOverImage ? '松开即可上传图片' : '点击或拖拽上传参考图片'}
          </span>
          <span className="text-xs text-muted-foreground">支持 JPEG/PNG/WebP，≤ 10MB</span>
        </div>
      )}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}
