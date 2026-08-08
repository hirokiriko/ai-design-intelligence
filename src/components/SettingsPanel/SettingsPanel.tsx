import { useState } from 'react';
import {
  ALL_DEPARTMENTS,
  ALL_DESIGN_KINDS,
  DEPARTMENT_LABELS,
  DESIGN_KIND_LABELS,
  FUTURE_SOURCES,
  PERIOD_LABELS,
  PRIMARY_PURPOSES,
  PRODUCT_DOMAIN_PRESETS,
  PURPOSE_LABELS,
} from '../../domain/labels';
import type { AnalysisPurpose, AnalysisRequest, Department, Period, ValidationErrors } from '../../domain/types';
import type { LocalJpoLoadFailure, LocalJpoLoadSuccess } from '../../data/LocalJpoJsonDataSource';
import type { DemoShowcaseLoadFailure, DemoShowcaseLoadSuccess } from '../../data/DemoShowcaseDataSource';
import type { HosoeAnalysisPackLoadFailure, HosoeAnalysisPackLoadSuccess } from '../../data/HosoeAnalysisPackDataSource';
import { DEMO_PRESETS } from '../../domain/presets';
import { resolveDesignKinds } from '../../domain/selection';
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

type HosoeAnalysisPackPanelState =
  | { status: 'empty'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: HosoeAnalysisPackLoadSuccess }
  | { status: 'error'; failure: HosoeAnalysisPackLoadFailure };

interface SettingsPanelProps {
  request: AnalysisRequest;
  companyInput: string;
  companyOptions?: string[];
  errors: ValidationErrors;
  isRunning: boolean;
  hasResult?: boolean;
  localJpoState: LocalJpoPanelState;
  enableLocalAnalysisPack: boolean;
  externalDemoMode: boolean;
  demoShowcaseState: DemoShowcasePanelState;
  hosoeAnalysisPackState: HosoeAnalysisPackPanelState;
  onRequestChange: (request: AnalysisRequest) => void;
  onCompanyInputChange: (value: string) => void;
  onAddCompany: (company?: string) => void;
  onRemoveCompany: (company: string) => void;
  onAnalyze: () => void;
  onLocalJsonFile: (file: File | null) => void;
  onProtectedDemoData: () => void;
  onResetToSampleData: () => void;
  onExternalDemoModeChange: (enabled: boolean) => void;
  onDemoShowcaseFile: (file: File | null) => void;
  onClearDemoShowcase: () => void;
  onHosoeAnalysisPackFile: (file: File | null) => void;
  onClearHosoeAnalysisPack: () => void;
}

