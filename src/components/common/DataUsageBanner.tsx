import type { BackendContractDataClassification } from '../../data/BackendContractDataClassification';

type DataUsageBannerProps =
  | { mode: 'sample' }
  | { mode: 'legacy' }
  | {
      mode: 'backend';
      classification: BackendContractDataClassification;
      acceptedCount: number;
      analysisCutoff: string;
    };

const countFormatter = new Intl.NumberFormat('ja-JP');
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function DataUsageBanner(props: DataUsageBannerProps) {
  if (props.mode === 'backend') {
    const isApprovedPublicDesignDemo = props.classification === 'approved_public_design_demo';
    const isFictionalContractFixture = props.classification === 'fictional_contract_fixture';

    return (
      <section
        aria-label="使用中のデータ"
        aria-live="polite"
        className={
          isApprovedPublicDesignDemo
            ? 'border-t border-teal-200 bg-teal-50'
            : isFictionalContractFixture
              ? 'border-t border-amber-200 bg-amber-50'
              : 'border-t border-slate-300 bg-slate-100'
        }
        role="status"
      >
        <div
          className={
            isApprovedPublicDesignDemo
              ? 'mx-auto max-w-7xl px-4 py-4 text-accent'
              : isFictionalContractFixture
                ? 'mx-auto max-w-7xl px-4 py-4 text-caution'
                : 'mx-auto max-w-7xl px-4 py-4 text-slate-700'
          }
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-bold text-ink">
                {isApprovedPublicDesignDemo
                  ? '公開意匠実データを使用中'
                  : isFictionalContractFixture
                    ? '架空Contract検証データを使用中'
                    : 'Contract検証データを使用中'}
              </p>
              <p className="mt-1 text-sm leading-6">
                {isApprovedPublicDesignDemo
                  ? '取得済みの週次更新差分を用いた、初回提案向けの限定デモです。'
                  : isFictionalContractFixture
                    ? 'Contract 0.1.0の読込・分析経路を確認するための完全架空データです。'
                    : 'Contract 0.1.0として検証済みですが、データ区分は未確認です。実データとは断定しません。'}
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-teal-200 bg-white px-4 py-2">
                <dt className="text-xs font-semibold text-muted">分析対象件数</dt>
                <dd className="mt-1 text-base font-bold text-ink">{countFormatter.format(props.acceptedCount)}件</dd>
              </div>
              <div className="rounded-lg border border-teal-200 bg-white px-4 py-2">
                <dt className="text-xs font-semibold text-muted">データ基準日</dt>
                <dd className="mt-1 text-base font-bold text-ink">{formatAnalysisCutoff(props.analysisCutoff)}</dd>
              </div>
            </dl>
          </div>
          {isApprovedPublicDesignDemo ? (
            <p className="mt-3 text-xs leading-5 text-muted">
              日本の全意匠を網羅するものではなく、最新の法的状態や完全な市場母集団を示すものではありません。
            </p>
          ) : null}
          {isFictionalContractFixture ? (
            <p className="mt-3 text-xs leading-5 text-muted">実在企業・実在公報ではなく、実データとして扱いません。</p>
          ) : null}
          {props.classification === 'unclassified_contract' ? (
            <p className="mt-3 text-xs leading-5 text-muted">利用承認を確認するまで、承認済みデータ用の表示へ切り替えません。</p>
          ) : null}
          <p className="mt-1 text-xs leading-5 text-muted">
            手動選択したデータはブラウザのメモリ上だけで扱い、公開Preview・公開ビルドには含めません。
          </p>
        </div>
      </section>
    );
  }

  if (props.mode === 'legacy') {
    return (
      <section aria-label="使用中のデータ" aria-live="polite" className="border-t border-line bg-teal-50" role="status">
        <div className="mx-auto max-w-7xl px-4 py-3 text-sm leading-6 text-accent">
          <strong className="mr-1">ローカル検証データを使用中です。</strong>
          データはブラウザのメモリ上だけで扱い、公開ビルドには含めません。
        </div>
      </section>
    );
  }

  return (
    <section aria-label="使用中のデータ" aria-live="polite" className="border-t border-amber-200 bg-amber-50" role="status">
      <div className="mx-auto max-w-7xl px-4 py-3 text-sm leading-6 text-caution">
        <strong className="mr-1">サンプルデータ版です。</strong>
        表示される企業・意匠情報はすべて架空で、実在企業・実在公報ではありません。
      </div>
    </section>
  );
}

function formatAnalysisCutoff(value: string): string {
  const match = isoDatePattern.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}
