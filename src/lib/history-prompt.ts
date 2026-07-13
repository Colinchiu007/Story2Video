import { splitTextToScenes } from './text-segmentation';
import { isPromptEngineAvailable } from '@/services/external-config';
import { apiStoryboardCompose, apiBatchOptimize } from '@/services/prompt-engine-api';

/**
 * 历史文章生图提示词优化系统 v10.0（VisionCraft整合版）
 *
 * 整合版本历史：
 * - v7.0: 纯前端JavaScript分词，anti-AI，纪录片风格
 * - v7.1: 关键词朝代自动检测（DynastyDetector）
 * - v7.2: AI朝代推理（AIDynastyDetector）+ 动态视觉风格选择
 * - v8.0: 时代检测分流（EraDetector）+ 现代内容处理
 * - v8.1: 电影感关键词整合（10视角/8构图/10风格）
 * - v9.0: 电影感终极版（整合所有功能）
 * - v10.0: VisionCraft整合版（对话式引导+视觉知识图谱+意图解析+风格管理+批量生成）
 *
 * 功能一览（v10.0 VisionCraft整合版）：
 * 1. 智能文本分割（基于jieba-js分词）
 * 2. 多样化提示词生成（10视角/8构图/10风格轮换）
 * 3. 减少AI味的提示词策略（反AI生成）
 * 4. 纪录片风格的提示词策略
 * 5. 朝代自动检测系统（三层策略：专属词 > 时间事件 > 非专属词）
 * 6. AI语义推理朝代（可选，需要API Key）
 * 7. 动态视觉风格选择（按句子场景选元素，不再硬塞建筑）
 * 8. **时代检测分流**：古代→古代管线，现代→现代管线
 * 9. **电影感增强**：Kodak Portra 400 / anamorphic / cinematic lighting
 *
 * 关键修复：
 *   - 战争句子 → 服装+道具+氛围（无建筑）
 *   - 人物肖像 → 服装+少量道具（无建筑）
 *   - 抽象讨论 → 纯氛围（无建筑+无道具）
 *   - 朝堂句子 → 建筑+服装+道具+氛围
 *   - "清平乐"不误判为清朝
 *   - "淝水之战"正确识别为晋南北朝
 *   - 现代内容不再被错误标注为"古代中国"
 *
 * 使用方式：
 *   1. 安装依赖：npm install jieba-js
 *   2. 导入：import { HistoryArticleProcessorV9 } from './history_article_prompt_v9'
 *   3. 使用：const processor = new HistoryArticleProcessorV9();
 *             const results = await processor.process("原文...");
 */

// ==================== 类型定义 ====================

export interface HistoricalContext {
  period: string;
  location: string;
  visual_style: string;
  color_tone?: string;
  era_style?: string;
}

export interface Fragment {
  text: string;
  sentiment: string;
  is_key: boolean;
  importance: number;
  color_tone: string;
  is_complete: boolean;
}

export interface ProcessResult {
  text: string;
  prompt: string;
  negative: string;
  sentiment: string;
  is_key: boolean;
  importance: number;
  is_complete: boolean;
}

export interface DynastyResult {
  name: string;
  period: string;
  visual_style: string;
  confidence: number;
  method: string;
  evidence: string[];
  reasoning?: string;
}

export interface HybridDynastyConfig {
  strategy: 'keyword_first' | 'ai_first' | 'ai_only' | 'keyword_only';
  keywordThreshold: number;
  apiBase?: string;
  apiKey?: string;
  model?: string;
}

export type EraType = 'ancient' | 'modern' | 'mixed';

export interface EraResult {
  era: EraType;
  confidence: number;
  evidence: string[];
}

// ==================== 情感分析器 ====================

export class SentimentAnalyzer {
  private POSITIVE_WORDS = ["喜悦", "欢乐", "胜利", "成功", "美好", "和平"];
  private NEGATIVE_WORDS = ["悲伤", "失败", "死亡", "战争", "痛苦", "灾难"];

  analyze(text: string): string {
    for (const word of this.POSITIVE_WORDS) {
      if (text.includes(word)) return "positive";
    }
    for (const word of this.NEGATIVE_WORDS) {
      if (text.includes(word)) return "negative";
    }
    return "peaceful";
  }

  colorTone(s: string): string {
    const map: Record<string, string> = {
      positive: "温暖，明亮，金黄色调",
      negative: "阴沉，灰暗，冷色调",
    };
    return map[s] || "古朴，暖色调";
  }
}

// ==================== 语义完整性检查器 ====================

export class SemanticIntegrityChecker {
  private MODIFIERS = ["的", "地", "得", "了", "着", "过", "和", "与", "及", "或", "但", "却"];

  check(s: string): boolean {
    const t = s.trim();
    if (!t || t.length < 3) return false;
    const last = t[t.length - 1];
    if (!["。", "！", "？"].includes(last)) return false;
    for (const m of this.MODIFIERS) {
      if (t.endsWith(m)) return false;
    }
    return true;
  }

  shouldMerge(prev: string, curr: string): boolean {
    if (this.check(curr)) return false;
    if (curr.trim().length < 5 && !["。", "！", "？"].includes(curr.trim().slice(-1))) return true;
    for (const m of this.MODIFIERS) {
      if (prev.endsWith(m)) return true;
    }
    return false;
  }
}

// ==================== 智能文本分割器 ====================


export class SmartTextSplitterV8 {
  private minLen: number;
  private maxLen: number;
  private checker: SemanticIntegrityChecker;
  private sentiment: SentimentAnalyzer;

  constructor(minLen = 5, maxLen = 30) {
    this.minLen = minLen;
    this.maxLen = maxLen;
    this.checker = new SemanticIntegrityChecker();
    this.sentiment = new SentimentAnalyzer();
  }

  async split(text: string): Promise<Fragment[]> {
    const sentences = this.merge(await this.tokenize(text));
    return sentences.map(s => ({
      text: s,
      sentiment: this.sentiment.analyze(s),
      is_key: false,
      importance: this.checker.check(s) ? 1.0 : 0.6,
      color_tone: this.sentiment.colorTone(this.sentiment.analyze(s)),
      is_complete: this.checker.check(s),
    }));
  }

  private async tokenize(text: string): Promise<{ prompts: string[]; tier: "api" | "local" }> {
    const { cut } = await import('jieba-js') as any;
    const parts = text.split(/([。！？])/);
    const segments: string[] = [];
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        cur = parts[i];
      } else {
        if (cur.trim()) segments.push(cur + parts[i]);
        cur = "";
      }
    }
    if (cur.trim()) segments.push(cur);

    const result: string[] = [];
    for (const seg of segments) {
      const tokens = await cut(seg);
      let line = "";
      for (const t of tokens) {
        if ((line + t).length <= this.maxLen) {
          line += t;
        } else {
          if (line) result.push(line);
          line = t;
        }
      }
      if (line) result.push(line);
    }
    return result;
  }

  private merge(sentences: string[]): string[] {
    if (sentences.length <= 1) return sentences;
    const result = [sentences[0]];
    for (let i = 1; i < sentences.length; i++) {
      if (this.checker.shouldMerge(result[result.length - 1], sentences[i])) {
        result[result.length - 1] += sentences[i];
      } else {
        result.push(sentences[i]);
      }
    }
    return result;
  }
}

// ==================== 时代检测器（v8.1 新增：古代 vs 现代分流） ====================

