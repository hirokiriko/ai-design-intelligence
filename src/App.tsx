import { useMemo, useState } from 'react';
import { RuleBasedAnalysisEngine } from './analysis/RuleBasedAnalysisEngine';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { ResultsArea } from './components/ResultsArea/ResultsArea';
import { Badge } from './components/common/Badge';
import { ALL_DESIGN_KINDS, STATUS_BADGES } from './domain/labels';
import type { AnalysisPurpose, AnalysisRequest, AnalysisResult, DesignRecord, ValidationErrors } from './domain/types';
import { validateRequest } from './domain/validation';
import { SampleDesignDataSource } from './data/SampleDesignDataSource';

const DEFAULT_PURPOSES: AnalysisPurpose[] = ['market_trend', 'dx_dev', 'portfolio', 'filing_strategy'];

const initialRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  productDomain: '',
  period: 'last_1y',
  designKinds: [...ALL_DESIGN_KINDS],
  purposes: DEFAULT_PURPOSES,
  departments: ['product_planning', 'design', 'ip'],
};

export default function App() {
  const dataSource = useMemo(() => new SampleDesignDataSource(), []);
  const analysisEngine = useMemo(() => new RuleBasedAnalysisEngine(), []);
  const [request, setRequest] = useState<AnalysisRequest>(initialRequest);
  const [companyInput, setCompanyInput] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [records, setRecords] = useState<DesignRecord[]>([]);

  const allRecords = dataSource.getAllRecords();

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
      setRecords(queriedRecords);
      setResult(nextResult);
    } finally {
      setIsRunning(false);
    }
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
            {STATUS_BADGES.map((badge, index) => (
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
        />
        <ResultsArea request={request} result={result} records={records} allRecords={allRecords} isRunning={isRunning} />
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
