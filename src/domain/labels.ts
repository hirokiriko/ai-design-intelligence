import type { AnalysisPurpose, Department, DesignKind, Period } from './types';

export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  article: '物品意匠',
  image: '画像意匠',
  interior: '空間・内装意匠',
};

export const PERIOD_LABELS: Record<Period, string> = {
  last_1y: '現状把握：直近1年',
  last_2y: '傾向把握：直近2年',
};

export const PURPOSE_LABELS: Record<AnalysisPurpose, string> = {
  market_trend: '市場動向',
  company_trend: '企業動向',
  competitor_design: '商品化領域',
  dx_dev: 'デジタル商品開発動向',
  design_change: 'デザイン変化',
  ui_design: '画像意匠動向',
  portfolio: '意匠ポートフォリオ分析',
  filing_strategy: '出願・知財戦略の検討材料',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  mgmt_planning: '経営企画',
  product_planning: '商品企画',
  tech_planning: '技術企画',
  rnd: '研究開発',
  design: 'デザイン部門',
  ip: '知財部門',
};

export const ALL_DESIGN_KINDS = Object.keys(DESIGN_KIND_LABELS) as DesignKind[];
export const ALL_PURPOSES = Object.keys(PURPOSE_LABELS) as AnalysisPurpose[];
export const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

export const PRIMARY_PURPOSES: AnalysisPurpose[] = [
  'market_trend',
  'competitor_design',
  'company_trend',
  'design_change',
  'ui_design',
  'filing_strategy',
];

export const PRODUCT_DOMAIN_PRESETS = ['家電', '映像機器', 'IoT', '医療機器', '画像意匠'] as const;

export const STATUS_BADGES = [
  'デモ用サンプルデータ',
  'ルールベース分析',
  '外部データ未接続',
] as const;

export const FUTURE_SOURCES = [
  'WEB情報',
  '企業プレスリリース',
  '新聞情報',
  '株主総会情報・事業方針',
] as const;
