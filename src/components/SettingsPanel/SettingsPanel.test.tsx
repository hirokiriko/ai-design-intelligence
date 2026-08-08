import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisRequest } from '../../domain/types';
import { resolveDesignKinds } from '../../domain/selection';
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
  it('automatically selects image designs until the user changes design kinds manually', () => {
    expect(resolveDesignKinds(['ui_design'], ['article', 'image', 'interior'], false)).toEqual(['image']);
    expect(resolveDesignKinds(['market_trend'], ['image'], false)).toEqual(['article', 'image', 'interior']);
    expect(resolveDesignKinds(['ui_design'], ['article', 'interior'], true)).toEqual(['article', 'interior']);
  });

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
        onProtectedDemoData: vi.fn(),
        onResetToSampleData: vi.fn(),
        onExternalDemoModeChange: vi.fn(),
        onDemoShowcaseFile: vi.fn(),
        onClearDemoShowcase: vi.fn(),
        onHosoeAnalysisPackFile: vi.fn(),
        onClearHosoeAnalysisPack: vi.fn(),
      }),
    );

    expect(html).toContain('詳細設定・データ情報');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('分析を開始');
    expect(html).toContain('6. 結果と根拠を確認する');
    expect(html).not.toContain('保護されたデモデータを読み込む');
    expect(html).toContain('外部データ未接続');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).toContain('ローカル分析パックJSONを読み込む（開発用）');
    expect(html).toContain('未読込');
    expect(html).toContain('将来構想');
    expect(html).toContain('WEB情報');
    expect(html).toContain('企業プレスリリース');
    expect(html).toContain('新聞情報');
    expect(html).toContain('株主総会情報・事業方針');
    expect(html).toContain('準備中');
    expect(html).toContain('現在の分析には使用しません。');
    expect(html).toContain('出力部門（任意）');
    const stepPositions = [
      '1. 分析対象を決める',
      '2. 見たい領域を決める',
      '3. 対象となる意匠情報を決める',
      '4. 対象期間を決める',
      '5. 分析目的を選ぶ',
    ].map((label) => html.indexOf(label));
    expect(stepPositions.every((position) => position >= 0)).toBe(true);
    expect(stepPositions).toEqual([...stepPositions].sort((left, right) => left - right));
    expect(html).not.toContain('order-3');
    expect(html).not.toContain('order-4');
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
        onProtectedDemoData: vi.fn(),
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
        request: { ...request, scope: { mode: 'companies', companies: [] } },
        companyInput: '',
        companyOptions: ['サンプル電機株式会社', '架空モビリティ株式会社'],
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
        onProtectedDemoData: vi.fn(),
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
