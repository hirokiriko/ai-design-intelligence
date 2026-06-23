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
import { Badge } from '../common/Badge';

interface SettingsPanelProps {
  request: AnalysisRequest;
  companyInput: string;
  errors: ValidationErrors;
  isRunning: boolean;
  onRequestChange: (request: AnalysisRequest) => void;
  onCompanyInputChange: (value: string) => void;
  onAddCompany: () => void;
  onRemoveCompany: (company: string) => void;
  onAnalyze: () => void;
}

export function SettingsPanel({
  request,
  companyInput,
  errors,
  isRunning,
  onRequestChange,
  onCompanyInputChange,
  onAddCompany,
  onRemoveCompany,
  onAnalyze,
}: SettingsPanelProps) {
  const companies = request.scope.mode === 'companies' ? request.scope.companies : [];

  return (
    <aside className="space-y-5">
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
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-ink">③ 調査範囲</legend>
            <div className="mt-3 rounded-md border border-line p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold">デモ用意匠情報</span>
                <Badge tone="accent">現在利用</Badge>
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
                <Badge tone="warning">将来拡張</Badge>
              </div>
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
