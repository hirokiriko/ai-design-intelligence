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
import { companySelectorKey, type CompanySelector } from '../../domain/analysisRecords';
import type { LocalJpoLoadFailure, LocalJpoLoadSuccess } from '../../data/LocalJpoJsonDataSource';
import type { DemoShowcaseLoadFailure, DemoShowcaseLoadSuccess } from '../../data/DemoShowcaseDataSource';
import type { HosoeAnalysisPackLoadFailure, HosoeAnalysisPackLoadSuccess } from '../../data/HosoeAnalysisPackDataSource';
import type { BackendContractAdapterSuccess } from '../../data/BackendContractDataSource';
import type { BackendContractDataClassification } from '../../data/BackendContractDataClassification';
import type { BackendContractAcquisition } from '../../domain/backendContractAcquisition';
import {
  createDemoPresetRequest,
  getDemoPresetsForDataMode,
  type DemoPreset,
} from '../../domain/presets';
import { getDesignKindSelectionStatus, resolveDesignKinds } from '../../domain/selection';
import { Badge } from '../common/Badge';
import { DeferredDetails } from '../common/DeferredDetails';

type LocalJpoPanelState =
  | { status: 'sample'; warnings: string[]; errors: string[] }
  | { status: 'loading'; fileName: string; warnings: string[]; errors: string[] }
  | { status: 'loaded'; load: LocalJpoLoadSuccess }
  | {
      status: 'backend_loaded';
      fileName: string;
      adapted: BackendContractAdapterSuccess;
      classification: BackendContractDataClassification;
    }
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
  companyOptions?: CompanySelector[];
  companySelectionMode?: 'freeform' | 'options_only';
  errors: ValidationErrors;
  isRunning: boolean;
  hasResult?: boolean;
  technicalDetailsInitiallyOpen?: boolean;
  localJpoState: LocalJpoPanelState;
  backendContractAcquisition?: BackendContractAcquisition;
  enableLocalAnalysisPack: boolean;
  externalDemoMode: boolean;
  demoShowcaseState: DemoShowcasePanelState;
  hosoeAnalysisPackState: HosoeAnalysisPackPanelState;
  onRequestChange: (request: AnalysisRequest) => void;
  onCompanyInputChange: (value: string) => void;
  onAddCompany: (selectorKey?: string) => void;
  onRemoveCompany: (selectorKey: string) => void;
  onAnalyze: () => void;
  onLocalJsonFile: (file: File | null) => void;
  onApprovedPublicDesignDemoChange: (approved: boolean) => void;
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
  companySelectionMode = 'freeform',
  errors,
  isRunning,
  hasResult = false,
  technicalDetailsInitiallyOpen = false,
  localJpoState,
  backendContractAcquisition = 'manual_file',
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
  onApprovedPublicDesignDemoChange,
  onResetToSampleData,
  onExternalDemoModeChange,
  onDemoShowcaseFile,
  onClearDemoShowcase,
  onHosoeAnalysisPackFile,
  onClearHosoeAnalysisPack,
}: SettingsPanelProps) {
  const companySelectors = request.scope.mode === 'companies' ? request.scope.companySelectors : [];
  const selectedCompanyKeys = new Set(companySelectors.map(companySelectorKey));
  const availableCompanyOptions = companyOptions.filter((company) => !selectedCompanyKeys.has(companySelectorKey(company)));
  const [designKindsManuallyChanged, setDesignKindsManuallyChanged] = useState(false);
  const demoPresets = getDemoPresetsForDataMode(localJpoState.status === 'backend_loaded' ? 'backend' : 'sample');
  const isAuthenticatedTrial = backendContractAcquisition === 'authenticated_trial';

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

  const applyPreset = (preset: DemoPreset) => {
    setDesignKindsManuallyChanged(false);
    onRequestChange(createDemoPresetRequest(preset));
  };

  return (
    <aside className="min-w-0 space-y-5">
      <section id="analysis-settings" className="scroll-mt-6 rounded-lg border-2 border-teal-200 bg-white p-5 pb-24 shadow-soft sm:pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">5分デモ</p>
            <h2 className="mt-1 text-lg font-bold text-ink">分析条件を決める</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              対象・領域・意匠種別・期間・目的を順に選び、結果の件数から根拠意匠を確認します。
            </p>
          </div>
          <Badge tone="accent">1〜6</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {demoPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`rounded-lg border p-3 text-left text-sm ${preset.id === 'image' ? 'border-sky-200 bg-sky-50' : 'border-teal-200 bg-teal-50'}`}
              onClick={() => applyPreset(preset)}
            >
              <span className="block font-bold text-ink">{preset.label}</span>
              <span className="mt-1 block leading-5 text-muted">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <fieldset>
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
                  onChange={() => onRequestChange({ ...request, scope: { mode: 'industry', industry: request.productDomain ?? '' } })}
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
                  onChange={() => onRequestChange({ ...request, scope: { mode: 'companies', companySelectors } })}
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
                        <option key={companySelectorKey(company)} value={companySelectorKey(company)}>{company.displayLabel}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {companySelectionMode === 'freeform' ? (
                  <>
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
                  </>
                ) : (
                  <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                    表示される企業候補から選択できます。候補にない名称は追加されません。
                  </p>
                )}
                {companySelectors.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {companySelectors.map((company) => (
                      <button
                        key={companySelectorKey(company)}
                        type="button"
                        className="readable-text min-w-0 max-w-full rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-semibold text-accent [overflow-wrap:anywhere]"
                        onClick={() => onRemoveCompany(companySelectorKey(company))}
                      >
                        {company.displayLabel} ×
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
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-ink">2. 見たい領域を決める</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRODUCT_DOMAIN_PRESETS.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  aria-pressed={request.productDomain === domain}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold ${request.productDomain === domain ? 'border-teal-300 bg-teal-50 text-accent' : 'border-line bg-white text-ink'}`}
                  onClick={() => changeProductDomain(domain)}
                >
                  {domain}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-semibold text-ink">
              その他の領域を入力
              <input
                id="product-domain-input"
                className="mt-2 w-full rounded-md border border-line px-3 py-2"
                value={request.productDomain ?? ''}
                placeholder="例：ウェアラブル機器"
                aria-describedby={errors.productDomain ? 'product-domain-error' : undefined}
                onChange={(event) => changeProductDomain(event.target.value)}
              />
            </label>
            {errors.productDomain ? (
              <p id="product-domain-error" role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
                {errors.productDomain}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-ink">3. 対象となる意匠情報を決める</legend>
            <div className="mt-3 rounded-md border border-line p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {localJpoState.status === 'backend_loaded'
                    ? '公開意匠データ'
                    : localJpoState.status === 'loaded'
                      ? 'ローカル実データJSON'
                      : 'デモ用意匠情報'}
                </span>
                <Badge tone="accent">現在利用</Badge>
                {localJpoState.status === 'loaded' ? <Badge tone="warning">意匠種別は暫定推定</Badge> : null}
              </div>
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={request.designKinds.length === ALL_DESIGN_KINDS.length}
                  onChange={() => {
                    setDesignKindsManuallyChanged(true);
                    onRequestChange({
                      ...request,
                      designKinds: request.designKinds.length === ALL_DESIGN_KINDS.length ? [] : [...ALL_DESIGN_KINDS],
                    });
                  }}
                />
                全対象
              </label>
              <div className="grid gap-2">
                {ALL_DESIGN_KINDS.map((kind) => (
                  <CheckRow
                    key={kind}
                    checked={request.designKinds.includes(kind)}
                    label={DESIGN_KIND_LABELS[kind]}
                    onChange={() => {
                      setDesignKindsManuallyChanged(true);
                      onRequestChange({ ...request, designKinds: toggleValue(request.designKinds, kind) });
                    }}
                  />
                ))}
              </div>
              {errors.designKinds ? (
                <p id="design-kinds-error" role="alert" tabIndex={-1} className="mt-2 text-sm font-semibold text-red-700 focus:outline-none">
                  {errors.designKinds}
                </p>
              ) : null}
            </div>
            <p className={`mt-3 rounded-md border p-3 text-sm leading-6 ${designKindsManuallyChanged ? 'border-amber-200 bg-amber-50 text-caution' : 'border-sky-200 bg-sky-50 text-sky-900'}`}>
              {isAuthenticatedTrial
                ? getAuthenticatedTrialDesignKindSelectionStatus(designKindsManuallyChanged)
                : getDesignKindSelectionStatus(designKindsManuallyChanged)}
            </p>
          </fieldset>

          <fieldset>
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
            <p className="mt-2 text-sm text-muted">現状把握には直近1年、傾向把握には直近2年を目安に選択します。</p>
            {localJpoState.status === 'loaded' ? (
              <label className="mt-3 flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={request.includeUnresolvedApplicants ?? true}
                  onChange={() => onRequestChange({ ...request, includeUnresolvedApplicants: !(request.includeUnresolvedApplicants ?? true) })}
                />
                <span>
                  <span className="block font-semibold text-ink">名称未解決の申請人コードを含む</span>
                  <span className="text-muted">OFFにすると、名称を補完できていない申請人コードを含むレコードを除外します。</span>
                </span>
              </label>
            ) : null}
          </fieldset>

          <CheckboxGroup
            title="5. 分析目的を選ぶ"
            values={PRIMARY_PURPOSES}
            selected={request.purposes}
            labels={PURPOSE_LABELS}
            error={errors.purposes}
            errorId="purposes-error"
            onToggle={changePurposes}
          />

          <CheckboxGroup
            title="6. 出力部門を選ぶ（任意）"
            values={ALL_DEPARTMENTS}
            selected={request.departments}
            labels={DEPARTMENT_LABELS}
            error={errors.departments}
            errorId="departments-error"
            onToggle={(value) => onRequestChange({ ...request, departments: toggleValue(request.departments, value) })}
          />
        </div>

        <button
          type="button"
          className="mt-6 hidden w-full rounded-md bg-ink px-4 py-3 font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:block"
          onClick={onAnalyze}
          disabled={isRunning}
        >
          {isRunning ? '分析しています...' : '分析を開始'}
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-muted">
          7. 結果と根拠を確認する。分析対象意匠数と主な傾向を確認し、件数から根拠意匠へ移動します。
        </p>
      </section>

      <DeferredDetails
        className="rounded-lg border border-line bg-white p-4 shadow-soft"
        initiallyOpen={technicalDetailsInitiallyOpen}
        summaryClassName="cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        summary={
          <span className="flex flex-wrap items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">
                {localJpoState.status === 'backend_loaded' ? '技術・検証情報' : '詳細設定・データ情報'}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                通常は開かずに分析できます。データの取扱いや検証情報を確認する場合だけ開いてください。
              </span>
            </span>
            <Badge tone={localJpoState.status === 'loaded' ? 'warning' : localJpoState.status === 'backend_loaded' ? 'accent' : 'neutral'}>
              {localJpoState.status === 'backend_loaded'
                ? backendClassificationLabel(localJpoState.classification)
                : localJpoState.status === 'loaded'
                  ? 'ローカルデータ利用中'
                  : 'サンプルデータ利用中'}
            </Badge>
          </span>
        }
      >

        <div className="mt-4 space-y-5 border-t border-line pt-4">
      <section className="rounded-lg border border-line bg-slate-50 p-5">
        <h2 className="text-base font-bold text-ink">利用中のデータ・分析方法</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          データ境界や分析方式など、画面共有時に必要な技術情報です。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={localJpoState.status === 'backend_loaded' ? 'accent' : localJpoState.status === 'loaded' ? 'warning' : 'neutral'}>
            {localJpoState.status === 'backend_loaded'
              ? 'Backend Contract 0.1.0'
              : localJpoState.status === 'loaded'
                ? 'ローカル検証データ'
                : 'デモ用サンプルデータ'}
          </Badge>
          <Badge tone="accent">ルールベース分析</Badge>
          <Badge tone="warning">
            {localJpoState.status === 'sample'
              ? '外部データ未接続'
              : isAuthenticatedTrial
                ? '認証後・同一オリジン自動取得'
                : 'File API・メモリ内のみ'}
          </Badge>
          {localJpoState.status === 'backend_loaded' ? (
            <Badge tone={localJpoState.classification === 'approved_public_design_demo' ? 'accent' : 'warning'}>
              {backendClassificationLabel(localJpoState.classification)}
            </Badge>
          ) : null}
        </div>
      </section>

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
            <span className="text-muted">
              {isAuthenticatedTrial
                ? '法的注意書きと限定試用の前提は表示したまま、デモで見るポイントを前面に出します。'
                : '法的注意書きとローカル検証版の前提は表示したまま、デモで見るポイントを前面に出します。'}
            </span>
          </span>
        </label>
      </section>

      {isAuthenticatedTrial && localJpoState.status === 'backend_loaded' ? (
        <AuthenticatedTrialContractSummary state={localJpoState} />
      ) : null}

      {!isAuthenticatedTrial ? (
        <>
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">ローカルJSONを読み込む{externalDemoMode ? '' : '（開発用）'}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              選択したJSONはブラウザのメモリ上だけで扱い、リポジトリやブラウザ永続領域には保存しません。
            </p>
          </div>
          <Badge tone={localJpoState.status === 'error' ? 'warning' : localJpoState.status === 'loaded' || localJpoState.status === 'backend_loaded' ? 'accent' : 'neutral'}>
            {localJpoState.status === 'loading'
              ? '読込中'
              : localJpoState.status === 'loaded' || localJpoState.status === 'backend_loaded'
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
        {localJpoState.status === 'backend_loaded' ? (
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <div className="font-bold">Backend Contract読込済み</div>
            <div className="readable-text mt-1 font-semibold">{localJpoState.fileName}</div>
            <div className="mt-2 font-semibold">{backendClassificationLabel(localJpoState.classification)}</div>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <div><dt className="inline font-semibold">data classification: </dt><dd className="inline">{localJpoState.classification}</dd></div>
              <div><dt className="inline font-semibold">contract version: </dt><dd className="inline">{localJpoState.adapted.meta.contractVersion}</dd></div>
              <div><dt className="inline font-semibold">analysis cutoff: </dt><dd className="inline">{localJpoState.adapted.meta.analysisCutoff}</dd></div>
              <div><dt className="inline font-semibold">total / accepted / excluded: </dt><dd className="inline">{localJpoState.adapted.summary.totalRecordCount} / {localJpoState.adapted.summary.acceptedCount} / {localJpoState.adapted.summary.excludedCount}</dd></div>
              <div><dt className="inline font-semibold">warning / quarantined: </dt><dd className="inline">{localJpoState.adapted.summary.warningCount} / {localJpoState.adapted.summary.quarantinedCount}</dd></div>
              <div><dt className="inline font-semibold">missing gazetteDate: </dt><dd className="inline">{localJpoState.adapted.summary.missingGazetteDateCount}</dd></div>
              <div><dt className="inline font-semibold">unknown design type: </dt><dd className="inline">{localJpoState.adapted.summary.unknownDesignTypeCount}</dd></div>
            </dl>
            {localJpoState.classification === 'fictional_contract_fixture' ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                `FIXTURE-`名前空間は架空Contract fixtureとして固定し、実データ用表示へ変更しません。
              </div>
            ) : (
              <label className="mt-3 flex items-start gap-3 rounded-md border border-sky-200 bg-white p-3 text-xs leading-5 text-sky-950">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={localJpoState.classification === 'approved_public_design_demo'}
                  onChange={(event) => onApprovedPublicDesignDemoChange(event.currentTarget.checked)}
                />
                <span>
                  <span className="block font-semibold">承認済み公開意匠デモデータとして表示する</span>
                  <span className="text-muted">
                    利用承認を確認できた正式Contractに限り選択してください。この選択はメモリ内だけで保持し、別ファイルの選択や再読込では引き継ぎません。
                  </span>
                </span>
              </label>
            )}
            <button
              className="mt-3 rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-900"
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
        </>
      ) : null}

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
            <li key={source} className="rounded-md border border-line bg-white px-3 py-2">{source}（準備中）</li>
          ))}
          <li className="rounded-md border border-line bg-white px-3 py-2">IR・Web商品情報（準備中）</li>
          <li className="rounded-md border border-line bg-white px-3 py-2">LLMによる高度分析（準備中）</li>
        </ul>
      </section>

        </div>
      </DeferredDetails>

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
          <p className="mt-1 text-center text-[11px] text-muted">選択した条件で分析します</p>
        </div>
      ) : null}
    </aside>
  );
}

function AuthenticatedTrialContractSummary({
  state,
}: {
  state: Extract<LocalJpoPanelState, { status: 'backend_loaded' }>;
}) {
  return (
    <section
      className="rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950"
      data-testid="authenticated-trial-contract-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Backend Contract自動取得済み</h2>
          <p className="mt-1 leading-6 text-muted">
            認証済みセッションで同一オリジンから取得し、受理されたレコードだけを分析対象にしています。
          </p>
        </div>
        <Badge tone={state.classification === 'approved_public_design_demo' ? 'accent' : 'warning'}>
          {backendClassificationLabel(state.classification)}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="inline font-semibold">contract version: </dt><dd className="inline">{state.adapted.meta.contractVersion}</dd></div>
        <div><dt className="inline font-semibold">analysis cutoff: </dt><dd className="inline">{state.adapted.meta.analysisCutoff}</dd></div>
        <div><dt className="inline font-semibold">total / accepted / excluded: </dt><dd className="inline">{state.adapted.summary.totalRecordCount} / {state.adapted.summary.acceptedCount} / {state.adapted.summary.excludedCount}</dd></div>
        <div><dt className="inline font-semibold">warning / quarantined: </dt><dd className="inline">{state.adapted.summary.warningCount} / {state.adapted.summary.quarantinedCount}</dd></div>
        <div><dt className="inline font-semibold">missing gazetteDate: </dt><dd className="inline">{state.adapted.summary.missingGazetteDateCount}</dd></div>
        <div><dt className="inline font-semibold">unknown design type: </dt><dd className="inline">{state.adapted.summary.unknownDesignTypeCount}</dd></div>
      </dl>
    </section>
  );
}

function getAuthenticatedTrialDesignKindSelectionStatus(selectionChanged: boolean): string {
  return selectionChanged
    ? '個別設定中です。分析目的を変更しても現在の意匠種別を維持します。'
    : '自動設定中です。分析目的に合わせて意匠種別を設定し、必要なら個別に変更できます。';
}

function backendClassificationLabel(classification: BackendContractDataClassification): string {
  switch (classification) {
    case 'fictional_contract_fixture':
      return '架空の検証データ';
    case 'approved_public_design_demo':
      return '公開意匠データ';
    case 'unclassified_contract':
      return 'データ区分を確認中';
  }
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
  return [...departments];
}
