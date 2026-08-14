import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { RuleBasedAnalysisEngine } from './analysis/RuleBasedAnalysisEngine';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { ResultsArea } from './components/ResultsArea/ResultsArea';
import { ALL_DESIGN_KINDS } from './domain/labels';
import type { AnalysisPurpose, AnalysisRequest, AnalysisResult, DesignRecord, HosoeAnalysisPack, ValidationErrors } from './domain/types';
import { validateRequest } from './domain/validation';
import { SampleDesignDataSource } from './data/SampleDesignDataSource';
import {
  loadLocalJpoJson,
  sanitizeAnalysisEvidenceIds,
  type LocalJpoDataPeriodKind,
  type LocalJpoLoadFailure,
  type LocalJpoLoadSuccess,
} from './data/LocalJpoJsonDataSource';
import {
  loadDemoShowcaseJson,
  type DemoShowcaseLoadFailure,
  type DemoShowcaseLoadSuccess,
} from './data/DemoShowcaseDataSource';

const DEFAULT_PURPOSES: AnalysisPurpose[] = ['market_trend', 'competitor_design'];
const ENABLE_LOCAL_ANALYSIS_PACK = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_ANALYSIS_PACK === 'true';

const initialRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  productDomain: '',
  period: 'last_1y',
  designKinds: [...ALL_DESIGN_KINDS],
  purposes: DEFAULT_PURPOSES,
  departments: ['mgmt_planning', 'product_planning'],
  includeUnresolvedApplicants: true,
};

type LocalJpoState =
  | { status: 'sample'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: LocalJpoLoadSuccess }
  | { status: 'error'; failure: LocalJpoLoadFailure };

type DemoShowcaseState =
  | { status: 'empty'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: DemoShowcaseLoadSuccess }
  | { status: 'error'; failure: DemoShowcaseLoadFailure };

