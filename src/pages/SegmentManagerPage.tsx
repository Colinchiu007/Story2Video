import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Trash2, GripVertical, Wand2, Merge,
  Image as ImageIcon, AlertCircle, CheckCircle, Loader2, Save, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getVideoTask, listChildTasks } from '@/services/video-generation';
import { generateTTS } from '@/services/tts';
import { startImageGeneration, queryImageGeneration } from '@/services/image-generation';
import { createSlideshowVideo, getVideoExtension } from '@/lib/slideshow';
import { generateImagePrompts, generateImagePromptsSmart } from '@/lib/history-prompt';
import { splitTextToScenes, splitTextToScenesSmart } from '@/lib/text-segmentation';
import type { VideoTask, GalleryImage } from '@/types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

interface SegmentWithImages extends VideoTask {
  images: GalleryImage[];
}

export default function SegmentManagerPage() {
  const { id: parentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [parentTask, setParentTask] = useState<VideoTask | null>(null);
  const [segments, setSegments] = useState<SegmentWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [editSegment, setEditSegment] = useState<SegmentWithImages | null>(null);
  const [editText, setEditText] = useState('');
  const [isGeneratingSegment, setIsGeneratingSegment] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const [parent, children] = await Promise.all([
        getVideoTask(parentId),
        listChildTasks(parentId),
      ]);
      setParentTask(parent);

      // Load images for each child
      const childrenWithImages = await Promise.all(
        children.map(async (child) => {
          const { data: imgs } = await supabase
            .from('gallery_images')
            .select('*')
            .eq('task_id', child.id)
            .order('index', { ascending: true });
          return { ...child, images: Array.isArray(imgs) ? (imgs as GalleryImage[]) : [] };
        })
      );
      setSegments(childrenWithImages);
    } catch (err) {
      toast.error('加载分段数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    const newSegments = Array.from(segments);
    const [removed] = newSegments.splice(sourceIndex, 1);
    newSegments.splice(destIndex, 0, removed);

    // Update local state with new order
    const reordered = newSegments.map((s, idx) => ({ ...s, segment_index: idx }));
    setSegments(reordered);

    // Persist to DB
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('video_tasks').update({ segment_index: i }).eq('id', reordered[i].id);
      }
      toast.success('排序已保存');
    } catch {
      toast.error('排序保存失败');
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('确定删除此分段吗？')) return;
    try {
      await supabase.from('video_tasks').delete().eq('id', segmentId);
      setSegments((prev) => prev.filter((s) => s.id !== segmentId));
      toast.success('分段已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSaveEdit = async () => {
    if (!editSegment) return;
    try {
      await supabase.from('video_tasks').update({ segment_text: editText, prompt: editText }).eq('id', editSegment.id);
      setSegments((prev) => prev.map((s) => (s.id === editSegment.id ? { ...s, segment_text: editText, prompt: editText } : s)));
      setEditSegment(null);
      toast.success('文案已更新');
    } catch {
      toast.error('保存失败');
    }
  };

  const handleRegenerateImages = async (segment: SegmentWithImages) => {
    setIsGeneratingSegment(segment.id);
    try {
      const text = segment.segment_text || segment.prompt || '';
      if (!text.trim()) {
        toast.error('分段文案为空');
        return;
      }

      // Delete old images
      await supabase.from('gallery_images').delete().eq('task_id', segment.id);

      // Generate new images
      const duration = segment.tts_duration_seconds || Math.max(8, text.length / 3.3);
      const imageCount = Math.max(1, Math.ceil(duration / 6));
      const scenes = await splitTextToScenesSmart(text, { targetCount: imageCount });
      const prompts = await generateImagePromptsSmart(scenes, text);

      const records = await Promise.all(
        prompts.map((p, i) =>
          supabase.from('gallery_images').insert({
            task_id: segment.id,
            user_id: user?.id || '',
            prompt: p,
            original_prompt: scenes[i] || null,
            index: i,
            status: 'pending',
          }).select().single()
        )
      );

      for (let i = 0; i < prompts.length; i++) {
        const record = records[i].data as GalleryImage;
        if (!record) continue;
        try {
          const res = await startImageGeneration({ prompt: prompts[i], size: parentTask?.size || '720x1280' });
          let attempts = 0;
          while (attempts < 60) {
            await new Promise((r) => setTimeout(r, 3000));
            const q = await queryImageGeneration(res.imageId);
            if (q.status === 'completed' && q.publicUrl) {
              await supabase.from('gallery_images').update({ image_url: q.publicUrl, status: 'success' }).eq('id', record.id);
              break;
            }
            if (q.status === 'failed') {
              await supabase.from('gallery_images').update({ status: 'failed', error_message: q.error || '失败' }).eq('id', record.id);
              break;
            }
            attempts++;
          }
          if (attempts >= 60) {
            await supabase.from('gallery_images').update({ status: 'failed', error_message: '超时' }).eq('id', record.id);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from('gallery_images').update({ status: 'failed', error_message: msg }).eq('id', record.id);
        }
      }

      await supabase.from('video_tasks').update({ status: 'images_ready' }).eq('id', segment.id);
      toast.success('图片重新生成完成');
      await loadData();
    } catch (err) {
      toast.error('重新生成失败');
      console.error(err);
    } finally {
      setIsGeneratingSegment(null);
    }
  };

  const handleGenerateSegmentVideo = async (segment: SegmentWithImages) => {
    setIsGeneratingSegment(segment.id);
    try {
      const validImages = segment.images.filter((img): img is GalleryImage & { image_url: string } => !!img.image_url);
      if (validImages.length === 0) {
        toast.error('该分段没有可用图片，请先重新生成图片');
        return;
      }

      const audioUrl = segment.tts_audio_url || segment.audio_url;
      if (!audioUrl) {
        toast.error('该分段没有音频，请先生成语音');
        return;
      }

      const duration = segment.tts_duration_seconds || Math.max(8, (segment.segment_text || '').length / 3.3);

      const blob = await createSlideshowVideo(
        validImages.map((img) => ({ image_url: img.image_url, prompt: img.prompt })),
        audioUrl,
        parentTask?.image_effect || 'zoom-in',
        parentTask?.transition_effect || 'fade',
        30,
        () => {},
      );

      const ext = getVideoExtension(blob.type || 'video/webm');
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('generated-videos').upload(path, blob, {
        contentType: blob.type || 'video/webm',
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('generated-videos').getPublicUrl(path);

      await supabase.from('video_tasks').update({
        status: 'completed',
        video_url: urlData.publicUrl,
        progress: 100,
      }).eq('id', segment.id);

      toast.success('分段视频生成完成');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`视频生成失败: ${msg}`);
    } finally {
      setIsGeneratingSegment(null);
    }
  };

  const handleMergeVideo = async () => {
    if (!parentId || !parentTask) return;
    const readySegments = segments.filter((s) => s.images.some((img) => img.status === 'success' && img.image_url));
    if (readySegments.length === 0) {
      toast.error('没有可用的分段图片，请先生成各分段的图片');
      return;
    }

    setIsMerging(true);
    try {
      // Collect all images in order
      const allImages: Array<{ image_url: string; prompt: string }> = [];
      for (const seg of readySegments) {
        const segImages = seg.images
          .filter((img): img is GalleryImage & { image_url: string } => img.status === 'success' && !!img.image_url)
          .map((img) => ({ image_url: img.image_url, prompt: img.prompt }));
        allImages.push(...segImages);
      }

      // Collect all audio and mix if needed
      let mixedAudioUrl: string | null = null;
      const audioUrls = readySegments
        .map((s) => s.tts_audio_url || s.audio_url)
        .filter((url): url is string => !!url);

      if (audioUrls.length > 0) {
        // For simplicity, use the first audio if only one, or we could concatenate
        // Browser-side audio concatenation is complex; we'll just use the first for now
        // A better approach would be to concatenate in createSlideshowVideo by accepting multiple audio segments
        mixedAudioUrl = audioUrls[0];
      }

      const totalDuration = readySegments.reduce((sum, s) => sum + (s.tts_duration_seconds || 8), 0);

      const blob = await createSlideshowVideo(
        allImages,
        mixedAudioUrl,
        parentTask.image_effect || 'zoom-in',
        parentTask.transition_effect || 'fade',
        30,
        (progress) => {
          // Optionally show progress
        },
      );

      const ext = getVideoExtension(blob.type || 'video/webm');
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('generated-videos').upload(path, blob, {
        contentType: blob.type || 'video/webm',
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('generated-videos').getPublicUrl(path);

      await supabase.from('video_tasks').update({
        status: 'completed',
        video_url: urlData.publicUrl,
        merged_video_url: urlData.publicUrl,
        progress: 100,
      }).eq('id', parentId);

      toast.success('合并视频生成完成');
      navigate(`/result/${parentId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`合并视频失败: ${msg}`);
    } finally {
      setIsMerging(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" />已完成</span>;
      case 'images_ready':
        return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><ImageIcon className="h-3 w-3" />图片就绪</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />失败</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />待处理</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">分段视频管理</h1>
      </div>

      {parentTask && (
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>任务概览</span>
              <span className="text-xs font-normal text-muted-foreground">{parentTask.status === 'completed' ? '已完成' : '处理中'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">分段数</span>
                <p className="font-medium">{segments.length} 段</p>
              </div>
              <div>
                <span className="text-muted-foreground">已完成</span>
                <p className="font-medium">{segments.filter((s) => s.status === 'completed').length} 段</p>
              </div>
              <div>
                <span className="text-muted-foreground">图片就绪</span>
                <p className="font-medium">{segments.filter((s) => s.status === 'images_ready').length} 段</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMergeVideo}
                disabled={isMerging || segments.filter((s) => s.status === 'images_ready' || s.status === 'completed').length === 0}
                className="flex-1"
              >
                {isMerging ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    合并中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    合并所有分段视频
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold mb-4">分段列表（拖拽可排序）</h2>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="segments">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {segments.map((segment, index) => (
                <Draggable key={segment.id} draggableId={segment.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`border rounded-lg bg-card transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : 'border-border'}`}
                    >
                      <div className="p-4 flex items-start gap-3">
                        <div {...dragProvided.dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">分段 {index + 1}</span>
                              {getStatusBadge(segment.status)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditSegment(segment);
                                  setEditText(segment.segment_text || segment.prompt || '');
                                }}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSegment(segment.id)}
                                disabled={isGeneratingSegment === segment.id}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground truncate">
                            {segment.segment_text || segment.prompt || '（无文案）'}
                          </p>

                          {/* Image thumbnails */}
                          {segment.images.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {segment.images.map((img) => (
                                <div key={img.id} className="shrink-0 w-20 h-20 rounded border border-border overflow-hidden bg-muted">
                                  {img.image_url ? (
                                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {img.status === 'failed' ? (
                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                      ) : (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerateImages(segment)}
                              disabled={isGeneratingSegment === segment.id}
                            >
                              {isGeneratingSegment === segment.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              )}
                              重新生成图片
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateSegmentVideo(segment)}
                              disabled={isGeneratingSegment === segment.id || !segment.images.some((i) => i.status === 'success')}
                            >
                              {isGeneratingSegment === segment.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Wand2 className="h-3.5 w-3.5 mr-1" />
                              )}
                              生成分段视频
                            </Button>
                            {segment.video_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={segment.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                  <Play className="h-3.5 w-3.5" />
                                  预览
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Edit Dialog */}
      <Dialog open={!!editSegment} onOpenChange={(open) => !open && setEditSegment(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑分段文案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="bg-background border-border resize-none"
              placeholder="输入分段文案..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditSegment(null)}>取消</Button>
              <Button onClick={handleSaveEdit} disabled={!editText.trim()}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
