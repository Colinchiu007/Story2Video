export interface VoiceOption {
  value: string;
  label: string;
}

export interface VoiceCategory {
  label: string;
  voices: VoiceOption[];
}

export const VOICE_CATEGORIES: VoiceCategory[] = [
  {
    label: '中文男声',
    voices: [
      { value: 'zh_male_m191_uranus_bigtts', label: '云舟 2.0（磁性）' },
      { value: 'zh_male_taocheng_uranus_bigtts', label: '小天 2.0（年轻）' },
      { value: 'zh_male_wenrouxiaoge_mars_bigtts', label: '温柔小哥' },
      { value: 'zh_male_aojiaobazong_emo_v2_mars_bigtts', label: '傲娇霸总' },
      { value: 'zh_male_lubanqihao_mars_bigtts', label: '鲁班七号' },
      { value: 'zh_male_tangseng_mars_bigtts', label: '唐僧' },
      { value: 'zh_male_zhuangzhou_mars_bigtts', label: '庄周' },
    ],
  },
  {
    label: '中文女声',
    voices: [
      { value: 'zh_female_vv_uranus_bigtts', label: 'Vivi 2.0（活泼）' },
      { value: 'zh_female_qingxinnvsheng_uranus_bigtts', label: '清新女声 2.0' },
      { value: 'zh_female_vv_mars_bigtts', label: 'Vivi（活泼）' },
      { value: 'zh_female_qinqienvsheng_moon_bigtts', label: '亲切女声' },
      { value: 'zh_female_gaolengyujie_emo_v2_mars_bigtts', label: '高冷御姐' },
      { value: 'zh_female_yangmi_mars_bigtts', label: '林潇' },
    ],
  },
  {
    label: '英文',
    voices: [
      { value: 'en_male_tim_uranus_bigtts', label: 'Tim' },
      { value: 'en_female_dacey_uranus_bigtts', label: 'Dacey' },
    ],
  },
];

export const MIMO_PRESET_VOICES: VoiceCategory[] = [
  {
    label: 'MiMo 中文女声',
    voices: [
      { value: 'mimo_default_cn:冰糖', label: '冰糖（默认）' },
      { value: 'mimo_default_cn:茉莉', label: '茉莉' },
    ],
  },
  {
    label: 'MiMo 中文男声',
    voices: [
      { value: 'mimo_default_cn:苏打', label: '苏打' },
      { value: 'mimo_default_cn:白桦', label: '白桦' },
    ],
  },
  {
    label: 'MiMo 英文女声',
    voices: [
      { value: 'mimo_default_en:Mia', label: 'Mia（默认）' },
      { value: 'mimo_default_en:Chloe', label: 'Chloe' },
    ],
  },
  {
    label: 'MiMo 英文男声',
    voices: [
      { value: 'mimo_default_en:Milo', label: 'Milo' },
      { value: 'mimo_default_en:Dean', label: 'Dean' },
    ],
  },
];

export const EMOTION_OPTIONS: VoiceOption[] = [
  { value: 'default', label: '默认' },
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '生气' },
  { value: 'surprised', label: '惊讶' },
  { value: 'fearful', label: '恐惧' },
  { value: 'hate', label: '厌恶' },
  { value: 'excited', label: '激动' },
  { value: 'coldness', label: '冷漠' },
  { value: 'neutral', label: '中性' },
  { value: 'depressed', label: '沮丧' },
  { value: 'lovey-dovey', label: '撒娇' },
  { value: 'shy', label: '害羞' },
  { value: 'comfort', label: '安慰鼓励' },
  { value: 'tension', label: '咆哮/焦急' },
  { value: 'tender', label: '温柔' },
  { value: 'storytelling', label: '讲故事' },
  { value: 'radio', label: '情感电台' },
  { value: 'magnetic', label: '磁性' },
  { value: 'advertising', label: '广告营销' },
  { value: 'vocal-fry', label: '气泡音' },
  { value: 'ASMR', label: '低语' },
  { value: 'news', label: '新闻播报' },
  { value: 'entertainment', label: '娱乐八卦' },
  { value: 'dialect', label: '方言' },
];

export const DEFAULT_VOICE_ID = 'zh_female_qingxinnvsheng_uranus_bigtts';