/**
 * EraDetector — 输入层时代检测器
 *
 * 在进入朝代检测前先判断文本属于古代还是现代内容，分流到不同处理器。
 *
 * 检测策略：
 *   1. 现代专属词命中 → modern（高置信度）
 *   2. 古代专属词命中 → ancient（高置信度）
 *   3. 统计双方关键词 + 常用词得分，取高分者
 *   4. 都低分 → mixed（按古代处理，最安全，不污染现有逻辑）
 *
 * 适用场景：
 *   "台风过境后，居民在社区服务中心领取物资" → modern ✓
 *   "如果清军在甲午战争中死磕到底" → ancient ✓
 *   "今天天气真好" → mixed → ancient（安全兜底）
 */
export class EraDetector {
  // 现代专属词（出现即大概率是现代内容）
  private static MODERN_EXCLUSIVE = new Set([
    "电脑","手机","互联网","微信","抖音","微博","小程序","APP","App","iPhone","Android",
    "地铁","高铁","飞机","汽车","公交车","共享单车","电动汽车","自动驾驶",
    "改革开放","21世纪","20世纪","19世纪",
    "台风","雾霾","全球变暖","碳排放","碳中和",
    "大数据","人工智能","AI","算法","区块链","元宇宙","数字经济",
    "社区服务中心","物业","医保","社保","养老金","公积金",
    "超市","便利店","网约车","外卖","快递","电商",
    "电影","电视剧","综艺","直播","网红","KOL","博主",
    "志愿者","居委会","村委会","公务员","上班族",
    "新冠","疫情","疫苗","核酸检测","健康码","行程码","隔离","封控",
    "电子支付","支付宝","微信支付","扫码",
    "知乎","B站","小红书","公众号","Instagram","YouTube","Twitter","Facebook",
    "健身","瑜伽","马拉松","健身教练",
    "空调","冰箱","洗衣机","微波炉","电磁炉","电视机","投影仪",
    "请假","辞职","跳槽","KPI","OKR","996","内卷","躺平","摆烂","职场",
    "新能源","光伏","5G","芯片","智能手机","笔记本电脑","平板","耳机","蓝牙",
    "金融","股票","基金","理财","贷款","信用卡","房贷","首付",
    "教育","双减","考研","考公","高考","留学","课外班",
    "网购","电商购物","网上购物",
    "飞机","轮船","火车","公路","收费站","加油站","红绿灯",
  ]);

  // 现代常用词（出现加分，但不够确定现代）
  private static MODERN_COMMON = new Set([
    "现代","当代","如今","现在","今天","今年","本月","近日","近期",
    "200","201","202","203","204","205","206","207","208","209",
    "19","20","21","22","23","24","25","26","27","28","29",
    "公里","小时","分钟","百分比","数据","报告","调查",
    "居民","市民","业主","客户","用户","群众",
    "保险","贷款","银行","利率","汇率","投资",
    "网络","信号","直播","视频","照片","图片","内容",
    "民主","宪政","法案","组织","委员会","联合国","WTO",
    "研究","论文","科研","大学","学院",
  ]);

  // 古代专属词（出现即大概率是古代内容）
  private static ANCIENT_EXCLUSIVE = new Set([
    // 朝代/政权名
    "清政府","清朝","大清","满清","清代","清廷","清军","晚清","清末",
    "明代","明朝","明军","明廷",
    "大汉","汉代","汉朝","汉军","西汉","东汉",
    "大唐","唐代","唐朝","唐军","盛唐",
    "大宋","宋代","宋朝","宋军","北宋","南宋",
    "大秦","秦代","秦朝","秦军",
    "三国","魏蜀吴","三国鼎立","三国演义",
    "大元","元代","元朝",
    "大隋","隋代","隋朝",
    "大晋","晋朝","晋代","南北朝","北魏",
    "先秦","春秋战国","夏朝","商朝","周朝",
    "民国","北洋","军阀",
    "辽代","金代","西夏","五代十国",
    // 帝王/官僚/制度
    "皇帝","陛下","朕","寡人","奴才","跪","叩首","奏折","圣旨","诏书",
    "太后","王爷","皇子","太子","公主","驸马","丞相","尚书","太监","宦官",
    "锦衣卫","东厂","禁军","御林军","八旗","绿营",
    "科举","进士","状元","秀才","举人","老爷","县官","知府","知州",
    "道台","巡抚","总督","提督","总兵","参将","宰相","首辅","大臣","百官",
    // 历史人物（覆盖全部16个朝代的关键人物）
    "秦始皇","嬴政","刘邦","项羽","汉武帝","曹操","刘备","孙权","诸葛亮","关羽",
    "李世民","唐太宗","武则天","李白","杜甫","赵匡胤","王安石","苏轼","岳飞",
    "朱元璋","张居正","王阳明","郑和","康熙","乾隆","雍正","慈禧","曾国藩","李鸿章",
    "孙中山","蒋介石","成吉思汗","忽必烈",
    // 战争/事件
    "甲午","鸦片战争","赤壁之战","官渡之战","安史之乱","靖康","辛亥革命","五四运动",
    // 器物/服饰/建筑
    "青铜","竹简","帛书","车马","战车","旌旗",
    "匈奴","突厥","契丹","女真","鞑靼",
    "汉服","唐装","马褂","长袍","马靴","顶戴","马蹄袖","铠甲","战袍","旌旗",
    "牛车","马匹","驿站","烽火台","长城",
    "朝贡","藩属","天朝","中原","塞外","西域",
    // 历史典故/事件
    "焚书坑儒","贞观之治","开元盛世","靖康之耻","昭君出塞","张骞出使","郑和下西洋",
    "虎门销烟","戊戌变法","合肥","康有为","梁启超",
  ]);

  // 古代常见词（出现加分）
  private static ANCIENT_COMMON = new Set([
    "古代","历史","传统","古时","古","旧时",
    "春秋","战国","汉代","唐代","宋代","明代","清代",
    "史记","汉书","资治通鉴",
    "江山","社稷","天下","黎民","苍生",
    "君子","小人","贤","德","道","礼",
    "甲胄","刀刃","弓箭","长矛",
    "古筝","琵琶","箫","笛","琴",
    "笔墨","纸砚","诗","词","赋",
    "祭祀","礼乐","宗庙","祖先",
  ]);

  static detect(text: string): EraResult {
    if (!text || text.trim().length < 3) {
      return { era: "mixed", confidence: 0, evidence: ["文本太短"] };
    }

    const modernExclusiveHits: string[] = [];
    const modernCommonHits: string[] = [];
    const ancientExclusiveHits: string[] = [];
    const ancientCommonHits: string[] = [];

    // 扫描专属词
    for (const kw of this.MODERN_EXCLUSIVE) {
      if (text.includes(kw)) modernExclusiveHits.push(kw);
    }
    for (const kw of this.ANCIENT_EXCLUSIVE) {
      if (text.includes(kw)) ancientExclusiveHits.push(kw);
    }

    // 扫描常用词
    for (const kw of this.MODERN_COMMON) {
      if (text.includes(kw)) modernCommonHits.push(kw);
    }
    for (const kw of this.ANCIENT_COMMON) {
      if (text.includes(kw)) ancientCommonHits.push(kw);
    }

    // 计算总分
    const modernScore = modernExclusiveHits.length * 3 + modernCommonHits.length;
    const ancientScore = ancientExclusiveHits.length * 3 + ancientCommonHits.length;

    // 判定逻辑
    if (modernScore >= 2 && modernScore >= ancientScore * 1.5) {
      return {
        era: "modern",
        confidence: Math.min(0.6 + modernScore * 0.08, 0.98),
        evidence: modernExclusiveHits.slice(0, 5),
      };
    }
    if (modernExclusiveHits.length >= 1 && ancientExclusiveHits.length === 0) {
      return {
        era: "modern",
        confidence: 0.8,
        evidence: modernExclusiveHits.slice(0, 3),
      };
    }
    if (ancientScore >= 2 && ancientScore >= modernScore * 1.5) {
      return {
        era: "ancient",
        confidence: Math.min(0.6 + ancientScore * 0.08, 0.98),
        evidence: ancientExclusiveHits.slice(0, 5),
      };
    }
    if (ancientExclusiveHits.length >= 1 && modernExclusiveHits.length === 0) {
      return {
        era: "ancient",
        confidence: 0.8,
        evidence: ancientExclusiveHits.slice(0, 3),
      };
    }

    // 用得分决胜负
    if (modernScore > ancientScore && modernScore >= 2) {
      return { era: "modern", confidence: 0.6, evidence: modernExclusiveHits.slice(0, 3) };
    }
    if (ancientScore > modernScore && ancientScore >= 2) {
      return { era: "ancient", confidence: 0.6, evidence: ancientExclusiveHits.slice(0, 3) };
    }

    // 都低分或平局 → mixed，按古代处理（安全兜底）
    return { era: "mixed", confidence: 0, evidence: [] };
  }
}