type HosoeAnalysisPackState =
  | { status: 'empty'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | {
      status: 'loaded';
      load: { ok: true; fileName: string; pack: HosoeAnalysisPack; summaryText: string; warnings: string[] };
    }
  | { status: 'error'; failure: { ok: false; fileName: string; errors: string[]; warnings: string[] } };

type LocalAnalysisPackPanelComponent = ComponentType<{ pack: HosoeAnalysisPack }>;

export default function App() {
  const sampleDataSource = useMemo(() => new SampleDesignDataSource(), []);
  const analysisEngine = useMemo(() => new RuleBasedAnalysisEngine(), []);
  const [request, setRequest] = useState<AnalysisRequest>(initialRequest);
  const [companyInput, setCompanyInput] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [records, setRecords] = useState<DesignRecord[]>([]);
  const [localJpoState, setLocalJpoState] = useState<LocalJpoState>({ status: 'sample', warnings: [], errors: [] });
  const [demoShowcaseState, setDemoShowcaseState] = useState<DemoShowcaseState>({ status: 'empty', warnings: [], errors: [] });
  const [hosoeAnalysisPackState, setHosoeAnalysisPackState] = useState<HosoeAnalysisPackState>({ status: 'empty', warnings: [], errors: [] });
  const [localAnalysisPackPanel, setLocalAnalysisPackPanel] = useState<LocalAnalysisPackPanelComponent | null>(null);
  const [externalDemoMode, setExternalDemoMode] = useState(true);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);

  const dataSource = localJpoState.status === 'loaded' ? localJpoState.load.dataSource : sampleDataSource;
  const allRecords = useMemo(() => dataSource.getAllRecords(), [dataSource]);
  const companyOptions = useMemo(() => buildCompanyOptions(allRecords), [allRecords]);
  useEffect(() => {
    if (!ENABLE_LOCAL_ANALYSIS_PACK) return;

    void import('./local-analysis-pack/HosoeAnalysisPackPanel').then((module) => {
      setLocalAnalysisPackPanel(() => module.HosoeAnalysisPackPanel);
    });
  }, []);

  useEffect(() => {
    if (!result) return;

    const resultSection = document.getElementById('ai-analysis');
    resultSection?.focus({ preventScroll: true });
    resultSection?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [result]);

  useEffect(() => {
    focusFirstValidationError(errors);
  }, [errors]);

  const clearAnalysisResult = () => {
    setResult(null);
    setRecords([]);
    setAnalysisWarnings([]);
  };

  const addCompany = (suggestedCompany?: string) => {
    const nextCompany = (suggestedCompany ?? companyInput).trim();
    if (!nextCompany) return;

    setRequest((current) => {
      const companies = current.scope.mode === 'companies' ? current.scope.companies : [];
      return {
        ...current,
        scope: {
          mode: 'companies',
          companies: companies.includes(nextCompany) ? companies : [...companies, nextCompany],
        },
      };
    });
    setCompanyInput('');
    clearAnalysisResult();
  };

  const removeCompany = (company: string) => {
    setRequest((current) => {
      const companies = current.scope.mode === 'companies' ? current.scope.companies : [];
      return {
        ...current,
        scope: {
          mode: 'companies',
          companies: companies.filter((item) => item !== company),
        },
      };
    });
    clearAnalysisResult();
  };

  const analyze = async () => {
    const validationErrors = validateRequest(request);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsRunning(true);
    try {
      const queriedRecords = await dataSource.query(request);
      const nextResult = await analysisEngine.analyze(request, queriedRecords, dataSource.getDataAsOf());
      const evidenceWarnings = sanitizeAnalysisEvidenceIds(nextResult, allRecords);
      if (localJpoState.status === 'loaded') {
        nextResult.disclaimer = localJpoAnalysisDisclaimer(localJpoState.load.summary);
      }
      setRecords(queriedRecords);
      setResult(nextResult);
      setAnalysisWarnings(evidenceWarnings);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLocalJsonFile = async (file: File | null) => {
    if (!file) return;

    setResult(null);
    setRecords([]);
    setAnalysisWarnings([]);
    setLocalJpoState({ status: 'loading', fileName: file.name, warnings: [], errors: [] });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
      const loadResult = loadLocalJpoJson(parsed, file.name);
      setLocalJpoState(loadResult.ok ? { status: 'loaded', load: loadResult } : { status: 'error', failure: loadResult });
    } catch (error) {
      setLocalJpoState({
        status: 'error',
        failure: {
          ok: false,
          fileName: file.name,
          errors: [`JSONを読み込めませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`],
          warnings: [],
        },
      });
    }
  };

  const handleDemoShowcaseFile = async (file: File | null) => {
    if (!file) return;

    setDemoShowcaseState({ status: 'loading', fileName: file.name, warnings: [], errors: [] });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
      const loadResult = loadDemoShowcaseJson(parsed, file.name);
      setDemoShowcaseState(loadResult.ok ? { status: 'loaded', load: loadResult } : { status: 'error', failure: loadResult });
    } catch (error) {
      setDemoShowcaseState({
        status: 'error',
        failure: {
          ok: false,
          fileName: file.name,
          errors: [`JSONを読み込めませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`],
          warnings: [],
        },
      });
    }
  };

  const handleHosoeAnalysisPackFile = async (file: File | null) => {
    if (!file || !ENABLE_LOCAL_ANALYSIS_PACK) return;

    setHosoeAnalysisPackState({ status: 'loading', fileName: file.name, warnings: [], errors: [] });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
      const { loadHosoeAnalysisPackJson } = await import('./data/HosoeAnalysisPackDataSource');
      const loadResult = loadHosoeAnalysisPackJson(parsed, file.name);
      setHosoeAnalysisPackState(loadResult.ok ? { status: 'loaded', load: loadResult } : { status: 'error', failure: loadResult });
    } catch (error) {
      setHosoeAnalysisPackState({
        status: 'error',
        failure: {
          ok: false,
          fileName: file.name,
          errors: [`JSONを読み込めませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`],
          warnings: [],
        },
      });
    }
  };

  const resetToSampleData = () => {
    setLocalJpoState({ status: 'sample', warnings: [], errors: [] });
    setResult(null);
    setRecords([]);
    setAnalysisWarnings([]);
  };
  const LocalAnalysisPackPanel = localAnalysisPackPanel;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-ink">KIRIKO Design Signals</h1>
            <p className="mt-1 text-sm text-muted">意匠情報から、市場・企業・商品化領域の先行シグナルを捉える</p>
          </div>
        </div>
        {localJpoState.status === 'loaded' ? (
          <div className="border-t border-line bg-teal-50">
            <div className="mx-auto max-w-7xl px-4 py-3 text-sm leading-6 text-accent">
              ローカル検証データを使用中です。データはブラウザのメモリ上だけで扱い、公開ビルドには含めません。
            </div>
          </div>
        ) : (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="mx-auto max-w-7xl px-4 py-3 text-sm leading-6 text-caution">
              サンプルデータ版です。表示される企業・意匠情報はすべて架空で、実在企業・実在公報ではありません。
            </div>
          </div>
        )}
      </header>

      <section className="border-b border-line bg-gradient-to-br from-white via-white to-teal-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Design intelligence workflow</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-tight text-ink sm:text-3xl">
              意匠情報から、市場・企業・商品化領域の先行シグナルを捉える
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              意匠情報を俯瞰し、市場動向・企業動向・商品化領域・デザイン変化の検討材料を得ます。結果の件数から根拠意匠へ戻り、他の知財情報、商品情報、事業情報等と組み合わせて検討できます。
            </p>
          </div>
          <ul aria-label="分析の流れ" className="grid gap-3 rounded-xl border border-teal-200 bg-white p-4 shadow-soft sm:grid-cols-3 lg:grid-cols-1">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <div><strong className="block text-sm text-ink">対象を決める</strong><span className="text-xs leading-5 text-muted">市場・業界・企業を選択</span></div>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <div><strong className="block text-sm text-ink">見たい領域を決める</strong><span className="text-xs leading-5 text-muted">領域・意匠情報・期間を設定</span></div>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <div><strong className="block text-sm text-ink">結果と根拠を確認する</strong><span className="text-xs leading-5 text-muted">件数から該当する根拠意匠へ</span></div>
            </li>
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[410px_minmax(0,1fr)] lg:items-start">
        <SettingsPanel
          request={request}
          companyInput={companyInput}
          companyOptions={companyOptions}
          errors={errors}
          isRunning={isRunning}
          hasResult={Boolean(result)}
          onRequestChange={(nextRequest) => {
            setRequest(nextRequest);
            setErrors({});
            clearAnalysisResult();
          }}
          onCompanyInputChange={setCompanyInput}
          onAddCompany={addCompany}
          onRemoveCompany={removeCompany}
          onAnalyze={analyze}
          localJpoState={localJpoState}
          enableLocalAnalysisPack={ENABLE_LOCAL_ANALYSIS_PACK}
          onLocalJsonFile={handleLocalJsonFile}
          onResetToSampleData={resetToSampleData}
          externalDemoMode={externalDemoMode}
          onExternalDemoModeChange={setExternalDemoMode}
          demoShowcaseState={demoShowcaseState}
          onDemoShowcaseFile={handleDemoShowcaseFile}
          onClearDemoShowcase={() => setDemoShowcaseState({ status: 'empty', warnings: [], errors: [] })}
          hosoeAnalysisPackState={hosoeAnalysisPackState}
          onHosoeAnalysisPackFile={handleHosoeAnalysisPackFile}
          onClearHosoeAnalysisPack={() => setHosoeAnalysisPackState({ status: 'empty', warnings: [], errors: [] })}
        />
        <div className="min-w-0">
          <ResultsArea
          request={request}
          result={result}
          records={records}
          allRecords={allRecords}
          isRunning={isRunning}
          localJpoSummary={localJpoState.status === 'loaded' ? localJpoState.load.summary : null}
          localJpoWarnings={
            localJpoState.status === 'loaded'
              ? localJpoState.load.warnings
              : localJpoState.status === 'error'
                ? [...localJpoState.failure.errors, ...localJpoState.failure.warnings]
                : []
          }
          analysisWarnings={analysisWarnings}
          externalDemoMode={externalDemoMode}
          demoShowcaseRecords={demoShowcaseState.status === 'loaded' ? demoShowcaseState.load.records : []}
          localAnalysisPackPanel={
            ENABLE_LOCAL_ANALYSIS_PACK && hosoeAnalysisPackState.status === 'loaded' && LocalAnalysisPackPanel ? (
              <LocalAnalysisPackPanel pack={hosoeAnalysisPackState.load.pack} />
            ) : null
          }
          />
        </div>
      </div>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-sm leading-6 text-muted">
          出力はデモ用サンプルデータとルールベース分析による参考情報であり、法的助言ではありません。外部API、LLM、J-PlatPat
          Web UIの自動取得、WEB・新聞・プレス等の外部データ取得は接続していません。
        </div>
      </footer>
    </div>
  );
}

