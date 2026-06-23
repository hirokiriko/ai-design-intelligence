import type { AnalysisPurpose, Department, DesignKind, Period } from './types';

export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  article: '物品意匠',
  image: '画像意匠',
  interior: '空間・内装意匠',
};

export const PERIOD_LABELS: Record<Period, string> = {
  last_1y: '最新意匠動向（直近1年）',
  last_2y: '過去2年（トレンド分析）',
};

export const PURPOSE_LABELS: Record<AnalysisPurpose, string> = {
  market_trend: '市場・商品トレンド分析',
  company_trend: '企業動向分析',
  competitor_design: '競合意匠動向',
  dx_dev: 'DX商品開発動向分析',
  design_change: 'デザイン変化分析',
  ui_design: '画像意匠（UI）分析',
  portfolio: '意匠ポートフォリオ分析',
  filing_strategy: '出願戦略検討',
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
