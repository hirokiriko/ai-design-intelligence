import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisRequest, AnalysisResult, DemoShowcaseRecord, DesignRecord } from '../../domain/types';
import type { LocalJpoDatasetSummary } from '../../data/LocalJpoJsonDataSource';
import { ResultsArea } from './ResultsArea';

const request: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  period: 'last_1y',
  designKinds: ['article', 'image', 'interior'],
  purposes: ['market_trend'],
  departments: ['product_planning'],
  includeUnresolvedApplicants: true,
};

const records: DesignRecord[] = [
  {
    id: 'fixture-with-keys',
    sourceUpdateDate: '2026-06-24',
    registrationNumber: 'SAMPLE-REG-FIX-001',
    applicationNumber: 'SAMPLE-APP-FIX-001',
    applicationDate: '2025-09-05',
    registrationDate: '2026-06-09',
    gazetteDate: '2026-06-19',
    applicant: 'サンプル電機株式会社',
    businessDomain: '架空分類 N3-11W',
    designKind: 'image',
    articleName: 'サンプル操作用画像',
    designClass: 'S-N3-11',
    keywords: ['操作用画像'],
    designFeatures: ['画像図'],
    sourceLabel: 'ローカル実データJSON',
    sourceDataset: 'LOCAL_FIXTURE_DESIGN',
    isSample: false,
    gazetteDrawingKeys: {
      source: 'fixture_registered_design_gazette',
      issueDate: '2026-06-23',
      issueNumber: 'SAMPLE-ISSUE-FIX-001',
      matchedBy: 'registrationAndApplication',
      gazetteDateFromXml: '2026-06-23',
      gazetteDateMismatch: true,
      publicationDocumentId: 'SAMPLE-PUBLICATION-FIX-001',
      hasDrawingRefs: true,
      drawingRefCount: 1,
      sourceXmlFile: 'sample-publication-meta-fixture-001.xml',
      drawingRefs: [
        {
          label: '画像図',
          fileName: 'sample-drawing-fixture-001.png',
          fileType: 'jpg',
          order: 1,
          isRepresentativeCandidate: false,
          sourceXmlFile: 'sample-publication-meta-fixture-001.xml',
        },
      ],
      note: '画像本体はapp側に渡していません。',
    },
  },
  {
    id: 'fixture-without-keys',
    registrationNumber: 'SAMPLE-REG-FIX-002',
    applicationNumber: 'SAMPLE-APP-FIX-002',
    gazetteDate: '2026-06-23',
    applicant: 'デモ住設株式会社',
    businessDomain: '架空分類 B3430',
    designKind: 'article',
    articleName: 'サンプル収納ケース',
    designClass: 'S-B3-43',
    keywords: ['収納ケース'],
    designFeatures: [],
    sourceLabel: 'ローカル実データJSON',
    isSample: false,
    gazetteDrawingKeys: null,
  },
];

const publicSampleRecords: DesignRecord[] = records.map((record, index) => ({
  ...record,
  id: `SAMPLE-DESIGN-FIX-${index + 1}`,
  registrationNumber: `SAMPLE-REG-PUBLIC-${index + 1}`,
  applicationNumber: `SAMPLE-APP-PUBLIC-${index + 1}`,
  applicant: index === 0 ? 'サンプル電機株式会社' : 'デモ住設株式会社',
  applicantsDisplay: index === 0 ? 'サンプル電機株式会社' : 'デモ住設株式会社',
  businessDomain: index === 0 ? '家電・映像機器' : '住宅設備',
  sourceLabel: '公開デモ用サンプルデータ',
  sourceDataset: 'PUBLIC_SAMPLE_DESIGN_DEMO',
  isSample: true,
  gazetteDrawingKeys:
    index === 0
      ? {
          source: 'sample_demo_gazette_metadata',
          issueDate: '2026-06-19',
          issueNumber: 'SAMPLE-ISSUE-PUBLIC-001',
          matchedBy: 'sampleRecordId',
          gazetteDateFromXml: '2026-06-19',
          gazetteDateMismatch: false,
          gazetteNumber: 'SAMPLE-GAZETTE-PUBLIC-001',
          publicationDocumentId: 'SAMPLE-PUBLICATION-PUBLIC-001',
          hasDrawingRefs: true,
          drawingRefCount: 1,
          sourceXmlFile: 'sample-publication-meta-public-001.xml',
          drawingRefs: [
            {
              label: '正面図',
              fileName: 'sample-drawing-public-001.png',
              fileType: 'png',
              order: 1,
              isRepresentativeCandidate: true,
              sourceXmlFile: 'sample-publication-meta-public-001.xml',
            },
          ],
        }
      : null,
}));

