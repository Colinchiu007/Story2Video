import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Type, Image, Wand2, Mic, Upload, Play, ArrowRight, Trash2, Volume2, SlidersHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { createVideoTask, generateTTS, startTextToVideo, startImageToVideo, startRemixVideo, getUserVoices } from '@/services/video';
import { supabase } from '@/db/supabase';
import VoiceCloneDialog from '@/components/VoiceCloneDialog';
import type { CreateMode, UserVoice } from '@/types';

const MODES: { key: CreateMode; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'text', label: '文生视频', icon: Type, desc: '输入文本描述，AI 自动生成视频' },
  { key: 'image', label: '图生视频', icon: Image, desc: '上传参考图片，基于图片生成视频' },
  { key: 'remix', label: '视频Remix', icon: Wand2, desc: '上传已有视频，进行局部编辑' },
];

const VOICE_CATEGORIES = [
  {
    label: '中文男声',
    voices: [
      { value: 'male-qn-qingse', label: '青涩青年' },
      { value: 'male-zh-yinse', label: '精英青年' },
      { value: 'male-zh-badao', label: '霸道总裁' },
      { value: 'male-zh-xiaoshu', label: '温暖小叔' },
      { value: 'male-zh-dushu', label: '知性书生' },
    ],
  },
  {
    label: '中文女声',
    voices: [
      { value: 'female-shaonv', label: '青春少女' },
      { value: 'female-yujie', label: '成熟御姐' },
      { value: 'female-chengshu', label: '知性熟女' },
      { value: 'female-tianmei', label: '甜美可爱' },
      { value: 'female-yaoyuan', label: '妩媚动人' },
      { value: 'Chinese (Mandarin)_Warm_Girl', label: '温柔女孩' },
      { value: 'Chinese (Mandarin)_Lyrical_Voice', label: '抒情女声' },
      { value: 'Chinese (Mandarin)_News_Anchor', label: '新闻主播' },
    ],
  },
  {
    label: '英文',
    voices: [
      { value: 'English_Graceful_Lady', label: '优雅女声' },
      { value: 'English_Casual_Youth', label: '休闲青年' },
      { value: 'English_Professional_Man', label: '专业男声' },
      { value: 'English_News_Anchor', label: '新闻主播' },
    ],
  },
  {
    label: '特色',
    voices: [
      { value: 'female-dongbei', label: '东北幽默女声' },
      { value: 'female-sichuan', label: '四川麻辣女声' },
      { value: 'male-guangdong', label: '粤语港风男声' },
      { value: 'female-guangdong', label: '粤语港风女声' },
    ],
  },
];

const EMOTION_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '愤怒' },
  { value: 'fearful', label: '恐惧' },
  { value: 'disgusted', label: '厌恶' },
  { value: 'surprised', label: '惊讶' },
  { value: 'calm', label: '平静' },
  { value: 'fluent', label: '流畅' },
  { value: 'whisper', label: '耳语' },
];

