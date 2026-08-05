import type { ReactNode } from 'react';
import { Badge } from '../components/common/Badge';
import type {
  HosoeAnalysisPack,
  HosoeAnalysisRecord,
  HosoeCompanySummary,
  HosoeExcludedRecord,
} from '../domain/types';

const STRICT_COUNT_KEY = ['strict', 'PrefixWCount'].join('');
const CANDIDATE_COUNT_KEY = ['dTermWIncluded', 'CandidateCount'].join('');
const STRICT_LABEL = ['strict', 'PrefixW'].join('');
const CANDIDATE_LABEL = ['dTermWIncluded', 'Candidate'].join('');
const STRICT_DISPLAY_LABEL = '分類先頭がW';
const CLASSIFICATION_W_CANDIDATE_LABEL = '日本意匠分類にWを含む監査済み画像意匠候補';
const REVIEW_TITLE = '専門家レビュー：スマホ関連6社の画像意匠候補・抽出ロジック検証';
const REVIEW_SUBTITLE =
  '日本意匠分類にWを含む画像意匠候補について、企業名照合・分類・根拠レコードを監査したローカル暫定検証です。';
const NOT_DETECTED_TEXT = '手元データ内で未検出。実際に出願・登録がないことを意味しません';
const SOFTBANK_GROUP = ['Soft', 'Bank'].join('');
const SOFTBANK_NOTE = '手元データ範囲・現在の分類・名寄せ条件では未検出';
const V_TERM_CONFIRMED = 'confirmed';
const V_TERM_SOURCE_UNAVAILABLE = 'sourceGazetteUnavailable';

const EXPERT_REVIEW_QUESTIONS = [
  '日本意匠分類のW含有を画像意匠候補の一次抽出に使うことは妥当か',
  '画像共通DタームのV系分類をどの段階で併用すべきか',
  '登録公報XMLのV系Dタームを分析レコードへ付与してよいか',
  '複数のV系Dタームを企業比較で集計する適切な単位は何か',
  '比較基準日は出願日、国際出願日、登録日、公報発行日のどれが適切か',
  '出願人と権利者のどちらを企業比較の主軸にすべきか',
  '短い企業別名は完全一致のみにすべきか',
  'LINE、Yahoo、Z Holdings、LINE Yahooのグループ範囲をどう扱うべきか',
  '公報データ未接続のrecordを比較時にどう表示すべきか',
  '少数件・0件から戦略上の示唆を出す前に何を追加確認すべきか',
  '弁理士実務で次に必要なのは、先行意匠検索、図面、関連意匠、創作者、代理人、審査官のどの情報か',
  '企業知財・商品企画部門向けに有効な出力は何か',
];

