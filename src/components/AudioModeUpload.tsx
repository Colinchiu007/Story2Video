import React from 'react';
import { Music, Upload, Mic, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/services/api-config';

interface AudioModeUploadProps {
  uploadedAudioUrl: string;
  uploadedAudioName: string;
  uploadedAudioFile: File | null;
  setUploadedAudioUrl: (v: string) => void;
  setUploadedAudioName: (v: string) => void;
  setUploadedAudioFile: (v: File | null) => void;
  audioText: string;
  setAudioText: (v: string) => void;
  isRecognizingAudio: boolean;
  setIsRecognizingAudio: (v: boolean) => void;
  recognizeAudio: (blob: Blob, format?: 'wav' | 'm4a') => Promise<string>;
  handleAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAudioDrop?: (e: React.DragEvent) => void;
}

export default function AudioModeUpload({
  uploadedAudioUrl, uploadedAudioName, uploadedAudioFile,
  setUploadedAudioUrl, setUploadedAudioName, setUploadedAudioFile,
  audioText, setAudioText,
  isRecognizingAudio, setIsRecognizingAudio,
  recognizeAudio, handleAudioUpload, handleAudioDrop,
}: AudioModeUploadProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-primary" />
        <Label className="font-medium">音频文件</Label>
      </div>
      {!uploadedAudioUrl ? (
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={handleAudioDrop}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,.wav,.m4a,.mp3';
            input.onchange = (e) => handleAudioUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
            input.click();
          }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">点击或拖拽上传音频文件</p>
          <p className="text-xs text-muted-foreground mt-1">支持 WAV、M4A、MP3 格式，最大 20MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20">
          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{uploadedAudioName || '已上传音频'}</p>
            <p className="text-xs text-muted-foreground">{uploadedAudioUrl ? '上传成功' : ''}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUploadedAudioUrl('');
              setUploadedAudioName('');
              setUploadedAudioFile(null);
              setAudioText('');
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      )}
      {uploadedAudioUrl && !audioText && (
        <Button
          variant="outline"
          onClick={async () => {
            if (!uploadedAudioFile) {
              toast.error('未找到音频文件');
              return;
            }
            setIsRecognizingAudio(true);
            try {
              const ext = uploadedAudioFile.name.slice(uploadedAudioFile.name.lastIndexOf('.')).toLowerCase();
              const format: 'wav' | 'm4a' = ext === '.m4a' ? 'm4a' : 'wav';
              const text = await recognizeAudio(uploadedAudioFile, format);
              setAudioText(text);
              toast.success('语音识别完成');
            } catch (err) {
              const msg = extractErrorMessage(err);
              toast.error('语音识别失败: ' + msg);
            } finally {
              setIsRecognizingAudio(false);
            }
          }}
          disabled={isRecognizingAudio}
          className="w-full"
        >
          {isRecognizingAudio ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              识别中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              识别音频内容
            </span>
          )}
        </Button>
      )}
      {audioText && (
        <div className="relative">
          <Textarea
            placeholder="识别结果，可编辑修正"
            value={audioText}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length <= 5000) setAudioText(v);
            }}
            rows={4}
            className="bg-background border-border resize-none focus-visible:ring-primary"
          />
          <span className={`absolute bottom-2 right-2 text-xs ${audioText.length > 4800 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {audioText.length}/5000
          </span>
        </div>
      )}
    </div>
  );
}
