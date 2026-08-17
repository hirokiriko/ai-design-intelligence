import type { BackendContractDataClassification } from '../../data/BackendContractDataClassification';
import type { BackendContractAcquisition } from '../../domain/backendContractAcquisition';

type DataUsageBannerProps =
  | { mode: 'sample' }
  | { mode: 'legacy' }
  | {
      mode: 'backend';
      classification: BackendContractDataClassification;
      acceptedCount: number;
      analysisCutoff: string;
      acquisition?: BackendContractAcquisition;
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
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-bold text-ink">
                {isApprovedPublicDesignDemo
                  ? '公開意匠データを使用中'
                  : isFictionalContractFixture
                    ? '架空の検証データを使用中'
                    : 'データ区分を確認中'}
              </p>
              <p className="mt-1 text-sm leading-6">
                {isApprovedPublicDesignDemo
                  ? '公開意匠データを対象に、ルールベースで集計した参考情報です。'
                  : isFictionalContractFixture
                    ? '読込・分析経路を確認するための完全架空データです。'
                    : 'データ区分は未確認です。公開意匠データとは断定しません。'}
              </p>
            </div>
            <dl className="grid w-full min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:w-auto lg:shrink-0">
              <div className="min-w-0 rounded-lg border border-teal-200 bg-white px-4 py-2">
                <dt className="text-xs font-semibold text-muted">分析対象件数</dt>
                <dd className="readable-text mt-1 text-base font-bold text-ink">{countFormatter.format(props.acceptedCount)}件</dd>
              </div>
              <div className="min-w-0 rounded-lg border border-teal-200 bg-white px-4 py-2">
                <dt className="text-xs font-semibold text-muted">データ基準日</dt>
                <dd className="readable-text mt-1 text-base font-bold text-ink">{formatAnalysisCutoff(props.analysisCutoff)}</dd>
              </div>
            </dl>
          </div>
          {isApprovedPublicDesignDemo ? (
            <p className="mt-3 text-xs leading-5 text-muted">
              日本の全意匠や最新の法的状態を示すものではなく、法的判断には使用できません。
            </p>
          ) : null}
          {isFictionalContractFixture ? (
            <p className="mt-3 text-xs leading-5 text-muted">実在企業・実在公報ではなく、実データとして扱いません。</p>
          ) : null}
          {props.classification === 'unclassified_contract' ? (
            <p className="mt-3 text-xs leading-5 text-muted">利用承認を確認するまで、公開意匠データ用の表示へ切り替えません。</p>
          ) : null}
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