export function HosoeAnalysisPackPanel({ pack }: { pack: HosoeAnalysisPack }) {
  const orderedCompanySummaries = [...pack.companySummaries].sort(
    (left, right) => numberField(right, CANDIDATE_COUNT_KEY) - numberField(left, CANDIDATE_COUNT_KEY),
  );
  const dateFrom = pack.dateFrom ? `${pack.dateFrom}以降` : '指定期間';

  return (
    <section id="local-analysis-pack" className="scroll-mt-24 rounded-lg border-2 border-teal-300 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">{REVIEW_TITLE}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{REVIEW_SUBTITLE}</p>
          <p className="readable-text mt-1 text-xs text-muted">
            読み込みパック: {pack.title} / 対象: {dateFrom}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge tone="accent">ローカル検証</Badge>
          <Badge tone="warning">監査済みv3・暫定値</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={CLASSIFICATION_W_CANDIDATE_LABEL}
          value={`${formatCount(numberField(pack, CANDIDATE_COUNT_KEY))}件`}
        />
        {orderedCompanySummaries.map((summary) => (
          <StatCard
            key={summary.companyGroup}
            label={summary.companyGroup}
            value={formatCandidateCount(numberField(summary, CANDIDATE_COUNT_KEY))}
            note={summary.companyGroup === SOFTBANK_GROUP && numberField(summary, CANDIDATE_COUNT_KEY) === 0 ? SOFTBANK_NOTE : undefined}
          />
        ))}
      </div>

      <ExpertReviewOverview pack={pack} companySummaries={orderedCompanySummaries} />

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ExtractionAuditPanel pack={pack} />
        <VTermReviewPanel pack={pack} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReviewConditions pack={pack} />
        <ClassificationTerms />
      </div>

      <CompanyComparisonTable companySummaries={orderedCompanySummaries} />

      <details className="mt-5 rounded-md border border-line bg-panel p-4">
        <summary className="cursor-pointer text-sm font-bold text-ink">抽出方式の検討履歴</summary>
        <div className="mt-3 text-sm leading-6 text-muted">
          <p>初回条件の検討履歴としてのみ保持しています。現在のメイン結果には使用していません。</p>
          <p className="mt-2 font-semibold text-ink">
            {STRICT_DISPLAY_LABEL}：{formatCount(numberField(pack, STRICT_COUNT_KEY))}件
          </p>
        </div>
      </details>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <SmallTable
          title="年別推移ビュー"
          headers={['企業グループ', '年', '件数']}
          rows={pack.yearlyTrend.map((item) => [item.companyGroup, item.year, `${formatCount(item.count)}件`])}
        />
        <SmallTable
          title="分類別ビュー"
          headers={['企業グループ', '日本意匠分類', '件数']}
          rows={pack.byDesignClass.map((item) => [item.companyGroup, item.designClass, `${formatCount(item.count)}件`])}
        />
        <SmallTable
          title="物品名別ビュー"
          headers={['企業グループ', '物品名', '件数']}
          rows={pack.byArticleName.map((item) => [item.companyGroup, item.articleName, `${formatCount(item.count)}件`])}
        />
      </div>

      <AuditRecordList records={pack.records} />

      <div className="mt-5">
        <NumberedPanel title="安立先生に確認したい事項" items={EXPERT_REVIEW_QUESTIONS} />
      </div>

      {pack.warnings.length > 0 ? (
        <details className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <summary className="cursor-pointer font-bold">読込時の注意（{formatCount(pack.warnings.length)}件）</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {pack.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ExpertReviewOverview({ pack, companySummaries }: { pack: HosoeAnalysisPack; companySummaries: HosoeCompanySummary[] }) {
  const nonZeroSummaries = companySummaries.filter((summary) => numberField(summary, CANDIDATE_COUNT_KEY) > 0);
  const zeroSummaries = companySummaries.filter((summary) => numberField(summary, CANDIDATE_COUNT_KEY) === 0);
  const cannotConcludeItems = [
    '2020年4月1日以降の全量データではありません。',
    '0件は、実際に出願・登録がないことを意味しません。',
    '特許公開件数との直接比較には特許側の同一条件集計が必要です。',
    '企業の知財戦略の意図は件数だけでは判断できません。',
    '名寄せ、関連会社、旧社名による取りこぼしの可能性があります。',
    `V系Dターム未確認${formatCount(pack.vTermSummary.unconfirmedCount)}件が残ります。`,
    '法的・実務的な最終評価には専門家確認が必要です。',
  ];

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-3">
      <article className="rounded-md border border-sky-200 bg-sky-50 p-4">
        <div className="text-xs font-bold text-sky-800">A. 検証仮説</div>
        <p className="mt-2 text-sm leading-6 text-ink">
          ソフトバンクは特許活動が活発である一方、画像意匠の取得・出願活動は比較対象企業より少ない可能性がある、という仮説を手元データで検証します。
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">細江さんから提示された検証仮説です。確定事実としては表示していません。</p>
      </article>

      <article className="rounded-md border border-teal-200 bg-teal-50 p-4">
        <div className="text-xs font-bold text-accent">B. 現在の観測</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink">
          <li>
            {CLASSIFICATION_W_CANDIDATE_LABEL}：<strong>{formatCount(numberField(pack, CANDIDATE_COUNT_KEY))}件</strong>
          </li>
          {nonZeroSummaries.map((summary) => (
            <li key={summary.companyGroup}>
              {summary.companyGroup}：<strong>{formatCount(numberField(summary, CANDIDATE_COUNT_KEY))}件</strong>
            </li>
          ))}
          <li>その他{formatCount(zeroSummaries.length)}社：手元データ内で未検出</li>
          <li>V系Dターム確認済み：{formatCount(pack.vTermSummary.confirmedCount)}件</li>
          <li>V系Dターム未確認：{formatCount(pack.vTermSummary.unconfirmedCount)}件</li>
        </ul>
      </article>

      <article className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="text-xs font-bold text-amber-900">C. このデータだけでは結論できないこと</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
          {cannotConcludeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function ExtractionAuditPanel({ pack }: { pack: HosoeAnalysisPack }) {
  return (
    <section className="rounded-md border border-rose-200 bg-rose-50 p-4">
      <h3 className="text-sm font-bold text-ink">抽出結果の監査</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MiniStat label="初回自動抽出" value={`${formatCount(pack.audit.initialAutomaticCount)}件`} />
        <MiniStat label="監査後" value={`${formatCount(pack.audit.auditedCount)}件`} />
        <MiniStat label="除外" value={`${formatCount(pack.audit.excludedCount)}件`} />
      </div>
      <div className="mt-3 space-y-3">
        {pack.audit.excludedRecords.length > 0 ? (
          pack.audit.excludedRecords.map((record) => <ExcludedRecord key={record.id} record={record} />)
        ) : (
          <p className="text-sm text-muted">除外recordの詳細は未収録です。</p>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink">
        分析結果から元レコードへ戻り、企業名の照合根拠を確認することで、名寄せの誤抽出を検出・修正しています。
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">誤抽出を隠さず、分析結果を元レコードまで監査できることの実例として表示しています。</p>
    </section>
  );
}

function ExcludedRecord({ record }: { record: HosoeExcludedRecord }) {
  return (
    <dl className="grid gap-2 rounded-md border border-rose-200 bg-white p-3 text-sm sm:grid-cols-2">
      <DefinitionItem label="除外record" value={record.id} />
      <DefinitionItem label="元名称" value={record.originalName ?? '未収録'} />
      <div className="sm:col-span-2">
        <DefinitionItem label="除外理由" value={record.reason} />
      </div>
    </dl>
  );
}

function VTermReviewPanel({ pack }: { pack: HosoeAnalysisPack }) {
  const unconfirmedGroups = joinList(pack.vTermSummary.unconfirmedCompanyGroups, '未確認');
  const unconfirmedDates = joinList(pack.vTermSummary.unconfirmedGazetteDates, '未確認');

  return (
    <section className="rounded-md border border-violet-200 bg-violet-50 p-4">
      <h3 className="text-sm font-bold text-ink">V系画像共通Dタームの確認状況</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MiniStat label="V系Dターム確認済み" value={`${formatCount(pack.vTermSummary.confirmedCount)}件`} />
        <MiniStat label="公報データ未接続のため未確認" value={`${formatCount(pack.vTermSummary.unconfirmedCount)}件`} />
      </div>
      <dl className="mt-3 grid gap-3 rounded-md border border-violet-200 bg-white p-3 text-sm sm:grid-cols-2">
        <DefinitionItem
          label={`未確認${formatCount(pack.vTermSummary.unconfirmedCount)}件`}
          value={`すべて${unconfirmedGroups}`}
        />
        <DefinitionItem label="公報発行日" value={unconfirmedDates} />
        <DefinitionItem label="vTerms" value="空配列。現在の手元公報データでは未確認です。" />
        <DefinitionItem label="確認結果" value="現在の手元公報データでは確認できていません。" />
      </dl>
      <p className="mt-3 rounded-md border border-violet-200 bg-white p-3 text-sm font-semibold text-violet-950">
        未確認は、V系Dタームが存在しないことを意味しません。
      </p>
    </section>
  );
}

function ReviewConditions({ pack }: { pack: HosoeAnalysisPack }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h3 className="text-sm font-bold text-ink">検証条件とデータの限界</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <DefinitionItem label="条件上の対象開始日" value={pack.dateFrom ?? '未収録'} />
        <DefinitionItem label="手元データ" value={pack.dataScopeNote ?? '未収録'} />
        <DefinitionItem label="全量網羅性" value={pack.isComprehensive === false ? 'なし' : '未確認'} />
        <DefinitionItem label="比較用の日付条件" value={pack.dateFieldPolicy ?? '未収録'} />
        <DefinitionItem label="分類判定" value="日本意匠分類の文字列内にWを含むもの" />
        <DefinitionItem label="分類例" value="N310W / N311W" />
        <DefinitionItem label="画像共通Dターム" value="V系分類。今回のW含有抽出とは別" />
        <DefinitionItem label="対象主体" value="出願人および権利者" />
        <DefinitionItem label="企業名" value="監査済みの候補名寄せを使用" />
        <DefinitionItem label="0件の意味" value={NOT_DETECTED_TEXT} />
      </dl>
    </section>
  );
}

function ClassificationTerms() {
  return (
    <section className="rounded-md border border-line bg-white p-4">
      <h3 className="text-sm font-bold text-ink">日本意匠分類と画像共通Dターム</h3>
      <div className="mt-3 space-y-4 text-sm leading-6">
        <div>
          <h4 className="font-bold text-ink">日本意匠分類</h4>
          <p className="mt-1 text-muted">N310W、N311W等、日本意匠分類にWを含む分類を、今回の画像意匠候補の一次抽出に使用しています。</p>
        </div>
        <div>
          <h4 className="font-bold text-ink">画像共通Dターム</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li>GUI部品・画面構成：VAA～VCL</li>
            <li>アイコン・図記号：VEA～VED</li>
            <li>画像の用途：VNA～VNF</li>
            <li>画像の変化・遷移：VL群</li>
          </ul>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <p>日本意匠分類のW含有は画像意匠候補を探す大きな分類棚、V系の画像共通Dタームは画像の内容・用途を詳しく見る細かなタグです。</p>
          <p className="mt-2 font-semibold">日本意匠分類のW含有と、画像共通DタームのV系分類は別の分類軸です。</p>
        </div>
      </div>
    </section>
  );
}

function CompanyComparisonTable({ companySummaries }: { companySummaries: HosoeCompanySummary[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-ink">6社比較ビュー</h3>
      <p className="mt-1 text-xs leading-5 text-muted">監査済み件数と、どの主体名で照合したかを分けて確認できます。</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[1040px] border-collapse text-left text-sm">
          <thead className="bg-panel text-xs text-muted">
            <tr>
              <TableHead>企業グループ</TableHead>
              <TableHead>監査済み画像意匠候補</TableHead>
              <TableHead>出願人ヒット</TableHead>
              <TableHead>権利者ヒット</TableHead>
              <TableHead>代表的な日本意匠分類</TableHead>
              <TableHead>代表的な物品名</TableHead>
              <TableHead>集計上の注意</TableHead>
            </tr>
          </thead>
          <tbody>
            {companySummaries.map((summary) => (
              <tr key={summary.companyGroup} className="border-t border-line align-top">
                <TableCell>{summary.companyGroup}</TableCell>
                <TableCell>{formatCandidateCount(numberField(summary, CANDIDATE_COUNT_KEY))}</TableCell>
                <TableCell>{formatCount(summary.applicantHitCount)}件</TableCell>
                <TableCell>{formatCount(summary.rightHolderHitCount)}件</TableCell>
                <TableCell>{joinList(summary.representativeDesignClasses)}</TableCell>
                <TableCell>{joinList(summary.representativeArticleNames)}</TableCell>
                <TableCell>
                  {summary.companyGroup === SOFTBANK_GROUP && numberField(summary, CANDIDATE_COUNT_KEY) === 0
                    ? SOFTBANK_NOTE
                    : summary.note}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRecordList({ records }: { records: HosoeAnalysisRecord[] }) {
  return (
    <details className="mt-5 rounded-md border border-line bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-ink">根拠20件の監査表示（{formatCount(records.length)}件）</summary>
      <p className="mt-2 text-xs leading-5 text-muted">各recordを開くと、元名称・照合根拠・日付・分類・V系確認状況を確認できます。</p>
      <div className="mt-3 space-y-3">
        {records.length > 0 ? (
          records.map((record) => (
            <details key={record.id} className="rounded-md border border-line bg-panel p-3">
              <summary className="readable-text cursor-pointer text-sm font-semibold text-ink">
                {record.matchedCompanyGroup} / {record.articleName ?? '物品名未収録'} /{' '}
                {record.applicationNumber ?? record.registrationNumber ?? record.id}
              </summary>
              <div className="mt-3 grid gap-4 xl:grid-cols-3">
                <AuditGroup title="企業・名称照合">
                  <AuditItem label="企業グループ" value={record.matchedCompanyGroup} />
                  <AuditItem label="元の出願人名" value={joinList(record.applicants)} />
                  <AuditItem label="元の権利者名" value={joinList(record.rightHolders)} />
                  <AuditItem label="matchedAlias" value={joinList(record.matchedAlias)} />
                  <AuditItem label="matchedRole" value={record.matchedRole ?? '未収録'} />
                </AuditGroup>

                <AuditGroup title="番号・日付">
                  <AuditItem label="出願日" value={record.applicationDate ?? '未収録'} />
                  <AuditItem label="国際出願日" value={record.internationalApplicationDate ?? '未収録'} />
                  <AuditItem label="登録日" value={record.registrationDate ?? '未収録'} />
                  <AuditItem label="公報発行日" value={record.gazetteDate ?? '未収録'} />
                  <AuditItem label="出願番号" value={record.applicationNumber ?? '未収録'} />
                  <AuditItem label="登録番号" value={record.registrationNumber ?? '未収録'} />
                </AuditGroup>

                <AuditGroup title="分類・確認状況">
                  <AuditItem label="日本意匠分類原文" value={record.designClass ?? '未収録'} />
                  <AuditItem label="正規化後分類" value={record.designClassNormalized ?? '未収録'} />
                  <AuditItem label="物品名" value={record.articleName ?? '未収録'} />
                  <AuditItem label="V系Dターム" value={formatVTerms(record)} />
                  <AuditItem label="vTermReviewStatus" value={formatVTermReviewStatus(record.vTermReviewStatus)} />
                  <AuditItem label="sourceUpdateDate" value={record.sourceUpdateDate ?? '未収録'} />
                  <AuditItem label="classificationNote" value={record.classificationNote ?? '未収録'} />
                </AuditGroup>
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <dl className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                  <DefinitionItem label="record.id" value={record.id} />
                  <DefinitionItem label="抽出方式" value={formatFilterMode(record.wFilterMode)} />
                  <DefinitionItem label="日付フィルタ値" value={record.dateUsedForFilter ?? '未収録'} />
                  <DefinitionItem label="日付フィルタ種別" value={record.dateUsedType ?? '未収録'} />
                </dl>
                {record.vTermReviewNote ? <p className="mt-2 text-xs leading-5 text-muted">確認注記：{record.vTermReviewNote}</p> : null}
              </div>
            </details>
          ))
        ) : (
          <div className="rounded-md border border-line bg-panel p-3 text-sm text-muted">表示できる根拠recordがありません。</div>
        )}
      </div>
    </details>
  );
}

function AuditGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white p-3">
      <h4 className="text-xs font-bold text-muted">{title}</h4>
      <dl className="mt-2 space-y-2">{children}</dl>
    </section>
  );
}

function AuditItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="readable-text mt-0.5 text-sm leading-5 text-ink">{value}</dd>
    </div>
  );
}

function DefinitionItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="readable-text mt-0.5 leading-5 text-ink">{value}</dd>
    </div>
  );
}

function NumberedPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-teal-200 bg-teal-50 p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function SmallTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <div className="mt-3 max-h-72 overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-panel text-xs text-muted">
            <tr>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-t border-line align-top">
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${title}-${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-line">
                <TableCell colSpan={headers.length}>表示できる集計がありません。</TableCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <div className="readable-text text-xs font-semibold text-muted">{label}</div>
      <div className="readable-text mt-1 text-lg font-bold text-ink">{value}</div>
      {note ? <div className="readable-text mt-1 text-xs leading-5 text-muted">{note}</div> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-current/10 bg-white p-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-semibold">{children}</th>;
}

function TableCell({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td className="readable-text max-w-[20rem] px-3 py-2 leading-5 text-ink" colSpan={colSpan}>
      {children}
    </td>
  );
}

function numberField(value: object, key: string): number {
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function formatFilterMode(value: string | undefined): string {
  if (value === CANDIDATE_LABEL) return CLASSIFICATION_W_CANDIDATE_LABEL;
  if (value === STRICT_LABEL) return STRICT_DISPLAY_LABEL;
  return value ?? '未収録';
}

function formatVTerms(record: HosoeAnalysisRecord): string {
  if (record.vTermReviewStatus === V_TERM_SOURCE_UNAVAILABLE) return '未確認';
  return joinList(record.vTerms, record.vTermReviewStatus === V_TERM_CONFIRMED ? '未収録' : '未確認');
}

function formatVTermReviewStatus(value: string | undefined): string {
  if (value === V_TERM_CONFIRMED) return '確認済み';
  if (value === V_TERM_SOURCE_UNAVAILABLE) return '公報データ未接続のため未確認';
  return value ?? '未確認';
}

function formatCandidateCount(value: number): string {
  return value === 0 ? `0件（${NOT_DETECTED_TEXT}）` : `${formatCount(value)}件`;
}

function joinList(values: string[], emptyText = '未収録'): string {
  return values.length > 0 ? values.join('、') : emptyText;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value);
}
