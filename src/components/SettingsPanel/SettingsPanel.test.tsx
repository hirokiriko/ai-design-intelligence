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
        enableLocalAnalysisPack: true,
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
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
        onHosoeAnalysisPackFile: vi.fn(),
        onClearHosoeAnalysisPack: vi.fn(),
      }),
    );

    expect(html).toContain('任意：データ・デモ設定');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('AI分析開始');
    expect(html).toContain('意匠動向をルールベースで分析します。');
    expect(html).toContain('APIキーは不要');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).toContain('ローカル分析パックJSONを読み込む（開発用）');
    expect(html).toContain('未読込');
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

  it('hides the local analysis pack input in public production mode', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsPanel, {
        request,
        companyInput: '',
        errors: {},
        isRunning: false,
        localJpoState: { status: 'sample', warnings: [], errors: [] },
        enableLocalAnalysisPack: false,
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
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
        onHosoeAnalysisPackFile: vi.fn(),
        onClearHosoeAnalysisPack: vi.fn(),
      }),
    );

    expect(html).not.toContain('ローカル分析パックJSONを読み込む');
    expect(html).not.toContain('細江');
    expect(html).not.toContain('安立');
    expect(html).not.toContain('スマホ関連6社の画像意匠');
    expect(html).not.toContain('日本意匠分類にWを含む画像意匠候補');
    expect(html).not.toContain('画像共通Dターム');
    expect(html).not.toContain('専門家レビュー');
    expect(html).not.toContain(['strict', 'PrefixW'].join(''));
    expect(html).not.toContain(['dTermWIncluded', 'Candidate'].join(''));
  });

  it('offers companies from the active dataset and exposes validation errors accessibly', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsPanel, {
        request: { ...request, scope: { mode: 'companies', companySelectors: [] } },
        companyInput: '',
        companyOptions: [
          {
            origin: 'sample',
            role: 'applicant',
            localKey: 'サンプル電機株式会社',
            displayLabel: 'サンプル電機株式会社',
          },
          {
            origin: 'sample',
            role: 'applicant',
            localKey: '架空モビリティ株式会社',
            displayLabel: '架空モビリティ株式会社',
          },
        ],
        errors: { companies: '企業指定分析では、少なくとも1社を追加してください。' },
        isRunning: false,
        localJpoState: { status: 'sample', warnings: [], errors: [] },
        enableLocalAnalysisPack: false,
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
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
        onHosoeAnalysisPackFile: vi.fn(),
        onClearHosoeAnalysisPack: vi.fn(),
      }),
    );

    expect(html).toContain('データ内の企業候補');
    expect(html).toContain('企業候補から追加');
    expect(html).toContain('サンプル電機株式会社');
    expect(html).toContain('架空モビリティ株式会社');
    expect(html).toContain('id="companies-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
  });
});
