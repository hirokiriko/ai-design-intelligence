import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HosoeAnalysisPack, HosoeAnalysisRecord } from '../domain/types';
import { HosoeAnalysisPackPanel } from './HosoeAnalysisPackPanel';

const candidateMode = ['dTermWIncluded', 'Candidate'].join('');
const softBankGroup = ['Soft', 'Bank'].join('');
const companyGroups = ['Apple', 'NTT DOCOMO', 'LINE Yahoo候補', softBankGroup, 'PayPay', 'Google'];

function makeRecord(index: number, companyGroup: string, confirmed: boolean): HosoeAnalysisRecord {
  const serial = String(index + 1).padStart(3, '0');
  return {
    id: `local-analysis-fixture-${serial}`,
    matchedCompanyGroup: companyGroup,
    applicationNumber: `SAMPLE-LOCAL-APP-${serial}`,
    applicationDate: '2025-05-01',
    dateUsedForFilter: '2025-05-01',
    dateUsedType: 'applicationDate',
    registrationNumber: `SAMPLE-LOCAL-REG-${serial}`,
    registrationDate: '2026-05-01',
    gazetteDate: confirmed ? '2026-06-09' : '2026-06-08',
    designClass: confirmed ? 'N310W' : 'N311W',
    designClassNormalized: confirmed ? 'N310W' : 'N311W',
    articleName: confirmed ? '架空操作用画像' : '架空情報表示画像',
    applicants: confirmed ? ['架空端末デザイン株式会社'] : [],
    rightHolders: confirmed ? ['架空端末ホールディングス株式会社'] : ['架空通信デザイン株式会社'],
    matchedRole: confirmed ? 'both' : 'rightHolder',
    matchedName: ['架空照合名株式会社'],
    matchedAlias: [confirmed ? '架空端末A' : '架空通信B'],
    wFilterMode: candidateMode,
    classificationNote: '日本意匠分類の文字列内にWを含む一次抽出候補です。',
    vTerms: confirmed ? ['VAA', 'VNA'] : [],
    vTermReviewStatus: confirmed ? 'confirmed' : 'sourceGazetteUnavailable',
    vTermReviewNote: confirmed ? '架空公報データで確認済み。' : '公報データ未接続のため未確認。',
  };
}

const records = [
  ...Array.from({ length: 15 }, (_, index) => makeRecord(index, companyGroups[0], true)),
  ...Array.from({ length: 5 }, (_, index) => makeRecord(index + 15, companyGroups[1], false)),
];

const pack: HosoeAnalysisPack = {
  fileName: 'sample-local-analysis-pack.json',
  title: '専門家レビュー用：架空スマホ関連企業の画像意匠',
  version: 'v3-audited-fixture',
  createdAt: '2026-07-13T00:00:00.000Z',
  dateFrom: '2020-04-01',
  dateFieldPolicy: 'applicationDate or internationalApplicationDate',
  dataScopeNote: '架空の月次プレビューデータ。全量ではありません。',
  isComprehensive: false,
  sourceRecordCount: 21,
  strictPrefixWCount: 0,
  dTermWIncludedCandidateCount: 20,
  companySummaries: companyGroups.map((companyGroup, index) => {
    const count = index === 0 ? 15 : index === 1 ? 5 : 0;
    return {
      companyGroup,
      dTermWIncludedCandidateCount: count,
      strictPrefixWCount: 0,
      applicantHitCount: index === 0 ? 15 : 0,
      rightHolderHitCount: count,
      matchedRoleBreakdown: count > 0 ? `${index === 0 ? 'both' : 'rightHolder'}: ${count}件` : '該当なし',
      representativeDesignClasses: count > 0 ? [`${index === 0 ? 'N310W' : 'N311W'} (${count}件)`] : [],
      representativeArticleNames: count > 0 ? [`架空画像 (${count}件)`] : [],
      note:
        count > 0
          ? '手元データ範囲の暫定値'
          : companyGroup === softBankGroup
            ? '手元データ範囲・現在の分類・名寄せ条件では未検出'
            : '手元データ内で未検出。実際に出願・登録がないことを意味しません',
    };
  }),
  yearlyTrend: [
    { companyGroup: companyGroups[0], year: '2025', count: 15 },
    { companyGroup: companyGroups[1], year: '2025', count: 5 },
  ],
  byDesignClass: [
    { companyGroup: companyGroups[0], designClass: 'N310W', count: 15 },
    { companyGroup: companyGroups[1], designClass: 'N311W', count: 5 },
  ],
  byArticleName: [
    { companyGroup: companyGroups[0], articleName: '架空操作用画像', count: 15 },
    { companyGroup: companyGroups[1], articleName: '架空情報表示画像', count: 5 },
  ],
  records,
  audit: {
    initialAutomaticCount: 21,
    auditedCount: 20,
    excludedCount: 1,
    excludedRecords: [
      {
        id: 'FICTIONAL-EXCLUDED-001',
        originalName: '架空別会社株式会社',
        reason: '短い別名 XY が、別会社名 架空別会社 の文字列内に部分一致したため',
      },
    ],
  },
  vTermSummary: {
    confirmedCount: 15,
    unconfirmedCount: 5,
    unconfirmedCompanyGroups: ['NTT DOCOMO'],
    unconfirmedGazetteDates: ['2026-06-08'],
  },
  warnings: [],
};