export function SettingsPanel({
  request,
  companyInput,
  companyOptions = [],
  errors,
  isRunning,
  hasResult = false,
  localJpoState,
  enableLocalAnalysisPack,
  externalDemoMode,
  demoShowcaseState,
  hosoeAnalysisPackState,
  onRequestChange,
  onCompanyInputChange,
  onAddCompany,
  onRemoveCompany,
  onAnalyze,
  onLocalJsonFile,
  onProtectedDemoData,
  onResetToSampleData,
  onExternalDemoModeChange,
  onDemoShowcaseFile,
  onClearDemoShowcase,
  onHosoeAnalysisPackFile,
  onClearHosoeAnalysisPack,
}: SettingsPanelProps) {
  const companies = request.scope.mode === 'companies' ? request.scope.companies : [];
  const availableCompanyOptions = companyOptions.filter((company) => !companies.includes(company));
  const [designKindsManuallyChanged, setDesignKindsManuallyChanged] = useState(false);

  const changeProductDomain = (productDomain: string) => {
    onRequestChange({
      ...request,
      productDomain,
      scope: request.scope.mode === 'industry' ? { mode: 'industry', industry: productDomain } : request.scope,
    });
  };

  const changePurposes = (purpose: AnalysisPurpose) => {
    const purposes = toggleValue(request.purposes, purpose);
    onRequestChange({
      ...request,
      purposes,
      designKinds: resolveDesignKinds(purposes, request.designKinds, designKindsManuallyChanged),
      departments: departmentsForPurposes(purposes),
    });
  };

  const applyPreset = (preset: 'market' | 'image') => {
    setDesignKindsManuallyChanged(false);
    const selectedPreset = DEMO_PRESETS.find((candidate) => candidate.id === preset);
    if (selectedPreset) onRequestChange({ ...selectedPreset.request });
  };

  return (
    <aside className="flex flex-col gap-5">
      <details className="order-2 rounded-lg border border-line bg-white p-4 shadow-soft">
        <summary className="cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-ink">詳細設定・データ情報</div>
              <p className="mt-1 text-xs leading-5 text-muted">
                通常は開かずに分析できます。ローカルJSONや画面共有用の設定が必要な場合だけ開いてください。
              </p>
            </div>
            <Badge tone={localJpoState.status === 'loaded' ? 'warning' : 'neutral'}>
              {localJpoState.status === 'loaded' ? 'ローカルデータ利用中' : 'サンプルデータ利用中'}
            </Badge>
          </div>
        </summary>

        <div className="mt-4 space-y-5 border-t border-line pt-4">
      <section className="rounded-lg border border-line bg-white p-5">
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
        <button
          className="mt-3 w-full rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onProtectedDemoData}
          disabled={localJpoState.status === 'loading'}
        >
          保護されたデモデータを読み込む
        </button>
        <p className="mt-2 text-xs leading-5 text-muted">
          同一オリジンの保護エンドポイントが設定済みの場合だけ利用します。認証情報は入力・保存しません。
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

      {enableLocalAnalysisPack ? (
        <section className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">ローカル分析パックJSONを読み込む（開発用）</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                画面共有用の検証テーマなどを、File APIで追加表示します。読み込んだJSONはこの画面のメモリ上だけで保持します。
              </p>
            </div>
            <Badge tone={hosoeAnalysisPackState.status === 'loaded' ? 'accent' : hosoeAnalysisPackState.status === 'error' ? 'warning' : 'neutral'}>
              {hosoeAnalysisPackState.status === 'loading'
                ? '読込中'
                : hosoeAnalysisPackState.status === 'loaded'
                  ? '読込済み'
                  : hosoeAnalysisPackState.status === 'error'
                    ? '読込失敗'
                    : '未読込'}
            </Badge>
          </div>
          <label className="mt-4 block text-sm font-semibold text-ink">
            ローカル分析パックJSON
            <input
              className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onHosoeAnalysisPackFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-muted">
            公開URL版には含めず、画面共有用のローカル検証時だけ手動選択して使います。
          </p>
          {hosoeAnalysisPackState.status === 'loaded' ? (
            <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-accent">
              <div className="font-bold">読込済み</div>
              <div className="readable-text mt-1 font-semibold">{hosoeAnalysisPackState.load.fileName}</div>
              <div className="mt-1">{hosoeAnalysisPackState.load.summaryText}</div>
              {hosoeAnalysisPackState.load.warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {hosoeAnalysisPackState.load.warnings.slice(0, 3).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <button
                className="mt-3 rounded-md border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-accent"
                type="button"
                onClick={onClearHosoeAnalysisPack}
              >
                分析パックをクリア
              </button>
            </div>
          ) : null}
          {hosoeAnalysisPackState.status === 'loading' ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-muted">
              <div className="font-bold">読込中</div>
              <div className="readable-text mt-1">{hosoeAnalysisPackState.fileName}</div>
            </div>
          ) : null}
          {hosoeAnalysisPackState.status === 'error' ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-bold">{hosoeAnalysisPackState.failure.fileName}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {[...hosoeAnalysisPackState.failure.errors, ...hosoeAnalysisPackState.failure.warnings].map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-base font-bold text-ink">出力部門（任意）</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          通常は分析目的から自動設定されます。伝え方を調整したい場合だけ変更してください。
        </p>
        <div className="mt-4">
          <CheckboxGroup
            title="出力部門"
            values={ALL_DEPARTMENTS}
            selected={request.departments}
            labels={DEPARTMENT_LABELS}
            error={errors.departments}
            errorId="departments-error"
            onToggle={(value) =>
              onRequestChange({
                ...request,
                departments: toggleValue(request.departments, value),
              })
            }
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-slate-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-ink">将来構想</h2>
          <Badge tone="warning">準備中</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          現在の分析には使用しません。出典、利用条件、著作権を確認したうえで別フェーズとして検討します。
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {FUTURE_SOURCES.map((source) => (
            <li key={source} className="rounded-md border border-line bg-white px-3 py-2">
              {source}（準備中）
            </li>
          ))}
          <li className="rounded-md border border-line bg-white px-3 py-2">IR・Web商品情報（準備中）</li>
          <li className="rounded-md border border-line bg-white px-3 py-2">LLMによる高度分析（準備中）</li>
        </ul>
      </section>

        </div>
      </details>

      <section id="analysis-settings" className="order-1 scroll-mt-6 rounded-lg border-2 border-teal-200 bg-white p-5 pb-24 shadow-soft sm:pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">5分デモ</p>
            <h2 className="mt-1 text-lg font-bold text-ink">分析条件を決める</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              対象・期間・知りたいことを選ぶと、市場や企業の動向を根拠意匠とともに確認できます。
            </p>
          </div>
          <Badge tone="accent">1〜6</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`rounded-lg border p-3 text-left text-sm ${preset.id === 'market' ? 'border-teal-200 bg-teal-50' : 'border-sky-200 bg-sky-50'}`}
              onClick={() => applyPreset(preset.id)}
            >
              <span className="block font-bold text-ink">{preset.label}</span>
              <span className="mt-1 block leading-5 text-muted">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <fieldset className="order-1">
            <legend className="text-sm font-bold text-ink">1. 分析対象を決める</legend>
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
                  <span className="block font-semibold">市場全体</span>
                  <span className="text-sm text-muted">市場を俯瞰し、商品化領域と企業動向を把握</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-line p-3">
                <input
                  className="mt-1"
                  type="radio"
                  name="scope"
                  checked={request.scope.mode === 'industry'}
                  onChange={() =>
                    onRequestChange({
                      ...request,
                      scope: { mode: 'industry', industry: request.productDomain ?? '' },
                    })
                  }
                />
                <span>
                  <span className="block font-semibold">特定業界</span>
                  <span className="text-sm text-muted">選んだ商品・事業領域に絞って把握</span>
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
                  <span className="block font-semibold">特定企業</span>
                  <span className="text-sm text-muted">複数企業を追加し、企業別に結果を表示</span>
                </span>
              </label>
            </div>

            {request.scope.mode === 'companies' ? (
              <div className="mt-3">
                {availableCompanyOptions.length > 0 ? (
                  <label className="block text-sm font-semibold text-ink">
                    データ内の企業候補
                    <select
                      className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2"
                      aria-label="企業候補から追加"
                      defaultValue=""
                      onChange={(event) => {
                        if (event.currentTarget.value) onAddCompany(event.currentTarget.value);
                        event.currentTarget.value = '';
                      }}
                    >
                      <option value="" disabled>候補から企業を追加</option>
                      {availableCompanyOptions.map((company) => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="mt-3 text-xs leading-5 text-muted">候補にない名称は、下の入力欄から追加できます。</p>
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-line px-3 py-2"
                    value={companyInput}
                    aria-label="企業名"
                    placeholder="企業名を入力"
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
                    onClick={() => onAddCompany()}
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
                {errors.companies ? (
                  <p id="companies-error" role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
                    {errors.companies}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 border-t border-line pt-5">
              <div className="text-sm font-bold text-ink">2. 見たい領域を決める</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRODUCT_DOMAIN_PRESETS.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    aria-pressed={request.productDomain === domain}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold ${
                      request.productDomain === domain
                        ? 'border-teal-300 bg-teal-50 text-accent'
                        : 'border-line bg-white text-ink'
                    }`}
                    onClick={() => changeProductDomain(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-sm font-semibold text-ink">
                その他の領域を入力
              <input
                className="mt-2 w-full rounded-md border border-line px-3 py-2"
                value={request.productDomain ?? ''}
                  placeholder="例：住宅設備、モビリティ"
                  aria-describedby={errors.productDomain ? 'product-domain-error' : undefined}
                  onChange={(event) => changeProductDomain(event.target.value)}
              />
            </label>
              {errors.productDomain ? (
                <p id="product-domain-error" role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
                  {errors.productDomain}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="order-4">
            <legend className="text-sm font-bold text-ink">4. 対象期間を決める</legend>
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

          <fieldset className="order-3">
            <legend className="text-sm font-bold text-ink">3. 対象となる意匠情報を決める</legend>
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
                      {
                        setDesignKindsManuallyChanged(true);
                        onRequestChange({
                          ...request,
                          designKinds: toggleValue(request.designKinds, kind),
                        });
                      }
                    }
                  />
                ))}
              </div>
              {errors.designKinds ? (
                <p id="design-kinds-error" role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
                  {errors.designKinds}
                </p>
              ) : null}
            </div>
            {!designKindsManuallyChanged ? (
              <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                分析目的に合わせて意匠情報の種類を設定しました。必要なら手動で変更できます。
              </p>
            ) : null}
          </fieldset>

          <div className="order-5">
            <CheckboxGroup
              title="5. 分析目的を選ぶ"
              values={PRIMARY_PURPOSES}
              selected={request.purposes}
              labels={PURPOSE_LABELS}
              error={errors.purposes}
              errorId="purposes-error"
              onToggle={changePurposes}
            />
          </div>
        </div>

        <button
          type="button"
          className="mt-6 hidden w-full rounded-md bg-ink px-4 py-3 font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:block"
          onClick={onAnalyze}
          disabled={isRunning}
        >
          {isRunning ? '分析しています...' : '分析を開始'}
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-muted">6. 結果と根拠を確認する。意匠動向をルールベースで分析し、根拠意匠へ戻れます。</p>
      </section>
      {!hasResult ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden">
          <button
            type="button"
            className="w-full rounded-md bg-ink px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={onAnalyze}
            disabled={isRunning}
          >
            {isRunning ? '分析しています...' : '分析を開始'}
          </button>
          <p className="mt-1 text-center text-[11px] text-muted">APIキー不要のルールベース分析</p>
        </div>
      ) : null}
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
  errorId,
  onToggle,
}: {
  title: string;
  values: T[];
  selected: T[];
  labels: Record<T, string>;
  error?: string;
  errorId: string;
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
      {error ? (
        <p id={errorId} role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function departmentsForPurposes(purposes: AnalysisPurpose[]): Department[] {
  const departments = new Set<Department>();
  for (const purpose of purposes) {
    if (purpose === 'market_trend' || purpose === 'company_trend') departments.add('mgmt_planning');
    if (purpose === 'competitor_design') departments.add('product_planning');
    if (purpose === 'design_change' || purpose === 'ui_design') departments.add('design');
    if (purpose === 'filing_strategy') departments.add('ip');
  }
  return departments.size > 0 ? [...departments] : ['product_planning'];
}
