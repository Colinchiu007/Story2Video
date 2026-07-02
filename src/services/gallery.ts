import { supabase } from '@/db/supabase';
import type { GalleryImage } from '@/types';
import { extractErrorMessage } from './api-config';

export async function createGalleryImage(params: {
  taskId: string;
  imageUrl?: string;
  prompt: string;
  originalPrompt?: string;
  index: number;
  status?: 'pending' | 'success' | 'failed';
  errorMessage?: string;
}): Promise<GalleryImage> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('gallery_images')
    .insert({
      task_id: params.taskId,
      user_id: user?.id,
      image_url: params.imageUrl || null,
      prompt: params.prompt,
      original_prompt: params.originalPrompt || null,
      index: params.index,
      status: params.status || 'success',
      error_message: params.errorMessage || null,
    })
    .select()
    .single();
  if (error) throw new Error(extractErrorMessage(error));
  return data as GalleryImage;
}

export async function listGalleryImages(taskId: string): Promise<GalleryImage[]> {
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('task_id', taskId)
    .order('index', { ascending: true });
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as GalleryImage[]) : [];
}

export async function updateGalleryImage(
  id: string,
  updates: Partial<Pick<GalleryImage, 'image_url' | 'prompt' | 'original_prompt' | 'status' | 'error_message'>>,
): Promise<void> {
  const { error } = await supabase
    .from('gallery_images')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(extractErrorMessage(error));
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const { error } = await supabase.from('gallery_images').delete().eq('id', id);
  if (error) throw new Error(extractErrorMessage(error));
}