const result: AnalysisResult = {
  request,
  dataAsOf: '2026-06-23',
  generatedBy: 'rules',
  disclaimer: 'fixture',
  companies: [],
  market: {
    trends: {
      title: '対象意匠件数',
      text: 'fixture',
      metric: { label: '対象意匠件数', value: 2, unit: '件' },
      confidence: 'low',
      evidenceIds: ['fixture-with-keys', 'fixture-without-keys'],
    },
    emergingDomains: {
      title: '画像意匠件数',
      text: 'fixture',
      metric: { label: '画像意匠件数', value: 1, unit: '件' },
      confidence: 'low',
      evidenceIds: ['fixture-with-keys'],
    },
    companyMoves: {
      title: '対象企業数',
      text: 'fixture',
      metric: { label: '対象企業数', value: 2, unit: '社' },
      confidence: 'low',
      evidenceIds: ['fixture-with-keys', 'fixture-without-keys'],
    },
  },
};

const summary: LocalJpoDatasetSummary = {
  fileName: 'fixture-with-gazette-keys.json',
  dataPeriodKind: 'monthly_preview',
  dataPeriodDate: '2026-06',
  totalRecords: 2,
  sourceUpdateDateFrom: '2026-06-24',
  sourceUpdateDateTo: '2026-06-24',
  gazetteDateFrom: '2023-06-19',
  gazetteDateTo: '2026-06-23',
  registrationNumberCount: 2,
  applicantsInfoCount: 2,
  namedPartyRecordCount: 2,
  unresolvedCodeRecordCount: 0,
  unresolvedApplicantsCount: 0,
  rightHoldersCount: 0,
  unresolvedRightHoldersCount: 0,
  gazetteDrawingKeysCount: 1,
  drawingRefsRecordCount: 1,
  drawingRefTotalCount: 1,
  gazetteDateMismatchCount: 1,
  topDesignClasses: [{ label: 'S-N3-11', count: 1 }],
  topArticleNames: [{ label: 'サンプル操作用画像', count: 1 }],
  topParties: [{ label: 'サンプル電機株式会社', count: 1 }],
  topUnresolvedCodes: [],
  priorityClaims: { withClaims: 0, withoutClaims: 2 },
  agents: { withAgents: 0, withoutAgents: 2 },
  inferredDesignKindCount: 2,
};

const demoShowcaseRecords: DemoShowcaseRecord[] = [
  {
    id: 'fixture-with-keys',
    articleName: 'サンプル操作用画像',
    partyLabel: 'サンプル電機株式会社',
    registrationNumber: 'SAMPLE-REG-FIX-001',
    applicationNumber: 'SAMPLE-APP-FIX-001',
    gazetteDate: '2023-06-19',
    designClass: 'S-N3-11',
    drawingRefCount: 1,
    drawingLabels: ['画像図'],
    sourceXmlFile: 'sample-publication-meta-fixture-001.xml',
    whyDemoFriendly: '図面メタデータあり / 物品名が説明しやすい',
  },
  {
    id: 'fixture-without-keys',
    articleName: 'サンプル収納ケース',
    partyLabel: 'デモ住設株式会社',
    registrationNumber: 'SAMPLE-REG-FIX-002',
    applicationNumber: 'SAMPLE-APP-FIX-002',
    gazetteDate: '2026-06-23',
    designClass: 'S-B3-43',
    drawingRefCount: 0,
    drawingLabels: [],
    whyDemoFriendly: '未接続の課題説明に使いやすい',
  },
];

