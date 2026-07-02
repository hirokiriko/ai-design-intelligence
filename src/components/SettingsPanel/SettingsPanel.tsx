import {
  ALL_DEPARTMENTS,
  ALL_DESIGN_KINDS,
  ALL_PURPOSES,
  DEPARTMENT_LABELS,
  DESIGN_KIND_LABELS,
  FUTURE_SOURCES,
  PERIOD_LABELS,
  PURPOSE_LABELS,
} from '../../domain/labels';
import type { AnalysisPurpose, AnalysisRequest, Department, Period, ValidationErrors } from '../../domain/types';
import type { LocalJpoLoadFailure, LocalJpoLoadSuccess } from '../../data/LocalJpoJsonDataSource';
import type { DemoShowcaseLoadFailure, DemoShowcaseLoadSuccess } from '../../data/DemoShowcaseDataSource';
import { Badge } from '../common/Badge';

type LocalJpoPanelState =
  | { status: 'sample'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: LocalJpoLoadSuccess }
  | { status: 'error'; failure: LocalJpoLoadFailure };

type DemoShowcasePanelState =
  | { status: 'empty'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: DemoShowcaseLoadSuccess }
  | { status: 'error'; failure: DemoShowcaseLoadFailure };

interface SettingsPanelProps {
  request: AnalysisRequest;
  companyInput: string;
  errors: ValidationErrors;
  isRunning: boolean;
  localJpoState: LocalJpoPanelState;
  externalDemoMode: boolean;
  demoShowcaseState: DemoShowcasePanelState;
  onRequestChange: (request: AnalysisRequest) => void;
  onCompanyInputChange: (value: string) => void;
  onAddCompany: () => void;
  onRemoveCompany: (company: string) => void;
  onAnalyze: () => void;
  onLocalJsonFile: (file: File | null) => void;
  onResetToSampleData: () => void;
  onExternalDemoModeChange: (enabled: boolean) => void;
  onDemoShowcaseFile: (file: File | null) => void;
  onClearDemoShowcase: () => void;
}

