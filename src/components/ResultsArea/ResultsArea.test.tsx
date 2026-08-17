import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { companySelectorFromMembership } from '../../domain/analysisRecords';
import type { AnalysisRequest, AnalysisResult, DemoShowcaseRecord, DesignRecord } from '../../domain/types';
import type { LocalJpoDatasetSummary } from '../../data/LocalJpoJsonDataSource';
import { RuleBasedAnalysisEngine } from '../../analysis/RuleBasedAnalysisEngine';
import { projectLocalJpoDesignRecord } from '../../analysis/projectLegacyDesignRecord';
import { loadDesignJsonText } from '../../data/DesignJsonFileLoader';
import { ResultsArea } from './ResultsArea';
import {
  evidenceInteractionReducer,
  focusEvidenceSection,
  INITIAL_EVIDENCE_INTERACTION_STATE,
} from './evidenceInteraction';

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

const legacyAnalysisRecords = records.map(projectLocalJpoDesignRecord);

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
  it('fully resets evidence state and restores the list top before another selection', () => {
    let interaction = evidenceInteractionReducer(INITIAL_EVIDENCE_INTERACTION_STATE, {
      type: 'select',
      result,
      label: '対象意匠件数',
      ids: ['fixture-with-keys', 'fixture-with-keys', 'fixture-without-keys'],
      highlightedId: 'fixture-with-keys',
    });

    expect(interaction.selection?.ids).toEqual(['fixture-with-keys', 'fixture-without-keys']);
    expect(interaction.highlightedEvidenceId).toBe('fixture-with-keys');
    expect(interaction.expandedResult).toBe(result);
    expect(interaction.listRevision).toBe(1);

    let focusCount = 0;
    let scrollCount = 0;
    const evidenceSection = {
      focus: () => {
        focusCount += 1;
      },
      scrollIntoView: () => {
        scrollCount += 1;
      },
    } as Pick<HTMLElement, 'focus' | 'scrollIntoView'>;

    focusEvidenceSection(evidenceSection, interaction.selection, interaction.restoreFocus);
    expect({ focusCount, scrollCount }).toEqual({ focusCount: 1, scrollCount: 1 });

    interaction = evidenceInteractionReducer(interaction, { type: 'clear' });
    expect(interaction.selection).toBeNull();
    expect(interaction.highlightedEvidenceId).toBeNull();
    expect(interaction.expandedResult).toBeNull();
    expect(interaction.restoreFocus).toBe(true);
    expect(interaction.listRevision).toBe(2);

    focusEvidenceSection(evidenceSection, interaction.selection, interaction.restoreFocus);
    interaction = evidenceInteractionReducer(interaction, { type: 'focus_restored' });
    expect({ focusCount, scrollCount }).toEqual({ focusCount: 2, scrollCount: 2 });
    expect(interaction.restoreFocus).toBe(false);

    interaction = evidenceInteractionReducer(interaction, {
      type: 'select',
      result,
      label: '画像意匠件数',
      ids: ['fixture-without-keys'],
      highlightedId: 'fixture-without-keys',
    });
    expect(interaction.selection).toMatchObject({ label: '画像意匠件数', ids: ['fixture-without-keys'] });
    expect(interaction.highlightedEvidenceId).toBe('fixture-without-keys');
    expect(interaction.expandedResult).toBe(result);
    expect(interaction.listRevision).toBe(3);
  });

  it('renders only allowed gazetteDrawingKeys fields and no image body, URL, or local full path', () => {
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result,
        analysisRecords: legacyAnalysisRecords,
        allRecords: records,
        backendContract: null,
        dataMode: 'legacy',
        isRunning: false,
        localJpoSummary: summary,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('今回わかったこと');
    expect(html).toContain('重要な示唆');
    expect(html).toContain('件数の多い意匠分類・領域');
    expect(html).toContain('データ基準日 2026-06-23');
    expect(html).not.toContain('ルールベース分析');
    expect(html).not.toContain('信頼度：');
    expect(html).toContain('選択した目的別の詳細分析を見る');
    expect(html).toContain('商品化領域のヒント');
    expect(html).not.toContain('新商品領域');
    expect(html).toContain('data-testid="analysis-record-count-button"');
    expect(html.match(/data-testid="priority-insight"/g)).toHaveLength(3);
    expect(html.match(/data-testid="priority-evidence-button"/g)).toHaveLength(3);
    expect(html).not.toContain('根拠となる数値');
    expect(html).not.toContain('クリックして対象意匠を確認');
    expect(html).not.toMatch(/根拠意匠[\d,]+件を見る/);
    expect(html).toContain('min-w-0 overflow-hidden');
    expect(html.match(/data-testid="insight-evidence-button"/g)).toHaveLength(3);
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain('generatedBy:');
    expect(html).toContain('公報・図面メタデータあり');
    expect(html).toContain('図面メタデータあり：2件中1件');
    expect(html).toContain('2026-06-23');
    expect(html).toContain('SAMPLE-ISSUE-FIX-001');
    expect(html).toContain('registrationAndApplication');
    expect(html).toContain('sample-drawing-fixture-001.png');
    expect(html).toContain('sample-publication-meta-fixture-001.xml');
    expect(html).toContain('代表候補は未選定です。');
    expect(html).not.toContain('>いいえ</td>');
    expect(html).toContain('月次DesignRecord側のgazetteDateと公報XML側のgazetteDateが一致していません');
    expect(html).toContain('この意匠には、まだ公報・図面メタデータが接続されていません。');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });

  it('renders customer-first Backend evidence and exposes technical details only when requested', () => {
    const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
    const routed = loadDesignJsonText(fs.readFileSync(fixturePath, 'utf8'), 'design-export-fictional.json');
    expect(routed.kind).toBe('backend_contract');
    if (routed.kind !== 'backend_contract' || !routed.result.ok) {
      throw new Error('The fictional Backend Contract fixture must be accepted.');
    }
    const backendContract = routed.result;
    const backendResult: AnalysisResult = {
      ...result,
      dataAsOf: backendContract.meta.analysisCutoff,
      market: {
        trends: {
          ...result.market!.trends,
          evidenceIds: ['kds_fixture_alpha', 'kds_fixture_gamma', 'kds_fixture_delta'],
          metric: { label: '対象意匠件数', value: 2, unit: '件' },
        },
        emergingDomains: {
          ...result.market!.emergingDomains,
          evidenceIds: ['kds_fixture_beta'],
          metric: { label: '画像意匠件数', value: 1, unit: '件' },
        },
        companyMoves: {
          ...result.market!.companyMoves,
          evidenceIds: ['kds_fixture_alpha', 'kds_fixture_beta', 'kds_fixture_gamma'],
          metric: { label: '対象企業数', value: 3, unit: '社' },
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: backendResult,
        analysisRecords: backendContract.analysisRecords,
        allRecords: [],
        backendContract,
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('Backend Contractデータ概要');
    expect(html).toContain('File APIで選択したContract 0.1.0 JSONをブラウザのメモリ上でデータセット単位に検証');
    expect(html).not.toContain('現在は公開URL用の架空サンプルデータ版です。');
    expect(html).not.toContain('この画面は公開URL用の架空サンプルデータ版です。');
    expect(html).not.toContain('現在はローカル検証版です。');
    expect(html).not.toContain('この画面は画面共有用のローカル検証版です。');
    expect(html).not.toContain('公開サンプル版では架空メタデータです。');
    expect(html).toContain('contract version');
    expect(html).toContain('0.1.0');
    expect(html).toContain('analysis cutoff');
    expect(html).toContain('2026-08-10');
    expect(html).toContain('総件数');
    expect(html).toContain('分析対象');
    expect(html).toContain('分析対象外');
    expect(html).toContain('warning');
    expect(html).toContain('quarantined');
    expect(html).toContain('gazetteDate欠損');
    expect(html).toContain('意匠種別unknown');
    expect(html).toContain('未解決applicant');
    expect(html).toContain('未解決right holder');
    expect(html).toContain('id="evidence-kds_fixture_alpha"');
    expect(html).toContain('id="evidence-kds_fixture_gamma"');
    expect(html).not.toContain('id="evidence-kds_fixture_delta"');
    expect(html).toContain('data-testid="backend-customer-details"');
    expect(html).toContain('物品名・画像の用途');
    expect(html).toContain('企業名');
    expect(html).toContain('意匠分類');
    expect(html).toContain('出願番号');
    expect(html).toContain('登録番号');
    expect(html).toContain('公報番号');
    expect(html).toContain('公報発行日');
    expect(html).toContain('取得済み図面');
    expect(html).toContain('data-testid="backend-technical-details"');
    expect(html).toContain('技術・検証情報');
    const technicalDetailsTag = html.match(/<details[^>]*data-testid="backend-technical-details"[^>]*>/)?.[0];
    expect(technicalDetailsTag).toBeDefined();
    expect(technicalDetailsTag).toMatch(/\bopen(?:=|>)/i);
    expect(html).toContain('stable id');
    expect(html).toContain('架空アルファ意匠研究所');
    expect(html).toContain('right holder resolution');
    expect(html).toContain('名称解決済み');
    expect(html).toContain('名称未解決');
    expect(html).toContain('ambiguous_match');
    expect(html).toContain('missing_master');
    expect(html).toContain('主分類');
    expect(html).toContain('補助分類');
    expect(html).toContain('data-classification-role="primary"');
    expect(html).toContain('data-classification-role="supplemental"');
    expect(html).toContain('FIXTURE-SCHEME-A / FIXTURE-CLASS-A1 / 架空分類アルファ主分類');
    expect(html).toContain('quality');
    expect(html).toContain('analysis disposition');
    expect(html).toContain('accepted');
    expect(html).toContain('quality notices');
    expect(html).toContain('FIXTURE-GAZETTE-ALPHA');
    expect(html).toContain('publicationDocumentId');
    expect(html).toContain('order 1:');
    expect(html).toContain('代表候補');
    expect(html).toContain('publicationはnullです。別フィールドから補完していません。');
    expect(html).not.toContain('sourceRecordLocator');
    expect(html).not.toContain('sourceDocumentRef');
    expect(html).not.toContain('FIXTURE-RUN-ALPHA');
    expect(html).not.toContain('fixture:artifact:alpha');
    expect(html).not.toContain('fixture:record:alpha');
    expect(html).not.toContain('fixture-parser-0.1.0');
    expect(html.indexOf('data-testid="backend-customer-details"')).toBeLessThan(
      html.indexOf('data-testid="backend-technical-details"'),
    );
    expect(html.indexOf('data-testid="backend-technical-details"')).toBeLessThan(html.indexOf('stable id'));
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(/^data:/im);
    expect(html).not.toContain('<img');

    const authenticatedTrialHtml = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: backendResult,
        analysisRecords: backendContract.analysisRecords,
        allRecords: [],
        backendContract,
        backendContractAcquisition: 'authenticated_trial',
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(authenticatedTrialHtml).toContain('技術・検証情報');
    expect(authenticatedTrialHtml).not.toContain('認証後に同一オリジンから自動取得したContract 0.1.0');
    expect(authenticatedTrialHtml).not.toContain('Backend Contract');
    expect(authenticatedTrialHtml).not.toContain('accepted');
    expect(authenticatedTrialHtml).not.toContain('excluded');
    expect(authenticatedTrialHtml).not.toContain('adapter');
    expect(authenticatedTrialHtml).not.toContain('File API');
    expect(authenticatedTrialHtml.indexOf('data-testid="backend-customer-details"')).toBeLessThan(
      authenticatedTrialHtml.indexOf('data-testid="backend-technical-details"'),
    );
    const authenticatedTrialTechnicalTag = authenticatedTrialHtml.match(
      /<details[^>]*data-testid="backend-technical-details"[^>]*>/,
    )?.[0];
    expect(authenticatedTrialTechnicalTag).toBeDefined();
    expect(authenticatedTrialTechnicalTag).not.toMatch(/\bopen(?:=|>)/i);

    const authenticatedTrialTechnicalHtml = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: backendResult,
        analysisRecords: backendContract.analysisRecords,
        allRecords: [],
        backendContract,
        backendContractAcquisition: 'authenticated_trial',
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        onClearProductDomain: () => undefined,
        technicalDetailsInitiallyOpen: true,
      }),
    );
    expect(authenticatedTrialTechnicalHtml).toContain('認証後に同一オリジンから自動取得したContract 0.1.0');
  });

  it('keeps raw classification schemes and Backend terms out of the initial customer markup', () => {
    const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
    const routed = loadDesignJsonText(fs.readFileSync(fixturePath, 'utf8'), 'design-export-fictional.json');
    if (routed.kind !== 'backend_contract' || !routed.result.ok) {
      throw new Error('The fictional Backend Contract fixture must be accepted.');
    }
    const template = routed.result.records.find((record) => record.adapterDisposition.status === 'accepted');
    if (!template) throw new Error('The fixture must contain an accepted record.');
    const backendContract = {
      ...routed.result,
      records: routed.result.records.map((record) =>
        record.id === template.id
          ? {
              ...record,
              classifications: [
                {
                  scheme: 'JPO_NATIONAL_DESIGN_CLASSIFICATION',
                  code: 'FIXTURE-CODE-A1',
                  label: null,
                  isPrimary: true,
                },
                {
                  scheme: 'FIXTURE_SUPPLEMENTAL_CLASSIFICATION_SCHEME_WITH_A_LONG_NAME',
                  code: 'FIXTURE-SUPPLEMENTAL-CODE',
                  label: null,
                  isPrimary: false,
                },
              ],
            }
          : record,
      ),
    };
    const initialResult: AnalysisResult = {
      ...result,
      market: {
        trends: {
          ...result.market!.trends,
          evidenceIds: [template.id],
          metric: { label: '検出意匠数', value: 1, unit: '件' },
        },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [], metric: { label: '検出意匠数', value: 0, unit: '件' } },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [], metric: { label: '検出意匠数', value: 0, unit: '件' } },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: initialResult,
        analysisRecords: routed.result.analysisRecords,
        allRecords: [],
        backendContract,
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('日本意匠分類 FIXTURE-CODE-A1');
    expect(html).toContain('技術・検証情報');
    expect(html).toContain('data-testid="backend-technical-details"');
    expect(html).not.toContain('JPO_NATIONAL_DESIGN_CLASSIFICATION');
    expect(html).not.toContain('FIXTURE_SUPPLEMENTAL_CLASSIFICATION_SCHEME_WITH_A_LONG_NAME');
    expect(html).not.toContain('FIXTURE-SUPPLEMENTAL-CODE');
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('accepted');
    expect(html).not.toContain('excluded');
    expect(html).not.toContain('adapter');
    expect(html).not.toContain('stable id');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
  });

  it('keeps no-primary classifications supplemental and leaves all-false representative candidates unselected', () => {
    const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
    const routed = loadDesignJsonText(fs.readFileSync(fixturePath, 'utf8'), 'design-export-fictional.json');
    expect(routed.kind).toBe('backend_contract');
    if (routed.kind !== 'backend_contract' || !routed.result.ok) {
      throw new Error('The fictional Backend Contract fixture must be accepted.');
    }
    const template = routed.result.records.find(
      (record) => record.adapterDisposition.status === 'accepted' && record.classifications.length > 1 && record.drawings.length > 0,
    );
    if (!template) throw new Error('The fixture must contain an accepted multi-classification record with drawings.');
    const backendContract = {
      ...routed.result,
      records: routed.result.records.map((record) =>
        record.id === template.id
          ? {
              ...record,
              classifications: record.classifications.map((classification) => ({ ...classification, isPrimary: false })),
              drawings: record.drawings.map((drawing) => ({ ...drawing, isRepresentativeCandidate: false })),
            }
          : record,
      ),
    };
    const noPrimaryResult: AnalysisResult = {
      ...result,
      market: {
        trends: { ...result.market!.trends, evidenceIds: [template.id], metric: { label: '対象意匠件数', value: 1, unit: '件' } },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [], metric: { label: '画像意匠件数', value: 0, unit: '件' } },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [], metric: { label: '対象企業数', value: 0, unit: '社' } },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: noPrimaryResult,
        analysisRecords: routed.result.analysisRecords,
        allRecords: [],
        backendContract,
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('主分類は未選定です。先頭の分類を主分類として扱っていません。');
    expect(html.match(/data-classification-role="supplemental"/g)).toHaveLength(template.classifications.length);
    expect(html).not.toContain('data-classification-role="primary"');
    expect(html).toContain('代表候補は未選定です。');
    expect(html).not.toContain('data-representative-candidate="true"');
    expect(html).not.toContain('>いいえ</td>');
  });

  it('keeps valid Backend record fragments and tuple-based row identities distinct', () => {
    const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
    const routed = loadDesignJsonText(fs.readFileSync(fixturePath, 'utf8'), 'design-export-fictional.json');
    expect(routed.kind).toBe('backend_contract');
    if (routed.kind !== 'backend_contract' || !routed.result.ok) {
      throw new Error('The fictional Backend Contract fixture must be accepted.');
    }
    const template = routed.result.records.find((record) => record.adapterDisposition.status === 'accepted');
    if (!template) throw new Error('The fixture must contain an accepted record.');
    const ids = ['fixture:a', 'fixture.a', 'fixture-a'];
    const backendContract = {
      ...routed.result,
      records: ids.map((id, index) => ({
        ...template,
        id,
        classifications:
          index === 0
            ? [
                { scheme: 'a:b', code: 'c', label: '架空分類コロン一', isPrimary: true },
                { scheme: 'a', code: 'b:c', label: '架空分類コロン二', isPrimary: false },
              ]
            : template.classifications,
        drawings:
          index === 0 && template.drawings.length > 0
            ? [
                { ...template.drawings[0], drawingId: 'fixture-duplicate-drawing', order: 1 },
                { ...template.drawings[0], drawingId: 'fixture-duplicate-drawing', order: 2 },
              ]
            : template.drawings,
      })),
    };
    const collisionResult: AnalysisResult = {
      ...result,
      market: {
        ...result.market!,
        trends: { ...result.market!.trends, evidenceIds: ids },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [] },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [] },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: collisionResult,
        analysisRecords: [],
        allRecords: [],
        backendContract,
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('href="#evidence-fixture~3aa"');
    expect(html).toContain('href="#evidence-fixture~2ea"');
    expect(html).toContain('href="#evidence-fixture-a"');
    expect(html).toContain('id="evidence-fixture~3aa"');
    expect(html).toContain('id="evidence-fixture~2ea"');
    expect(html).toContain('id="evidence-fixture-a"');
    expect(html).toContain('架空分類コロン一');
    expect(html).toContain('架空分類コロン二');
    expect(html).toContain('order 1: fixture-duplicate-drawing');
    expect(html).toContain('order 2: fixture-duplicate-drawing');
  });

  it('renders external demo mode guide, showcase records, and folded unresolved codes safely', () => {
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result,
        analysisRecords: legacyAnalysisRecords,
        allRecords: records,
        backendContract: null,
        dataMode: 'legacy',
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
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
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
    expect(html).toContain('公開意匠情報から、企業各社や特定他社がどの領域に着目しているか、商品開発傾向・デザイン変化・出願活動の兆候を読み取り');
    expect(html).toContain('デモで見るポイント');
    expect(html).toContain('このアプリの強み');
    expect(html).toContain('公開意匠情報から、企業各社や特定他社がどの領域に着目しているか、商品開発傾向・デザイン変化・出願活動の兆候を読む');
    expect(html).toContain('公開意匠情報を主対象に分析できます');
    expect(html).toContain('特許出願公開、企業IR、プレスリリース等の一般公開情報との照合も検討できます');
    expect(html).not.toContain('公開情報を中心に分析できます');
    expect(html).toContain('実データ検証版の到達点');
    expect(html).toContain('現在の未接続・改善予定');
    expect(html).toContain('セキュリティ・共有前提');
    expect(html).toContain('現在はローカル検証版です。');
    expect(html).toContain('この画面は画面共有用のローカル検証版です。');
    expect(html).not.toContain('現在は公開URL用の架空サンプルデータ版です。');
    expect(html).not.toContain('この画面は公開URL用の架空サンプルデータ版です。');
    expect(html).not.toContain('公開サンプル版では架空メタデータです。');
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
    expect(html).toContain('技術・検証情報');
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
        analysisRecords: [],
        allRecords: publicSampleRecords,
        backendContract: null,
        dataMode: 'sample',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('分析すると得られること');
    expect(html).toContain('注力領域');
    expect(html).toContain('変化の兆候');
    expect(html).toContain('戦略の材料');
    expect(html).toContain('技術・検証情報');
    expect(html).toContain('この公開デモはサンプルデータ版です。特許庁実データを用いた検証版は、画面共有でご説明します。');
    expect(html).toContain('公開URL用サンプルデータ概要');
    expect(html).toContain('サンプルデータ件数');
    expect(html).toContain('サンプル企業上位');
    expect(html).toContain('おすすめデモ候補');
    expect(html).toContain('公開サンプルデータから自動抽出した、架空メタデータを説明しやすい意匠です。');
    expect(html).toContain('公開URL版のデータは架空データで、実在企業・実在公報ではありません。');
    expect(html).toContain('セキュリティ・共有前提');
    expect(html).toContain('現在は公開URL用の架空サンプルデータ版です。');
    expect(html).toContain('この画面は公開URL用の架空サンプルデータ版です。');
    expect(html).not.toContain('現在はローカル検証版です。');
    expect(html).not.toContain('この画面は画面共有用のローカル検証版です。');
    ['AI分析結果を見る', 'AI分析結果', 'AI分析結果だけでなく', 'AI知財戦略コメント'].forEach((phrase) => {
      expect(html).not.toContain(phrase);
    });
    expect(html).not.toContain('細江');
    expect(html).not.toContain('6社比較ビュー');
    expect(html).not.toContain('Soft' + 'Bank');
    expect(html).not.toContain('Pay' + 'Pay');
    expect(html).not.toContain('LINE ' + 'Yahoo');
    expect(html).not.toContain('Apple');
    expect(html).not.toContain('Google');
    expect(html).not.toContain('NTT ' + 'DOCOMO');
    expect(html).not.toContain('日本意匠分類にWを含む画像意匠候補');
    expect(html).not.toContain('安立');
    expect(html).not.toContain('画像共通Dターム');
    expect(html).not.toContain('専門家レビュー');
    expect(html).not.toContain(['strict', 'PrefixW'].join(''));
    expect(html).not.toContain(['dTermWIncluded', 'Candidate'].join(''));
    expect(html).not.toContain('類似' + '意匠検索ではなく');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
    expect(html).not.toContain('<img');
  });

  it('shows only the selected company-purpose details and matching evidence records', async () => {
    const purposeRequest: AnalysisRequest = {
      ...request,
      scope: {
        mode: 'companies',
        companySelectors: [companySelectorFromMembership(legacyAnalysisRecords[0].companyMemberships[0])],
      },
      purposes: ['dx_dev', 'filing_strategy'],
    };
    const purposeResult = await new RuleBasedAnalysisEngine().analyze(
      purposeRequest,
      legacyAnalysisRecords,
      '2026-06-23',
    );
    const company = purposeResult.companies[0];
    company.designTrend.domains.evidenceIds = ['fixture-without-keys'];
    company.designTrend.domains.metric.value = 1;
    company.dxDevTrend.aiIotTrend.evidenceIds = ['fixture-with-keys'];
    company.dxDevTrend.aiIotTrend.metric.value = 1;

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request: purposeRequest,
        result: purposeResult,
        analysisRecords: legacyAnalysisRecords,
        allRecords: records,
        backendContract: null,
        dataMode: 'legacy',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('DX商品開発動向');
    expect(html).toContain('AI・IoT関連傾向');
    expect(html).toContain('知財戦略の検討材料');
    expect(html).not.toContain('意匠ポートフォリオ分析');
    expect(html).not.toContain('AI知財戦略コメント');
    expect(html).toContain('id="evidence-fixture-with-keys"');
    expect(html).not.toContain('id="evidence-fixture-without-keys"');
  });

  it('keeps the market overview as scope context while emphasizing a non-market purpose', async () => {
    const purposeRequest: AnalysisRequest = { ...request, purposes: ['dx_dev'] };
    const purposeResult = await new RuleBasedAnalysisEngine().analyze(
      purposeRequest,
      legacyAnalysisRecords,
      '2026-06-23',
    );
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request: purposeRequest,
        result: purposeResult,
        analysisRecords: legacyAnalysisRecords,
        allRecords: records,
        backendContract: null,
        dataMode: 'legacy',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('市場全体ビュー');
    expect(html).toContain('DX商品開発動向');
  });

  it('shows the first eight evidence records before offering the remaining records', () => {
    const manyRecords: DesignRecord[] = Array.from({ length: 9 }, (_, index) => ({
      ...records[0],
      id: `bulk-evidence-${index + 1}`,
      gazetteDrawingKeys: null,
    }));
    const evidenceIds = manyRecords.map((record) => record.id);
    const manyResult: AnalysisResult = {
      ...result,
      market: {
        trends: { ...result.market!.trends, evidenceIds, metric: { label: '対象意匠件数', value: 9, unit: '件' } },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [], metric: { label: '画像意匠件数', value: 0, unit: '件' } },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [], metric: { label: '対象企業数', value: 0, unit: '社' } },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request,
        result: manyResult,
        analysisRecords: manyRecords.map(projectLocalJpoDesignRecord),
        allRecords: manyRecords,
        backendContract: null,
        dataMode: 'legacy',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html.match(/id="evidence-bulk-evidence-/g)).toHaveLength(8);
    expect(html).toContain('分析結果全体の根拠意匠9件／まず先頭8件を表示しています。');
    expect(html).toContain('残り1件の根拠意匠を表示');
    expect(html).not.toContain('id="evidence-bulk-evidence-9"');
  });

  it('explains how to recover when no records match the selected conditions', () => {
    const emptyRequest = { ...request, productDomain: '架空の限定領域' };
    const emptyResult: AnalysisResult = {
      ...result,
      request: emptyRequest,
      market: {
        trends: { ...result.market!.trends, evidenceIds: [], metric: { label: '対象意匠件数', value: 0, unit: '件' } },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [], metric: { label: '画像意匠件数', value: 0, unit: '件' } },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [], metric: { label: '対象企業数', value: 0, unit: '社' } },
      },
    };
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request: emptyRequest,
        result: emptyResult,
        analysisRecords: [],
        allRecords: publicSampleRecords,
        backendContract: null,
        dataMode: 'sample',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: false,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        technicalDetailsInitiallyOpen: true,
        onClearProductDomain: () => undefined,
      }),
    );

    expect(html).toContain('この条件に一致する意匠はありません。');
    expect(html).toContain('企業名、商品・事業領域、期間、意匠種別を見直して');
    expect(html).toContain('商品・事業領域の指定を解除');
    expect(html).toContain('role="status"');
  });

  it('offers a full safe-preset reset for a zero-result authenticated trial', () => {
    const emptyResult: AnalysisResult = {
      ...result,
      request: { ...request, productDomain: '' },
      market: {
        trends: { ...result.market!.trends, evidenceIds: [], metric: { label: '対象意匠件数', value: 0, unit: '件' } },
        emergingDomains: { ...result.market!.emergingDomains, evidenceIds: [], metric: { label: '画像意匠件数', value: 0, unit: '件' } },
        companyMoves: { ...result.market!.companyMoves, evidenceIds: [], metric: { label: '対象企業数', value: 0, unit: '社' } },
      },
    };
    const html = renderToStaticMarkup(
      createElement(ResultsArea, {
        request: emptyResult.request,
        result: emptyResult,
        analysisRecords: [],
        allRecords: [],
        backendContract: null,
        backendContractAcquisition: 'authenticated_trial',
        dataMode: 'backend',
        isRunning: false,
        localJpoSummary: null,
        localJpoWarnings: [],
        analysisWarnings: [],
        externalDemoMode: true,
        demoShowcaseRecords: [],
        localAnalysisPackPanel: null,
        onClearProductDomain: () => undefined,
        onResetAnalysisFilters: () => undefined,
      }),
    );

    expect(html).toContain('推奨条件に戻す');
    expect(html).not.toContain('商品・事業領域の指定を解除');
  });
});
