import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisRequest } from '../../domain/types';
import { SettingsPanel } from './SettingsPanel';

const request: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  productDomain: '',
  period: 'last_1y',
  designKinds: ['article', 'image', 'interior'],
  purposes: ['market_trend'],
  departments: ['product_planning'],
  includeUnresolvedApplicants: true,
};

describe('SettingsPanel external information wording', () => {
  it('marks company public information sources as preparing and shows source/copyright notice', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsPanel, {
        request,
        companyInput: '',
        errors: {},
        isRunning: false,
        localJpoState: { status: 'sample', warnings: [], errors: [] },
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        onRequestChange: vi.fn(),
        onCompanyInputChange: vi.fn(),
        onAddCompany: vi.fn(),
        onRemoveCompany: vi.fn(),
        onAnalyze: vi.fn(),
        onLocalJsonFile: vi.fn(),
        onResetToSampleData: vi.fn(),
        onExternalDemoModeChange: vi.fn(),
        onDemoShowcaseFile: vi.fn(),
        onClearDemoShowcase: vi.fn(),
      }),
    );

    expect(html).toContain('企業公開情報');
    expect(html).toContain('WEB情報');
    expect(html).toContain('企業プレスリリース');
    expect(html).toContain('新聞情報');
    expect(html).toContain('株主総会情報・事業方針');
    expect(html).toContain('準備中');
    expect(html).toContain('企業公開情報との連携は、出典明示・利用条件・著作権を確認したうえで対応予定です。');
    expect(html).toContain('本文転載ではなく、企業IR・プレスリリース等の一般公開情報への参照・要約・出典表示を前提に検討します。');
    expect(html).not.toContain('本文転載ではなく、公開情報への参照・要約・出典表示を前提に検討します。');
    expect(html).not.toContain('将来' + '拡張');
    expect(html).not.toContain('C:\\KIRIKO_Data');
    expect(html).not.toContain(['design-records-', 'monthly-preview'].join(''));
    expect(html).not.toContain(['demo-candidate-', 'expanded'].join(''));
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\[^<]*(?:\.jpe?g|\.png|\.gif|\.webp|\.bmp|\.tiff?)/i);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });
});