// ==================== 关键词朝代检测器（v7.1） ====================

export class DynastyDetector {
  private static DYNASTY_RULES = [
    { keywords: ["清政府","清朝","大清","满清","清代","清军","清廷","光绪","慈禧","同治","康熙","乾隆","雍正","嘉庆","曾国藩","李鸿章","左宗棠","康有为","梁启超","林则徐","邓世昌","袁世凯","恭亲王"], name: "清朝", period: "清朝（1644-1912）", visualStyle: "清代建筑，宫殿，园林，清装，马褂，顶戴花翎，马蹄袖", exclusive: true },
    { keywords: ["明朝","明代","大明","明军","明廷","朱元璋","朱棣","洪武","永乐","万历","崇祯","张居正","王阳明","郑和","郑成功","海瑞","戚继光","李贽","李自成","朱由检","朱厚照","锦衣卫","东林党","司礼监","内阁首辅"], name: "明朝", period: "明朝（1368-1644）", visualStyle: "明代建筑，紫禁城，明代汉服，补服，乌纱帽，曳撒", exclusive: true },
    { keywords: ["汉朝","汉代","大汉","西汉","东汉","汉军","刘邦","项羽","汉武帝","刘彻","韩信","张良","卫青","霍去病","张骞","司马迁","王昭君","蔡伦","张衡","董仲舒","霍光","班超","刘秀"], name: "汉朝", period: "汉朝（前202-220）", visualStyle: "汉代建筑，宫阙，古城，汉服，曲裾，深衣，博冠，玉带", exclusive: true },
    { keywords: ["唐朝","唐代","大唐","唐军","盛唐","李世民","唐太宗","李渊","武则天","唐玄宗","李白","杜甫","白居易","王维","诗仙","诗圣","杨贵妃","安禄山","史思明","玄奘","鉴真","魏征","房玄龄","杜如晦","郭子仪","颜真卿"], name: "唐朝", period: "唐朝（618-907）", visualStyle: "唐代建筑，宫殿，长安城，唐装，圆领袍，襦裙，高髻", exclusive: true },
    { keywords: ["宋朝","宋代","大宋","北宋","南宋","宋军","赵匡胤","赵构","王安石","苏轼","辛弃疾","李清照","岳飞","秦桧","包拯","范仲淹","欧阳修","司马光","朱熹","陆游","文天祥"], name: "宋朝", period: "宋朝（960-1279）", visualStyle: "宋代建筑，城楼，市井，宋装，直裰，褙子，东坡巾", exclusive: false },
    { keywords: ["秦朝","秦代","大秦","秦军","秦始皇","嬴政","李斯","赵高","蒙恬","扶苏","项梁","焚书坑儒","万里长城"], name: "秦朝", period: "秦朝（前221-前207）", visualStyle: "秦代建筑，长城，兵马俑，秦装，铠甲，曲裾，冠冕", exclusive: true },
    { keywords: ["三国","魏蜀吴","汉末","曹操","刘备","孙权","诸葛亮","关羽","张飞","赵云","马超","黄忠","周瑜","司马懿","吕布","貂蝉","曹丕","司马昭","司马炎","姜维","陆逊"], name: "三国", period: "三国（220-280）", visualStyle: "汉代建筑，城寨，战场，汉服，铠甲，战袍，旌旗", exclusive: true },
    { keywords: ["元朝","元代","大元","蒙古帝国","忽必烈","成吉思汗","铁木真","拖雷","窝阔台","拔都","马可波罗","元大都"], name: "元朝", period: "元朝（1271-1368）", visualStyle: "元代建筑，宫城，草原，蒙古袍，质孙服，辫线袄", exclusive: true },
    { keywords: ["隋朝","隋代","大隋","隋军","杨坚","杨广","隋文帝","隋炀帝","独孤皇后","大运河","科举制"], name: "隋朝", period: "隋朝（581-618）", visualStyle: "隋代建筑，宫殿，运河，龙舟，隋装，圆领袍", exclusive: true },
    { keywords: ["晋朝","晋代","大晋","西晋","东晋","两晋","司马懿","司马炎","司马昭","谢安","王羲之","南北朝","北魏","北周","北齐","拓跋","宇文"], name: "晋南北朝", period: "魏晋南北朝（220-589）", visualStyle: "魏晋建筑，庄园，竹林，宽袍大袖，魏晋风骨", exclusive: true },
    { keywords: ["先秦","上古","夏朝","商朝","商代","周朝","周代","西周","东周","春秋","战国","诸子百家","孔子","孟子","荀子","老子","庄子","韩非子","墨子","孙武","孙子","吴起","商鞅","屈原","周武王","姜子牙","纣王"], name: "先秦", period: "先秦（约前2070-前221）", visualStyle: "先秦建筑，城池，宫室，先秦服饰，深衣，玄端，青铜器", exclusive: true },
    { keywords: ["民国","北洋","军阀","孙中山","蒋介石","周恩来","上海滩","租界","大公报","辛亥革命","武昌起义"], name: "民国", period: "民国（1912-1949）", visualStyle: "民国建筑，洋楼，上海滩，中山装，旗袍，长衫，报馆", exclusive: true },
    { keywords: ["辽朝","辽代","契丹","耶律","金朝","金代","女真","完颜","西夏","党项","李元昊"], name: "辽金西夏", period: "辽金西夏（907-1234）", visualStyle: "辽金建筑，草原，帐篷，皮裘，铠甲，胡服", exclusive: true },
    { keywords: ["五代十国","五代","李存勖","石敬瑭","后梁","后唐","后晋","后汉","后周"], name: "五代十国", period: "五代十国（907-979）", visualStyle: "五代建筑，城墙，战场，铠甲，胡服，圆领袍", exclusive: true },
  ];

