import { DEPARTMENT_LABELS, DESIGN_KIND_LABELS, PERIOD_LABELS, PURPOSE_LABELS } from '../../domain/labels';
import type { AnalysisInsight, AnalysisRequest, AnalysisResult, CompanyAnalysis, DesignRecord } from '../../domain/types';
import { designKindSummary } from '../../analysis/RuleBasedAnalysisEngine';
import { Badge } from '../common/Badge';

interface ResultsAreaProps {
  request: AnalysisRequest;
  result: AnalysisResult | null;
  records: DesignRecord[];
  allRecords: DesignRecord[];
  isRunning: boolean;
}

export function ResultsArea({ request, result, records, allRecords, isRunning }: ResultsAreaProps) {
  const evidenceRecords = result ? collectEvidenceRecords(result, allRecords) : [];

  return (
    <main className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">入力条件</h2>
            <p className="mt-1 text-sm text-muted">現在の画面入力をそのまま分析条件として使用します。</p>
          </div>
          <Badge tone="accent">外部データ未接続</Badge>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="分析範囲" value={request.scope.mode === 'all_classes' ? '全意匠分類' : request.scope.companies.join('、') || '未指定'} />
          <SummaryItem label="商品・事業領域" value={request.productDomain?.trim() || '指定なし'} />
          <SummaryItem label="対象期間" value={PERIOD_LABELS[request.period]} />
          <SummaryItem label="意匠種別" value={request.designKinds.map((kind) => DESIGN_KIND_LABELS[kind]).join('、') || '未選択'} />
          <SummaryItem label="分析目的" value={request.purposes.map((purpose) => PURPOSE_LABELS[purpose]).join('、') || '未選択'} />
          <SummaryItem label="出力部門" value={request.departments.map((department) => DEPARTMENT_LABELS[department]).join('、') || '未選択'} />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">分析結果</h2>
            <p className="mt-1 text-sm text-muted">
              {result
                ? `dataAsOf ${result.dataAsOf} 基準 / 対象 ${records.length}件 / ${designKindSummary(records)}`
                : '分析を開始すると、ここにルールベースの示唆が表示されます。'}
            </p>
          </div>
          {result ? <Badge tone="accent">generatedBy: {result.generatedBy}</Badge> : null}
        </div>

        {isRunning ? <p className="mt-6 rounded-md bg-slate-50 p-4 font-semibold text-muted">分析中...</p> : null}
        {!isRunning && !result ? <EmptyState /> : null}
        {result?.market ? <MarketView market={result.market} /> : null}
        {result?.companies.map((company) => <CompanyView key={company.company} analysis={company} />)}

        {result ? (
          <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-caution">{result.disclaimer}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold text-ink">根拠意匠の詳細</h2>
        <p className="mt-1 text-sm text-muted">各示唆の evidenceIds に含まれるサンプル意匠を表示します。</p>
        {evidenceRecords.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-muted">分析後に根拠意匠が表示されます。</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {evidenceRecords.map((record) => (
              <EvidenceRecord key={record.id} record={record} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-md border border-dashed border-line bg-panel p-6 text-sm text-muted">
      条件を確認して「AI分析開始」を実行してください。
    </div>
  );
}

function MarketView({ market }: { market: NonNullable<AnalysisResult['market']> }) {
  return (
    <div className="mt-5 space-y-4">
      <h3 className="text-sm font-bold text-ink">市場全体ビュー</h3>
      <InsightGrid
        insights={[
          ['市場・商品トレンド', market.trends],
          ['新商品領域', market.emergingDomains],
          ['企業動向', market.companyMoves],
        ]}
      />
    </div>
  );
}

function CompanyView({ analysis }: { analysis: CompanyAnalysis }) {
  return (
    <article className="mt-6 border-t border-line pt-5">
      <h3 className="text-lg font-bold text-ink">{analysis.company}</h3>
      <ResultGroup
        title="意匠動向"
        insights={[
          ['最近の意匠展開領域', analysis.designTrend.domains],
          ['形状変化', analysis.designTrend.shapeChange],
          ['デザイン方向', analysis.designTrend.designDirection],
        ]}
      />
      <ResultGroup
        title="DX商品開発動向"
        insights={[
          ['画像意匠の増加領域', analysis.dxDevTrend.imageDesignGrowth],
          ['デジタルサービス展開', analysis.dxDevTrend.digitalService],
          ['AI・IoT関連傾向', analysis.dxDevTrend.aiIotTrend],
        ]}
      />
      <ResultGroup
        title="デザイン変化分析"
        insights={[
          ['大型化／小型化', analysis.designChange.sizeTrend],
          ['薄型化', analysis.designChange.thinning],
          ['操作性変化', analysis.designChange.usability],
          ['UI変化', analysis.designChange.uiChange],
        ]}
      />
      <ResultGroup
        title="意匠ポートフォリオ分析"
        insights={[
          ['集中領域', analysis.portfolio.focusAreas],
          ['強化領域', analysis.portfolio.strengthening],
          ['未開拓領域', analysis.portfolio.whitespace],
        ]}
      />
      <ResultGroup
        title="AI知財戦略コメント"
        insights={[
          ['意匠保護領域', analysis.ipStrategy.designProtectionAreas],
          ['意匠出願戦略の方向性', analysis.ipStrategy.designFilingDirection],
          ['特許出願検討への参考情報', analysis.ipStrategy.patentReference],
          ['商標保護検討への参考情報', analysis.ipStrategy.trademarkReference],
          ['著作権保護検討への参考情報', analysis.ipStrategy.copyrightReference],
        ]}
      />
    </article>
  );
}

function ResultGroup({ title, insights }: { title: string; insights: [string, AnalysisInsight][] }) {
  return (
    <section className="mt-4">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <InsightGrid insights={insights} />
    </section>
  );
}

function InsightGrid({ insights }: { insights: [string, AnalysisInsight][] }) {
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-3">
      {insights.map(([title, insight]) => (
        <InsightView key={title} title={title} insight={insight} />
      ))}
    </div>
  );
}

function InsightView({ title, insight }: { title: string; insight: AnalysisInsight }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h5 className="text-sm font-bold text-ink">{title}</h5>
        <Badge tone={insight.confidence === 'high' ? 'accent' : insight.confidence === 'medium' ? 'warning' : 'neutral'}>
          confidence: {insight.confidence}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink">{insight.text}</p>
      <dl className="mt-3 grid gap-2 text-xs text-muted">
        <div>
          <dt className="font-bold">metric</dt>
          <dd>
            {insight.metric.label}: {insight.metric.value}
            {insight.metric.unit ?? ''}
            {insight.metric.comparison ? ` / ${insight.metric.comparison}` : ''}
          </dd>
        </div>
        <div>
          <dt className="font-bold">evidenceIds</dt>
          <dd>{insight.evidenceIds.length > 0 ? insight.evidenceIds.join('、') : 'なし'}</dd>
        </div>
      </dl>
    </div>
  );
}

function EvidenceRecord({ record }: { record: DesignRecord }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-ink">
            {record.id} / {record.articleName}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {record.applicant} / {DESIGN_KIND_LABELS[record.designKind]} / {record.businessDomain}
          </p>
        </div>
        <Badge tone="accent">{record.sourceLabel}</Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Detail label="公報番号" value={record.gazetteNumber ?? '-'} />
        <Detail label="公報発行日" value={record.gazetteDate} />
        <Detail label="分類" value={`${record.designClass} ${record.classLabel ?? ''}`.trim()} />
        <Detail label="画像参照" value={record.imageRef ?? '-'} />
      </dl>
      <p className="mt-3 text-sm leading-6 text-ink">{record.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...record.keywords, ...record.designFeatures].map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function collectEvidenceRecords(result: AnalysisResult, allRecords: DesignRecord[]): DesignRecord[] {
  const ids = new Set<string>();
  const collectInsight = (insight: AnalysisInsight) => insight.evidenceIds.forEach((id) => ids.add(id));

  if (result.market) {
    collectInsight(result.market.trends);
    collectInsight(result.market.emergingDomains);
    collectInsight(result.market.companyMoves);
  }

  for (const company of result.companies) {
    Object.values(company.designTrend).forEach(collectInsight);
    Object.values(company.dxDevTrend).forEach(collectInsight);
    Object.values(company.designChange).forEach(collectInsight);
    Object.values(company.portfolio).forEach(collectInsight);
    Object.values(company.ipStrategy).forEach(collectInsight);
  }

  return allRecords.filter((record) => ids.has(record.id));
}
