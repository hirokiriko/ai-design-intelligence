import type { AnalysisRequest } from './types';

export interface DemoPreset {
  id: 'market' | 'image';
  label: string;
  description: string;
  request: AnalysisRequest;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'market',
    label: 'プリセットA：家電・映像機器',
    description: '市場動向と商品化領域を直近2年で把握',
    request: {
      scope: { mode: 'all_classes' },
      productDomain: '家電・映像機器',
      designKinds: ['article', 'image', 'interior'],
      period: 'last_2y',
      purposes: ['market_trend', 'competitor_design'],
      departments: ['mgmt_planning', 'product_planning'],
      includeUnresolvedApplicants: true,
    },
  },
  {
    id: 'image',
    label: 'プリセットB：画像意匠',
    description: '画像意匠動向と企業動向を直近2年で把握',
    request: {
      scope: { mode: 'all_classes' },
      productDomain: '画像意匠',
      designKinds: ['image'],
      period: 'last_2y',
      purposes: ['ui_design', 'company_trend'],
      departments: ['design', 'mgmt_planning'],
      includeUnresolvedApplicants: true,
    },
  },
];
