import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BackendContractAdapterSuccess } from '../../data/BackendContractDataSource';
import {
  classifyBackendContractData,
  type BackendContractDataClassification,
} from '../../data/BackendContractDataClassification';
import { loadDesignJsonText, loadDesignJsonValue } from '../../data/DesignJsonFileLoader';
import type { BackendContractAcquisition } from '../../domain/backendContractAcquisition';
import { DataUsageBanner } from './DataUsageBanner';

const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');

describe('DataUsageBanner', () => {
  it('loads the repository Contract fixture through the Adapter without asserting real-data use', () => {
    const routed = loadDesignJsonText(fixtureText, 'design-export-fictional.json');
    const contract = requireBackendContract(routed);
    const classification = classifyBackendContractData({
      exportId: contract.meta.exportId,
      approvedPublicDesignDemo: true,
    });
    const html = renderBackendBanner(contract, classification);

    expect(classification).toBe('fictional_contract_fixture');
    expect(html).toContain('架空の検証データを使用中');
    expect(html).toContain('完全架空データ');
    expect(html).toContain('実在企業・実在公報ではなく');
    expect(html).not.toContain('公開意匠データを使用中');
    expect(html).not.toContain('Contract');
  });

  it('shows the real-data banner and dynamic Contract values only after explicit local approval', () => {
    const contract = loadPublicSafeTestContract('TEST-APPROVED-PUBLIC-DESIGN-DEMO-V1');
    const classification = classifyBackendContractData({
      exportId: contract.meta.exportId,
      approvedPublicDesignDemo: true,
    });
    const html = renderBackendBanner(contract, classification);

    expect(classification).toBe('approved_public_design_demo');
    expect(html).toContain('公開意匠データを使用中');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('分析対象件数');
    expect(html).toContain(`${new Intl.NumberFormat('ja-JP').format(contract.summary.acceptedCount)}件`);
    expect(html).toContain(formatExpectedDate(contract.meta.analysisCutoff));
    expect(html).toContain('公開意匠データを対象に、ルールベースで集計した参考情報です');
    expect(html).toContain('日本の全意匠や最新の法的状態を示すものではなく');
    expect(html).toContain('法的判断には使用できません');
    expect(html).not.toContain('ブラウザのメモリ');
    expect(html).not.toContain('公開Preview');
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('accepted');
    expect(html).not.toContain('excluded');
    expect(html).not.toContain('adapter');
    expect(html).not.toContain('analysis-ready');
    expect(html).not.toContain('架空の検証データを使用中');
    expect(html).not.toContain('データ区分を確認中');
  });

  it('uses authenticated trial wording without manual acquisition or approval claims', () => {
    const contract = loadPublicSafeTestContract('TEST-AUTHENTICATED-TRIAL-PUBLIC-DESIGN-V1');
    const classification = classifyBackendContractData({
      exportId: contract.meta.exportId,
      approvedPublicDesignDemo: true,
    });
    const html = renderBackendBanner(contract, classification, 'authenticated_trial');

    expect(html).toContain('公開意匠データを使用中');
    expect(html).toContain(`${new Intl.NumberFormat('ja-JP').format(contract.summary.acceptedCount)}件`);
    expect(html).toContain(formatExpectedDate(contract.meta.analysisCutoff));
    expect(html).toContain('公開意匠データを対象に、ルールベースで集計した参考情報です');
    expect(html).toContain('日本の全意匠や最新の法的状態を示すものではなく');
    expect(html).toContain('法的判断には使用できません');
    expect(html).not.toContain('認証後');
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('accepted');
    expect(html).not.toContain('excluded');
    expect(html).not.toContain('adapter');
    expect(html).not.toContain('ブラウザのメモリ');
    expect(html).not.toContain('File API');
    expect(html).not.toContain('手動');
    expect(html).not.toContain('利用承認');
    expect(html).not.toContain('公開Preview・公開ビルドには含めません');
  });

  it('keeps a valid but unclassified Contract neutral', () => {
    const contract = loadPublicSafeTestContract('TEST-UNCLASSIFIED-CONTRACT-V1');
    const classification = classifyBackendContractData({ exportId: contract.meta.exportId });
    const html = renderBackendBanner(contract, classification);

    expect(classification).toBe('unclassified_contract');
    expect(html).toContain('データ区分を確認中');
    expect(html).toContain('データ区分は未確認です');
    expect(html).toContain('公開意匠データとは断定しません');
    expect(html).not.toContain('公開意匠データを使用中');
    expect(html).not.toContain('架空の検証データを使用中');
    expect(html).not.toContain('Contract');
  });

  it('keeps sample and legacy explanations separate from Contract classifications', () => {
    const sampleHtml = renderToStaticMarkup(createElement(DataUsageBanner, { mode: 'sample' }));
    const legacyHtml = renderToStaticMarkup(createElement(DataUsageBanner, { mode: 'legacy' }));

    expect(sampleHtml).toContain('サンプルデータ版です。');
    expect(sampleHtml).toContain('すべて架空');
    expect(sampleHtml).not.toContain('公開意匠データを使用中');
    expect(sampleHtml).not.toContain('データ区分を確認中');
    expect(sampleHtml).not.toContain('ローカル検証データを使用中');

    expect(legacyHtml).toContain('ローカル検証データを使用中です。');
    expect(legacyHtml).not.toContain('公開意匠データを使用中');
    expect(legacyHtml).not.toContain('データ区分を確認中');
    expect(legacyHtml).not.toContain('サンプルデータ版');
  });
});

function loadPublicSafeTestContract(exportId: string): BackendContractAdapterSuccess {
  const fixture = JSON.parse(fixtureText) as Record<string, unknown>;
  const routed = loadDesignJsonValue({ ...fixture, exportId }, 'public-safe-contract-test.json');
  return requireBackendContract(routed);
}

function requireBackendContract(
  routed: ReturnType<typeof loadDesignJsonText> | ReturnType<typeof loadDesignJsonValue>,
): BackendContractAdapterSuccess {
  if (routed.kind !== 'backend_contract' || !routed.result.ok) {
    throw new Error('Expected a valid Backend Contract test input.');
  }
  return routed.result;
}

function renderBackendBanner(
  contract: BackendContractAdapterSuccess,
  classification: BackendContractDataClassification,
  acquisition?: BackendContractAcquisition,
): string {
  return renderToStaticMarkup(
    createElement(DataUsageBanner, {
      mode: 'backend',
      classification,
      acceptedCount: contract.summary.acceptedCount,
      analysisCutoff: contract.meta.analysisCutoff,
      acquisition,
    }),
  );
}

function formatExpectedDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
