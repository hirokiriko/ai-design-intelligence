import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisRequest } from '../../domain/types';
import { getDesignKindSelectionStatus, resolveDesignKinds } from '../../domain/selection';
import type { BackendContractAdapterSuccess } from '../../data/BackendContractDataSource';
import { loadDesignJsonText, loadDesignJsonValue } from '../../data/DesignJsonFileLoader';
import type { BackendContractAcquisition } from '../../domain/backendContractAcquisition';
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
    expect(getDesignKindSelectionStatus(false)).toContain('自動設定中です。');
    expect(getDesignKindSelectionStatus(true)).toContain('手動設定中です。');
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
        technicalDetailsInitiallyOpen: true,
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
        onRequestChange: vi.fn(),
        onCompanyInputChange: vi.fn(),
        onAddCompany: vi.fn(),
        onRemoveCompany: vi.fn(),
        onAnalyze: vi.fn(),
        onLocalJsonFile: vi.fn(),
        onApprovedPublicDesignDemoChange: vi.fn(),
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
    expect(html).toContain('プリセットA：家電・映像機器');
    expect(html).toContain('プリセットB：画像意匠');
    expect(html).not.toContain('Backend推奨：受理レコード全体');
    expect(html).toContain('分析を開始');
    expect(html).toContain('6. 結果と根拠を確認する');
    expect(html).toContain('外部データ未接続');
    const dataDetailsIndex = html.indexOf('詳細設定・データ情報');
    ['デモ用サンプルデータ', 'ルールベース分析', '外部データ未接続'].forEach((label) => {
      expect(html.indexOf(label)).toBeGreaterThan(dataDetailsIndex);
    });
    expect(html).toMatch(/<details[^>]*\bopen(?:=|>)/i);
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
    expect(html).toContain('住宅設備');
    expect(html).toContain('モビリティ');
    const stepLabels = [
      '1. 分析対象を決める',
      '2. 見たい領域を決める',
      '3. 対象となる意匠情報を決める',
      '4. 対象期間を決める',
      '5. 分析目的を選ぶ',
      '6. 結果と根拠を確認する',
    ];
    const stepSequence = Array.from(
      html.matchAll(/1\. 分析対象を決める|2\. 見たい領域を決める|3\. 対象となる意匠情報を決める|4\. 対象期間を決める|5\. 分析目的を選ぶ|6\. 結果と根拠を確認する/g),
      (match) => match[0],
    );
    expect(stepSequence).toEqual(stepLabels);
    expect(html.indexOf('6. 結果と根拠を確認する')).toBeLessThan(html.indexOf('詳細設定・データ情報'));
    expect(html).not.toMatch(/\b(?:[a-z]+:)*order-[^\s"]+/);
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
        technicalDetailsInitiallyOpen: true,
        externalDemoMode: true,
        demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
        hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
        onRequestChange: vi.fn(),
        onCompanyInputChange: vi.fn(),
        onAddCompany: vi.fn(),
        onRemoveCompany: vi.fn(),
        onAnalyze: vi.fn(),
        onLocalJsonFile: vi.fn(),
        onApprovedPublicDesignDemoChange: vi.fn(),
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

  it('shows an auditable, non-persistent classification control for Backend Contracts', () => {
    const fixtureContract = loadContractFixture();
    const testContract = loadContractFixture('TEST-CONTRACT-PUBLIC-SAFE-V1');
    const fictionalHtml = renderBackendSettings(fixtureContract, 'fictional_contract_fixture', undefined, true);
    const unclassifiedHtml = renderBackendSettings(testContract, 'unclassified_contract', undefined, true);
    const approvedHtml = renderBackendSettings(testContract, 'approved_public_design_demo', undefined, true);

    expect(fictionalHtml).toContain('架空の検証データ');
    expect(fictionalHtml).toContain('fictional_contract_fixture');
    expect(fictionalHtml).toContain('架空Contract fixtureとして固定');
    expect(fictionalHtml).not.toContain('承認済み公開意匠デモデータとして表示する');

    expect(unclassifiedHtml).toContain('データ区分を確認中');
    expect(unclassifiedHtml).toContain('unclassified_contract');
    expect(unclassifiedHtml).toContain('承認済み公開意匠デモデータとして表示する');
    expect(unclassifiedHtml).toContain('別ファイルの選択や再読込では引き継ぎません');
    expect(approvalControl(unclassifiedHtml)).not.toContain('checked=""');

    expect(approvedHtml).toContain('公開意匠データ');
    expect(approvedHtml).toContain('approved_public_design_demo');
    expect(approvalControl(approvedHtml)).toContain('checked=""');

    for (const html of [fictionalHtml, unclassifiedHtml, approvedHtml]) {
      expect(html).toContain('公開意匠データ：全体を俯瞰');
      expect(html).toContain('商品・事業領域を固定せず、直近2年の公開意匠データを把握');
      expect(html).not.toContain('プリセットA：家電・映像機器');
      expect(html).not.toContain('プリセットB：画像意匠');
      expect(html).toContain('ローカルJSONを読み込む');
      expect(html).not.toContain('ローカル実データJSONを読み込む');
    }
  });

  it('removes every local acquisition control from authenticated trial markup', () => {
    const contract = loadContractFixture('TEST-AUTHENTICATED-TRIAL-PUBLIC-SAFE-V1');
    const initialHtml = renderBackendSettings(contract, 'approved_public_design_demo', 'authenticated_trial');
    const html = renderBackendSettings(contract, 'approved_public_design_demo', 'authenticated_trial', true);

    expect(initialHtml).toContain('公開意匠データ');
    expect(initialHtml).toContain('技術・検証情報');
    expect(initialHtml).not.toContain('Backend Contract');
    expect(initialHtml).not.toContain('accepted');
    expect(initialHtml).not.toContain('excluded');
    expect(initialHtml).not.toContain('adapter');

    expect(html).toContain('Backend Contract自動取得済み');
    expect(html).toContain('認証済みセッションで同一オリジンから取得');
    expect(html).toContain('contract version');
    expect(html).toContain('analysis cutoff');
    expect(html).toContain('total / accepted / excluded');
    expect(html).not.toMatch(/<input[^>]+type="file"/i);
    expect(html).not.toContain('承認済み公開意匠デモデータとして表示する');
    expect(html).not.toContain('利用承認');
    expect(html).not.toContain('File API');
    expect(html).not.toContain('手動選択');
    expect(html).not.toContain('サンプルデータに戻す');
    expect(html).not.toContain('ローカルJSONを読み込む');
    expect(html).not.toContain('デモ候補JSONを読み込む');
    expect(html).not.toContain('ローカル分析パックJSONを読み込む');
    expect(html).not.toContain('contract-test.json');
    expect(html).not.toContain('承認');
    expect(html).not.toContain('ファイル');
    expect(html).not.toContain('手動');
    expect(html).not.toContain('サンプル');
  });

  it('keeps Backend technical terms out of the initial customer markup', () => {
    const contract = loadContractFixture();
    const html = renderBackendSettings(contract, 'fictional_contract_fixture');

    expect(html).toContain('3. 対象となる意匠情報を決める');
    expect(html).toContain('公開意匠データ');
    expect(html).toContain('技術・検証情報');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('accepted');
    expect(html).not.toContain('excluded');
    expect(html).not.toContain('adapter');
    expect(html).not.toContain('fictional_contract_fixture');
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
        onApprovedPublicDesignDemoChange: vi.fn(),
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

function loadContractFixture(exportId?: string): BackendContractAdapterSuccess {
  const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const routed = exportId
    ? loadDesignJsonValue({ ...(JSON.parse(fixtureText) as Record<string, unknown>), exportId }, 'contract-test.json')
    : loadDesignJsonText(fixtureText, 'design-export-fictional.json');
  if (routed.kind !== 'backend_contract' || !routed.result.ok) {
    throw new Error('Expected a valid Backend Contract test input.');
  }
  return routed.result;
}

function renderBackendSettings(
  adapted: BackendContractAdapterSuccess,
  classification: 'fictional_contract_fixture' | 'approved_public_design_demo' | 'unclassified_contract',
  backendContractAcquisition?: BackendContractAcquisition,
  technicalDetailsInitiallyOpen = false,
): string {
  return renderToStaticMarkup(
    createElement(SettingsPanel, {
      request,
      companyInput: '',
      errors: {},
      isRunning: false,
      localJpoState: { status: 'backend_loaded', fileName: 'contract-test.json', adapted, classification },
      backendContractAcquisition,
      enableLocalAnalysisPack: false,
      technicalDetailsInitiallyOpen,
      externalDemoMode: true,
      demoShowcaseState: { status: 'empty', warnings: [], errors: [] },
      hosoeAnalysisPackState: { status: 'empty', warnings: [], errors: [] },
      onRequestChange: vi.fn(),
      onCompanyInputChange: vi.fn(),
      onAddCompany: vi.fn(),
      onRemoveCompany: vi.fn(),
      onAnalyze: vi.fn(),
      onLocalJsonFile: vi.fn(),
      onApprovedPublicDesignDemoChange: vi.fn(),
      onResetToSampleData: vi.fn(),
      onExternalDemoModeChange: vi.fn(),
      onDemoShowcaseFile: vi.fn(),
      onClearDemoShowcase: vi.fn(),
      onHosoeAnalysisPackFile: vi.fn(),
      onClearHosoeAnalysisPack: vi.fn(),
    }),
  );
}

function approvalControl(html: string): string {
  const marker = '承認済み公開意匠デモデータとして表示する';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return '';
  const startIndex = html.lastIndexOf('<label', markerIndex);
  const endIndex = html.indexOf('</label>', markerIndex);
  return startIndex === -1 || endIndex === -1 ? '' : html.slice(startIndex, endIndex + '</label>'.length);
}
