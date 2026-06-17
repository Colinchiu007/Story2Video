export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export interface VideoTask {
  id: string;
  video_id: string | null;
  mode: CreateMode;
  prompt: string;
  size: string;
  seconds: number;
  status: string;
  progress: number;
  video_url: string | null;
  audio_url: string | null;
  input_reference_url: string | null;
  remix_source_id: string | null;
  parent_id: string | null;
  segment_index: number;
  total_segments: number;
  segment_text: string | null;
  bgm_enabled: boolean;
  bgm_url: string | null;
  bgm_volume: number;
  subtitle_enabled: boolean;
  subtitle_font: string;
  subtitle_size: string;
  subtitle_style: string;
  merged_video_url: string | null;
  error_message: string | null;
  queue_position: number | null;
  queue_total: number | null;
  estimated_seconds_remaining: number | null;
  image_effect: string | null;
  transition_effect: string | null;
  tts_audio_url: string | null;
  tts_duration_seconds: number | null;
  generate_base_enabled: boolean;
  generate_merged_enabled: boolean;
  per_image_duration: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type CreateMode = 'text' | 'image' | 'remix' | 'gallery';

export interface GalleryImage {
  id: string;
  task_id: string;
  user_id: string;
  image_url: string | null;
  prompt: string;
  original_prompt: string | null;
  index: number;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomApiProfile {
  id: string;
  name: string;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  isDefault: boolean;
  /** 额外凭证字段（如即梦需要 AK/SK） */
  extra?: Record<string, string>;
}

export interface ModelConfig {
  llm?: ModelProviderConfig;
  tts?: ModelProviderConfig;
  video?: ModelProviderConfig;
  image?: ModelProviderConfig;
}

export interface ModelProviderConfig {
  source: 'builtin' | 'custom';
  provider: string;
  apiBaseUrl?: string;
  apiKey?: string;
  modelName?: string;
  activeProfileId?: string | null;
  profiles?: CustomApiProfile[];
}

export interface UserVoice {
  id: string;
  name: string;
  description: string | null;
  sample_audio_url: string;
  voice_id: string | null;
  status: 'pending' | 'ready' | 'error' | 'forbidden';
  duration_seconds: number | null;
  language: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  ai_source: string;
  api_base_url: string | null;
  api_key: string | null;
  model_name: string | null;
  last_voice_id: string | null;
  created_at: string;
  updated_at: string;
}