  private static TIME_KEYWORDS: [string[], string][] = [
    [["甲午","甲午战争","1894","1895","鸦片战争","1840","1842","八国联军","庚子","1900","戊戌变法","戊戌","1898","洋务运动","太平天国","捻军","义和团","湘军","淮军","虎门销烟","南京条约","马关条约","辛丑条约","北洋水师","清末","晚清","19世纪末","闭关锁国"], "清朝"],
    [["永乐大典","郑和下西洋","张居正改革","一条鞭法","明末","明末清初","土木堡","戚继光抗倭","资本主义萌芽","海禁","八股"], "明朝"],
    [["贞观之治","开元盛世","安史之乱","755","玄奘取经","大唐盛世","西域","均田制","租庸调","藩镇割据","牛李党争","武周"], "唐朝"],
    [["张骞出使西域","丝绸之路","匈奴","北击匈奴","史记","盐铁论","推恩令","光武中兴","西域都护"], "汉朝"],
    [["靖康","靖康之耻","1127","澶渊之盟","王安石变法","交子","清明上河图","程朱理学"], "宋朝"],
    [["兵马俑","焚书坑儒","书同文","车同轨","郡县制","统一度量衡"], "秦朝"],
    [["赤壁之战","208","官渡之战","200","三国鼎立","三国演义","三顾茅庐","草船借箭","空城计","七擒孟获"], "三国"],
    [["蒙古帝国","13世纪","元大都","行省制","蒙古铁骑"], "元朝"],
    [["春秋战国","百家争鸣","战国七雄","合纵连横","商鞅变法","长平之战","围魏救赵","卧薪尝胆"], "先秦"],
    [["辛亥革命","1911","1912","五四运动","1919","北伐","1926","抗日战争","1937","1945","解放战争","1946","1949"], "民国"],
    [["淝水之战","八王之乱","永嘉之乱"], "晋南北朝"],
  ];

  static detect(text: string): DynastyResult | null {
    if (!text) return null;

    // 第1层：专属关键词（优先级最高）
    for (const rule of this.DYNASTY_RULES) {
      if (rule.exclusive) {
        for (const kw of rule.keywords) {
          if (text.includes(kw)) {
            return {
              name: rule.name, period: rule.period,
              visual_style: rule.visualStyle,
              confidence: 0.95, method: "exclusive_keyword", evidence: [kw],
            };
          }
        }
      }
    }

    // 第2层：时间/事件关键词
    for (const [keywords, name] of this.TIME_KEYWORDS) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          const rule = this.DYNASTY_RULES.find(r => r.name === name);
          if (rule) {
            return {
              name: rule.name, period: rule.period,
              visual_style: rule.visualStyle,
              confidence: 0.85, method: "time_keyword", evidence: [kw],
            };
          }
        }
      }
    }

    // 第3层：非专属关键词
    for (const rule of this.DYNASTY_RULES) {
      if (!rule.exclusive) {
        for (const kw of rule.keywords) {
          if (text.includes(kw)) {
            return {
              name: rule.name, period: rule.period,
              visual_style: rule.visualStyle,
              confidence: 0.60, method: "non_exclusive", evidence: [kw],
            };
          }
        }
      }
    }

    return null;
  }

  static buildContext(text: string, defaultLocation = "中国"): HistoricalContext {
    const r = this.detect(text);
    if (r) {
      return {
        period: r.name, location: defaultLocation,
        visual_style: r.visual_style, era_style: r.period,
      };
    }
    return {
      period: "古代中国", location: defaultLocation,
      visual_style: "古代建筑，传统服饰，古风",
    };
  }
}

// ==================== AI 朝代推理引擎（v8 集成） ====================

export class AIDynastyDetector {
  private static SYSTEM_PROMPT = [
    "你是一位中国历史专家。分析用户输入文本，判断它讨论的是哪个朝代。",
    "",
    "关键原则：",
    '1. 从人物、事件、制度、地名中推理时代背景',
    '2. "清平乐"的"清"是剧名，不指清朝；应判断为宋朝（讲宋仁宗）',
    '3. 即使没有直接朝代名也要推断（"王阳明"->明朝，"淝水之战"->东晋）',
    '4. 输出严格JSON（无多余文字）',
    "",
    '输出格式：',
    '{ "dynasty": "朝代名称", "confidence": 0.95, "evidence": ["证据"], "reasoning": "简述" }',
    "",
    "可输出：清朝|明朝|汉朝|唐朝|宋朝|秦朝|三国|元朝|隋朝|晋南北朝|先秦|民国|辽金西夏|五代十国|无法确定",
  ].join("\n");

  private static ALIASES: Record<string, string> = {
    "清朝":"清朝","清":"清朝","满清":"清朝","明朝":"明朝","明":"明朝","汉朝":"汉朝","汉":"汉朝","西汉":"汉朝","东汉":"汉朝","唐朝":"唐朝","唐":"唐朝","宋朝":"宋朝","宋":"宋朝","北宋":"宋朝","南宋":"宋朝","秦朝":"秦朝","秦":"秦朝","三国":"三国","元朝":"元朝","元":"元朝","隋朝":"隋朝","隋":"隋朝","晋朝":"晋南北朝","晋":"晋南北朝","南北朝":"晋南北朝","魏晋":"晋南北朝","先秦":"先秦","春秋战国":"先秦","民国":"民国","辽金":"辽金西夏","辽":"辽金西夏","金":"辽金西夏","西夏":"辽金西夏","五代十国":"五代十国","五代":"五代十国",
  };

  private apiBase: string;
  private apiKey: string;
  private model: string;
  private cache: Map<string, DynastyResult>;

  constructor(config?: { apiBase?: string; apiKey?: string; model?: string }) {
    this.apiBase = config?.apiBase || "https://api.deepseek.com/v1";
    this.apiKey = config?.apiKey || "";
    this.model = config?.model || "deepseek-chat";
    this.cache = new Map();
  }

