import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEPARTMENT_LABELS, DESIGN_KIND_LABELS, PERIOD_LABELS, PURPOSE_LABELS } from '../../domain/labels';
import type {
  AnalysisInsight,
  AnalysisPurpose,
  AnalysisRequest,
  AnalysisResult,
  CompanyAnalysis,
  DemoShowcaseRecord,
  DesignRecord,
} from '../../domain/types';
import { classificationMembershipKey, type AnalysisReadyDesignRecord } from '../../domain/analysisRecords';
import { designKindSummary } from '../../analysis/RuleBasedAnalysisEngine';
import { displayPartyLabel, type LocalJpoDatasetSummary, type RankedItem } from '../../data/LocalJpoJsonDataSource';
import type {
  BackendContractAdapterSuccess,
  BackendRecordViewModel,
} from '../../data/BackendContractDataSource';
import { Badge } from '../common/Badge';
import {
  evidenceInteractionReducer,
  focusEvidenceSection,
  INITIAL_EVIDENCE_INTERACTION_STATE,
} from './evidenceInteraction';

interface ResultsAreaProps {
  request: AnalysisRequest;
  result: AnalysisResult | null;
  analysisRecords: AnalysisReadyDesignRecord[];
  allRecords: DesignRecord[];
  backendContract: BackendContractAdapterSuccess | null;
  dataMode: 'sample' | 'legacy' | 'backend';
  isRunning: boolean;
  localJpoSummary: LocalJpoDatasetSummary | null;
  localJpoWarnings: string[];
  analysisWarnings: string[];
  externalDemoMode: boolean;
  demoShowcaseRecords: DemoShowcaseRecord[];
  localAnalysisPackPanel: ReactNode | null;
  onClearProductDomain: () => void;
}

type DemoScenarioKind = 'three_min' | 'ten_min';

interface DemoScenarioStep {
  label: string;
  href: string;
  description: string;
}

interface PublicSampleSummary {
  totalRecords: number;
  gazetteDrawingKeysCount: number;
  drawingRefsRecordCount: number;
  drawingRefTotalCount: number;
  topDesignClasses: RankedItem[];
  topArticleNames: RankedItem[];
  topParties: RankedItem[];
  designKindCounts: RankedItem[];
}

interface EvidenceAvailability {
  id: string;
  hasDrawingMetadata: boolean;
}

type EvidenceRecordItem =
  | { kind: 'legacy'; record: DesignRecord }
  | { kind: 'backend'; record: BackendRecordViewModel };

const INITIAL_EVIDENCE_LIMIT = 8;
const INITIAL_DRAWING_LIMIT = 3;

const DEMO_SCENARIOS: Record<DemoScenarioKind, { label: string; steps: DemoScenarioStep[] }> = {
  three_min: {
    label: '3分デモ',
    steps: [
      { label: 'データ件数を見る', href: '#overview', description: 'まず、公開サンプルまたはローカル検証データとして読み込んだ件数とデータ範囲を確認します。' },
      { label: '企業別・分類別・物品名ランキングを見る', href: '#rankings', description: '次に、公開意匠情報を企業別、分類別、物品名別に俯瞰します。' },
      { label: '分析結果を見る', href: '#ai-analysis', description: 'ルールベース参考分析で、参考傾向と検討材料を確認します。' },
      { label: '根拠意匠IDを開く', href: '#evidence-details', description: 'Insightから根拠となる意匠IDへ戻れることを見せます。' },
      { label: '公報・図面メタデータを見る', href: '#evidence-details', description: '一部レコードで、図面名や画像ファイル名などのメタデータを確認します。' },
    ],
  },
  ten_min: {
    label: '10分デモ',
    steps: [
      { label: 'アプリの目的', href: '#demo-strengths', description: '公開意匠情報から、企業各社や特定他社がどの領域に着目しているか、商品開発傾向・デザイン変化・出願活動の兆候を読むための検討材料である点を説明します。' },
      { label: 'データ範囲', href: '#overview', description: '公開サンプル版とローカル検証版の違い、また実データ利用時のsourceUpdateDateとgazetteDateの違いを確認します。' },
      { label: 'ランキング', href: '#rankings', description: '企業別、分類別、物品名別の相対的な分布を確認します。' },
      { label: 'Insight', href: '#ai-analysis', description: '参考傾向として確認できる示唆と、根拠件数を説明します。' },
      { label: '根拠意匠詳細', href: '#evidence-details', description: '根拠意匠IDに戻り、基本情報を確認します。' },
      { label: '公報・図面メタデータ', href: '#evidence-details', description: '図面名、画像ファイル名、図面順序などのメタデータを確認します。' },
      { label: '未解決コード・今後の改善点', href: '#open-improvements', description: '名寄せ改善中の点と、現在の未接続範囲を先に共有します。' },
      { label: '本番化に向けた課題', href: '#demo-closing', description: '対象期間拡張、公報・図面リンク方針、利用条件確認が次フェーズであることをまとめます。' },
    ],
  },
};