describe('ResultsArea gazette drawing metadata display', () => {
  it('renders only allowed gazetteDrawingKeys fields and no image body, URL, or local full path', () => {
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result,
        records,
        allRecords: records,
        isRunning: false,
        localJpoSummary: summary,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
      }),
    );

    expect(html).toContain('公報・図面メタデータあり');
    expect(html).toContain('図面メタデータあり：2件中1件');
    expect(html).toContain('2026-06-23');
    expect(html).toContain('SAMPLE-ISSUE-FIX-001');
    expect(html).toContain('registrationAndApplication');
    expect(html).toContain('sample-drawing-fixture-001.png');
    expect(html).toContain('sample-publication-meta-fixture-001.xml');
    expect(html).toContain('月次DesignRecord側のgazetteDateと公報XML側のgazetteDateが一致していません');
    expect(html).toContain('この意匠には、まだ公報・図面メタデータが接続されていません。');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });

  it('renders external demo mode guide, showcase records, and folded unresolved codes safely', () => {
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result,
        records,
        allRecords: records,
        isRunning: false,
        localJpoSummary: {
          ...summary,
          topUnresolvedCodes: [{ label: '未解決コード: 12345', count: 1 }],
          unresolvedApplicantsCount: 1,
          unresolvedRightHoldersCount: 1,
        },
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords,
      }),
    );

    expect(html).toContain('外部デモモード');
    expect(html).toContain('デモ準備状況');
    expect(html).toContain('本体JSON読込済み');
    expect(html).toContain('デモ候補あり');
    expect(html).toContain('分析実行済み');
    expect(html).toContain('プレゼンターモード');
    expect(html).toContain('デモシナリオ');
    expect(html).toContain('3分デモ');
    expect(html).toContain('10分デモ');
    expect(html).toContain('デモシナリオ導線');
    expect(html).toContain('今どこを説明しているか');
    expect(html).toContain('次に見る場所');
    expect(html).toContain('公開意匠情報から、他社の商品化傾向、デザイン変化、出願活動の兆候を読み取り');
    expect(html).toContain('デモで見るポイント');
    expect(html).toContain('このアプリの強み');
    expect(html).toContain('公開意匠情報から、他社の商品化・デザイン・知財活動の兆候を読む');
    expect(html).toContain('実データ検証版の到達点');
    expect(html).toContain('現在の未接続・改善予定');
    expect(html).toContain('セキュリティ・共有前提');
    expect(html).toContain('先方の社外秘情報を入力する必要はありません。');
    expect(html).toContain('商用導入時は、社内環境・閉域環境・セキュアなクラウド構成を相談可能です。');
    expect(html).toContain('デモナビ');
    expect(html).toContain('おすすめデモ候補');
    expect(html).toContain('そのほかのデモ候補');
    expect(html).toContain('おすすめ');
    expect(html).toContain('公報・図面メタデータあり');
    expect(html).toContain('図面参照数');
    expect(html).toContain('詳細を見る');
    expect(html).toContain('href="#evidence-fixture-with-keys"');
    expect(html).toContain('根拠意匠を見る');
    expect(html).toContain('図面メタデータありの根拠だけ表示');
    expect(html).toContain('図面名・画像ファイル名が確認できる根拠意匠に絞ります。');
    expect(html).toContain('A. 見せ場サマリー');
    expect(html).toContain('公報・図面メタデータ接続済み');
    expect(html).toContain('図面名の代表3件');
    expect(html).toContain('B. 基本情報');
    expect(html).toContain('C. 公報・図面メタデータ');
    expect(html).toContain('D. 注意');
    expect(html).toContain('画像形式 fileType');
    expect(html).toContain('図面順序 order');
    expect(html).toContain('現時点の到達点');
    expect(html).toContain('注意事項');
    expect(html).toContain('一部の申請人・権利者コードは、現在DB側で名寄せ改善中です。');
    expect(html).toContain('未解決コード一覧');
    expect(html).not.toContain('<details open');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
    const avoidedPhrases = ['類似' + '意匠検索ではなく', '類似' + '検索ではなく', '出願' + 'すべき', '法的' + 'に問題' + 'ありません'];
    avoidedPhrases.forEach((phrase) => expect(html).not.toContain(phrase));
  });

  it('shows public sample demo notice when no local real-data JSON is loaded', () => {
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: null,
        records: [],
        allRecords: publicSampleRecords,
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
      }),
    );

    expect(html).toContain('この公開デモはサンプルデータ版です。特許庁実データを用いた検証版は、画面共有でご説明します。');
    expect(html).toContain('公開URL用サンプルデータ概要');
    expect(html).toContain('サンプルデータ件数');
    expect(html).toContain('サンプル企業上位');
    expect(html).toContain('おすすめデモ候補');
    expect(html).toContain('公開サンプルデータから自動抽出した、架空メタデータを説明しやすい意匠です。');
    expect(html).toContain('架空サンプルメタデータ');
    expect(html).toContain('これは公開デモ用の架空メタデータです。実在企業・実在公報ではありません。');
    expect(html).toContain('公開URL版のデータは架空データで、実在企業・実在公報ではありません。');
    expect(html).toContain('セキュリティ・共有前提');
    expect(html).not.toContain('類似' + '意匠検索ではなく');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });
});
