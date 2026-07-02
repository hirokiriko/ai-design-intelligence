import { useMemo, useState } from 'react';
import { RuleBasedAnalysisEngine } from './analysis/RuleBasedAnalysisEngine';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { ResultsArea } from './components/ResultsArea/ResultsArea';
import { Badge } from './components/common/Badge';
import { ALL_DESIGN_KINDS, STATUS_BADGES } from './domain/labels';
import type { AnalysisPurpose, AnalysisRequest, AnalysisResult, DesignRecord, ValidationErrors } from './domain/types';
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

const DEFAULT_PURPOSES: AnalysisPurpose[] = ['market_trend', 'dx_dev', 'portfolio', 'filing_strategy'];

const initialRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  productDomain: '',
  period: 'last_1y',
  designKinds: [...ALL_DESIGN_KINDS],
  purposes: DEFAULT_PURPOSES,
  departments: ['product_planning', 'design', 'ip'],
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
  const [externalDemoMode, setExternalDemoMode] = useState(false);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);

  const dataSource = localJpoState.status === 'loaded' ? localJpoState.load.dataSource : sampleDataSource;
  const allRecords = dataSource.getAllRecords();
  const headerBadges =
    localJpoState.status === 'loaded'
      ? ['ローカル実データJSON（開発用）', 'ルールベース分析', 'File API読込']
      : STATUS_BADGES;

  const addCompany = () => {
    const nextCompany = companyInput.trim();
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

  const resetToSampleData = () => {
    setLocalJpoState({ status: 'sample', warnings: [], errors: [] });
    setResult(null);
    setRecords([]);
    setAnalysisWarnings([]);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-ink">AI Design Intelligence</h1>
            <p className="mt-1 text-sm text-muted">意匠情報を、先行商品戦略＆知財戦略へ活用</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {headerBadges.map((badge, index) => (
              <Badge key={badge} tone={index === 1 ? 'accent' : index === 2 ? 'warning' : 'neutral'}>
                {badge}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <SettingsPanel
          request={request}
          companyInput={companyInput}
          errors={errors}
          isRunning={isRunning}
          onRequestChange={(nextRequest) => {
            setRequest(nextRequest);
            setErrors({});
          }}
          onCompanyInputChange={setCompanyInput}
          onAddCompany={addCompany}
          onRemoveCompany={removeCompany}
          onAnalyze={analyze}
          localJpoState={localJpoState}
          onLocalJsonFile={handleLocalJsonFile}
          onResetToSampleData={resetToSampleData}
          externalDemoMode={externalDemoMode}
          onExternalDemoModeChange={setExternalDemoMode}
          demoShowcaseState={demoShowcaseState}
          onDemoShowcaseFile={handleDemoShowcaseFile}
          onClearDemoShowcase={() => setDemoShowcaseState({ status: 'empty', warnings: [], errors: [] })}
        />
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
        />
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
  }${localJpoAnalysisPeriodLabel(summary.dataPeriodKind)}のため、傾向判断には追加データが必要です。分析期間はgazetteDate基準です。法的助言ではありません。`;
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