export function ResultsArea({
  request,
  result,
  analysisRecords,
  allRecords,
  backendContract,
  dataMode,
  isRunning,
  localJpoSummary,
  localJpoWarnings,
  analysisWarnings,
  externalDemoMode,
  demoShowcaseRecords,
  localAnalysisPackPanel,
  onClearProductDomain,
}: ResultsAreaProps) {
  const [presenterMode, setPresenterMode] = useState(true);
  const [demoScenario, setDemoScenario] = useState<DemoScenarioKind>('three_min');
  const [presenterStepIndex, setPresenterStepIndex] = useState(0);
  const [evidenceInteraction, dispatchEvidenceInteraction] = useReducer(
    evidenceInteractionReducer,
    INITIAL_EVIDENCE_INTERACTION_STATE,
  );
  const evidenceSectionRef = useRef<HTMLElement>(null);
  const {
    highlightedEvidenceId,
    selection: evidenceSelection,
    expandedResult: expandedEvidenceResult,
    listRevision,
  } = evidenceInteraction;
  const activeScenario = DEMO_SCENARIOS[demoScenario];
  const activeStepIndex = Math.min(presenterStepIndex, activeScenario.steps.length - 1);
  const isPresenterMode = externalDemoMode && presenterMode;
  const publicSampleSummary = dataMode === 'sample' ? buildPublicSampleSummary(allRecords) : null;
  const derivedSampleShowcaseRecords =
    externalDemoMode && demoShowcaseRecords.length === 0 && publicSampleSummary ? buildSampleDemoShowcaseRecords(allRecords) : [];
  const effectiveDemoShowcaseRecords = demoShowcaseRecords.length > 0 ? demoShowcaseRecords : derivedSampleShowcaseRecords;
  const demoMatches = externalDemoMode ? resolveDemoShowcaseMatches(effectiveDemoShowcaseRecords, allRecords) : [];
  const backendEvidenceRecords =
    backendContract?.records.filter((record) => record.adapterDisposition.status === 'accepted') ?? [];
  const evidenceAvailability: EvidenceAvailability[] = [
    ...allRecords.map((record) => ({ id: record.id, hasDrawingMetadata: Boolean(record.gazetteDrawingKeys) })),
    ...backendEvidenceRecords.map((record) => ({ id: record.id, hasDrawingMetadata: record.drawings.length > 0 })),
  ];
  const activeEvidenceSelection = evidenceSelection?.result === result ? evidenceSelection : null;
  const evidenceRecords = activeEvidenceSelection
    ? recordsForEvidenceIds(activeEvidenceSelection.ids, allRecords, backendEvidenceRecords)
    : result
      ? collectEvidenceRecords(result, allRecords, backendEvidenceRecords)
      : [];
  const showAllEvidence = Boolean(result && expandedEvidenceResult === result);
  const visibleEvidenceRecords = showAllEvidence || activeEvidenceSelection
    ? evidenceRecords
    : evidenceRecords.slice(0, INITIAL_EVIDENCE_LIMIT);
  const warnings = [...localJpoWarnings, ...analysisWarnings];
  const selectEvidence = (label: string, ids: string[], highlightedId: string | null = null) => {
    dispatchEvidenceInteraction({ type: 'select', result, label, ids, highlightedId });
  };

  useEffect(() => {
    focusEvidenceSection(evidenceSectionRef.current, activeEvidenceSelection, evidenceInteraction.restoreFocus);
    if (evidenceInteraction.restoreFocus) dispatchEvidenceInteraction({ type: 'focus_restored' });
  }, [activeEvidenceSelection, evidenceInteraction.restoreFocus]);

  const clearEvidenceSelection = () => {
    dispatchEvidenceInteraction({ type: 'clear' });
  };

  return (
    <main className="space-y-5">
      <section
        id="ai-analysis"
        className="scroll-mt-6 rounded-lg border-2 border-teal-200 bg-white p-5 shadow-soft focus:outline-none sm:p-6"
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">分析アウトプット</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{result ? '今回わかったこと' : '分析すると得られること'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {result ? `データ基準日 ${result.dataAsOf} / 対象 ${analysisRecords.length}件 / ${designKindSummary(analysisRecords)}` : '重要な示唆を先に読み、必要なときだけ詳細と根拠意匠を開けます。'}
            </p>
            {localJpoSummary ? (
              <p className="mt-1 text-sm text-caution">
                ローカル実データでは意匠種別を designClass・articleName・description から暫定推定しています。
              </p>
            ) : null}
          </div>
        </div>

        {isRunning ? <p className="mt-6 rounded-md bg-slate-50 p-4 font-semibold text-muted">分析中...</p> : null}
        {!isRunning && !result ? <AnalysisStartGuide /> : null}
        {result ? (
          <ExecutiveSummary
            result={result}
            records={analysisRecords}
            onSelectEvidence={selectEvidence}
            onClearProductDomain={onClearProductDomain}
          />
        ) : null}

        {result ? (
          <details className="mt-6 rounded-lg border border-line bg-panel p-4">
            <summary className="cursor-pointer font-bold text-ink">選択した目的別の詳細分析を見る</summary>
            <p className="mt-2 text-sm leading-6 text-muted">
              {result.request.purposes.map((purpose) => PURPOSE_LABELS[purpose]).join('、')}
            </p>
            {result.market ? (
              <MarketView
                market={result.market}
                allRecords={evidenceAvailability}
                externalDemoMode={externalDemoMode}
                onSelectEvidence={selectEvidence}
              />
            ) : null}
            {result.companies.map((company) => (
              <CompanyView
                key={company.companyKey}
                analysis={company}
                allRecords={evidenceAvailability}
                externalDemoMode={externalDemoMode}
                purposes={result.request.purposes}
                onSelectEvidence={selectEvidence}
              />
            ))}
          </details>
        ) : null}

        {result ? <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-caution">{result.disclaimer}</p> : null}
      </section>

      <details id="overview" className="scroll-mt-6 rounded-lg border border-line bg-white p-4 shadow-soft">
        <summary className="cursor-pointer font-bold text-ink">現在の分析条件を確認</summary>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryItem
            label="分析範囲"
            value={
              request.scope.mode === 'all_classes'
                ? '全意匠分類'
                : request.scope.mode === 'companies'
                  ? request.scope.companySelectors.map((selector) => selector.displayLabel).join('、') || '未指定'
                  : `特定業界：${request.scope.industry || request.productDomain || '未指定'}`
            }
          />
          <SummaryItem label="商品・事業領域" value={request.productDomain?.trim() || '指定なし'} />
          <SummaryItem label="対象期間" value={PERIOD_LABELS[request.period]} />
          <SummaryItem label="意匠種別" value={request.designKinds.map((kind) => DESIGN_KIND_LABELS[kind]).join('、') || '未選択'} />
          <SummaryItem label="分析目的" value={request.purposes.map((purpose) => PURPOSE_LABELS[purpose]).join('、') || '未選択'} />
          <SummaryItem label="出力部門" value={request.departments.map((department) => DEPARTMENT_LABELS[department]).join('、') || '未選択'} />
          <SummaryItem label="未解決コード" value={request.includeUnresolvedApplicants ?? true ? '含める' : '除外'} />
        </dl>
      </details>

      {warnings.length > 0 ? <WarningPanel warnings={warnings} /> : null}

      {result && evidenceRecords.length > 0 ? (
        <section
          ref={evidenceSectionRef}
          id="evidence-details"
          aria-labelledby="evidence-details-heading"
          className="scroll-mt-6 rounded-lg border border-line bg-white p-5 shadow-soft focus:outline-none"
          tabIndex={-1}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="evidence-details-heading" className="text-base font-bold text-ink">根拠意匠を確認</h2>
              <p className="mt-1 text-sm text-muted" role="status" aria-live="polite">
                {activeEvidenceSelection
                  ? `「${activeEvidenceSelection.label}」の対象となる根拠意匠${evidenceRecords.length}件を表示しています。`
                  : evidenceRecords.length > INITIAL_EVIDENCE_LIMIT
                    ? `分析結果全体の根拠意匠${evidenceRecords.length}件／まず先頭${INITIAL_EVIDENCE_LIMIT}件を表示しています。`
                    : `分析結果全体の根拠意匠${evidenceRecords.length}件を表示しています。`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone="accent">{evidenceRecords.length}件</Badge>
              {activeEvidenceSelection ? (
                <button
                  type="button"
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={clearEvidenceSelection}
                >
                  根拠意匠の絞り込みを解除
                </button>
              ) : null}
            </div>
          </div>
          <div key={listRevision} className="mt-4 grid gap-3" data-testid="evidence-record-list">
            {visibleEvidenceRecords.map((item) =>
              item.kind === 'backend' ? (
                <BackendEvidenceRecord key={item.record.id} record={item.record} forceOpen={highlightedEvidenceId === item.record.id} />
              ) : (
                <EvidenceRecord
                  key={item.record.id}
                  record={item.record}
                  externalDemoMode={externalDemoMode}
                  presenterMode={isPresenterMode}
                  forceOpen={highlightedEvidenceId === item.record.id}
                />
              ),
            )}
          </div>
          {!activeEvidenceSelection && evidenceRecords.length > INITIAL_EVIDENCE_LIMIT ? (
            <button
              type="button"
              className="mt-4 w-full rounded-md border border-line bg-panel px-4 py-2 text-sm font-bold text-ink"
              onClick={() => dispatchEvidenceInteraction({ type: 'toggle_expanded', result })}
            >
              {showAllEvidence
                ? `最初の${INITIAL_EVIDENCE_LIMIT}件だけ表示`
                : `残り${evidenceRecords.length - INITIAL_EVIDENCE_LIMIT}件の根拠意匠を表示`}
            </button>
          ) : null}
        </section>
      ) : null}

      <details className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <summary className="cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <div>
            <div className="text-sm font-bold text-ink">任意：データ・デモ・技術情報</div>
            <p className="mt-1 text-xs leading-5 text-muted">データ範囲、画面共有用の案内、未接続事項を確認するときだけ開いてください。</p>
          </div>
        </summary>
        <div className="mt-4 space-y-5 border-t border-line pt-4">
          {backendContract ? (
            <BackendContractSummaryPanel contract={backendContract} />
          ) : localJpoSummary ? (
            <LocalJpoSummaryPanel summary={localJpoSummary} externalDemoMode={externalDemoMode} demoShowcaseCount={effectiveDemoShowcaseRecords.length} />
          ) : publicSampleSummary ? (
            <PublicSampleSummaryPanel summary={publicSampleSummary} />
          ) : null}
          {localAnalysisPackPanel}
          {externalDemoMode && dataMode !== 'backend' ? <DemoNavigation /> : null}
          {externalDemoMode && dataMode !== 'backend' ? (
            <DemoReadinessPanel
              summary={localJpoSummary}
              sampleSummary={publicSampleSummary}
              demoShowcaseCount={effectiveDemoShowcaseRecords.length}
              result={result}
            />
          ) : null}
          {externalDemoMode && dataMode !== 'backend' ? (
            <PresenterModePanel
              presenterMode={presenterMode}
              onPresenterModeChange={setPresenterMode}
              demoScenario={demoScenario}
              onDemoScenarioChange={(nextScenario) => {
                setDemoScenario(nextScenario);
                setPresenterStepIndex(0);
              }}
              activeScenario={activeScenario}
              activeStepIndex={activeStepIndex}
            />
          ) : null}
          {isPresenterMode && dataMode !== 'backend' ? (
            <DemoScenarioPanel scenario={activeScenario} activeStepIndex={activeStepIndex} onStepSelect={setPresenterStepIndex} />
          ) : null}
          {externalDemoMode && dataMode !== 'backend' ? (
            <ExternalDemoGuide summary={localJpoSummary} sampleSummary={publicSampleSummary} demoShowcaseCount={effectiveDemoShowcaseRecords.length} />
          ) : null}
          {externalDemoMode && dataMode !== 'backend' && effectiveDemoShowcaseRecords.length > 0 ? (
            <DemoShowcasePanel
              records={effectiveDemoShowcaseRecords}
              matches={demoMatches}
              presenterMode={isPresenterMode}
              sampleMode={!localJpoSummary && demoShowcaseRecords.length === 0}
              onOpenEvidence={(id) => selectEvidence('デモ候補の根拠意匠', [id], id)}
            />
          ) : null}
          {externalDemoMode && dataMode !== 'backend' ? <DemoClosingSummaryPanel summary={localJpoSummary} sampleSummary={publicSampleSummary} /> : null}
          {externalDemoMode && dataMode !== 'backend' ? <DemoNoticePanel /> : null}
        </div>
      </details>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="readable-text mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function AnalysisStartGuide() {
  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['注力領域', 'どの企業・分類・物品に意匠が集まっているか'],
          ['変化の兆候', '画像意匠、UI、形状やサービス接点がどう変わっているか'],
          ['戦略の材料', 'ポートフォリオと出願戦略で次に確認すべきこと'],
        ].map(([title, description]) => (
          <div key={title} className="rounded-lg border border-line bg-panel p-4">
            <h3 className="text-sm font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold leading-6 text-accent">
        左の「分析条件を決める」で対象と目的を確認し、「分析を開始」を押すと意匠動向を分析します。
      </p>
    </div>
  );
}

interface PriorityInsight {
  label: string;
  insight: AnalysisInsight;
}

function ExecutiveSummary({
  result,
  records,
  onSelectEvidence,
  onClearProductDomain,
}: {
  result: AnalysisResult;
  records: AnalysisReadyDesignRecord[];
  onSelectEvidence: (label: string, ids: string[]) => void;
  onClearProductDomain: () => void;
}) {
  const priorityInsights = buildPrimaryInsights(result);
  const acceptedIds = new Set(records.map((record) => record.id));
  if (records.length === 0 || priorityInsights.length === 0) {
    return (
      <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-caution">
        <div role="status">
          <p className="font-bold">{records.length === 0 ? 'この条件に一致する意匠はありません。' : '根拠付きの示唆を表示できませんでした。'}</p>
          <p className="mt-1">企業名、商品・事業領域、期間、意匠種別を見直して、もう一度分析してください。</p>
        </div>
        {records.length === 0 && result.request.productDomain?.trim() ? (
          <button
            type="button"
            className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-2 font-semibold text-caution focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onClearProductDomain}
          >
            商品・事業領域の指定を解除
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-5" aria-label="重要な分析結果">
      <button
        type="button"
        data-testid="analysis-record-count-button"
        className="w-full rounded-xl border-2 border-teal-300 bg-teal-50 p-5 text-left transition hover:border-teal-500"
        onClick={() => onSelectEvidence('今回の分析対象意匠数', records.map((record) => record.id))}
      >
        <span className="block text-xs font-bold text-accent">1. 今回の分析対象意匠数</span>
        <span className="mt-2 block text-3xl font-bold text-ink">{formatCount(records.length)}件</span>
        <span className="mt-2 block text-sm font-semibold text-accent">クリックして対象意匠を確認</span>
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">重要な示唆</h3>
          <p className="mt-1 text-sm text-muted">件数から対応する根拠意匠へ移動できる順に、最初に確認したい結果を表示します。</p>
        </div>
        <Badge tone="neutral">{priorityInsights.length}件</Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {priorityInsights.map(({ label, insight }, index) => {
          const evidenceIds = insight.evidenceIds.filter((id) => acceptedIds.has(id));
          return (
            <article key={label} className="rounded-lg border border-teal-200 bg-teal-50/50 p-4" data-testid="priority-insight">
              <h4 className="text-sm font-bold text-ink">{index + 2}. {label}</h4>
              <p className="mt-3 text-sm leading-6 text-ink">{insight.text}</p>
              <button
                type="button"
                data-testid="priority-evidence-button"
                className="mt-3 w-full rounded-md border border-line bg-white p-3 text-left text-sm disabled:cursor-not-allowed disabled:text-muted"
                onClick={() => onSelectEvidence(label, evidenceIds)}
                disabled={evidenceIds.length === 0}
              >
                <span className="block text-xs font-bold text-muted">根拠となる数値</span>
                <span className="mt-1 block font-semibold text-ink">
                  {insight.metric.label}: {formatCount(insight.metric.value)}{insight.metric.unit ?? ''}
                </span>
                <span className="mt-1 block font-semibold text-accent">根拠意匠{formatCount(evidenceIds.length)}件を見る</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildPrimaryInsights(result: AnalysisResult): PriorityInsight[] {
  if (result.market) {
    return [
      { label: '注目トレンド', insight: result.market.trends },
      { label: '商品化領域のヒント', insight: result.market.emergingDomains },
      { label: '企業動向', insight: result.market.companyMoves },
    ].filter(({ insight }) => shouldShowInsight(insight));
  }

  const pickStrongest = (select: (company: CompanyAnalysis) => AnalysisInsight): AnalysisInsight | undefined =>
    result.companies
      .map(select)
      .filter(shouldShowInsight)
      .sort((left, right) => insightStrength(right) - insightStrength(left))[0];
  const candidates: Array<[string, AnalysisInsight | undefined]> = [
    ['注目トレンド', pickStrongest((company) => company.portfolio.strengthening)],
    ['商品化領域のヒント', pickStrongest((company) => company.portfolio.focusAreas)],
    ['企業動向', pickStrongest((company) => company.designTrend.domains)],
  ];
  return candidates
    .filter((candidate): candidate is [string, AnalysisInsight] => Boolean(candidate[1]))
    .map(([label, insight]) => ({ label, insight }));
}

function buildPriorityInsights(result: AnalysisResult): PriorityInsight[] {
  const groups = result.request.purposes.map((purpose) => insightsForPurpose(result, purpose).filter(({ insight }) => shouldShowInsight(insight)));
  const selected: PriorityInsight[] = [];
  const usedInsights = new Set<AnalysisInsight>();

  for (const group of groups) {
    const strongest = [...group]
      .filter(({ insight }) => !usedInsights.has(insight))
      .sort((left, right) => insightStrength(right.insight) - insightStrength(left.insight))[0];
    if (!strongest) continue;
    selected.push(strongest);
    usedInsights.add(strongest.insight);
    if (selected.length === 3) return selected;
  }

  for (const candidate of groups.flat()) {
    if (usedInsights.has(candidate.insight)) continue;
    selected.push(candidate);
    usedInsights.add(candidate.insight);
    if (selected.length === 3) return selected;
  }

  return selected;
}

function insightsForPurpose(result: AnalysisResult, purpose: AnalysisPurpose): PriorityInsight[] {
  const candidates: PriorityInsight[] = [];
  const add = (label: string, insight: AnalysisInsight) => candidates.push({ label, insight });

  if (purpose === 'market_trend' && result.market) {
    add('市場・商品トレンド', result.market.trends);
    add('商品化領域のヒント', result.market.emergingDomains);
    add('企業動向', result.market.companyMoves);
  }

  for (const company of result.companies) {
    if (hasAnyPurpose([purpose], ['market_trend', 'company_trend', 'competitor_design'])) {
      add(`${company.company}：最近の意匠展開領域`, company.designTrend.domains);
      add(`${company.company}：形状変化`, company.designTrend.shapeChange);
      add(`${company.company}：デザイン方向`, company.designTrend.designDirection);
    }
    if (purpose === 'dx_dev') {
      add(`${company.company}：画像意匠の参考領域`, company.dxDevTrend.imageDesignGrowth);
      add(`${company.company}：デジタルサービス展開`, company.dxDevTrend.digitalService);
      add(`${company.company}：AI・IoT関連傾向`, company.dxDevTrend.aiIotTrend);
    }
    if (purpose === 'design_change') {
      add(`${company.company}：サイズ・形状変化`, company.designChange.sizeTrend);
      add(`${company.company}：薄型化`, company.designChange.thinning);
      add(`${company.company}：操作性変化`, company.designChange.usability);
      add(`${company.company}：UI変化`, company.designChange.uiChange);
    }
    if (purpose === 'ui_design') {
      add(`${company.company}：UI変化`, company.designChange.uiChange);
    }
    if (purpose === 'portfolio') {
      add(`${company.company}：集中領域`, company.portfolio.focusAreas);
      add(`${company.company}：相対的に多い領域`, company.portfolio.strengthening);
      add(`${company.company}：確認できない領域の参考候補`, company.portfolio.whitespace);
    }
    if (purpose === 'filing_strategy') {
      add(`${company.company}：意匠保護領域`, company.ipStrategy.designProtectionAreas);
      add(`${company.company}：意匠出願戦略`, company.ipStrategy.designFilingDirection);
      add(`${company.company}：特許出願検討`, company.ipStrategy.patentReference);
      add(`${company.company}：商標保護検討`, company.ipStrategy.trademarkReference);
      add(`${company.company}：著作権保護検討`, company.ipStrategy.copyrightReference);
    }
  }

  return candidates;
}

function insightStrength(insight: AnalysisInsight): number {
  const confidenceScore = insight.confidence === 'high' ? 3 : insight.confidence === 'medium' ? 2 : 1;
  return confidenceScore * 1000 + insight.evidenceIds.length;
}

function hasAnyPurpose(selected: AnalysisPurpose[], candidates: AnalysisPurpose[]): boolean {
  return candidates.some((purpose) => selected.includes(purpose));
}

function DemoNavigation() {
  const items = [
    ['概要', '#overview'],
    ['ランキング', '#rankings'],
    ['分析結果', '#ai-analysis'],
    ['デモ候補', '#demo-candidates'],
    ['根拠意匠詳細', '#evidence-details'],
    ['注意事項', '#notices'],
  ] as const;
  return (
    <nav className="z-10 rounded-lg border border-line bg-white/95 p-3 shadow-soft backdrop-blur lg:sticky lg:top-[73px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted">デモナビ</span>
        {items.map(([label, href]) => (
          <a key={href} className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-teal-300" href={href}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function DemoReadinessPanel({
  summary,
  sampleSummary,
  demoShowcaseCount,
  result,
}: {
  summary: LocalJpoDatasetSummary | null;
  sampleSummary: PublicSampleSummary | null;
  demoShowcaseCount: number;
  result: AnalysisResult | null;
}) {
  const metadataCount = summary?.gazetteDrawingKeysCount ?? sampleSummary?.gazetteDrawingKeysCount ?? 0;
  const drawingRefCount = summary?.drawingRefTotalCount ?? sampleSummary?.drawingRefTotalCount ?? 0;
  const usingSample = !summary && Boolean(sampleSummary);
  const readyForDemo = Boolean((summary || sampleSummary) && result);
  const nextAction = !summary && !sampleSummary
    ? '次に、公開サンプルデータの読み込み状態を確認してください。'
    : !result
      ? '次に、「分析を開始」を押してください。'
      : 'デモ準備は整っています。ランキング、分析結果、デモ候補、根拠意匠詳細の順で説明できます。';

  return (
    <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">デモ準備状況</h2>
          <p className="mt-1 text-sm text-muted">画面共有前に、読み込みと分析実行の状態を確認できます。</p>
        </div>
        <Badge tone={readyForDemo ? 'accent' : 'warning'}>{readyForDemo ? '確認中' : '準備中'}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReadinessItem
          done={Boolean(summary || sampleSummary)}
          label={summary ? '本体JSON読込済み' : usingSample ? '公開サンプルデータ利用中' : 'データ未読込'}
        />
        <ReadinessItem
          done={demoShowcaseCount > 0}
          label={demoShowcaseCount > 0 ? `デモ候補あり（${formatCount(demoShowcaseCount)}件）` : 'デモ候補未読込'}
        />
        <ReadinessItem done label="外部デモモードON" />
        <ReadinessItem done={Boolean(result)} label={result ? '分析実行済み' : '分析未実行'} />
        <ReadinessItem done={metadataCount > 0} label={`公報・図面メタデータあり件数: ${metadataCount > 0 ? `${formatCount(metadataCount)}件` : '-'}`} />
        <ReadinessItem done={drawingRefCount > 0} label={`図面参照数: ${drawingRefCount > 0 ? `${formatCount(drawingRefCount)}件` : '-'}`} />
        <ReadinessItem done label="実データは公開ビルドに含まれていない" />
      </div>
      <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">{nextAction}</p>
    </section>
  );
}

function ReadinessItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`rounded-md border p-3 text-sm font-semibold ${done ? 'border-teal-200 bg-teal-50 text-accent' : 'border-amber-200 bg-amber-50 text-caution'}`}>
      <span className="mr-2">{done ? 'OK' : '未完了'}</span>
      <span className="readable-text">{label}</span>
    </div>
  );
}

function PresenterModePanel({
  presenterMode,
  onPresenterModeChange,
  demoScenario,
  onDemoScenarioChange,
  activeScenario,
  activeStepIndex,
}: {
  presenterMode: boolean;
  onPresenterModeChange: (enabled: boolean) => void;
  demoScenario: DemoScenarioKind;
  onDemoScenarioChange: (scenario: DemoScenarioKind) => void;
  activeScenario: { label: string; steps: DemoScenarioStep[] };
  activeStepIndex: number;
}) {
  const activeStep = activeScenario.steps[activeStepIndex];
  const nextStep = activeScenario.steps[activeStepIndex + 1];
  return (
    <section className="rounded-lg border-2 border-teal-300 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">プレゼンターモード</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            画面共有で説明する順番を前面に出し、細かい開発用情報は必要なときだけ開ける表示にします。
          </p>
        </div>
        <Badge tone={presenterMode ? 'accent' : 'neutral'}>{presenterMode ? 'ON' : 'OFF'}</Badge>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm">
        <input
          className="mt-1"
          type="checkbox"
          checked={presenterMode}
          onChange={(event) => onPresenterModeChange(event.currentTarget.checked)}
        />
        <span>
          <span className="block font-semibold text-ink">プレゼンターモードを有効にする</span>
          <span className="text-muted">見せ場となる数値、Insight、根拠意匠詳細を説明しやすい順番で表示します。</span>
        </span>
      </label>
      <div className="mt-4 rounded-md border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">デモシナリオ</h3>
            <p className="mt-1 text-sm text-muted">選択した流れに応じて、次に見る場所と説明文を表示します。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DEMO_SCENARIOS) as DemoScenarioKind[]).map((scenarioKey) => (
              <button
                key={scenarioKey}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  demoScenario === scenarioKey ? 'border-teal-300 bg-teal-50 text-accent' : 'border-line bg-white text-ink'
                }`}
                type="button"
                onClick={() => onDemoScenarioChange(scenarioKey)}
              >
                {DEMO_SCENARIOS[scenarioKey].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm">
            <div className="font-bold text-accent">今どこを説明しているか</div>
            <div className="readable-text mt-1 text-ink">
              {activeScenario.label} / {activeStepIndex + 1}. {activeStep.label}
            </div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
            <div className="font-bold text-sky-900">次に見る場所</div>
            {nextStep ? (
              <a className="readable-text mt-1 inline-flex font-semibold text-sky-900 underline" href={nextStep.href}>
                {activeStepIndex + 2}. {nextStep.label}
              </a>
            ) : (
              <span className="readable-text mt-1 block text-sky-900">デモ終了時のまとめへ進みます。</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoScenarioPanel({
  scenario,
  activeStepIndex,
  onStepSelect,
}: {
  scenario: { label: string; steps: DemoScenarioStep[] };
  activeStepIndex: number;
  onStepSelect: (index: number) => void;
}) {
  const activeStep = scenario.steps[activeStepIndex];
  return (
    <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">デモシナリオ導線</h2>
          <p className="mt-1 text-sm text-muted">大がかりなツアーではなく、画面内カードとアンカーリンクで説明順を示します。</p>
        </div>
        <Badge tone="accent">{scenario.label}</Badge>
      </div>
      <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4">
        <div className="text-sm font-bold text-sky-900">説明文</div>
        <p className="readable-text mt-1 text-sm leading-6 text-sky-900">{activeStep.description}</p>
      </div>
      <ol className="mt-4 grid gap-2 lg:grid-cols-2">
        {scenario.steps.map((step, index) => (
          <li key={`${scenario.label}-${step.label}`}>
            <a
              className={`block rounded-md border p-3 text-sm ${
                index === activeStepIndex ? 'border-teal-300 bg-teal-50 text-accent' : 'border-line bg-panel text-ink'
              }`}
              href={step.href}
              onClick={() => onStepSelect(index)}
            >
              <span className="font-bold">
                {index + 1}. {step.label}
              </span>
              {index === activeStepIndex ? <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold">現在</span> : null}
              <span className="readable-text mt-1 block leading-5">{step.description}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExternalDemoGuide({
  summary,
  sampleSummary,
  demoShowcaseCount,
}: {
  summary: LocalJpoDatasetSummary | null;
  sampleSummary: PublicSampleSummary | null;
  demoShowcaseCount: number;
}) {
  const metadataCount = summary?.gazetteDrawingKeysCount ?? sampleSummary?.gazetteDrawingKeysCount ?? 0;
  const drawingRefCount = summary?.drawingRefTotalCount ?? sampleSummary?.drawingRefTotalCount ?? 0;
  const isPublicSample = !summary;
  return (
    <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">外部デモモード</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            公開意匠情報から、企業各社や特定他社がどの領域に着目しているか、商品開発傾向・デザイン変化・出願活動の兆候を読み取り、商品企画・知財戦略の検討材料として活用する分析デモです。企業別・分類別・物品名別の集計、ルールベースの参考分析、根拠意匠の確認を行います。
          </p>
        </div>
        <Badge tone="accent">画面共有用</Badge>
      </div>
      {!summary ? <PublicSampleDemoNotice /> : null}
      <DemoMetricHighlights summary={summary} sampleSummary={sampleSummary} demoShowcaseCount={demoShowcaseCount} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-line bg-panel p-4">
          <h3 className="text-sm font-bold text-ink">デモで見るポイント</h3>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-ink">
            <li>① 月次プレビューの件数を見る</li>
            <li>② 企業別・分類別・物品名別ランキングを見る</li>
            <li>③ 分析結果を見る</li>
            <li>④ 根拠意匠IDを開く</li>
            <li>⑤ 公報・図面メタデータを見る</li>
            <li>⑥ 未接続・未解決の課題を確認する</li>
          </ol>
        </div>
        <div className="rounded-md border border-line bg-panel p-4">
          <h3 className="text-sm font-bold text-ink">データスコープ</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <DemoScopeItem label="データ種別" value={isPublicSample ? '公開URL用サンプルデータ（架空データ）' : 'ローカル検証用実データ'} />
            <DemoScopeItem label="公報・図面メタデータあり" value={metadataCount > 0 ? `${formatCount(metadataCount)}件` : '未接続'} />
            <DemoScopeItem label="図面参照数" value={drawingRefCount > 0 ? `${formatCount(drawingRefCount)}件` : '未接続'} />
            <DemoScopeItem label="図面画像本体と外部リンク" value="未接続" />
            <DemoScopeItem label="公開ビルドへの実データ同梱" value="なし" />
          </dl>
          {isPublicSample ? (
            <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
              公開URL版はサンプルデータ・架空データのみで構成しています。実在企業・実在公報ではありません。実データ版は画面共有で説明します。
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div id="demo-strengths" className="scroll-mt-24 rounded-md border border-teal-200 bg-teal-50 p-4">
          <h3 className="text-sm font-bold text-ink">このアプリの強み</h3>
          <p className="mt-2 text-sm leading-6 text-muted">このデモで伝えたいことを、外部向けの検討材料として整理しています。</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink">
            <li>公開意匠情報から、企業各社や特定他社がどの領域に着目しているか、商品開発傾向・デザイン変化・出願活動の兆候を読むための参考情報にします。</li>
            <li>企業別、分類別、物品名別に公開意匠情報を俯瞰し、検討材料として確認できます。</li>
            <li>分析結果だけでなく、根拠となる意匠IDに戻れる点が特徴です。</li>
            <li>一部の意匠では、図面名・画像ファイル名などの公報メタデータまで確認できます。</li>
            <li>社外秘情報を入力せず、公開意匠情報を主対象に分析できます。必要に応じて、特許出願公開、企業IR、プレスリリース等の一般公開情報との照合も検討できます。</li>
          </ul>
        </div>
        <div id="open-improvements" className="scroll-mt-24 rounded-md border border-line bg-panel p-4">
          <h3 className="text-sm font-bold text-ink">現在の未接続・改善予定</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink">
            <li>図面画像本体は未表示です。</li>
            <li>外部リンクは未接続です。</li>
            <li>申請人・権利者コードの名寄せは改善中です。</li>
            <li>分析は現時点ではルールベースです。</li>
            <li>中長期トレンド判断には対象期間拡張が必要です。</li>
            <li>法的判断や出願可否を保証するものではありません。</li>
          </ul>
        </div>
      </div>
      <DemoSecurityPanel isPublicSample={isPublicSample} />
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-caution md:grid-cols-2">
        <li className="rounded-md border border-amber-200 bg-amber-50 p-3">分析結果は参考情報であり、法的助言ではありません。</li>
        <li className="rounded-md border border-amber-200 bg-amber-50 p-3">現時点では図面画像本体や外部リンクは表示していません。</li>
        <li className="rounded-md border border-amber-200 bg-amber-50 p-3">図面画像表示や外部リンクは、著作権・利用条件確認後に検討します。</li>
        <li className="rounded-md border border-amber-200 bg-amber-50 p-3">
          {isPublicSample ? 'この画面は公開URL用の架空サンプルデータ版です。' : 'この画面は画面共有用のローカル検証版です。'}
        </li>
      </ul>
    </section>
  );
}

function PublicSampleDemoNotice() {
  return (
    <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold leading-6 text-sky-900">
      この公開デモはサンプルデータ版です。特許庁実データを用いた検証版は、画面共有でご説明します。
    </p>
  );
}

function DemoSecurityPanel({ isPublicSample }: { isPublicSample: boolean }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-ink">セキュリティ・共有前提</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink">
        <li>{isPublicSample ? '現在は公開URL用の架空サンプルデータ版です。' : '現在はローカル検証版です。'}</li>
        <li>実データは公開ビルドに含まれていません。</li>
        <li>先方の社外秘情報を入力する必要はありません。</li>
        <li>分析対象は公開意匠情報です。</li>
        <li>図面画像本体や外部リンクは未接続です。</li>
        <li>商用導入時は、社内環境・閉域環境・セキュアなクラウド構成を相談可能です。</li>
      </ul>
    </div>
  );
}

function DemoMetricHighlights({
  summary,
  sampleSummary,
  demoShowcaseCount,
}: {
  summary: LocalJpoDatasetSummary | null;
  sampleSummary: PublicSampleSummary | null;
  demoShowcaseCount: number;
}) {
  const isPublicSample = !summary;
  const totalRecords = summary?.totalRecords ?? sampleSummary?.totalRecords;
  const metadataCount = summary?.gazetteDrawingKeysCount ?? sampleSummary?.gazetteDrawingKeysCount;
  const drawingRefCount = summary?.drawingRefTotalCount ?? sampleSummary?.drawingRefTotalCount;
  const metrics = [
    ['意匠データ', totalRecords ? `${formatCount(totalRecords)}件` : '未読込'],
    ['公報・図面メタデータ接続', metadataCount ? `${formatCount(metadataCount)}件` : '未接続'],
    ['図面参照', drawingRefCount ? `${formatCount(drawingRefCount)}件` : '未接続'],
    ['デモ候補', demoShowcaseCount > 0 ? `${formatCount(demoShowcaseCount)}件` : '未読込'],
    ['分析方式', 'ルールベース参考分析'],
    ['画像本体・外部リンク', '未接続'],
  ] as const;

  return (
    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{isPublicSample ? '公開URL用サンプル版の到達点' : '実データ検証版の到達点'}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            {isPublicSample
              ? '架空の公開デモ用サンプルから、企業別・分類別・物品別の集計と、根拠意匠の架空メタデータ確認までを体験できます。'
              : '公開意匠情報から、企業別・分類別・物品別の集計と、根拠意匠の公報・図面メタデータ確認までをローカル検証しています。'}
          </p>
        </div>
        <Badge tone="accent">デモ用サマリー</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-md border border-teal-200 bg-white p-4">
            <dt className="text-xs font-bold text-muted">{label}</dt>
            <dd className="readable-text mt-2 text-xl font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DemoScopeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-2">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="readable-text font-bold text-ink">{value}</dd>
    </div>
  );
}

function BackendContractSummaryPanel({ contract }: { contract: BackendContractAdapterSuccess }) {
  const { meta, summary } = contract;
  const primaryItems = [
    ['contract version', meta.contractVersion],
    ['analysis cutoff', meta.analysisCutoff],
    ['総件数', `${formatCount(summary.totalRecordCount)}件`],
    ['分析対象', `${formatCount(summary.acceptedCount)}件`],
    ['分析対象外', `${formatCount(summary.excludedCount)}件`],
    ['warning', `${formatCount(summary.warningCount)}件`],
    ['quarantined', `${formatCount(summary.quarantinedCount)}件`],
    ['gazetteDate欠損', `${formatCount(summary.missingGazetteDateCount)}件`],
    ['意匠種別unknown', `${formatCount(summary.unknownDesignTypeCount)}件`],
    ['未解決applicant', `${formatCount(summary.unresolvedApplicantCount)}件`],
    ['未解決right holder', `${formatCount(summary.unresolvedRightHolderCount)}件`],
  ] as const;

  return (
    <section id="rankings" className="scroll-mt-24 rounded-lg border border-sky-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Backend Contractデータ概要</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            File APIで選択したContract 0.1.0 JSONをブラウザのメモリ上でデータセット単位に検証し、受理したレコードだけを分析境界へ渡しています。
          </p>
        </div>
        <Badge tone="accent">検証済みsafe subset</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaryItems.map(([label, value]) => (
          <SummaryItem key={label} label={label} value={value} />
        ))}
      </dl>
      <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-muted">
        provenance、内部参照、図面URLは表示・生成していません。件数指標には重複する状態があるため、warningや欠損件数を合算して総件数とは比較しません。
      </p>
    </section>
  );
}

function LocalJpoSummaryPanel({
  summary,
  externalDemoMode,
}: {
  summary: LocalJpoDatasetSummary;
  externalDemoMode: boolean;
  demoShowcaseCount: number;
}) {
  const primaryItems = [
    ['総件数', `${formatCount(summary.totalRecords)}件`],
    ['データ種別', dataPeriodKindLabel(summary.dataPeriodKind)],
    ...(summary.sourceUpdateDateFrom || summary.sourceUpdateDateTo
      ? [['sourceUpdateDate範囲', `${summary.sourceUpdateDateFrom ?? '-'}〜${summary.sourceUpdateDateTo ?? '-'}`]]
      : []),
    ['gazetteDate範囲', `${summary.gazetteDateFrom ?? '-'}〜${summary.gazetteDateTo ?? '-'}`],
    ['公報・図面メタデータあり', `${formatCount(summary.gazetteDrawingKeysCount)}件`],
    ['図面参照あり', `${formatCount(summary.drawingRefsRecordCount)}件`],
    ['図面参照数', `${formatCount(summary.drawingRefTotalCount)}件`],
    ['公報日差異あり', `${formatCount(summary.gazetteDateMismatchCount)}件`],
  ] as const;
  const detailItems = [
    ['registrationNumberあり', `${formatCount(summary.registrationNumberCount)}件`],
    ['applicant情報あり', `${formatCount(summary.applicantsInfoCount)}件`],
    ['名称解決済み候補件数', `${formatCount(summary.namedPartyRecordCount)}件`],
    ['未解決コードあり件数', `${formatCount(summary.unresolvedCodeRecordCount)}件`],
    ['名称未解決applicant codeあり', `${formatCount(summary.unresolvedApplicantsCount)}件`],
    ['rightHoldersあり', `${formatCount(summary.rightHoldersCount)}件`],
    ['名称未解決rightHolder codeあり', `${formatCount(summary.unresolvedRightHoldersCount)}件`],
    ['意匠種別の暫定推定', `${formatCount(summary.inferredDesignKindCount)}件`],
    ['priorityClaims', `あり ${formatCount(summary.priorityClaims.withClaims)}件 / なし ${formatCount(summary.priorityClaims.withoutClaims)}件`],
    ['agents', `あり ${formatCount(summary.agents.withAgents)}件 / なし ${formatCount(summary.agents.withoutAgents)}件`],
  ] as const;

  return (
    <section id="rankings" className="scroll-mt-24 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">ローカル実データ概要</h2>
          <p className="mt-1 text-sm text-muted">{summary.fileName}</p>
        </div>
        <Badge tone="warning">公開ビルドに含めない</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaryItems.map(([label, value]) => (
          <SummaryItem key={label} label={label} value={value} />
        ))}
      </dl>
      {externalDemoMode ? (
        <details className="mt-4 rounded-md border border-line bg-panel p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">開発用の補足指標</summary>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {detailItems.map(([label, value]) => (
              <SummaryItem key={label} label={label} value={value} />
            ))}
          </dl>
        </details>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detailItems.map(([label, value]) => (
            <SummaryItem key={label} label={label} value={value} />
          ))}
        </dl>
      )}
      {summary.dataPeriodDate ? (
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
          {localJpoPeriodNotice(summary)}
        </p>
      ) : null}
      <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-muted">
        現在は公報・図面メタデータのみを表示しています。図面画像本体や外部リンクは、利用条件確認後に対応予定です。
      </p>
      {summary.unresolvedApplicantsCount > 0 || summary.unresolvedRightHoldersCount > 0 ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-caution">
          {externalDemoMode
            ? '一部の申請人・権利者コードは、現在DB側で名寄せ改善中です。'
            : '一部の申請人コードはまだ正式名称に補完できていません。DB側で申請人マスタの拡充が必要です。'}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Ranking title="designClass上位" items={summary.topDesignClasses} />
        <Ranking title="articleName上位" items={summary.topArticleNames} />
        <Ranking title="applicant / rightHolder上位" items={summary.topParties} />
      </div>
      {summary.topUnresolvedCodes.length > 0 ? (
        <details className="mt-4 rounded-md border border-line bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">
            未解決コード一覧（上位{summary.topUnresolvedCodes.length}件）
          </summary>
          <div className="mt-3">
          <Ranking title="未解決コード一覧" items={summary.topUnresolvedCodes} />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function PublicSampleSummaryPanel({ summary }: { summary: PublicSampleSummary }) {
  const primaryItems = [
    ['サンプルデータ件数', `${formatCount(summary.totalRecords)}件`],
    ['サンプルの公報・図面メタデータ件数', `${formatCount(summary.gazetteDrawingKeysCount)}件`],
    ['サンプルの図面参照あり', `${formatCount(summary.drawingRefsRecordCount)}件`],
    ['サンプルの図面参照数', `${formatCount(summary.drawingRefTotalCount)}件`],
  ] as const;

  return (
    <section id="rankings" className="scroll-mt-24 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">公開URL用サンプルデータ概要</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            公開URL版はサンプルデータ・架空データのみで動作します。実在企業・実在公報ではありません。実データ版は画面共有で説明します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">サンプルデータ</Badge>
          <Badge tone="warning">架空データ</Badge>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaryItems.map(([label, value]) => (
          <SummaryItem key={label} label={label} value={value} />
        ))}
      </dl>
      <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
        この公開デモはサンプルデータ版です。特許庁実データを用いた検証版は、画面共有でご説明します。
      </p>
      <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-muted">
        サンプルの図面名・画像ファイル名は架空メタデータです。画像本体、外部リンク、ローカルフルパス、埋め込み画像データは含めていません。
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <Ranking title="サンプル企業上位" items={summary.topParties} />
        <Ranking title="サンプルdesignClass上位" items={summary.topDesignClasses} />
        <Ranking title="サンプルarticleName上位" items={summary.topArticleNames} />
        <Ranking title="サンプル意匠種別" items={summary.designKindCounts} />
      </div>
    </section>
  );
}

function dataPeriodKindLabel(kind: LocalJpoDatasetSummary['dataPeriodKind']): string {
  if (kind === 'monthly_preview') return '月次プレビュー（4週分統合データ）';
  if (kind === 'weekly') return '週次統合データ';
  if (kind === 'daily') return '日次データ';
  return 'ローカルデータ';
}

function localJpoPeriodNotice(summary: LocalJpoDatasetSummary): string {
  if (summary.dataPeriodKind === 'monthly_preview') {
    const monthLabel = formatMonthLabel(summary.dataPeriodDate);
    return `このデータは${monthLabel}の週次更新4回分を統合した月次プレビューです。sourceUpdateDateは更新データの取得週、gazetteDateは意匠公報発行日を示します。直近1年などの分析条件はgazetteDate基準で集計します。`;
  }

  if (summary.dataPeriodKind === 'weekly') {
    return `このデータは ${summary.dataPeriodDate} に取得した週次統合データです。sourceUpdateDateは更新データの取得日、gazetteDateは意匠公報発行日を示します。直近1年などの分析条件はgazetteDate基準で集計します。`;
  }

  if (summary.dataPeriodKind === 'daily') {
    return `このデータは ${summary.dataPeriodDate} に取得した日次データです。gazetteDate範囲には過去日付の更新案件も含まれます。直近1年などの分析条件はgazetteDate基準で集計します。`;
  }

  return 'このデータはローカルJSONとして読み込まれています。gazetteDateを基準に分析期間を集計します。';
}

function formatMonthLabel(value?: string): string {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value ?? '対象月';
  return `${match[1]}年${Number(match[2])}月`;
}

function WarningPanel({ warnings }: { warnings: string[] }) {
  const uniqueWarnings = [...new Set(warnings)];
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-soft">
      <h2 className="text-base font-bold text-caution">読込・分析警告</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-caution">
        {uniqueWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function Ranking({ title, items }: { title: string; items: RankedItem[] }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">該当なし</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-3">
              <span className="readable-text min-w-0 text-ink">{item.label}</span>
              <span className="shrink-0 font-bold text-muted">{item.count}件</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface DemoShowcaseMatch {
  showcase: DemoShowcaseRecord;
  record?: DesignRecord;
}

function DemoShowcasePanel({
  records,
  matches,
  presenterMode,
  sampleMode,
  onOpenEvidence,
}: {
  records: DemoShowcaseRecord[];
  matches: DemoShowcaseMatch[];
  presenterMode: boolean;
  sampleMode: boolean;
  onOpenEvidence: (id: string) => void;
}) {
  const byId = new Map(matches.map((match) => [match.showcase.id, match.record]));
  const [recommended, ...others] = records;
  return (
    <section id="demo-candidates" className="scroll-mt-24 rounded-lg border-2 border-teal-300 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">{presenterMode ? 'おすすめデモ候補' : 'デモで見せやすい根拠意匠候補'}</h2>
          <p className="mt-1 text-sm text-muted">
            {sampleMode
              ? '公開サンプルデータから自動抽出した、架空メタデータを説明しやすい意匠です。公開URL版の見せ場として使えます。'
              : '候補JSONから読み込んだ、図面メタデータを説明しやすい意匠です。画面共有時の見せ場として使えます。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">見せ場</Badge>
          {sampleMode ? <Badge tone="warning">架空データ</Badge> : null}
          <Badge tone="accent">{records.length}件</Badge>
        </div>
      </div>
      {recommended ? (
        <div className="mt-4">
          <DemoShowcaseCard
            showcase={recommended}
            matchedRecord={byId.get(recommended.id)}
            tone="recommended"
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      ) : null}
      {others.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-ink">そのほかのデモ候補</h3>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {others.map((showcase) => (
              <DemoShowcaseCard
                key={showcase.id}
                showcase={showcase}
                matchedRecord={byId.get(showcase.id)}
                tone="normal"
                onOpenEvidence={onOpenEvidence}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DemoShowcaseCard({
  showcase,
  matchedRecord,
  tone,
  onOpenEvidence,
}: {
  showcase: DemoShowcaseRecord;
  matchedRecord?: DesignRecord;
  tone: 'recommended' | 'normal';
  onOpenEvidence: (id: string) => void;
}) {
  const drawingLabels = showcase.drawingLabels.length > 0 ? showcase.drawingLabels.join('、') : '-';
  return (
    <article className={`rounded-md border p-4 ${tone === 'recommended' ? 'border-teal-300 bg-teal-50' : 'border-teal-200 bg-teal-50/60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="readable-text text-sm font-bold text-ink">{showcase.articleName}</h3>
          <p className="readable-text mt-1 text-sm text-muted">{showcase.partyLabel ?? '-'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tone === 'recommended' ? <Badge tone="accent">おすすめ</Badge> : null}
          {matchedRecord ? <Badge tone="accent">詳細接続済み</Badge> : <Badge tone="warning">詳細未照合</Badge>}
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Detail label="登録番号" value={showcase.registrationNumber ?? '-'} />
        <Detail label="出願番号" value={showcase.applicationNumber ?? '-'} />
        <Detail label="公報発行日" value={showcase.gazetteDate ?? '-'} />
        <Detail label="意匠分類" value={showcase.designClass ?? '-'} />
        <Detail label="図面数" value={`${formatCount(showcase.drawingRefCount)}件`} />
        <Detail label="sourceXmlFile" value={safeMetadataValue(showcase.sourceXmlFile)} />
      </dl>
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
        <div className="font-bold text-muted">図面名一覧</div>
        <div className="readable-text mt-1 text-ink">{drawingLabels}</div>
      </div>
      {showcase.whyDemoFriendly ? (
        <p className="readable-text mt-3 rounded-md border border-teal-200 bg-white p-3 text-sm text-accent">
          {showcase.whyDemoFriendly}
        </p>
      ) : null}
      {matchedRecord ? (
        <a
          className="mt-3 inline-flex rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
          href={`#${evidenceDomId(matchedRecord.id)}`}
          onClick={() => onOpenEvidence(matchedRecord.id)}
        >
          詳細を見る
        </a>
      ) : (
        <p className="mt-3 text-sm text-muted">本体JSON内の同一レコードに照合できませんでした。</p>
      )}
    </article>
  );
}

function MarketView({
  market,
  allRecords,
  externalDemoMode,
  onSelectEvidence,
}: {
  market: NonNullable<AnalysisResult['market']>;
  allRecords: EvidenceAvailability[];
  externalDemoMode: boolean;
  onSelectEvidence: (label: string, ids: string[]) => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <h3 className="text-sm font-bold text-ink">市場全体ビュー</h3>
      <InsightGrid
        allRecords={allRecords}
        externalDemoMode={externalDemoMode}
        onSelectEvidence={onSelectEvidence}
        insights={[
          ['市場・商品トレンド', market.trends],
          ['商品化領域のヒント', market.emergingDomains],
          ['企業動向', market.companyMoves],
        ]}
      />
    </div>
  );
}

function CompanyView({
  analysis,
  allRecords,
  externalDemoMode,
  purposes,
  onSelectEvidence,
}: {
  analysis: CompanyAnalysis;
  allRecords: EvidenceAvailability[];
  externalDemoMode: boolean;
  purposes: AnalysisPurpose[];
  onSelectEvidence: (label: string, ids: string[]) => void;
}) {
  const designChangeInsights: [string, AnalysisInsight][] = purposes.includes('design_change')
    ? [
        ['大型化／小型化', analysis.designChange.sizeTrend],
        ['薄型化', analysis.designChange.thinning],
        ['操作性変化', analysis.designChange.usability],
        ['UI変化', analysis.designChange.uiChange],
      ]
    : [['UI変化', analysis.designChange.uiChange]];

  return (
    <article className="mt-6 border-t border-line pt-5">
      <h3 className="text-lg font-bold text-ink">{analysis.company}</h3>
      {hasAnyPurpose(purposes, ['market_trend', 'company_trend', 'competitor_design']) ? (
        <ResultGroup
          title="意匠動向"
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          onSelectEvidence={onSelectEvidence}
          insights={[
            ['最近の意匠展開領域', analysis.designTrend.domains],
            ['形状変化', analysis.designTrend.shapeChange],
            ['デザイン方向', analysis.designTrend.designDirection],
          ]}
        />
      ) : null}
      {purposes.includes('dx_dev') ? (
        <ResultGroup
          title="DX商品開発動向"
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          onSelectEvidence={onSelectEvidence}
          insights={[
            ['画像意匠の参考領域', analysis.dxDevTrend.imageDesignGrowth],
            ['デジタルサービス展開', analysis.dxDevTrend.digitalService],
            ['AI・IoT関連傾向', analysis.dxDevTrend.aiIotTrend],
          ]}
        />
      ) : null}
      {hasAnyPurpose(purposes, ['design_change', 'ui_design']) ? (
        <ResultGroup
          title="デザイン変化分析"
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          insights={designChangeInsights}
          onSelectEvidence={onSelectEvidence}
        />
      ) : null}
      {purposes.includes('portfolio') ? (
        <ResultGroup
          title="意匠ポートフォリオ分析"
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          onSelectEvidence={onSelectEvidence}
          insights={[
            ['集中領域', analysis.portfolio.focusAreas],
            ['相対的に多い領域', analysis.portfolio.strengthening],
            ['確認できない領域の参考候補', analysis.portfolio.whitespace],
          ]}
        />
      ) : null}
      {purposes.includes('filing_strategy') ? (
        <ResultGroup
          title="知財戦略の検討材料"
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          onSelectEvidence={onSelectEvidence}
          insights={[
            ['意匠保護領域', analysis.ipStrategy.designProtectionAreas],
            ['意匠出願戦略の方向性', analysis.ipStrategy.designFilingDirection],
            ['特許出願検討への参考情報', analysis.ipStrategy.patentReference],
            ['商標保護検討への参考情報', analysis.ipStrategy.trademarkReference],
            ['著作権保護検討への参考情報', analysis.ipStrategy.copyrightReference],
          ]}
        />
      ) : null}
    </article>
  );
}

function ResultGroup({
  title,
  insights,
  allRecords,
  externalDemoMode,
  onSelectEvidence,
}: {
  title: string;
  insights: [string, AnalysisInsight][];
  allRecords: EvidenceAvailability[];
  externalDemoMode: boolean;
  onSelectEvidence: (label: string, ids: string[]) => void;
}) {
  const visibleInsights = insights.filter(([, insight]) => shouldShowInsight(insight));
  if (visibleInsights.length === 0) return null;

  return (
    <section className="mt-4">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <InsightGrid
        insights={visibleInsights}
        allRecords={allRecords}
        externalDemoMode={externalDemoMode}
        onSelectEvidence={onSelectEvidence}
      />
    </section>
  );
}

function InsightGrid({
  insights,
  allRecords,
  externalDemoMode,
  onSelectEvidence,
}: {
  insights: [string, AnalysisInsight][];
  allRecords: EvidenceAvailability[];
  externalDemoMode: boolean;
  onSelectEvidence: (label: string, ids: string[]) => void;
}) {
  const visibleInsights = insights.filter(([, insight]) => shouldShowInsight(insight));
  if (visibleInsights.length === 0) {
    return <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm text-muted">表示できる根拠付きInsightはありません。</p>;
  }
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-3">
      {visibleInsights.map(([title, insight]) => (
        <InsightView
          key={title}
          title={title}
          insight={insight}
          allRecords={allRecords}
          externalDemoMode={externalDemoMode}
          onSelectEvidence={onSelectEvidence}
        />
      ))}
    </div>
  );
}

function InsightView({
  title,
  insight,
  allRecords,
  externalDemoMode,
  onSelectEvidence,
}: {
  title: string;
  insight: AnalysisInsight;
  allRecords: EvidenceAvailability[];
  externalDemoMode: boolean;
  onSelectEvidence: (label: string, ids: string[]) => void;
}) {
  const [metadataOnly, setMetadataOnly] = useState(false);
  const gazetteEvidenceCount = countGazetteMetadataEvidence(insight, allRecords);
  const recordsById = new Map(allRecords.map((record) => [record.id, record]));
  const availableEvidenceIds = insight.evidenceIds.filter((id) => recordsById.has(id));
  const evidenceIds = externalDemoMode && metadataOnly
    ? availableEvidenceIds.filter((id) => recordsById.get(id)?.hasDrawingMetadata === true)
    : availableEvidenceIds;
  const developerDetails = (
    <dl className="grid gap-2 text-xs text-muted">
      <div>
        <dt className="font-bold">title</dt>
        <dd className="readable-text">{insight.title}</dd>
      </div>
      <div>
        <dt className="font-bold">metric</dt>
        <dd>
          {insight.metric.label}: {formatCount(insight.metric.value)}
          {insight.metric.unit ?? ''}
          {insight.metric.comparison ? ` / ${insight.metric.comparison}` : ''}
        </dd>
      </div>
      <div>
        <dt className="font-bold">evidenceIds</dt>
        <dd className="flex flex-wrap gap-1">
          {evidenceIds.length > 0
            ? evidenceIds.map((id) => (
                <a key={id} className="font-semibold text-accent underline" href={`#${evidenceDomId(id)}`}>
                  {id}
                </a>
              ))
            : 'なし'}
        </dd>
      </div>
    </dl>
  );
  return (
    <div className={`rounded-md border p-4 ${externalDemoMode ? 'border-teal-200 bg-white' : 'border-line bg-panel'}`}>
      <h5 className="text-sm font-bold text-ink">{title}</h5>
      <p className="readable-text mt-3 text-sm leading-6 text-ink">{insight.text}</p>
      <button
        type="button"
        data-testid="insight-evidence-button"
        className="mt-3 w-full rounded-md border border-line bg-panel p-3 text-left text-sm disabled:cursor-not-allowed disabled:text-muted"
        onClick={() => onSelectEvidence(title, evidenceIds)}
        disabled={evidenceIds.length === 0}
      >
          <span className="block font-bold text-muted">件数・対象数</span>
          <span className="readable-text mt-1 block text-ink">
            {insight.metric.label}: {formatCount(insight.metric.value)}
            {insight.metric.unit ?? ''}
            {insight.metric.comparison ? ` / ${insight.metric.comparison}` : ''}
            {evidenceIds.length > 0 ? ` ／ 根拠意匠を見る（${formatCount(evidenceIds.length)}件）` : ''}
          </span>
      </button>
      {gazetteEvidenceCount > 0 ? (
        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
          <p>
            図面メタデータあり：{formatCount(insight.evidenceIds.length)}件中{formatCount(gazetteEvidenceCount)}件
          </p>
          {externalDemoMode ? (
            <div className="mt-3 rounded-md border border-sky-200 bg-white p-3">
              <label className="flex items-start gap-2">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={metadataOnly}
                  disabled={gazetteEvidenceCount === insight.evidenceIds.length}
                  onChange={(event) => setMetadataOnly(event.currentTarget.checked)}
                />
                <span>
                  <span className="block font-bold">図面メタデータありの根拠だけ表示</span>
                  <span className="block font-normal leading-5 text-sky-900">
                    図面名・画像ファイル名が確認できる根拠意匠に絞ります。
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
      {externalDemoMode ? (
        <details className="mt-3 rounded-md border border-line bg-panel p-3">
          <summary className="cursor-pointer text-xs font-bold text-muted">開発用の根拠情報</summary>
          <div className="mt-3">{developerDetails}</div>
        </details>
      ) : (
        <div className="mt-3">{developerDetails}</div>
      )}
    </div>
  );
}

function BackendEvidenceRecord({
  record,
  forceOpen,
}: {
  record: BackendRecordViewModel;
  forceOpen: boolean;
}) {
  const applicantLabel = backendPartyNameListValue(record.applicants);
  const rightHolderLabel = backendPartyNameListValue(record.rightHolders);
  const companyLabel = applicantLabel !== '-' ? applicantLabel : rightHolderLabel;
  const designTypeLabel = record.designType === 'unknown' ? '不明' : DESIGN_KIND_LABELS[record.designType];
  const hasPrimaryClassification = record.classifications.some((classification) => classification.isPrimary);
  const hasRepresentativeCandidate = record.drawings.some((drawing) => drawing.isRepresentativeCandidate);
  const customerClassificationLabel = backendCustomerClassificationValue(record.classifications);
  const visibleDrawings = record.drawings.slice(0, INITIAL_DRAWING_LIMIT);
  const remainingDrawings = record.drawings.slice(INITIAL_DRAWING_LIMIT);
  const description = record.description ?? record.articleDescription ?? '-';

  return (
    <details id={evidenceDomId(record.id)} className="scroll-mt-24 rounded-md border border-sky-200 bg-sky-50/40 p-4" open={forceOpen || undefined}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="readable-text font-bold text-ink">
              {record.articleName ?? '物品名・画像の用途 未取得'}
            </h3>
            <p className="readable-text mt-1 text-sm text-muted">
              {companyLabel} / {designTypeLabel}
            </p>
          </div>
        </div>
      </summary>
      <div className="mt-4 space-y-3">
        <section className="rounded-md border border-line bg-white p-4" data-testid="backend-customer-details">
          <h4 className="text-sm font-bold text-ink">意匠情報</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="企業名" value={companyLabel} />
            <Detail label="物品名・画像の用途" value={record.articleName ?? '-'} />
            <Detail label="意匠種別" value={designTypeLabel} />
            <Detail label="意匠分類" value={customerClassificationLabel} />
            <Detail label="出願番号" value={record.applicationNumber ?? '-'} />
            <Detail label="登録番号" value={record.registrationNumber ?? '-'} />
            <Detail label="公報番号" value={record.publication?.gazetteNumber ?? '-'} />
            <Detail label="公報発行日" value={record.publication?.issueDate ?? '-'} />
          </dl>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="意匠の説明" value={description} />
            <Detail label="取得済み図面" value={`${formatCount(record.drawings.length)}件`} />
          </dl>
        </section>

        <section className="rounded-md border border-line bg-white p-4">
          <h4 className="text-sm font-bold text-ink">取得済みの図面情報</h4>
          {record.drawings.length > 0 ? (
            <>
              <ol className="mt-3 space-y-2 text-sm text-ink">
                {visibleDrawings.map((drawing) => (
                  <li key={drawing.order} className="rounded-md bg-panel px-3 py-2">
                    {drawing.label ?? '図面名未取得'}
                  </li>
                ))}
              </ol>
              {remainingDrawings.length > 0 ? (
                <details className="mt-3 rounded-md border border-line bg-panel p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">
                    残り{formatCount(remainingDrawings.length)}件の図面名を見る
                  </summary>
                  <ol className="mt-3 space-y-2 text-sm text-ink">
                    {remainingDrawings.map((drawing) => (
                      <li key={drawing.order} className="rounded-md bg-white px-3 py-2">
                        {drawing.label ?? '図面名未取得'}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">取得済みの図面情報はありません。</p>
          )}
          <p className="mt-3 text-xs leading-5 text-muted">図面画像本体と外部リンクは表示していません。</p>
        </section>

        <details className="rounded-md border border-slate-300 bg-slate-50 p-4" data-testid="backend-technical-details">
          <summary className="cursor-pointer text-sm font-bold text-ink">技術・検証情報</summary>
          <div className="mt-4 space-y-3">
            <section className="rounded-md border border-line bg-white p-4">
              <h4 className="text-sm font-bold text-ink">内部状態</h4>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <Detail label="stable id" value={record.id} />
                <Detail label="quality" value={record.quality.state} />
                <Detail
                  label="analysis disposition"
                  value={
                    record.adapterDisposition.status === 'accepted'
                      ? 'accepted'
                      : `excluded: ${record.adapterDisposition.exclusionReasons.join(', ')}`
                  }
                />
                <Detail label="gazetteDate" value={record.gazetteDate ?? '-'} />
                <Detail label="applicationDate" value={record.applicationDate ?? '-'} />
                <Detail label="registrationDate" value={record.registrationDate ?? '-'} />
                <Detail label="applicant resolution" value={backendPartyTechnicalValue(record.applicants)} />
                <Detail label="right holder resolution" value={backendPartyTechnicalValue(record.rightHolders)} />
                <Detail label="未解決applicant" value={backendUnresolvedSummary(record.unresolved.applicants)} />
                <Detail label="未解決right holder" value={backendUnresolvedSummary(record.unresolved.rightHolders)} />
              </dl>
            </section>

            <section className="rounded-md border border-line bg-white p-4">
              <h4 className="text-sm font-bold text-ink">分類の取得値</h4>
              {!hasPrimaryClassification ? (
                <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
                  主分類は未選定です。先頭の分類を主分類として扱っていません。
                </p>
              ) : null}
              <ul className="mt-3 space-y-2 text-sm text-ink">
                {record.classifications.map((classification) => (
                  <li
                    key={classificationMembershipKey(classification)}
                    className="rounded-md bg-panel px-3 py-2"
                    data-classification-role={classification.isPrimary ? 'primary' : 'supplemental'}
                  >
                    <Badge tone={classification.isPrimary ? 'accent' : 'neutral'}>
                      {classification.isPrimary ? '主分類' : '補助分類'}
                    </Badge>{' '}
                    {classification.scheme} / {classification.code} / {classification.label ?? 'label未設定'}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border border-line bg-white p-4">
              <h4 className="text-sm font-bold text-ink">publicationの取得値</h4>
              {record.publication ? (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <Detail label="gazetteNumber" value={record.publication.gazetteNumber ?? '-'} />
                  <Detail label="publicationDocumentId" value={record.publication.publicationDocumentId ?? '-'} />
                  <Detail label="issueDate" value={record.publication.issueDate ?? '-'} />
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted">publicationはnullです。別フィールドから補完していません。</p>
              )}
            </section>

            <section className="rounded-md border border-line bg-white p-4">
              <h4 className="text-sm font-bold text-ink">drawingの取得値</h4>
              {record.drawings.length > 0 ? (
                <>
                  {!hasRepresentativeCandidate ? (
                    <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
                      代表候補は未選定です。候補フラグがない図面を自動的に代表へ昇格していません。
                    </p>
                  ) : null}
                  <ol className="mt-3 space-y-2 text-sm text-ink">
                    {record.drawings.map((drawing) => (
                      <li
                        key={drawing.order}
                        className="rounded-md bg-panel px-3 py-2"
                        data-representative-candidate={drawing.isRepresentativeCandidate ? 'true' : undefined}
                      >
                        order {drawing.order}: {drawing.drawingId} / {drawing.label ?? 'label未設定'} / {drawing.fileName ?? 'fileName未設定'} /{' '}
                        {drawing.mediaType ?? 'mediaType未設定'}
                        {drawing.isRepresentativeCandidate ? ' / 代表候補' : ''}
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">図面メタデータはありません。</p>
              )}
            </section>

            {record.quality.findings.length > 0 || record.quality.duplicateCandidates.length > 0 ? (
              <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <h4 className="text-sm font-bold text-caution">quality notices</h4>
                {record.quality.findings.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-caution">
                    {record.quality.findings.map((finding, index) => (
                      <li key={`${finding.code}:${index}`}>{finding.code} / {finding.severity}</li>
                    ))}
                  </ul>
                ) : null}
                {record.quality.duplicateCandidates.length > 0 ? (
                  <p className="mt-2 text-sm text-caution">duplicate candidates: {record.quality.duplicateCandidates.join(', ')}</p>
                ) : null}
              </section>
            ) : null}
          </div>
        </details>
      </div>
    </details>
  );
}

function EvidenceRecord({
  record,
  externalDemoMode,
  presenterMode,
  forceOpen,
}: {
  record: DesignRecord;
  externalDemoMode: boolean;
  presenterMode: boolean;
  forceOpen: boolean;
}) {
  const hasGazetteDrawingKeys = Boolean(record.gazetteDrawingKeys);
  const partyLabel =
    displayPartyLabel(record.applicantsDisplay) ||
    partyListValue(record.applicants) ||
    partyListValue(record.rightHolders) ||
    displayPartyLabel(record.applicant) ||
    record.applicant;
  return (
    <details id={evidenceDomId(record.id)} className="scroll-mt-24 rounded-md border border-line bg-panel p-4" open={forceOpen || undefined}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="readable-text font-bold text-ink">
              {record.id} / {record.articleName}
            </h3>
            <p className="readable-text mt-1 text-sm text-muted">
              {partyLabel} /{' '}
              {DESIGN_KIND_LABELS[record.designKind]}
              {record.designKindInferred ? '（推定）' : ''} / {record.businessDomain}
            </p>
          </div>
          <Badge tone={record.isSample ? 'accent' : 'warning'}>{record.sourceLabel}</Badge>
        </div>
      </summary>
      <div className="mt-4">
        {!record.isSample ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-caution">
            {hasGazetteDrawingKeys
              ? '一部レコードでは公報・図面メタデータを接続済みです。図面画像本体と外部リンクは未接続です。'
              : '公報・図面リンクは未接続です。今後、公報・画像メタデータ取得後に対応予定です。'}
          </p>
        ) : null}
        {(record.unresolvedApplicants?.length ?? 0) > 0 || (record.unresolvedRightHolders?.length ?? 0) > 0 ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-caution">
            {externalDemoMode
              ? '一部の申請人・権利者コードは、現在DB側で名寄せ改善中です。'
            : '一部の申請人コードはまだ正式名称に補完できていません。DB側で申請人マスタの拡充が必要です。'}
          </p>
        ) : null}
        {externalDemoMode && presenterMode ? (
          <>
            <EvidenceShowcaseSummary record={record} partyLabel={partyLabel} />
            <section className="mt-3 rounded-md border border-line bg-white p-4">
              <h4 className="text-sm font-bold text-ink">B. 基本情報</h4>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <Detail label="出願番号" value={record.applicationNumber ?? '-'} />
                <Detail label="登録番号" value={record.registrationNumber ?? '-'} />
                <Detail label="公報発行日" value={record.gazetteDate} />
                <Detail label="意匠分類" value={`${record.designClass} ${record.classLabel ?? ''}`.trim()} />
              </dl>
            </section>
          </>
        ) : externalDemoMode ? (
          <section className="rounded-md border border-line bg-white p-4">
            <h4 className="text-sm font-bold text-ink">A. 基本情報</h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Detail label="物品名" value={record.articleName} />
              <Detail label="出願人 / 権利者" value={partyLabel} />
              <Detail label="登録番号" value={record.registrationNumber ?? '-'} />
              <Detail label="出願番号" value={record.applicationNumber ?? '-'} />
              <Detail label="公報発行日" value={record.gazetteDate} />
              <Detail label="意匠分類" value={`${record.designClass} ${record.classLabel ?? ''}`.trim()} />
            </dl>
          </section>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Detail label="record.id" value={record.id} />
              <Detail label="物品名" value={record.articleName} />
              <Detail label="applicants" value={partyLabel} />
              <Detail label="rightHolders" value={partyListValue(record.rightHolders)} />
              <Detail label="applicationNumber" value={record.applicationNumber ?? '-'} />
              <Detail label="registrationNumber" value={record.registrationNumber ?? '-'} />
              <Detail label="applicationDate" value={record.applicationDate ?? '-'} />
              <Detail label="registrationDate" value={record.registrationDate ?? '-'} />
              <Detail label="sourceUpdateDate" value={record.sourceUpdateDate ?? '-'} />
              <Detail label="gazetteDate" value={record.gazetteDate} />
              <Detail label="designClass" value={`${record.designClass} ${record.classLabel ?? ''}`.trim()} />
              <Detail label="priorityClaims" value={listValue(record.priorityClaims)} />
              <Detail label="sourceDataset" value={record.sourceDataset ?? record.sourceLabel} />
            </dl>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <Detail label="designDescription" value={record.designDescription ?? record.summary ?? '-'} />
              <Detail label="articleDescription" value={record.articleDescription ?? '-'} />
              <Detail label="sourceFiles" value={listValue(record.sourceFiles)} />
              <Detail label="unresolvedApplicants" value={listValue(record.unresolvedApplicants)} />
              <Detail label="unresolvedRightHolders" value={listValue(record.unresolvedRightHolders)} />
              <Detail label="creators" value={listValue(record.creators)} />
            </dl>
          </>
        )}
        <GazetteDrawingMetadata
          record={record}
          externalDemoMode={externalDemoMode}
          sectionTitle={externalDemoMode && presenterMode ? 'C. 公報・図面メタデータ' : undefined}
        />
        {externalDemoMode ? (
          <section className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-bold text-caution">{presenterMode ? 'D. 注意' : 'C. 注意'}</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-caution">
              <li>画像本体と外部リンクは未接続です。</li>
              <li>図面画像表示や外部リンクは利用条件確認後に検討します。</li>
            </ul>
          </section>
        ) : null}
        {record.isSample ? (
          <>
            <p className="mt-3 text-sm leading-6 text-ink">{record.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...record.keywords, ...record.designFeatures].map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}

function EvidenceShowcaseSummary({ record, partyLabel }: { record: DesignRecord; partyLabel: string }) {
  const keys = record.gazetteDrawingKeys;
  const drawingRefs = keys?.drawingRefs ?? [];
  const drawingCount = keys?.drawingRefCount ?? drawingRefs.length;
  const representativeLabels = drawingRefs
    .map((ref) => ref.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
  return (
    <section className="rounded-md border border-teal-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-ink">A. 見せ場サマリー</h4>
        {keys ? <Badge tone="accent">公報・図面メタデータ接続済み</Badge> : <Badge tone="warning">公報・図面メタデータ未接続</Badge>}
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
        <Detail label="物品名" value={record.articleName} />
        <Detail label="出願人 / 権利者" value={partyLabel} />
        <Detail label="登録番号" value={record.registrationNumber ?? '-'} />
        <Detail label="図面数" value={`${formatCount(drawingCount)}件`} />
        <Detail label="図面名の代表3件" value={representativeLabels.length > 0 ? representativeLabels.join('、') : '-'} />
      </dl>
    </section>
  );
}

function GazetteDrawingMetadata({
  record,
  externalDemoMode,
  sectionTitle,
}: {
  record: DesignRecord;
  externalDemoMode: boolean;
  sectionTitle?: string;
}) {
  const keys = record.gazetteDrawingKeys;
  const isSampleMetadata = Boolean(record.isSample);
  if (!keys) {
    return (
      <section className="mt-3 rounded-md border border-slate-200 bg-white p-4">
        {externalDemoMode ? <h4 className="text-sm font-bold text-ink">{sectionTitle ?? 'B. 公報・図面メタデータ'}</h4> : null}
        <p className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-muted">
          この意匠には、まだ公報・図面メタデータが接続されていません。
        </p>
      </section>
    );
  }
  const drawingRefs = keys.drawingRefs ?? [];
  const hasRepresentativeCandidate = drawingRefs.some((ref) => ref.isRepresentativeCandidate);

  return (
    <section className="mt-3 rounded-md border border-sky-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-ink">{externalDemoMode ? (sectionTitle ?? 'B. 公報・図面メタデータ') : '公報・図面メタデータあり'}</h4>
        {externalDemoMode ? <Badge tone="accent">{isSampleMetadata ? '架空サンプルメタデータ' : '公報・図面メタデータあり'}</Badge> : null}
        <Badge tone="warning">画像本体・外部リンク未接続</Badge>
      </div>
      {isSampleMetadata ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold leading-6 text-sky-900">
          これは公開デモ用の架空メタデータです。実在企業・実在公報ではありません。
        </p>
      ) : null}
      {keys.gazetteDateMismatch ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-caution">
          注意：月次DesignRecord側のgazetteDateと公報XML側のgazetteDateが一致していません。月次側の日付は上書きしていません。
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Detail label={externalDemoMode ? '発行日 issueDate' : 'issueDate'} value={keys.issueDate ?? '-'} />
        <Detail label={externalDemoMode ? '号数 issueNumber' : 'issueNumber'} value={keys.issueNumber ?? '-'} />
        <Detail label={externalDemoMode ? '突合方法 matchedBy' : 'matchedBy'} value={keys.matchedBy ?? '-'} />
        <Detail label={externalDemoMode ? '図面数 drawingRefCount' : 'drawingRefCount'} value={`${keys.drawingRefCount ?? keys.drawingRefs?.length ?? 0}件`} />
        <Detail label="sourceXmlFile" value={safeMetadataValue(keys.sourceXmlFile)} />
      </dl>
      {drawingRefs.length > 0 ? (
        <div className="mt-3">
          {!hasRepresentativeCandidate ? (
            <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
              代表候補は未選定です。候補フラグ未設定を公式な否定判断として扱っていません。
            </p>
          ) : null}
          <p className="mb-2 text-xs text-muted sm:hidden">表は横にスクロールできます。</p>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3">図面順序 order</th>
                <th className="py-2 pr-3">図面名</th>
                <th className="py-2 pr-3">画像ファイル名</th>
                <th className="py-2 pr-3">画像形式 fileType</th>
                <th className="py-2 pr-3">代表候補（作業用）</th>
                <th className="py-2 pr-3">sourceXmlFile</th>
              </tr>
            </thead>
            <tbody>
              {drawingRefs.map((ref, index) => (
                <tr key={`${ref.fileName ?? 'drawing'}-${index}`} className="border-b border-line/70 align-top">
                  <td className="py-2 pr-3 font-semibold text-muted">{ref.order ?? '-'}</td>
                  <td className="readable-text py-2 pr-3 text-ink">{ref.label ?? '-'}</td>
                  <td className="readable-text py-2 pr-3 text-ink">{safeMetadataValue(ref.fileName)}</td>
                  <td className="py-2 pr-3 text-ink">{ref.fileType ?? '-'}</td>
                  <td className="py-2 pr-3 text-ink">{ref.isRepresentativeCandidate ? '候補' : '-'}</td>
                  <td className="readable-text py-2 pr-3 text-ink">{safeMetadataValue(ref.sourceXmlFile)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-muted">図面参照はありません。</p>
      )}
    </section>
  );
}

function DemoClosingSummaryPanel({
  summary,
  sampleSummary,
}: {
  summary: LocalJpoDatasetSummary | null;
  sampleSummary: PublicSampleSummary | null;
}) {
  const isPublicSample = !summary;
  const totalRecords = summary?.totalRecords ?? sampleSummary?.totalRecords;
  const metadataCount = summary?.gazetteDrawingKeysCount ?? sampleSummary?.gazetteDrawingKeysCount;
  return (
    <section id="demo-closing" className="scroll-mt-24 rounded-lg border border-teal-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">現時点の到達点</h2>
          <p className="mt-1 text-sm text-muted">デモ終了時に、検証できている範囲と次フェーズをまとめて説明できます。</p>
        </div>
        <Badge tone="accent">まとめ</Badge>
      </div>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-ink md:grid-cols-2">
        <li className="rounded-md border border-line bg-panel p-3">
          {isPublicSample ? '公開URL版はサンプルデータ・架空データのみで構成しています。' : '特許庁実データを用いたローカル検証版です。'}
        </li>
        <li className="rounded-md border border-line bg-panel p-3">
          {totalRecords ? `${formatCount(totalRecords)}件の意匠データを対象に分析可能です。` : 'データ読み込み後に、対象件数を表示します。'}
        </li>
        <li className="rounded-md border border-line bg-panel p-3">企業別・分類別・物品名別の参考傾向を確認可能です。</li>
        <li className="rounded-md border border-line bg-panel p-3">Insightから根拠意匠IDに戻れます。</li>
        <li className="rounded-md border border-line bg-panel p-3">
          {metadataCount
            ? `${formatCount(metadataCount)}件で公報・図面メタデータまで確認できます。`
            : '一部の意匠では公報・図面メタデータまで接続できます。'}
        </li>
        <li className="rounded-md border border-line bg-panel p-3">
          {isPublicSample ? '実データ版は画面共有で説明します。' : '次フェーズは名寄せ改善、公報・図面リンク方針、対象期間拡張です。'}
        </li>
      </ul>
    </section>
  );
}

function DemoNoticePanel() {
  return (
    <section id="notices" className="scroll-mt-24 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-soft">
      <h2 className="text-base font-bold text-caution">注意事項</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-caution md:grid-cols-2">
        <li className="rounded-md border border-amber-200 bg-white p-3">本画面は公開URLではサンプルデータ版、実データ利用時はローカル検証版です。</li>
        <li className="rounded-md border border-amber-200 bg-white p-3">実データは公開ビルドに含まれていません。</li>
        <li className="rounded-md border border-amber-200 bg-white p-3">公開URL版のデータは架空データで、実在企業・実在公報ではありません。</li>
        <li className="rounded-md border border-amber-200 bg-white p-3">分析結果は参考情報であり、法的助言ではありません。</li>
        <li className="rounded-md border border-amber-200 bg-white p-3">図面画像本体と外部リンクは未接続です。</li>
        <li className="rounded-md border border-amber-200 bg-white p-3 md:col-span-2">
          図面画像表示や外部リンクは、著作権・利用条件確認後に検討します。
        </li>
      </ul>
    </section>
  );
}

function buildPublicSampleSummary(records: DesignRecord[]): PublicSampleSummary | null {
  const sampleRecords = records.filter((record) => record.isSample);
  if (sampleRecords.length === 0) return null;
  const recordsWithDrawingRefs = sampleRecords.filter((record) => (record.gazetteDrawingKeys?.drawingRefs?.length ?? 0) > 0);
  return {
    totalRecords: sampleRecords.length,
    gazetteDrawingKeysCount: sampleRecords.filter((record) => Boolean(record.gazetteDrawingKeys)).length,
    drawingRefsRecordCount: recordsWithDrawingRefs.length,
    drawingRefTotalCount: sampleRecords.reduce((sum, record) => sum + (record.gazetteDrawingKeys?.drawingRefs?.length ?? 0), 0),
    topDesignClasses: buildRanking(sampleRecords.map((record) => record.designClass)),
    topArticleNames: buildRanking(sampleRecords.map((record) => record.articleName)),
    topParties: buildRanking(sampleRecords.map((record) => displayPartyLabel(record.applicantsDisplay) ?? record.applicant)),
    designKindCounts: buildRanking(sampleRecords.map((record) => DESIGN_KIND_LABELS[record.designKind])),
  };
}

function buildSampleDemoShowcaseRecords(records: DesignRecord[]): DemoShowcaseRecord[] {
  return records
    .filter((record) => record.isSample && record.gazetteDrawingKeys?.hasDrawingRefs)
    .slice(0, 8)
    .map((record) => {
      const keys = record.gazetteDrawingKeys;
      const drawingRefs = keys?.drawingRefs ?? [];
      return {
        id: record.id,
        articleName: record.articleName,
        partyLabel: displayPartyLabel(record.applicantsDisplay) ?? record.applicant,
        registrationNumber: record.registrationNumber,
        applicationNumber: record.applicationNumber,
        gazetteDate: record.gazetteDate,
        designClass: record.designClass,
        drawingRefCount: keys?.drawingRefCount ?? drawingRefs.length,
        drawingLabels: drawingRefs.map((ref) => ref.label).filter((label): label is string => Boolean(label)),
        sourceXmlFile: keys?.sourceXmlFile,
        whyDemoFriendly: '公開URL版で見せやすい架空サンプルです。図面名・画像ファイル名・図面順序を確認できます。',
      };
    });
}

function buildRanking(values: string[], limit = 8): RankedItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ja-JP'))
    .slice(0, limit);
}

function listValue(values?: string[]): string {
  return values && values.length > 0 ? values.join('、') : '-';
}

function partyListValue(values?: string[]): string {
  const labels = values?.map((value) => displayPartyLabel(value) ?? value).filter(Boolean);
  return labels && labels.length > 0 ? labels.join('、') : '-';
}

function backendPartyNameListValue(parties: BackendRecordViewModel['applicants']): string {
  if (parties.length === 0) return '-';
  return parties
    .map((party) => party.displayName ?? party.normalizedNameCandidate ?? party.rawName ?? '名称未設定')
    .join('、');
}

function backendPartyTechnicalValue(parties: BackendRecordViewModel['applicants']): string {
  if (parties.length === 0) return '-';
  return parties
    .map((party) => {
      const name = party.displayName ?? party.normalizedNameCandidate ?? party.rawName ?? '名称未設定';
      const status = party.resolutionStatus === 'resolved' ? '名称解決済み' : '名称未解決';
      return `${name}（${status}）`;
    })
    .join('、');
}

function backendCustomerClassificationValue(classifications: BackendRecordViewModel['classifications']): string {
  const labels = classifications
    .map((classification) => classification.label?.trim())
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? [...new Set(labels)].join('、') : '分類名未取得';
}

function backendUnresolvedSummary(items: BackendRecordViewModel['unresolved']['applicants']): string {
  if (items.length === 0) return '0件';
  const reasons = [...new Set(items.map((item) => item.reason))];
  return `${formatCount(items.length)}件（${reasons.join('、')}）`;
}

function evidenceDomId(id: string): string {
  return `evidence-${id.replace(/[.:]/g, (character) => `~${character.codePointAt(0)?.toString(16)}`)}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="readable-text mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function safeMetadataValue(value?: string | null): string {
  if (!value) return '-';
  if (/^https?:\/\//i.test(value)) return '-';
  if (/^data:/i.test(value)) return '-';
  if (/^[A-Za-z]:\\/.test(value)) return '-';
  return value;
}

function countGazetteMetadataEvidence(insight: AnalysisInsight, allRecords: EvidenceAvailability[]): number {
  const recordsById = new Map(allRecords.map((record) => [record.id, record]));
  return insight.evidenceIds.filter((id) => recordsById.get(id)?.hasDrawingMetadata === true).length;
}

function shouldShowInsight(insight: AnalysisInsight): boolean {
  return insight.metric.value > 0 && insight.evidenceIds.length > 0;
}

function collectEvidenceRecords(
  result: AnalysisResult,
  allRecords: DesignRecord[],
  backendRecords: BackendRecordViewModel[],
): EvidenceRecordItem[] {
  const orderedIds: string[] = [];
  const ids = new Set<string>();
  const addId = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    orderedIds.push(id);
  };
  const collectInsight = (insight: AnalysisInsight) => insight.evidenceIds.forEach(addId);

  buildPriorityInsights(result).forEach(({ insight }) => collectInsight(insight));

  if (result.market) {
    collectInsight(result.market.trends);
    collectInsight(result.market.emergingDomains);
    collectInsight(result.market.companyMoves);
  }

  const seenInsights = new Set<AnalysisInsight>();
  for (const purpose of result.request.purposes) {
    for (const { insight } of insightsForPurpose(result, purpose)) {
      if (seenInsights.has(insight) || !shouldShowInsight(insight)) continue;
      seenInsights.add(insight);
      collectInsight(insight);
    }
  }

  const recordsById = new Map<string, EvidenceRecordItem>([
    ...allRecords.map((record) => [record.id, { kind: 'legacy' as const, record }] as const),
    ...backendRecords.map((record) => [record.id, { kind: 'backend' as const, record }] as const),
  ]);
  return orderedIds
    .map((id) => recordsById.get(id))
    .filter((record): record is EvidenceRecordItem => Boolean(record));
}

function recordsForEvidenceIds(
  ids: string[],
  allRecords: DesignRecord[],
  backendRecords: BackendRecordViewModel[],
): EvidenceRecordItem[] {
  const recordsById = new Map<string, EvidenceRecordItem>([
    ...allRecords.map((record) => [record.id, { kind: 'legacy' as const, record }] as const),
    ...backendRecords.map((record) => [record.id, { kind: 'backend' as const, record }] as const),
  ]);
  const seen = new Set<string>();
  return ids
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => recordsById.get(id))
    .filter((record): record is EvidenceRecordItem => Boolean(record));
}

function resolveDemoShowcaseMatches(showcaseRecords: DemoShowcaseRecord[], allRecords: DesignRecord[]): DemoShowcaseMatch[] {
  return showcaseRecords.map((showcase) => ({
    showcase,
    record: allRecords.find(
      (record) =>
        record.id === showcase.id ||
        (showcase.registrationNumber && record.registrationNumber === showcase.registrationNumber) ||
        (showcase.applicationNumber && record.applicationNumber === showcase.applicationNumber),
    ),
  }));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value);
}