function localJpoAnalysisDisclaimer(summary: LocalJpoLoadSuccess['summary']): string {
  const periodDate = summary.dataPeriodKind === 'monthly_preview' ? formatMonthLabel(summary.dataPeriodDate) : summary.dataPeriodDate;
  return `この結果はローカル実データJSONをブラウザのメモリ上で読み込み、ルールベースで集計した参考情報です。${
    periodDate ? `${periodDate}対象の` : ''
  }${localJpoAnalysisPeriodLabel(summary.dataPeriodKind)}のため、傾向判断には追加データが必要です。分析期間は公報発行日を基準にしています。法的助言ではありません。`;
}

function buildCompanyOptions(records: DesignRecord[], limit = 20): string[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const company = record.applicant.trim();
    if (!company) continue;
    counts.set(company, (counts.get(company) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([leftCompany, leftCount], [rightCompany, rightCount]) => rightCount - leftCount || leftCompany.localeCompare(rightCompany, 'ja'))
    .slice(0, limit)
    .map(([company]) => company);
}

function focusFirstValidationError(errors: ValidationErrors): void {
  const targets: Array<[keyof ValidationErrors, string]> = [
    ['companies', 'companies-error'],
    ['productDomain', 'product-domain-error'],
    ['designKinds', 'design-kinds-error'],
    ['purposes', 'purposes-error'],
  ];
  const targetId = targets.find(([key]) => Boolean(errors[key]))?.[1];
  if (!targetId) return;

  const target = document.getElementById(targetId);
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ behavior: 'auto', block: 'center' });
}

function localJpoAnalysisPeriodLabel(kind: LocalJpoDataPeriodKind): string {
  if (kind === 'monthly_preview') return '月次プレビュー';
  if (kind === 'weekly') return '週次データ';
  if (kind === 'daily') return '1日分データ';
  return 'ローカルデータ';
}

function formatMonthLabel(value?: string): string | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月`;
}
