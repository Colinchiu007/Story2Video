import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { extractErrorMessage } from '@/services/api-config';

interface UseFileUploadsReturn {
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
  uploadToStorage: (file: File, bucket: string) => Promise<string>;
  processImageFile: (file: File, setUploadedImageUrl: (url: string) => void) => Promise<void>;
  processVideoFile: (file: File, setRemixVideoUrl: (url: string) => void, setRemixVideoFileName: (name: string) => void) => Promise<void>;
  processAudioFile: (file: File, setUploadedAudioUrl: (url: string) => void, setUploadedAudioName: (name: string) => void, setUploadedAudioFile: (f: File | null) => void) => Promise<void>;
}

export function useFileUploads(): UseFileUploadsReturn {
  const [isUploading, setIsUploading] = useState(false);

  const uploadToStorage = useCallback(async (file: File, bucket: string): Promise<string> => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      if (error) throw new Error(extractErrorMessage(error));
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const processImageFile = useCallback(async (file: File, setUploadedImageUrl: (url: string) => void) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPEG、PNG、WebP 格式图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }
    try {
      const url = await uploadToStorage(file, 'generated-media');
      setUploadedImageUrl(url);
      toast.success('图片上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '上传失败';
      toast.error(`上传失败: ${msg}`);
    }
  }, [uploadToStorage]);

  const processVideoFile = useCallback(async (
    file: File,
    setRemixVideoUrl: (url: string) => void,
    setRemixVideoFileName: (name: string) => void,
  ) => {
    if (!file.type.startsWith('video/')) {
      toast.error('仅支持视频文件（MP4、MOV、WebM等）');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('视频大小不能超过 50MB');
      return;
    }
    try {
      const url = await uploadToStorage(file, 'generated-media');
      setRemixVideoUrl(url);
      setRemixVideoFileName(file.name);
      toast.success('视频上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '上传失败';
      toast.error(`视频上传失败: ${msg}`);
    }
  }, [uploadToStorage]);

  const processAudioFile = useCallback(async (
    file: File,
    setUploadedAudioUrl: (url: string) => void,
    setUploadedAudioName: (name: string) => void,
    setUploadedAudioFile: (f: File | null) => void,
  ) => {
    const validTypes = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    const validExts = ['.wav', '.m4a', '.mp3'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.some((t) => file.type.includes(t.replace('audio/', ''))) && !validExts.includes(ext)) {
      toast.error('仅支持 WAV、M4A、MP3 格式音频');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('音频大小不能超过 20MB');
      return;
    }
    try {
      const url = await uploadToStorage(file, 'generated-media');
      setUploadedAudioUrl(url);
      setUploadedAudioName(file.name);
      setUploadedAudioFile(file);
      toast.success('音频上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '上传失败';
      toast.error(`音频上传失败: ${msg}`);
    }
  }, [uploadToStorage]);

  return { isUploading, setIsUploading, uploadToStorage, processImageFile, processVideoFile, processAudioFile };
}
