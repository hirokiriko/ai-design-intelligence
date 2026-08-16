import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App, {
  AnalysisWorkspace,
  TrialBootstrapPanel,
  TrialModeApp,
} from './App';
import {
  adaptBackendDesignExport,
  type BackendContractAdapterSuccess,
} from './data/BackendContractDataSource';
import type { TrialBackendContractErrorCode } from './data/TrialBackendContractLoader';

describe('App primary task flow', () => {
  it('starts every fresh mount in sample mode without a persisted Contract classification', () => {
    const firstMount = renderToStaticMarkup(createElement(App));
    const reloadedMount = renderToStaticMarkup(createElement(App));

    for (const html of [firstMount, reloadedMount]) {
      expect(html).toContain('サンプルデータ版です。');
      expect(html).not.toContain('公開意匠実データを使用中');
      expect(html).not.toContain('fictional_contract_fixture');
      expect(html).not.toContain('approved_public_design_demo');
      expect(html).not.toContain('unclassified_contract');
    }
  });

  it('explains the product, six-step flow, and sample-data boundary before analysis', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('KIRIKO Design Signals');
    expect(html).toContain('サンプルデータ版です。');
    expect(html).toContain('すべて架空');
    expect(html).toContain('実在企業・実在公報ではありません');
    expect(html).toContain('意匠情報から、市場・企業・商品化領域の先行シグナルを捉える');
    expect(html).toContain('対象を決める');
    expect(html).toContain('1. 分析対象を決める');
    expect(html).toContain('2. 見たい領域を決める');
    expect(html).toContain('3. 対象となる意匠情報を決める');
    expect(html).toContain('4. 対象期間を決める');
    expect(html).toContain('5. 分析目的を選ぶ');
    expect(html).toContain('6. 結果と根拠を確認する');
    expect(html).toContain('詳細設定・データ情報');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('分析を開始');
    expect(html).toContain('分析すると得られること');
    expect(html).toContain('tabindex="-1"');
    const formalStepLabels = [
      '1. 分析対象を決める',
      '2. 見たい領域を決める',
      '3. 対象となる意匠情報を決める',
      '4. 対象期間を決める',
      '5. 分析目的を選ぶ',
      '6. 結果と根拠を確認する',
    ];
    const formalStepSequence = Array.from(
      html.matchAll(/1\. 分析対象を決める|2\. 見たい領域を決める|3\. 対象となる意匠情報を決める|4\. 対象期間を決める|5\. 分析目的を選ぶ|6\. 結果と根拠を確認する/g),
      (match) => match[0],
    );
    expect(formalStepSequence).toEqual(formalStepLabels);
    expect(html.indexOf(formalStepLabels[0])).toBeLessThan(html.indexOf('詳細設定・データ情報'));

    const overviewFlow = html.match(/<ul aria-label="分析の流れ"[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(overviewFlow).not.toBe('');
    expect(overviewFlow).not.toMatch(/>\s*[123]\s*</);

    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(header).not.toBe('');
    ['デモ用サンプルデータ', 'ルールベース分析', '外部データ未接続'].forEach((label) => {
      expect(header).not.toContain(label);
      expect(html).toContain(label);
    });
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

describe('authenticated trial bootstrap', () => {
  it('renders only the loading gate before the Contract request succeeds', () => {
    const html = renderToStaticMarkup(
      createElement(TrialModeApp, {
        loadContract: async () => ({
          ok: false,
          code: 'unavailable',
          message: '限定試用データを読み込めませんでした。',
        }),
      }),
    );

    expect(html).toContain('限定試用データを読み込んでいます');
    expect(html).toContain('認証済みセッションからBackend Contractを取得');
    expect(html).not.toContain('サンプルデータ版です。');
    expect(html).not.toMatch(/<input\b/i);
    expect(html).not.toContain('承認済み公開意匠デモデータとして表示する');
  });

  it('distinguishes public-safe trial failures and offers retry without exposing input UI', () => {
    const cases: Array<[TrialBackendContractErrorCode, string, boolean]> = [
      ['authentication_required', '認証または利用権限の確認が必要です', true],
      ['expired', '限定試用の利用期間が終了しました', false],
      ['data_unavailable', '限定試用データがまだ配置されていません', true],
      ['invalid_contract', '限定試用データを検証できません', false],
      ['unavailable', '限定試用データを一時的に利用できません', true],
    ];

    cases.forEach(([code, title, canRetry]) => {
      const html = renderToStaticMarkup(
        createElement(TrialBootstrapPanel, {
          state: { status: 'error', code, message: '安全な顧客向け案内です。' },
          onRetry: canRetry ? () => undefined : undefined,
        }),
      );

      expect(html).toContain(title);
      expect(html).toContain('role="alert"');
      if (canRetry) {
        expect(html).toContain(
          code === 'authentication_required' ? '認証後に再読込' : 'もう一度読み込む',
        );
      } else {
        expect(html).not.toContain('もう一度読み込む');
        expect(html).not.toContain('認証後に再読込');
      }
      expect(html).not.toMatch(/<input\b/i);
      expect(html).not.toContain('/api/trial/design-export');
    });
  });

  it('fails closed on an invalid public mode without a sample workspace', () => {
    const html = renderToStaticMarkup(
      createElement(TrialBootstrapPanel, {
        state: {
          status: 'configuration_error',
          message: '公開アプリの動作モードを確認できませんでした。',
        },
      }),
    );

    expect(html).toContain('限定試用モードの設定を確認できません');
    expect(html).not.toContain('サンプルデータ版です。');
    expect(html).not.toContain('もう一度読み込む');
  });

  it('initializes a successful trial directly in the Backend safe preset with no file or approval UI', () => {
    const contract = loadTestContract('TEST-AUTHENTICATED-TRIAL-PUBLIC-DESIGN-V1');
    const html = renderToStaticMarkup(
      createElement(AnalysisWorkspace, {
        initialBackendContract: contract,
        backendContractAcquisition: 'authenticated_trial',
      }),
    );

    expect(html).toContain('公開意匠実データを使用中');
    expect(html).toContain('認証後に自動取得した週次更新差分');
    expect(html).toContain('Backend推奨：受理レコード全体');
    expect(html).toContain('傾向把握：直近2年');
    expect(html).toContain('認証後に自動取得したBackend Contract');
    expect(html).not.toMatch(/<input[^>]+type="file"/i);
    expect(html).not.toContain('承認済み公開意匠デモデータとして表示する');
    expect(html).not.toContain('サンプルデータに戻す');
    expect(html).not.toContain('File API');
    expect(html).not.toContain('手動選択');
    expect(html).not.toContain('リモートBackend API');
    expect(html).not.toContain('プリセットA');
    expect(html).not.toContain('プリセットB');
  });

  it('keeps fixture classification fictional in the authenticated trial workspace', () => {
    const fixture = loadTestContract();
    const html = renderToStaticMarkup(
      createElement(AnalysisWorkspace, {
        initialBackendContract: fixture,
        backendContractAcquisition: 'authenticated_trial',
      }),
    );

    expect(html).toContain('架空Contract検証データを使用中');
    expect(html).not.toContain('公開意匠実データを使用中');
    expect(html).not.toMatch(/<input[^>]+type="file"/i);
  });
});

function loadTestContract(exportId?: string): BackendContractAdapterSuccess {
  const fixturePath = path.resolve(
    'fixtures',
    'backend-contract-v0.1.0',
    'design-export-fictional.json',
  );
  const value = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
  const adapted = adaptBackendDesignExport(exportId ? { ...value, exportId } : value);
  if (!adapted.ok) throw new Error('Expected a valid fictional Contract fixture.');
  return adapted;
}