  async infer(text: string): Promise<DynastyResult | null> {
    if (!text.trim() || !this.apiKey) return null;
    const key = this.md5(text.slice(0, 800));
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const result = await this.callLLM(text);
      if (result) {
        this.cache.set(key, result);
        if (this.cache.size > 200) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
      }
      return result;
    } catch {
      return null;
    }
  }

  private findRule(name: string): { name: string; period: string; visualStyle: string } | null {
    for (const r of DynastyDetector["DYNASTY_RULES"]) {
      if (r.name === name) return r;
    }
    const canonical = AIDynastyDetector.ALIASES[name];
    if (canonical) {
      for (const r of DynastyDetector["DYNASTY_RULES"]) {
        if (r.name === canonical) return r;
      }
    }
    return null;
  }

  private async callLLM(text: string): Promise<DynastyResult | null> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: AIDynastyDetector.SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 800) },
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: "json_object" },
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`${this.apiBase.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content;
        if (!raw) throw new Error("No content in response");
        const parsed = JSON.parse(raw);
        const dynastyName = parsed.dynasty || "无法确定";
        if (dynastyName === "无法确定") return null;
        const rule = this.findRule(dynastyName);
        if (!rule) return null;
        return {
          name: rule.name, period: rule.period, visual_style: rule.visualStyle,
          confidence: parsed.confidence || 0.8, method: "ai_inference",
          evidence: parsed.evidence || [], reasoning: parsed.reasoning || "",
        };
      } catch (e: any) {
        lastError = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    return null;
  }

  private md5(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
  }
}

// ==================== 混合朝代检测器（v8 集成） ====================

export class HybridDynastyDetector {
  private strategy: string;
  private threshold: number;
  private ai: AIDynastyDetector;

  constructor(config?: Partial<HybridDynastyConfig>) {
    this.strategy = config?.strategy || "keyword_first";
    this.threshold = config?.keywordThreshold ?? 0.7;
    this.ai = new AIDynastyDetector({
      apiBase: config?.apiBase, apiKey: config?.apiKey, model: config?.model,
    });
  }

  async detect(text: string): Promise<DynastyResult | null> {
    if (!text.trim()) return null;

    if (this.strategy === "keyword_only") return DynastyDetector.detect(text);
    if (this.strategy === "ai_only") return this.ai.infer(text);

    if (this.strategy === "keyword_first") {
      const kw = DynastyDetector.detect(text);
      if (kw && kw.confidence >= this.threshold) return kw;
      return (await this.ai.infer(text)) || kw;
    }

    const ai = await this.ai.infer(text);
    return ai || DynastyDetector.detect(text);
  }

  async buildContext(text: string, defaultLocation = "中国"): Promise<HistoricalContext> {
    const r = await this.detect(text);
    if (r) {
      return {
        period: r.name, location: defaultLocation,
        visual_style: r.visual_style, era_style: r.period,
      };
    }
    return {
      period: "古代中国", location: defaultLocation, visual_style: "",
    };
  }
}

// ==================== 视觉元素库（古代 + 现代） ====================

const VISUAL_ELEMENTS: Record<string, { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] }> = {
  "清朝":     { architecture: ["清代宫殿","园林","城墙"], clothing: ["清装","马褂","顶戴花翎","马蹄袖","长袍"], props: ["折扇","朝珠","盖碗茶"], atmosphere: ["宫廷气氛","市井风情"] },
  "明朝":     { architecture: ["紫禁城","明代城楼","江南园林"], clothing: ["明代汉服","补服","乌纱帽","曳撒","直裰"], props: ["毛笔","长卷","官印"], atmosphere: ["宫廷气派","士人风雅"] },
  "汉朝":     { architecture: ["汉代宫阙","古城","长街"], clothing: ["汉服","曲裾","深衣","博冠","玉带"], props: ["竹简","帛书","铜镜"], atmosphere: ["古朴庄重","雄浑大气"] },
  "唐朝":     { architecture: ["唐代宫殿","长安城","大雁塔"], clothing: ["唐装","圆领袍","襦裙","高髻","胡服"], props: ["琵琶","唐三彩","胡瓶"], atmosphere: ["盛唐气象","开放华丽"] },
  "宋朝":     { architecture: ["宋式城楼","街市","瓦舍"], clothing: ["宋装","褙子","东坡巾","直裰"], props: ["瓷器","茶具","团扇"], atmosphere: ["雅致简约","市井繁华"] },
  "秦朝":     { architecture: ["秦长城","宫殿","驰道"], clothing: ["秦装","铠甲","曲裾","冠冕"], props: ["兵马俑","青铜剑","虎符"], atmosphere: ["威严雄壮","古朴森严"] },
  "三国":     { architecture: ["城寨","军营","烽火台"], clothing: ["汉服","铠甲","战袍","羽扇纶巾"], props: ["旌旗","兵器","战马"], atmosphere: ["战乱纷争","英雄气概"] },
  "元朝":     { architecture: ["元大都","蒙古包","草原"], clothing: ["蒙古袍","质孙服","辫线袄"], props: ["马鞍","弓箭","铜壶"], atmosphere: ["草原雄风","粗犷豪放"] },
  "隋朝":     { architecture: ["隋宫殿","运河","龙舟"], clothing: ["隋装","圆领袍","高冠"], props: ["运河船","铜钱"], atmosphere: ["雄才大略","盛世初开"] },
  "晋南北朝": { architecture: ["庄园","竹林","佛寺"], clothing: ["宽袍大袖","褒衣博带"], props: ["酒杯","琴","毛笔"], atmosphere: ["名士风流","飘逸洒脱"] },
  "先秦":     { architecture: ["城池","宫室","祭祀台"], clothing: ["先秦服饰","深衣","玄端"], props: ["青铜器","竹简","战车"], atmosphere: ["古朴原始","礼乐庄严"] },
  "民国":     { architecture: ["民国洋楼","石库门","报馆"], clothing: ["中山装","旗袍","长衫","学生装"], props: ["报纸","电报","留声机"], atmosphere: ["新旧交替","中西合璧"] },
  "辽金西夏": { architecture: ["草原帐篷","佛塔","城墙"], clothing: ["皮裘","铠甲","胡服"], props: ["弓箭","马刀","银器"], atmosphere: ["游牧风情","苍茫壮阔"] },
  "五代十国": { architecture: ["五代城墙","战营","关隘"], clothing: ["铠甲","胡服","圆领袍"], props: ["兵器","战马","令牌"], atmosphere: ["战乱频繁","改朝换代"] },
  // --- 现代元素（v8.1 新增） ---
  "现代":     { architecture: ["现代建筑","城市天际线","玻璃幕墙","街道","社区","写字楼","住宅小区","机场","车站","公园"],
                clothing: ["T恤","牛仔裤","休闲服","外套","运动装","正装","西装","连衣裙","羽绒服","运动鞋"],
                props: ["手机","笔记本电脑","汽车","自行车","相机","背包","咖啡杯","公文包"],
                atmosphere: ["都市感","现代感","生活气息","科技感","日常氛围"] },
  // --- 通用（仅服装+氛围，兜底） ---
  "通用":     { architecture: [], clothing: ["服饰"], props: [], atmosphere: ["真实感"] },
  // --- 古代兜底 ---
  "古代中国": { architecture: [], clothing: ["传统服饰"], props: [], atmosphere: ["古风"] },
};

// ==================== 句子场景分类器 ====================

export class SentenceContextClassifier {
  private static WAR = new Set(["战争","打仗","战斗","战役","战场","军队","士兵","将军","进攻","防守","抵抗","袭击","入侵","征战","歼灭","武器","兵器","铠甲","刀剑","箭","盾牌","枪炮","大炮","兵变","叛乱","讨伐","抗倭","北伐","南征","胜","败","投降","死磕","打赢","战败","俘虏","镇远","定远","水师","舰队","战线","阵地"]);
  private static COURT = new Set(["皇帝","皇上","陛下","帝王","朝廷","朝堂","天子","大臣","官员","宰相","首辅","内阁","官场","官僚","上朝","奏折","圣旨","诏书","谕旨","宫","殿","紫禁","皇城","皇宫","御","登基","即位","禅让","摄政","垂帘","辅政","政治","改革","新政","变法","制度"]);
  private static PEOPLE = new Set(["人","人物","名","肖像","相貌","容貌","长相","面容","表情","神态","眼神","他","她","他们","众人","百姓","民"]);
  private static DAILY = new Set(["百姓","民众","民生","民间","市井","街","生活","日常","起居","吃","穿","住","行","家","宅","院","屋","房","市","集市","商","卖","买","交易","贸易"]);
  private static ECONOMIC = new Set(["经济","贸易","商业","商","银","钱","税","漕运","运河","航运","丝绸之路","通商","农业","田","赋税","盐铁","货币","江南","繁荣","富庶"]);
  private static CULTURE = new Set(["诗","词","曲","赋","文","书法","画","琴","棋","书","画","茶","酒","文章","文学","诗词","散文","哲学","思想","学说","学术","儒","道","佛","书法","绘画","工艺","艺术"]);
  private static ABSTRACT = new Set(["如果","假如","假设","若是","若","倘","会不会","能不能","是否","可否","可能","也许","大概","应该"]);

  static classify(sentence: string): string {
    const scores: Record<string, number> = {};

    let score = this.countKeywords(sentence, this.ABSTRACT);
    if (score > 0) scores["abstract"] = score * 1.5;

    for (const [cat, kws] of [["war", this.WAR], ["court", this.COURT], ["daily", this.DAILY], ["people", this.PEOPLE], ["economic", this.ECONOMIC], ["culture", this.CULTURE]] as [string, Set<string>][]) {
      score = this.countKeywords(sentence, kws);
      if (score > 0) scores[cat] = score * (cat === "people" ? 0.8 : 1.0);
    }

    if (Object.keys(scores).length === 0) return "default";
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  private static countKeywords(sentence: string, keywords: Set<string>): number {
    let count = 0;
    for (const kw of keywords) {
      if (sentence.includes(kw)) count++;
    }
    return count;
  }
}

// ==================== 动态视觉风格选择器 ====================

export class VisualStyleSelector {
  private elements: Record<string, { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] }>;

  constructor(elements?: typeof VISUAL_ELEMENTS) {
    this.elements = elements || VISUAL_ELEMENTS;
  }

  select(sentence: string, periodName: string): string {
    const ctx = SentenceContextClassifier.classify(sentence);
    // 现代/通用/古代各自取对应的元素库
    const el = this.elements[periodName] || this.elements["通用"];

    const selected: string[] = [];

    switch (ctx) {
      case "war":
        selected.push(...el.clothing, ...el.props, ...el.atmosphere);
        break;
      case "court":
        selected.push(...el.architecture, ...el.clothing, ...el.props, ...el.atmosphere);
        break;
      case "daily":
        selected.push(...el.architecture.slice(0, 1), ...el.clothing, ...el.atmosphere);
        break;
      case "people":
        selected.push(...el.clothing, ...el.props.slice(0, 1), ...el.atmosphere);
        break;
      case "economic":
        selected.push(...el.architecture, ...el.clothing, ...el.atmosphere);
        break;
      case "culture":
        selected.push(...el.props, ...el.clothing.slice(0, 2), ...el.atmosphere);
        break;
      case "abstract":
        selected.push(...el.clothing.slice(0, 1), ...el.atmosphere);
        break;
      default:
        selected.push(...el.clothing.slice(0, 2), ...el.atmosphere);
        break;
    }

    return selected.join("，") || (periodName === "现代" ? "现代生活" : "古风");
  }

  selectStructured(sentence: string, dynasty: string | null, isModern: boolean): { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] } {
    const ctx = SentenceContextClassifier.classify(sentence);

    if (isModern) {
      const modern = this.elements['现代'];
      switch (ctx) {
        case 'war':
          return { architecture: [], clothing: modern.clothing.slice(0, 2), props: ['背包'], atmosphere: ['都市感'] };
        case 'court':
          return { architecture: modern.architecture.slice(0, 2), clothing: ['正装'], props: ['公文包'], atmosphere: ['职场感'] };
        case 'daily':
          return { architecture: modern.architecture.slice(0, 1), clothing: ['T恤'], props: ['咖啡杯'], atmosphere: ['日常氛围'] };
        case 'people':
          return { architecture: [], clothing: modern.clothing.slice(0, 1), props: ['相机'], atmosphere: ['生活气息'] };
        default:
          return { architecture: [], clothing: modern.clothing.slice(0, 1), props: [], atmosphere: ['真实感'] };
      }
    }

    const elements = (dynasty && this.elements[dynasty]) ? this.elements[dynasty] : this.elements['通用'];

    switch (ctx) {
      case 'war':
        return { architecture: [], clothing: elements.clothing.slice(0, 2), props: ['兵器'], atmosphere: ['战场氛围'] };
      case 'court':
        return { architecture: elements.architecture.slice(0, 2), clothing: elements.clothing.slice(0, 2), props: elements.props.slice(0, 2), atmosphere: elements.atmosphere.slice(0, 2) };
      case 'daily':
        return { architecture: elements.architecture.slice(0, 1), clothing: elements.clothing.slice(0, 1), props: [], atmosphere: ['市井繁华'] };
      case 'people':
        return { architecture: [], clothing: elements.clothing.slice(0, 1), props: elements.props.slice(0, 1), atmosphere: ['士人风雅'] };
      case 'economic':
        return { architecture: elements.architecture.slice(0, 1), clothing: elements.clothing.slice(0, 1), props: [], atmosphere: ['古朴庄重'] };
      case 'culture':
        return { architecture: [], clothing: elements.clothing.slice(0, 1), props: ['笔墨', '古琴'], atmosphere: ['文化气息'] };
      case 'abstract':
        return { architecture: [], clothing: [], props: [], atmosphere: elements.atmosphere.slice(0, 1) };
      default:
        return { architecture: [], clothing: elements.clothing.slice(0, 1), props: [], atmosphere: ['古风'] };
    }
  }
}

// ==================== 提示词生成器（v10 VisionCraft版） ====================

export class DiversePromptGeneratorV10 {
  private perspectives: string[];
  private compositions: string[];
  private styles: string[];
  private antiAIGroups: string[][];
  private documentaryGroups: string[][];
  private realGroups: string[][];
  private isModern: boolean;

  constructor(_context: HistoricalContext, _styleSelector?: VisualStyleSelector, isModern = false) {
    this.isModern = isModern;

    // 10种视角
    this.perspectives = [
      '平视角度，真实自然',
      '俯视角度，全景感',
      '仰视角度，高大感',
      '侧面角度，层次感',
      '特写视角，细节丰富',
      '广角镜头，空间感强',
      '长焦压缩，背景虚化',
      '微距摄影，极致细节',
      '动态视角，运动感',
      '静态视角，宁静感'
    ];

    // 8种构图
    this.compositions = [
      '三分法构图，平衡',
      '对称构图，庄重',
      '引导线构图，纵深感',
      '框架构图，聚焦',
      '满幅构图，冲击力',
      '留白构图，意境深远',
      '对角线构图，动感',
      '重复构图，节奏感'
    ];

    // 10种风格
    this.styles = [
      '写实风格，摄影级细节',
      '油画质感，笔触明显',
      '水彩风格，清新淡雅',
      '水墨风格，意境悠远',
      '胶片风格，颗粒感',
      '复古风格，怀旧感',
      '现代风格，简洁明快',
      '超现实风格，梦幻感',
      'Kodak Portra 400, 35mm film, analog photo, 颗粒感',
      'anamorphic lens, 变形镜头感, 电影宽幅, 浅景深'
    ];

    // 6组anti-AI
    this.antiAIGroups = [
      ['真实感', '摄影感', '胶片感'],
      ['raw photo', 'unedited', 'authentic moment'],
      ['imperfection', 'asymmetric', 'natural pose'],
      ['film grain', 'ISO 3200', 'high grain', 'analog feel'],
      ['Kodak film stock', 'analog texture', 'not digital'],
      ['cinematic', 'film still', 'not AI art', 'authentic photography']
    ];

    // 6组纪录片
    this.documentaryGroups = [
      ['纪录片风格', '纪实摄影'],
      ['candid', 'unposed', 'real life'],
      ['raw footage', 'behind the scenes'],
      ['handheld', 'slight blur', 'documentary feel'],
      ['手持摄影', '轻微失焦', '纪录片抓拍感'],
      ['cinema verite', 'natural light', 'unpolished']
    ];

    // 6组真实感
    this.realGroups = [
      ['realistic', 'authentic', 'natural'],
      ['photorealistic', '8k', 'ultra detailed'],
      [' authentic photography', 'real moment'],
      ['film grain', 'ISO 3200', 'high grain', 'analog feel'],
      ['Kodak film stock', 'analog texture', 'not digital'],
      ['raw photo', 'unedited', 'authentic moment']
    ];
  }

  generate(text: string, dynasty: string | null, visualElements: { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] }): { prompt: string; negative: string } {
    const perspective = this.perspectives[Math.floor(Math.random() * this.perspectives.length)];
    const composition = this.compositions[Math.floor(Math.random() * this.compositions.length)];
    const style = this.styles[Math.floor(Math.random() * this.styles.length)];
    const antiAI = this.antiAIGroups[Math.floor(Math.random() * this.antiAIGroups.length)];
    const documentary = this.documentaryGroups[Math.floor(Math.random() * this.documentaryGroups.length)];
    const real = this.realGroups[Math.floor(Math.random() * this.realGroups.length)];

    let prompt = '';

    if (this.isModern) {
      prompt = this.buildModernPrompt(text, visualElements, perspective, composition, style, antiAI, documentary, real);
    } else {
      prompt = this.buildAncientPrompt(text, dynasty, visualElements, perspective, composition, style, antiAI, documentary, real);
    }

    const negative = this.buildNegativePrompt();

    return { prompt, negative };
  }

  private buildAncientPrompt(text: string, dynasty: string | null, visualElements: { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] }, perspective: string, composition: string, style: string, antiAI: string[], documentary: string[], real: string[]): string {
    let prompt = '';
    if (dynasty) {
      prompt += `${dynasty}历史时期，中国，\n`;
    } else {
      prompt += `古代，中国，\n`;
    }
    prompt += `${text}，\n`;

    if (visualElements.architecture.length > 0) {
      prompt += `${visualElements.architecture.join('，')}，\n`;
    }
    if (visualElements.clothing.length > 0) {
      prompt += `${visualElements.clothing.join('，')}，\n`;
    }
    if (visualElements.atmosphere.length > 0) {
      prompt += `${visualElements.atmosphere.join('，')}，\n`;
    }

    prompt += `${perspective}，\n`;
    prompt += `${composition}，\n`;
    prompt += `古风，历史还原，无现代元素，\n`;
    prompt += `${antiAI.join('，')}，\n`;
    prompt += `${documentary.join('，')}，\n`;
    prompt += `${real.join('，')}，\n`;
    prompt += `${style}`;

    return prompt;
  }

  private buildModernPrompt(text: string, visualElements: { architecture: string[]; clothing: string[]; props: string[]; atmosphere: string[] }, perspective: string, composition: string, style: string, antiAI: string[], documentary: string[], real: string[]): string {
    let prompt = '现代，中国，\n';
    prompt += `${text}，\n`;

    if (visualElements.architecture.length > 0) {
      prompt += `${visualElements.architecture.join('，')}，\n`;
    }
    if (visualElements.clothing.length > 0) {
      prompt += `${visualElements.clothing.join('，')}，\n`;
    }
    if (visualElements.atmosphere.length > 0) {
      prompt += `${visualElements.atmosphere.join('，')}，\n`;
    }

    prompt += `${perspective}，\n`;
    prompt += `${composition}，\n`;
    prompt += `现代风格，真实场景，\n`;
    prompt += `${antiAI.join('，')}，\n`;
    prompt += `${documentary.join('，')}，\n`;
    prompt += `${real.join('，')}，\n`;
    prompt += `${style}`;

    return prompt;
  }

  private buildNegativePrompt(): string {
    return `negative: ai-generated, perfect face, symmetrical face, plastic skin, over-smooth, digital art, CGI, 3D render, watermark, text, blurry, low quality, deformed, extra fingers`;
  }
}
// ==================== v8 主处理器（含时代分流） ====================

export class HistoryArticleProcessorV9 {
  private manualContext: HistoricalContext | null;
  private splitter: SmartTextSplitterV8;
  private styleSelector: VisualStyleSelector;
  private detector: {
    detect: (text: string) => Promise<DynastyResult | null>;
    buildContext: (text: string, loc?: string) => Promise<HistoricalContext>;
  };
  private eraOverride: 'auto' | 'force_ancient' | 'force_modern';

  constructor(config?: {
    context?: HistoricalContext;
    strategy?: HybridDynastyConfig["strategy"];
    keywordThreshold?: number;
    apiKey?: string;
    apiBase?: string;
    model?: string;
    era?: 'auto' | 'force_ancient' | 'force_modern';
  }) {
    this.manualContext = config?.context || null;
    this.splitter = new SmartTextSplitterV8(5, 30);
    this.styleSelector = new VisualStyleSelector();
    this.eraOverride = config?.era || 'auto';

    const strategy = config?.strategy || "keyword_only";
    if (config?.apiKey && strategy !== "keyword_only") {
      this.detector = new HybridDynastyDetector({
        strategy: strategy as any,
        keywordThreshold: config?.keywordThreshold ?? 0.7,
        apiKey: config.apiKey,
        apiBase: config?.apiBase,
        model: config?.model,
      });
    } else {
      this.detector = {
        detect: async (text: string) => DynastyDetector.detect(text),
        buildContext: async (text: string, loc?: string) => DynastyDetector.buildContext(text, loc),
      };
    }
  }

  async process(article: string): Promise<ProcessResult[]> {
    // 1. 手动上下文优先
    if (this.manualContext) {
      return this._processWithContext(this.manualContext, article, false);
    }

    // 2. 时代检测
    let eraResult: EraResult;
    if (this.eraOverride === 'force_ancient') {
      eraResult = { era: "ancient", confidence: 1.0, evidence: ["用户强制古代"] };
    } else if (this.eraOverride === 'force_modern') {
      eraResult = { era: "modern", confidence: 1.0, evidence: ["用户强制现代"] };
    } else {
      eraResult = EraDetector.detect(article);
    }

    // 3. 按时代分流
    if (eraResult.era === "modern" && eraResult.confidence >= 0.5) {
      // 现代内容 → 使用现代上下文
      const modernContext: HistoricalContext = {
        period: "现代",
        location: "",
        visual_style: "现代建筑，现代服饰，都市感",
        era_style: "现代",
      };
      return this._processWithContext(modernContext, article, true);
    }

    // 古代/mixed → 使用朝代检测器
    const context = await this.detector.buildContext(article);
    return this._processWithContext(context, article, false);
  }

  private async _processWithContext(
    context: HistoricalContext,
    article: string,
    isModern: boolean
  ): Promise<ProcessResult[]> {
    const gen = new DiversePromptGeneratorV10(context, this.styleSelector, isModern);
    const fragments = await this.splitter.split(article);

    const results: ProcessResult[] = [];
    for (const f of fragments) {
      const visualElements = this.styleSelector.selectStructured(f.text, context.period, isModern);
      const { prompt, negative } = gen.generate(f.text, context.period, visualElements);
      results.push({
        text: f.text, prompt, negative,
        sentiment: f.sentiment, is_key: f.is_key,
        importance: f.importance, is_complete: f.is_complete,
      });
    }
    return results;
  }

  async detectDynasty(text: string): Promise<DynastyResult | null> {
    // 先检测时代
    const era = EraDetector.detect(text);
    if (era.era === "modern" && era.confidence >= 0.5) {
      return null; // 现代内容无朝代
    }
    return this.detector.detect(text);
  }
}

// ==================== v7 兼容层 ====================

export const HISTORY_PROMPT_VERSION = 'v10.0';

/** v7 兼容 PromptResult */
export interface PromptResult {
  prompt: string;
  negative: string;
  sentiment: string;
  colorTone: string;
  isComplete: boolean;
}

/**
 * 【兼容层】将语音合成文案分断为图片片段
 * @deprecated 建议直接使用 text-segmentation 模块的 splitTextToScenes
 */
export function splitTextForImages(text: string, targetCount: number): string[] {
  return splitTextToScenes(text, { targetCount });
}

/**
 * 【兼容层】将分断后的文案片段转化为生图提示词
 * 使用 v10 的 DiversePromptGeneratorV10 和 DynastyDetector 驱动
 */
export function generateImagePrompts(segments: string[], fullText: string): string[] {
  return generateImagePromptsWithNegative(segments, fullText).map((r) => r.prompt);
}

/**
 * 【兼容层】完整版提示词生成（含负面提示词）
 */
export function generateImagePromptsWithNegative(
  segments: string[],
  fullText: string,
): PromptResult[] {
  if (segments.length === 0) return [];

  const era = EraDetector.detect(fullText);
  const isModern = era.era === 'modern' && era.confidence >= 0.5;
  const context: HistoricalContext = isModern
    ? { period: '现代', location: '中国', visual_style: '现代建筑，现代服饰，都市感', era_style: '现代' }
    : DynastyDetector.buildContext(fullText);

  const styleSelector = new VisualStyleSelector();
  const generator = new DiversePromptGeneratorV10(context, styleSelector, isModern);
  const sentimentAnalyzer = new SentimentAnalyzer();

  return segments.map((segment) => {
    const visualElements = styleSelector.selectStructured(segment, context.period, isModern);
    const { prompt, negative } = generator.generate(segment, context.period, visualElements);
    const sentiment = sentimentAnalyzer.analyze(segment.length < 10 ? fullText : segment);
    return {
      prompt,
      negative,
      sentiment,
      colorTone: sentimentAnalyzer.colorTone(sentiment),
      isComplete: segment.length >= 3,
    };
  });
}

/**
 * 【兼容层】获取调试信息
 */
export function getSegmentDebugInfo(
  segments: string[],
  fullText: string,
): Array<{
  index: number;
  text: string;
  prompt: string;
  negative: string;
  sentiment: string;
  isComplete: boolean;
}> {
  const results = generateImagePromptsWithNegative(segments, fullText);
  return results.map((r, index) => ({
    index,
    text: segments[index],
    prompt: r.prompt,
    negative: r.negative,
    sentiment: r.sentiment,
    isComplete: r.isComplete,
  }));
}

/**
 * 【兼容层】获取策略版本
 */
export function getStrategyVersion(): string {
  return HISTORY_PROMPT_VERSION;
}

/**
 * 智能图片提示词生成（API-First + TS-Fallback）
 *
 * 当 prompt-engine 服务可用时：
 * 1. 优先调用 /v1/storyboard/compose（专为 Story2Video 设计的分镜合成）
 * 2. 若 storyboard 失败，降级到本地生成 + /v1/batch 批量优化
 * 3. 若批量优化也失败，完全降级到本地 TS 实现
 *
 * @param segments 分割后的文本段
 * @param fullText 完整原文
 * @returns 优化后的提示词数组
 */
export async function generateImagePromptsSmart(
  segments: string[],
  fullText: string,
): Promise<string[]> {
  if (segments.length === 0) return [];

  if (isPromptEngineAvailable()) {
    // 策略 1：使用 /v1/storyboard/compose
    try {
      const result = await apiStoryboardCompose(segments, fullText);
      if (result.prompts && result.prompts.length > 0) {
        return { prompts: result.prompts, tier: "api" };
      }
    } catch {
      // storyboard compose 失败，尝试策略 2
    }

    // 策略 2：本地生成 + 批量优化
    try {
      const localPrompts = generateImagePrompts(segments, fullText);
      const optimized = await apiBatchOptimize(
        localPrompts.map((p) => ({ prompt: p, platform: 'generic' })),
      );
      if (optimized.length > 0) {
        return { prompts: optimized.map((r) => r.optimized_prompt), tier: "api" };
      }
    } catch {
      // 完全降级到本地
    }
  }

  // 策略 3：完全本地执行
  return { prompts: generateImagePrompts(segments, fullText), tier: "local" };
}

// 内部导出供测试用（兼容 v7 测试接口）
export const _internal = {
  extractHistoricalContext: (text: string) => {
    const era = EraDetector.detect(text);
    const isModern = era.era === 'modern' && era.confidence >= 0.5;
    if (isModern) {
      return {
        period: '现代',
        location: '中国',
        visual_style: '现代建筑，现代服饰，都市感',
        colorTone: '都市感，现代色调',
        era_style: '现代',
      };
    }
    const ctx = DynastyDetector.buildContext(text);
    // 为兼容 v7 测试，补充 colorTone
    const sentiment = new SentimentAnalyzer().analyze(text);
    const colorTone = new SentimentAnalyzer().colorTone(sentiment);
    return { ...ctx, colorTone };
  },
  analyzeSentiment: (text: string) => new SentimentAnalyzer().analyze(text),
  getColorTone: (s: string) => new SentimentAnalyzer().colorTone(s),
  isSemanticallySufficientForImage: (s: string) => {
    const MODIFIER_ENDINGS = ['的', '地', '得', '把', '被', '让', '使', '对', '向', '从', '于'];
    for (const mod of MODIFIER_ENDINGS) {
      if (s.endsWith(mod)) return false;
    }
    if (s.length < 4 && !/[。！？]$/.test(s)) return false;
    return true;
  },
  buildPromptForSegment: (segment: string, context: HistoricalContext, _index: number, _colorTone?: string) => {
    const isModern = context.period === '现代';
    const styleSelector = new VisualStyleSelector();
    const visualElements = styleSelector.selectStructured(segment, context.period, isModern);
    const generator = new DiversePromptGeneratorV10(context, styleSelector, isModern);
    return generator.generate(segment, context.period, visualElements);
  },
  PERSPECTIVES: [
    '广角镜头，全景视角',
    '中景镜头，人物特写',
    '近景镜头，细节特写',
    '仰视角度，宏伟壮观',
    '俯视角度，全局概览',
    '平视角度，真实自然',
    '手持镜头，轻微抖动，纪录片感',
    '肩扛摄影，动态感，真实感',
  ],
  COMPOSITIONS: [
    '对称构图，庄重',
    '三分法构图，平衡',
    '对角线构图，动态',
    '框架构图，聚焦',
    '中心构图，突出主体',
    '不规则构图，纪录片感，抓拍感',
  ],
  STYLES: [
    '写实风格，摄影级细节',
    '艺术风格，美感优先',
    '电影感，史诗感，宏大场景',
    '古画风格，水墨画，中国画',
    '插画风格，细腻精致',
    '纪录片风格，纪实摄影，真实感',
    '胶片摄影，film grain，噪点，真实感',
  ],
  ANTI_AI_PROMPTS: [
    '真实感，摄影感，胶片感',
    '非AI生成，真实照片，raw photo',
    'film grain, noise texture, authentic',
    'imperfections, natural lighting, candid',
    'realistic skin texture, pores visible',
  ],
  DOCUMENTARY_PROMPTS: [
    '纪录片风格，纪实摄影，真实感',
    'documentary style, cinéma vérité, handheld camera',
    'natural lighting, candid, imperfect, authentic',
    'film grain, noise texture, raw photo, unpolished',
    'historical documentary, BBC documentary style',
  ],
  REALISM_PROMPTS: [
    '真实感，摄影感，细节丰富',
    'realistic, authentic, natural, imperfect',
    'natural skin texture, pores visible, imperfections',
    'natural lighting, soft shadows, realistic',
    'candid shot, unposed, natural expression',
  ],
  NEGATIVE_PROMPTS: `ai-generated, ai art, 3d render, cg, artificial, synthetic, deepfake, perfect face, symmetrical face, plastic skin, smooth skin, unrealistic, painting, illustration, anime, cartoon, stylized, over-polished, flawless, airbrushed, modern building, car, electric wire, modern clothing, plastic, electronic device, neon light, low quality, blurry, deformed`.trim(),
};