function expectNearby(html: string, label: string, value: string) {
  const labelIndex = html.indexOf(label);
  expect(labelIndex).toBeGreaterThanOrEqual(0);
  expect(html.slice(labelIndex, labelIndex + 600)).toContain(value);
}

describe('HosoeAnalysisPackPanel', () => {
  it('renders the audited 20-record canonical review with the six-company split and cautious zero wording', () => {
    const html = renderToStaticMarkup(createElement(HosoeAnalysisPackPanel, { pack }));

    expect(html).toContain('専門家レビュー：スマホ関連6社の画像意匠候補・抽出ロジック検証');
    expect(html).toContain('企業名照合・分類・根拠レコードを監査したローカル暫定検証です');
    expect(html).toContain('日本意匠分類にWを含む監査済み画像意匠候補');
    expect(html).toContain('Apple');
    expectNearby(html, 'Apple', '15件');
    expectNearby(html, 'NTT DOCOMO', '5件');
    expectNearby(html, 'LINE Yahoo候補', '0件（手元データ内で未検出。実際に出願・登録がないことを意味しません）');
    expectNearby(html, softBankGroup, '0件（手元データ内で未検出。実際に出願・登録がないことを意味しません）');
    expectNearby(html, 'PayPay', '0件（手元データ内で未検出。実際に出願・登録がないことを意味しません）');
    expectNearby(html, 'Google', '0件（手元データ内で未検出。実際に出願・登録がないことを意味しません）');
    expect(html).toContain('その他4社：手元データ内で未検出');
    expect(html).toContain('0件（手元データ内で未検出。実際に出願・登録がないことを意味しません）');
    expect(html).toContain('手元データ範囲・現在の分類・名寄せ条件では未検出');
  });

  it('shows the exclusion audit as an auditable correction and keeps the initial strict condition in history only', () => {
    const html = renderToStaticMarkup(createElement(HosoeAnalysisPackPanel, { pack }));

    expect(html).toContain('抽出結果の監査');
    expectNearby(html, '初回自動抽出', '21件');
    expectNearby(html, '監査後', '20件');
    expectNearby(html, '除外', '1件');
    expect(html).toContain('除外record');
    expect(html).toContain('FICTIONAL-EXCLUDED-001');
    expect(html).toContain('架空別会社株式会社');
    expect(html).toContain('分析結果から元レコードへ戻り、企業名の照合根拠を確認することで、名寄せの誤抽出を検出・修正しています');
    expect(html.indexOf('分類先頭がW')).toBeGreaterThan(html.indexOf('抽出方式の検討履歴'));
    expect(html).not.toContain(['strict', 'PrefixW'].join(''));
    expect(html).not.toContain(['dTermWIncluded', 'Candidate'].join(''));
  });

  it('separates V-term confirmation from absence and renders all requested limitations and review questions', () => {
    const html = renderToStaticMarkup(createElement(HosoeAnalysisPackPanel, { pack }));

    expect(html).toContain('V系画像共通Dタームの確認状況');
    expectNearby(html, 'V系Dターム確認済み', '15件');
    expectNearby(html, '公報データ未接続のため未確認', '5件');
    expect(html).toContain('すべてNTT DOCOMO');
    expect(html).toContain('2026-06-08');
    expect(html).toContain('現在の手元公報データでは確認できていません');
    expect(html).toContain('未確認は、V系Dタームが存在しないことを意味しません');
    expect(html).not.toContain('Dタームなし');
    expect(html).not.toContain('Dタームが付与されていない');
    expect(html).toContain('A. 検証仮説');
    expect(html).toContain('細江さんから提示された検証仮説');
    expect(html).toContain('B. 現在の観測');
    expect(html).toContain('C. このデータだけでは結論できないこと');
    expect(html).toContain('0件は、実際に出願・登録がないことを意味しません');
    expect(html).not.toContain('0件は実際の不存在を意味しません');
    expect(html).toContain('名寄せ、関連会社、旧社名による取りこぼしの可能性があります');
    expect(html).toContain(
      '日本意匠分類のW含有は画像意匠候補を探す大きな分類棚、V系の画像共通Dタームは画像の内容・用途を詳しく見る細かなタグです',
    );
    expect(html).toContain('日本意匠分類のW含有と、画像共通DタームのV系分類は別の分類軸です');
    expect(html).toContain('安立先生に確認したい事項');
    for (const question of [
      '日本意匠分類のW含有を画像意匠候補の一次抽出に使うことは妥当か',
      '画像共通DタームのV系分類をどの段階で併用すべきか',
      '登録公報XMLのV系Dタームを分析レコードへ付与してよいか',
      '複数のV系Dタームを企業比較で集計する適切な単位は何か',
      '比較基準日は出願日、国際出願日、登録日、公報発行日のどれが適切か',
      '出願人と権利者のどちらを企業比較の主軸にすべきか',
      '短い企業別名は完全一致のみにすべきか',
      'LINE、Yahoo、Z Holdings、LINE Yahooのグループ範囲をどう扱うべきか',
      '公報データ未接続のrecordを比較時にどう表示すべきか',
      '少数件・0件から戦略上の示唆を出す前に何を追加確認すべきか',
      '弁理士実務で次に必要なのは、先行意匠検索、図面、関連意匠、創作者、代理人、審査官のどの情報か',
      '企業知財・商品企画部門向けに有効な出力は何か',
    ]) {
      expect(html).toContain(question);
    }
  });

  it('renders all 20 evidence records with the requested audit fields and safe missing-value labels', () => {
    const html = renderToStaticMarkup(createElement(HosoeAnalysisPackPanel, { pack }));

    expect(html).toContain('根拠20件の監査表示（20件）');
    expect(html).toContain('企業グループ');
    expect(html).toContain('元の出願人名');
    expect(html).toContain('元の権利者名');
    expect(html).toContain('matchedAlias');
    expect(html).toContain('matchedRole');
    expect(html).toContain('出願日');
    expect(html).toContain('国際出願日');
    expect(html).toContain('登録日');
    expect(html).toContain('公報発行日');
    expect(html).toContain('出願番号');
    expect(html).toContain('登録番号');
    expect(html).toContain('日本意匠分類原文');
    expect(html).toContain('正規化後分類');
    expect(html).toContain('物品名');
    expect(html).toContain('V系Dターム');
    expect(html).toContain('vTermReviewStatus');
    expect(html).toContain('sourceUpdateDate');
    expect(html).toContain('classificationNote');
    expect(html).toContain('未収録');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });
});
