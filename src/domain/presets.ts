import type { AnalysisRequest } from './types';

export interface DemoPreset {
  id: 'market' | 'image' | 'backend_all';
  label: string;
  description: string;
  request: AnalysisRequest;
}

export type DemoPresetDataMode = 'sample' | 'legacy' | 'backend';

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

export const BACKEND_CONTRACT_DEMO_PRESET: DemoPreset = {
  id: 'backend_all',
  label: '公開意匠データ：全体を俯瞰',
  description: '商品・事業領域を固定せず、直近2年の公開意匠データを把握',
  request: {
    scope: { mode: 'all_classes' },
    productDomain: '',
    designKinds: ['article', 'image', 'interior'],
    period: 'last_2y',
    purposes: ['market_trend', 'competitor_design'],
    departments: ['mgmt_planning', 'product_planning'],
    includeUnresolvedApplicants: true,
  },
};

export function getDemoPresetsForDataMode(dataMode: DemoPresetDataMode): readonly DemoPreset[] {
  return dataMode === 'backend' ? [BACKEND_CONTRACT_DEMO_PRESET] : DEMO_PRESETS;
}

export function createDemoPresetRequest(preset: DemoPreset): AnalysisRequest {
  return {
    ...preset.request,
    scope: cloneScope(preset.request.scope),
    designKinds: [...preset.request.designKinds],
    purposes: [...preset.request.purposes],
    departments: [...preset.request.departments],
  };
}

export function createBackendContractDemoRequest(): AnalysisRequest {
  return createDemoPresetRequest(BACKEND_CONTRACT_DEMO_PRESET);
}

export function createRequestForDataMode(
  currentRequest: AnalysisRequest,
  dataMode: DemoPresetDataMode,
): AnalysisRequest {
  return dataMode === 'backend'
    ? createBackendContractDemoRequest()
    : { ...currentRequest, scope: { mode: 'all_classes' } };
}

export function clearProductDomainFilter(request: AnalysisRequest): AnalysisRequest {
  return {
    ...request,
    productDomain: '',
    scope: request.scope.mode === 'industry' ? { mode: 'all_classes' } : cloneScope(request.scope),
  };
}

function cloneScope(scope: AnalysisRequest['scope']): AnalysisRequest['scope'] {
  if (scope.mode === 'companies') {
    return { mode: 'companies', companySelectors: [...scope.companySelectors] };
  }
  return { ...scope };
}