export default function CreatePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreateMode>('text');
  const [prompt, setPrompt] = useState('');
  const [audioText, setAudioText] = useState('');
  const [voiceId, setVoiceId] = useState('male-qn-qingse');
  const [speed, setSpeed] = useState(1.0);
  const [vol, setVol] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [emotion, setEmotion] = useState('default');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [size, setSize] = useState('720x1280');
  const [seconds, setSeconds] = useState('8');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [remixVideoId, setRemixVideoId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioPreview, setAudioPreview] = useState('');
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load user cloned voices
  useEffect(() => {
    getUserVoices()
      .then((voices) => setUserVoices(voices.filter((v) => v.status === 'ready')))
      .catch(() => setUserVoices([]));
  }, []);

  const handleSelectClonedVoice = (id: string, name: string) => {
    setVoiceId(id);
    toast.success(`已选择音色: ${name}`);
  };

  const uploadToStorage = useCallback(async (file: File, bucket: string) => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
  };

  const handlePreviewAudio = async () => {
    if (!audioText.trim()) {
      toast.error('请先输入音频文本');
      return;
    }
    setIsPreviewingAudio(true);
    try {
      const { audioUrl } = await generateTTS({
        text: audioText.trim(),
        voiceId,
        speed,
        vol,
        pitch,
        emotion: emotion === 'default' ? undefined : emotion,
      });
      setAudioPreview(audioUrl);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '音频生成失败';
      toast.error(`音频预览失败: ${msg}`);
    } finally {
      setIsPreviewingAudio(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(mode === 'remix' ? '请输入编辑说明' : '请输入视频描述');
      return;
    }
    if (mode === 'image' && !uploadedImageUrl) {
      toast.error('请上传参考图片');
      return;
    }
    if (mode === 'remix' && !remixVideoId.trim()) {
      toast.error('请输入源视频任务ID');
      return;
    }

    setIsGenerating(true);
    try {
      let audioUrl = '';
      if (audioText.trim()) {
        try {
          const result = await generateTTS({
            text: audioText.trim(),
            voiceId,
            speed,
            vol,
            pitch,
            emotion: emotion === 'default' ? undefined : emotion,
          });
          audioUrl = result.audioUrl;
        } catch (err) {
          const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '语音合成失败';
          toast.warning(`语音合成失败: ${msg}，将继续生成无音频视频`);
        }
      }

      const totalSeconds = Number(seconds);
      const segmentDuration = 12;
      const totalSegments = Math.ceil(totalSeconds / segmentDuration);

      const baseParams = {
        mode,
        prompt: prompt.trim(),
        size,
        seconds: totalSegments > 1 ? segmentDuration : totalSeconds,
        audioUrl: audioUrl || undefined,
        inputReferenceUrl: uploadedImageUrl || undefined,
        remixSourceId: remixVideoId.trim() || undefined,
      };

      if (totalSegments <= 1) {
        const task = await createVideoTask(baseParams);
        let videoId = '';
        let status = '';
        if (mode === 'text') {
          const res = await startTextToVideo({ prompt: prompt.trim(), size, seconds: totalSeconds });
          videoId = res.videoId; status = res.status;
        } else if (mode === 'image') {
          const res = await startImageToVideo({ prompt: prompt.trim(), inputReferenceUrl: uploadedImageUrl, size });
          videoId = res.videoId; status = res.status;
        } else if (mode === 'remix') {
          const sourceId = remixVideoId.trim();
          if (!sourceId) throw new Error('缺少源视频ID');
          const res = await startRemixVideo({ videoId: sourceId, prompt: prompt.trim() });
          videoId = res.videoId; status = res.status;
        }
        await supabase.from('video_tasks').update({ video_id: videoId, status }).eq('id', task.id);
        toast.success('任务已提交，开始生成视频');
        navigate(`/progress/${task.id}`);
        return;
      }

      // 多段生成
      const parentTask = await createVideoTask({
        ...baseParams,
        seconds: totalSeconds,
        totalSegments,
      });

      const segmentTasks: { taskId: string; index: number }[] = [];
      for (let i = 0; i < totalSegments; i++) {
        const seg = await createVideoTask({
          mode,
          prompt: `${prompt.trim()}（片段 ${i + 1}/${totalSegments}）`,
          size,
          seconds: segmentDuration,
          audioUrl: audioUrl || undefined,
          inputReferenceUrl: uploadedImageUrl || undefined,
          remixSourceId: remixVideoId.trim() || undefined,
          parentId: parentTask.id,
          segmentIndex: i,
          totalSegments,
        });
        segmentTasks.push({ taskId: seg.id, index: i });
      }

      // 并行发起 Sora 生成
      const generatePromises = segmentTasks.map(async (seg) => {
        try {
          let res: { videoId: string; status: string };
          if (mode === 'text') {
            res = await startTextToVideo({ prompt: prompt.trim(), size, seconds: segmentDuration });
          } else if (mode === 'image') {
            res = await startImageToVideo({ prompt: prompt.trim(), inputReferenceUrl: uploadedImageUrl, size });
          } else {
            const sourceId = remixVideoId.trim();
            if (!sourceId) throw new Error('缺少源视频ID');
            res = await startRemixVideo({ videoId: sourceId, prompt: prompt.trim() });
          }
          await supabase.from('video_tasks').update({ video_id: res.videoId, status: res.status }).eq('id', seg.taskId);
          return { success: true, taskId: seg.taskId, videoId: res.videoId };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from('video_tasks').update({ status: 'failed' }).eq('id', seg.taskId);
          return { success: false, taskId: seg.taskId, error: msg };
        }
      });

      await Promise.all(generatePromises);
      toast.success(`已提交 ${totalSegments} 个片段任务，开始生成视频`);
      navigate(`/progress/${parentTask.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      console.error('Generate error:', err);
      toast.error(`提交失败: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="relative rounded-sm overflow-hidden mb-8 aspect-[16/6] md:aspect-[16/5]">
        <img
          src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_84235796-312b-463e-b768-99b46e02e834.jpg"
          alt="AI 视频创作"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-balance mb-2">视频创作</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md text-pretty">选择创作模式，输入描述或上传素材，AI 将为您生成视频</p>
        </div>
      </div>

      {/* Mode Selection */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as CreateMode)} className="mb-6">
        <TabsList className="grid grid-cols-3 w-full bg-muted h-auto p-1">
          {MODES.map((m) => (
            <TabsTrigger
              key={m.key}
              value={m.key}
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <m.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{m.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="border border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <currentMode.icon className="h-5 w-5 text-primary" />
            {currentMode.label}
          </CardTitle>
          <CardDescription className="text-pretty">{currentMode.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt */}
          <div className="space-y-2">
            <Label>
              {mode === 'remix' ? '编辑说明' : '视频描述'}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              placeholder={
                mode === 'text'
                  ? '例如：一只橘猫在阳光明媚的草地上追逐蝴蝶'
                  : mode === 'image'
                    ? '描述视频中期望的画面动态效果'
                    : '描述希望做出的修改，如：将场景变为夜晚，增加霓虹灯光'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="bg-background border-border resize-none focus-visible:ring-primary"
            />
          </div>

          {/* Image Upload for Image mode */}
          {mode === 'image' && (
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
                  className="border border-dashed border-border rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-colors bg-muted/30"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">点击上传参考图片</span>
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
          )}

          {/* Remix Video ID */}
          {mode === 'remix' && (
            <div className="space-y-2">
              <Label>源视频ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="输入已完成视频的Sora任务ID（如 video_xxx）"
                value={remixVideoId}
                onChange={(e) => setRemixVideoId(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary"
              />
              <p className="text-xs text-muted-foreground">仅支持对已通过本工具生成的视频进行Remix编辑</p>
            </div>
          )}

          {/* Audio Section */}
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <Label className="font-medium">语音合成（可选）</Label>
            </div>
            <Textarea
              placeholder="输入需要合成的语音文本，生成的音频将用于视频配音"
              value={audioText}
              onChange={(e) => setAudioText(e.target.value)}
              rows={2}
              className="bg-background border-border resize-none focus-visible:ring-primary"
            />
            {/* Voice Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>音色选择</Label>
                <VoiceCloneDialog
                  onSelectVoice={handleSelectClonedVoice}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <User className="h-3.5 w-3.5 mr-1" />
                      克隆音色
                    </button>
                  }
                />
              </div>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="选择音色" />
                </SelectTrigger>
                <SelectContent>
                  {/* User cloned voices */}
                  {userVoices.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                        我的音色
                      </div>
                      {userVoices.map((v) => (
                        <SelectItem key={v.voice_id ?? v.id} value={v.voice_id ?? v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {VOICE_CATEGORIES.map((cat) => (
                    <React.Fragment key={cat.label}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {cat.label}
                      </div>
                      {cat.voices.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voice Settings Toggle */}
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showVoiceSettings ? '收起参数调节' : '展开参数调节'}
            </button>

            {/* Voice Settings Panel */}
            {showVoiceSettings && (
              <div className="space-y-5 p-4 border border-border rounded-sm bg-muted/20">
                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>语速</Label>
                    <span className="text-muted-foreground tabular-nums">{speed.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    onValueChange={(v) => setSpeed(v[0])}
                  />
                </div>
                {/* Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>音量</Label>
                    <span className="text-muted-foreground tabular-nums">{vol.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[vol]}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    onValueChange={(v) => setVol(v[0])}
                  />
                </div>
                {/* Pitch */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>音调</Label>
                    <span className="text-muted-foreground tabular-nums">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  </div>
                  <Slider
                    value={[pitch]}
                    min={-10}
                    max={10}
                    step={1}
                    onValueChange={(v) => setPitch(v[0])}
                  />
                </div>
                {/* Emotion */}
                <div className="space-y-2">
                  <Label>情绪</Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="选择情绪" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOTION_OPTIONS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePreviewAudio}
                disabled={isPreviewingAudio || !audioText.trim()}
                className="shrink-0"
              >
                {isPreviewingAudio ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">{isPreviewingAudio ? '生成中...' : '试听'}</span>
              </Button>
            </div>
            {audioPreview && (
              <audio src={audioPreview} controls className="w-full" />
            )}
          </div>

          {/* Settings */}
          <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>分辨率</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720x1280">720x1280（竖屏）</SelectItem>
                  <SelectItem value="1280x720">1280x720（横屏）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>时长</Label>
              <Select value={seconds} onValueChange={setSeconds}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 秒</SelectItem>
                  <SelectItem value="8">8 秒</SelectItem>
                  <SelectItem value="12">12 秒</SelectItem>
                  <SelectItem value="30">30 秒</SelectItem>
                  <SelectItem value="60">60 秒</SelectItem>
                </SelectContent>
              </Select>
              {Number(seconds) > 12 && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                  长视频将拆分为 {Math.ceil(Number(seconds) / 12)} 个 12 秒片段并行生成
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isUploading}
              className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  提交中...
                </span>
              ) : isUploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  上传中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  立即创作
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