export function SettingsPanel({
  request,
  companyInput,
  errors,
  isRunning,
  localJpoState,
  externalDemoMode,
  demoShowcaseState,
  onRequestChange,
  onCompanyInputChange,
  onAddCompany,
  onRemoveCompany,
  onAnalyze,
  onLocalJsonFile,
  onResetToSampleData,
  onExternalDemoModeChange,
  onDemoShowcaseFile,
  onClearDemoShowcase,
}: SettingsPanelProps) {
  const companies = request.scope.mode === 'companies' ? request.scope.companies : [];

  return (
    <aside className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">外部デモモード</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              画面共有で見せる順番を出し、開発用の細かい情報は必要なときだけ開ける表示にします。
            </p>
          </div>
          <Badge tone={externalDemoMode ? 'accent' : 'neutral'}>{externalDemoMode ? 'ON' : 'OFF'}</Badge>
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={externalDemoMode}
            onChange={(event) => onExternalDemoModeChange(event.currentTarget.checked)}
          />
          <span>
            <span className="block font-semibold text-ink">外部デモモードを有効にする</span>
            <span className="text-muted">法的注意書きとローカル検証版の前提は表示したまま、デモで見るポイントを前面に出します。</span>
          </span>
        </label>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">ローカル実データJSONを読み込む{externalDemoMode ? '' : '（開発用）'}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              実データはローカルファイルとして読み込まれ、リポジトリやブラウザ永続領域には保存されません。
            </p>
          </div>
          <Badge tone={localJpoState.status === 'error' ? 'warning' : localJpoState.status === 'loaded' ? 'accent' : 'neutral'}>
            {localJpoState.status === 'loading'
              ? '読込中'
              : localJpoState.status === 'loaded'
                ? '読込済み'
                : localJpoState.status === 'error'
                  ? '読込失敗'
                  : 'サンプル既定'}
          </Badge>
        </div>
        <label className="mt-4 block text-sm font-semibold text-ink">
          JSONファイル
          <input
            className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              onLocalJsonFile(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-muted">
          File APIで手動選択したJSONだけを、この画面のメモリ上で利用します。
        </p>
        <details className="mt-2 rounded-md border border-line bg-panel p-3 text-xs leading-5 text-muted" open={!externalDemoMode}>
          <summary className="cursor-pointer font-semibold text-ink">読み込み例</summary>
          <p className="readable-text mt-2">
            例（日次）: DB側で作成した日次統合JSONをローカルで選択
            <br />
            例（週次）: DB側で作成した週次統合JSONをローカルで選択
            <br />
            例（月次プレビュー）: DB側で作成した月次プレビューJSONをローカルで選択
          </p>
        </details>
        {localJpoState.status === 'loading' ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
            <div className="font-bold">読込中</div>
            <div className="readable-text mt-1">{localJpoState.fileName}</div>
          </div>
        ) : null}
        {localJpoState.status === 'loaded' ? (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-accent">
            <div className="font-bold">読込済み</div>
            <div className="readable-text mt-1 font-semibold">{localJpoState.load.fileName}</div>
            <div className="mt-1">
              総件数 {localJpoState.load.summary.totalRecords}件 / gazetteDate{' '}
              {localJpoState.load.summary.gazetteDateFrom ?? '-'}〜{localJpoState.load.summary.gazetteDateTo ?? '-'}
            </div>
            {localJpoState.load.summary.sourceUpdateDateFrom || localJpoState.load.summary.sourceUpdateDateTo ? (
              <div className="mt-1">
                sourceUpdateDate {localJpoState.load.summary.sourceUpdateDateFrom ?? '-'}〜
                {localJpoState.load.summary.sourceUpdateDateTo ?? '-'}
              </div>
            ) : null}
            <button
              className="mt-3 rounded-md border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-accent"
              type="button"
              onClick={onResetToSampleData}
            >
              サンプルデータに戻す
            </button>
          </div>
        ) : null}
        {localJpoState.status === 'error' ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="font-bold">{localJpoState.failure.fileName}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {[...localJpoState.failure.errors, ...localJpoState.failure.warnings].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">デモ候補JSONを読み込む（任意）</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              外部デモで見せやすい根拠意匠候補を、File APIで追加表示します。候補がなくても通常分析は動作します。
            </p>
          </div>
          <Badge tone={demoShowcaseState.status === 'loaded' ? 'accent' : demoShowcaseState.status === 'error' ? 'warning' : 'neutral'}>
            {demoShowcaseState.status === 'loading'
              ? '読込中'
              : demoShowcaseState.status === 'loaded'
                ? '読込済み'
                : demoShowcaseState.status === 'error'
                  ? '読込失敗'
                  : '未読込'}
          </Badge>
        </div>
        <label className="mt-4 block text-sm font-semibold text-ink">
          デモ候補JSON
          <input
            className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              onDemoShowcaseFile(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-muted">読み込んだ候補は、この画面のメモリ上だけで保持します。</p>
        {demoShowcaseState.status === 'loaded' ? (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-accent">
            <div className="font-bold">読込済み</div>
            <div className="readable-text mt-1 font-semibold">{demoShowcaseState.load.fileName}</div>
            <div className="mt-1">候補 {demoShowcaseState.load.records.length}件</div>
            {demoShowcaseState.load.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {demoShowcaseState.load.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <button
              className="mt-3 rounded-md border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-accent"
              type="button"
              onClick={onClearDemoShowcase}
            >
              候補をクリア
            </button>
          </div>
        ) : null}
        {demoShowcaseState.status === 'loading' ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
            <div className="font-bold">読込中</div>
            <div className="readable-text mt-1">{demoShowcaseState.fileName}</div>
          </div>
        ) : null}
        {demoShowcaseState.status === 'error' ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="font-bold">{demoShowcaseState.failure.fileName}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {[...demoShowcaseState.failure.errors, ...demoShowcaseState.failure.warnings].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold text-ink">分析設定</h2>

        <div className="mt-5 space-y-6">
          <fieldset>
            <legend className="text-sm font-bold text-ink">① 分析対象選択</legend>
            <div className="mt-3 grid gap-2">
              <label className="flex items-start gap-3 rounded-md border border-line p-3">
                <input
                  className="mt-1"
                  type="radio"
                  name="scope"
                  checked={request.scope.mode === 'all_classes'}
                  onChange={() => onRequestChange({ ...request, scope: { mode: 'all_classes' } })}
                />
                <span>
                  <span className="block font-semibold">全意匠分類から分析（推奨）</span>
                  <span className="text-sm text-muted">市場全体の意匠動向／新商品領域／企業動向</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-line p-3">
                <input
                  className="mt-1"
                  type="radio"
                  name="scope"
                  checked={request.scope.mode === 'companies'}
                  onChange={() => onRequestChange({ ...request, scope: { mode: 'companies', companies } })}
                />
                <span>
                  <span className="block font-semibold">企業指定分析</span>
                  <span className="text-sm text-muted">複数企業を追加し、企業別に結果を表示</span>
                </span>
              </label>
            </div>

            {request.scope.mode === 'companies' ? (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-line px-3 py-2"
                    value={companyInput}
                    placeholder="例：企業A"
                    onChange={(event) => onCompanyInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onAddCompany();
                      }
                    }}
                  />
                  <button
                    className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    onClick={onAddCompany}
                    disabled={!companyInput.trim()}
                  >
                    ＋追加
                  </button>
                </div>
                {companies.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {companies.map((company) => (
                      <button
                        key={company}
                        type="button"
                        className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-semibold text-accent"
                        onClick={() => onRemoveCompany(company)}
                      >
                        {company} ×
                      </button>
                    ))}
                  </div>
                ) : null}
                {errors.companies ? <p className="mt-2 text-sm font-semibold text-red-700">{errors.companies}</p> : null}
              </div>
            ) : null}

            <label className="mt-4 block text-sm font-semibold text-ink">
              商品・事業領域
              <input
                className="mt-2 w-full rounded-md border border-line px-3 py-2"
                value={request.productDomain ?? ''}
                placeholder="家電 / 映像機器 / AI・IoT / 医療機器 等"
                onChange={(event) => onRequestChange({ ...request, productDomain: event.target.value })}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-ink">② 対象期間</legend>
            <div className="mt-3 grid gap-2">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => (
                <label key={period} className="flex items-center gap-3 rounded-md border border-line p-3">
                  <input
                    type="radio"
                    name="period"
                    checked={request.period === period}
                    onChange={() => onRequestChange({ ...request, period })}
                  />
                  <span className="font-semibold">{PERIOD_LABELS[period]}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              案件によっては特許の出願公開より早期に把握できる可能性がある意匠情報を活用するため、最新動向を重視
            </p>
            {localJpoState.status === 'loaded' ? (
              <label className="mt-3 flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={request.includeUnresolvedApplicants ?? true}
                  onChange={() =>
                    onRequestChange({
                      ...request,
                      includeUnresolvedApplicants: !(request.includeUnresolvedApplicants ?? true),
                    })
                  }
                />
                <span>
                  <span className="block font-semibold text-ink">未解決applicant codeを含む</span>
                  <span className="text-muted">OFFにすると、未補完の申請人コードを含むレコードを除外します。</span>
                </span>
              </label>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-ink">③ 調査範囲</legend>
            <div className="mt-3 rounded-md border border-line p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {localJpoState.status === 'loaded' ? 'ローカル実データJSON' : 'デモ用意匠情報'}
                </span>
                <Badge tone="accent">現在利用</Badge>
                {localJpoState.status === 'loaded' ? <Badge tone="warning">意匠種別は暫定推定</Badge> : null}
              </div>
              <div className="grid gap-2">
                {ALL_DESIGN_KINDS.map((kind) => (
                  <CheckRow
                    key={kind}
                    checked={request.designKinds.includes(kind)}
                    label={DESIGN_KIND_LABELS[kind]}
                    onChange={() =>
                      onRequestChange({
                        ...request,
                        designKinds: toggleValue(request.designKinds, kind),
                      })
                    }
                  />
                ))}
              </div>
              {errors.designKinds ? <p className="mt-2 text-sm font-semibold text-red-700">{errors.designKinds}</p> : null}
            </div>
            <div className="mt-3 rounded-md border border-line bg-slate-50 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-muted">企業公開情報</span>
                <Badge tone="warning">準備中</Badge>
              </div>
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-caution">
                企業公開情報との連携は、出典明示・利用条件・著作権を確認したうえで対応予定です。本文転載ではなく、企業IR・プレスリリース等の一般公開情報への参照・要約・出典表示を前提に検討します。
              </p>
              <div className="grid gap-2">
                {FUTURE_SOURCES.map((source) => (
                  <label key={source} className="flex items-center justify-between gap-2 text-sm text-muted">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      {source}
                    </span>
                    <Badge tone="warning">準備中</Badge>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <CheckboxGroup
            title="④ 分析目的"
            values={ALL_PURPOSES}
            selected={request.purposes}
            labels={PURPOSE_LABELS}
            error={errors.purposes}
            onToggle={(value) =>
              onRequestChange({
                ...request,
                purposes: toggleValue(request.purposes, value),
              })
            }
          />

          <CheckboxGroup
            title="⑤ 出力部門選択"
            values={ALL_DEPARTMENTS}
            selected={request.departments}
            labels={DEPARTMENT_LABELS}
            error={errors.departments}
            onToggle={(value) =>
              onRequestChange({
                ...request,
                departments: toggleValue(request.departments, value),
              })
            }
          />
        </div>

        <button
          type="button"
          className="mt-6 w-full rounded-md bg-ink px-4 py-3 font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={onAnalyze}
          disabled={isRunning}
        >
          {isRunning ? '分析中...' : 'AI分析開始'}
        </button>
      </section>
    </aside>
  );
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function CheckboxGroup<T extends AnalysisPurpose | Department>({
  title,
  values,
  selected,
  labels,
  error,
  onToggle,
}: {
  title: string;
  values: T[];
  selected: T[];
  labels: Record<T, string>;
  error?: string;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink">{title}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {values.map((value) => (
          <CheckRow key={value} checked={selected.includes(value)} label={labels[value]} onChange={() => onToggle(value)} />
        ))}
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </fieldset>
  );
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
