import type { CollectionContextV23, Run, RunV2, RunV21, RunV22, RunV23, Signal, SignalV2 } from './contract';
import { classificationSchemeLabel, comparisonStatusLabel, dataModeLabel, evidenceId, factsOnlyRun, recordDisplayLabel, relationLabels } from './labels';

function evidenceLabel(signal: Signal, id: string): string {
  const design = signal.designFacts.findIndex((item) => item.id === id);
  if (design >= 0) return `意匠の事実${design + 1}`;
  const observation = signal.visualObservations.findIndex((item) => item.id === id);
  if (observation >= 0) return `画像観察${observation + 1}`;
  const official = signal.officialFacts.findIndex((item) => item.id === id);
  if (official >= 0) return `公式記載${official + 1}`;
  const source = signal.sources.findIndex((item) => item.id === id);
  if (source >= 0) return `参照先${source + 1}`;
  const media = signal.media.find((item) => item.id === id);
  return media ? `${media.role === 'comparisonA' ? '比較A' : '比較B'}の画像` : '根拠資料';
}

export function EvidenceLinks({ ids, signal }: { ids: string[]; signal: Signal }) {
  return <span className="signal-evidence-links">根拠：{ids.length ? ids.map((id) => <a key={id} href={`#${evidenceId(id)}`}>{evidenceLabel(signal, id)}</a>) : '登録なし'}</span>;
}

function SavedCollection({ label, collection }: { label: string; collection: CollectionContextV23 | null }) {
  if (!collection) return <p className="signal-subtle">{label}：収録集合の作成経緯は未記録です。</p>;
  const daily = collection.kind === 'retrospective_selected_daily_gazettes';
  return <div className="signal-fact">
    <h4>{label} · {daily ? '選定した日刊公報からの遡及再構成収録集合' : '週次原本からの遡及再構成収録集合'}</h4>
    <p>{daily ? `原本の公開日を基準に、列挙した公報号の資料を同じ規則で収録しています。最初の号は${collection.commonStartDate}、最後の号は${collection.cutoffDate}です。` : `原本の公開日を基準に、${collection.commonStartDate}から${collection.cutoffDate}までの資料を同じ規則で収録しています。`}</p>
    {daily ? <p className="signal-subtle">選定した公報日：{collection.selectedIssueDates.join('、')}。全公報・全件の収録は示しません。</p> : null}
    <p className="signal-retrospective">当時稼働していたサービスの保存状態や、当時の予測実績を示すものではありません。</p>
    <dl className="signal-metadata">
      <div><dt>共通の収録開始日</dt><dd>{collection.commonStartDate}</dd></div>
      <div><dt>収録の締切日 / 判定基準</dt><dd>{collection.cutoffDate} / 原本の公開日</dd></div>
      <div><dt>原本の取得日時</dt><dd>{collection.sourceAcquiredFrom === null ? '不明（手元での確認日時とは区別）' : `${collection.sourceAcquiredFrom} 〜 ${collection.sourceAcquiredThrough}`}</dd></div>
      <div><dt>手元で原本を確認した日時</dt><dd>{collection.locallyVerifiedAt}</dd></div>
      <div><dt>再構成した日時</dt><dd>{collection.reconstructedAt}</dd></div>
      <div><dt>後日取得した資料の補足</dt><dd>{collection.retrospectiveSupplements ? '後日取得した資料を事後の補足として含みます。当時サービスが取得済みだったことを示しません。' : 'この収録集合には登録されていません。'}</dd></div>
    </dl>
    <ul>{collection.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <details className="signal-details"><summary>{label}の原本系列・処理規則の照合情報</summary><dl className="signal-metadata"><div><dt>原本系列</dt><dd>{collection.sourceFamilies.join('、')}</dd></div><div><dt>処理規則の識別値</dt><dd>{collection.policySha256}</dd></div><div><dt>原本集合の識別値</dt><dd>{collection.archiveSetSha256}</dd></div></dl></details>
  </div>;
}

export function SavedContext({ run }: { run: Run }) {
  if (run.schemaVersion === '1.0.0') return <div className="signal-data-banner">架空データの保存結果（旧形式）<span>保存時の企業・商品表示名とデータ区分の詳細は未記録です。現在のカタログから補完していません。</span></div>;
  const context = run.input.context;
  return <section className="signal-saved-context" aria-label="保存時の対象とデータ">
    <p className="signal-data-banner">{factsOnlyRun(run) ? '公開書誌事項の比較（原文・図面なし）' : dataModeLabel(context.dataMode)}<span>この実行に保存された区分です。</span></p>
    <h3>{context.entity.name ?? '企業名不明'} / {context.category.label}</h3>
    <dl className="signal-metadata"><div><dt>分類体系</dt><dd>{classificationSchemeLabel(context.category.scheme)}</dd></div><div><dt>比較A · 基準日</dt><dd>{context.beforeDataset.dataAsOf}<small>{context.beforeDataset.coverage}</small></dd></div><div><dt>比較B · 基準日</dt><dd>{context.afterDataset.dataAsOf}<small>{context.afterDataset.coverage}</small></dd></div></dl>
    {run.schemaVersion === '2.1.0' || run.schemaVersion === '2.2.0' || run.schemaVersion === '2.3.0' ? <><SavedCollection label="比較A" collection={run.input.context.beforeDataset.collection} /><SavedCollection label="比較B" collection={run.input.context.afterDataset.collection} /></> : null}
    {run.schemaVersion === '2.2.0' || run.schemaVersion === '2.3.0' ? <div className="signal-saved-pair"><h4>この実行に保存された比較組</h4>{run.input.comparisonPair ? <><p><strong>{run.input.comparisonPair.label}</strong></p><p>{run.input.comparisonPair.evidence}</p><dl className="signal-metadata">{run.input.comparisonPair.media.map((media) => <div key={media.id}><dt>{media.role === 'comparisonA' ? '比較A' : '比較B'}の対象</dt><dd>{media.label}<small>{media.view ?? '方向不明'} · {comparisonStatusLabel(media.comparisonStatus)}</small></dd></div>)}</dl></> : <p className="signal-subtle">登録済み比較組の選択は保存されていません。現在の候補から過去の入力を補完していません。</p>}</div> : null}
    <h4>確認条件に登録された商品情報</h4>
    {context.knownProducts.length ? <ul>{context.knownProducts.map((product, index) => <li key={index}><strong>{product.name ?? '商品名未確認'}{product.model ? ` / ${product.model}` : ''}</strong><p>{product.evidence}</p><p className="signal-subtle">対応を確認する意匠：{product.recordIds.map((recordId, position) => `候補${position + 1} ${recordDisplayLabel(run.signal?.recordFacts.find((fact) => fact.recordId === recordId), '物品名未確認')}`).join('、') || '未登録'}</p></li>)}</ul> : <p className="signal-subtle">商品名・型番は登録されていません。物品名と販売商品名は別の情報です。</p>}
  </section>;
}

export function ResultOverview({ run }: { run: Run }) {
  const signal = run.signal;
  if (!signal) return null;
  const highlights = run.schemaVersion !== '1.0.0' ? run.signal?.recordFacts.filter((fact) => fact.selectionReason === 'newly_observed' || fact.selectionReason === 'comparison_pair').slice(0, 3) ?? [] : [];
  return <section className="signal-overview" aria-label="確認結果の概要"><h3>今回わかったこと</h3>
    <div><h4>収録範囲の新規観測・変化</h4><p>{signal.counts.comparable ? `比較Bの対象${signal.counts.after}件、収録範囲での新規観測${signal.counts.newlyObserved}件。` : '収録条件が異なるため、前後の増減を比較できません。'}</p><p className="signal-subtle">収録件数の差は、形状の変化や商品の世代差を示しません。</p></div>
    {highlights.length ? <div><h4>詳しく見る意匠</h4><ul>{highlights.map((fact) => <li key={fact.id}><a href={`#${evidenceId(fact.id)}`}>{recordDisplayLabel(fact, '物品名未確認')}</a> · {fact.selectionReason === 'newly_observed' ? '収録範囲で新しく確認' : '画像の比較対象'}</li>)}</ul></div> : null}
    <nav className="signal-evidence-links" aria-label="確認結果の根拠へ"><a href="#signal-design-facts">意匠データの事実へ</a><a href="#signal-images">画像と観察へ</a><a href="#signal-official">公式発表へ</a><a href="#signal-next-checks">次の確認事項へ</a></nav>
  </section>;
}

export function SavedTarget({ run }: { run: Run }) {
  if (run.schemaVersion === '1.0.0') return <p className="signal-data-banner">架空データの保存結果（旧形式）<span>保存時の企業・商品表示名は未記録です。</span></p>;
  const context = run.input.context;
  const collection = 'collection' in context.afterDataset ? context.afterDataset.collection : null;
  return <div className="signal-target">
    <p className="signal-data-banner">{factsOnlyRun(run) ? '公開書誌事項の比較（原文・図面なし）' : dataModeLabel(context.dataMode)}</p>
    <p className="signal-subtle">比較A {context.beforeDataset.dataAsOf} → 比較B {context.afterDataset.dataAsOf}</p>
    {collection ? <p className="signal-subtle">{collection.kind === 'retrospective_selected_daily_gazettes' ? '選定した公報号の範囲を後日再構成した比較です。全国の全公報・全意匠は含みません。' : '収録した週次原本を後日再構成した比較です。当時の予測実績は示しません。'}</p> : null}
  </div>;
}

export function Relationships({ signal, factsOnly = false }: { signal: SignalV2; factsOnly?: boolean }) {
  return <section><h3>個別意匠と商品の対応</h3><p className="signal-subtle">{factsOnly ? '参照リンクと個別意匠が同じ製品を指すことは確認していません。' : '公式サイトの記載と、個別意匠が同じ製品であることの確認を分けています。'}</p>
    {signal.relationships.length ? signal.relationships.map((item) => <article className={`signal-fact signal-relation relation-${item.relation}`} key={item.id} id={`signal-relation-${encodeURIComponent(item.id)}`} tabIndex={-1}><h4>{relationLabels[item.relation]}</h4><p>{item.summary}</p><div><strong>支持する根拠</strong><EvidenceLinks ids={item.supportingEvidenceIds} signal={signal} /></div><div><strong>不一致・反証の根拠</strong><EvidenceLinks ids={item.opposingEvidenceIds} signal={signal} /></div>{item.missingEvidence.length ? <><h5>不足している根拠</h5><ul>{item.missingEvidence.map((text, index) => <li key={index}>{text}</li>)}</ul></> : null}</article>) : <p>個別意匠と商品の対応は評価されていません。</p>}
  </section>;
}

export function RecordFact({ fact }: { fact: SignalV2['recordFacts'][number] }) {
  return <dl className="signal-metadata"><div><dt>物品名</dt><dd>{fact.articleName ?? '不明'}</dd></div><div><dt>出願人</dt><dd>{fact.applicant.name ?? '不明'}</dd></div><div><dt>登録番号 / 出願番号</dt><dd>{fact.registrationNumber ?? '不明'} / {fact.applicationNumber ?? '不明'}</dd></div><div><dt>分類</dt><dd>{fact.classifications.map((item) => `${classificationSchemeLabel(item.scheme)} ${item.code}${item.label ? ` ${item.label}` : ''}`).join(' / ') || '未収録'}</dd></div><div><dt>出願日 / 公報日</dt><dd>{fact.applicationDate ?? '不明'} / {fact.gazetteDate ?? '不明'}</dd></div><div><dt>意匠の説明</dt><dd>{fact.description ?? '説明は未収録'}</dd></div><div><dt>物品の説明</dt><dd>{fact.articleDescription ?? '説明は未収録'}</dd></div><div><dt>データの検証状態</dt><dd>{{ pass: '検証済み', warning: '注意事項あり', quarantined: '保留' }[fact.quality]}</dd></div><div><dt>採用理由</dt><dd>{{ comparison_pair: '画像の比較対象', newly_observed: '収録範囲での新規観測', scope_sample: '対象範囲からの代表資料' }[fact.selectionReason]}</dd></div></dl>;
}

export function DiscoveryDetails({ run }: { run: RunV2 | RunV21 | RunV22 | RunV23 }) {
  const signal = run.signal;
  const discovery = signal?.discovery;
  if (!discovery) return null;
  const factsOnly = factsOnlyRun(run);
  return <details className="signal-details"><summary>公式資料の探索範囲と不足</summary><p>{factsOnly ? '公式記事の自動探索・本文取得は行っていません。手動で確認した参照先は下に表示します。' : discovery.state === 'not_started' ? '公式資料の探索は開始していません。資料がないことを意味しません。' : '登録された範囲の探索処理は終了しています。個別意匠との対応確認を意味しません。'}</p><p>{factsOnly ? `手動確認した参照先 ${signal.sources.length}件 · 自動探索の確認リンク ${discovery.scannedLinks}件` : `確認リンク ${discovery.scannedLinks}件 · 対象候補 ${discovery.eligibleCandidates}件 · 上限等による省略 ${discovery.omittedCandidates}件`}</p><ul>{discovery.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>{discovery.candidates.map((item) => <div className="signal-fact" key={item.id}>{factsOnly ? <><strong>{item.title || 'タイトル不明'}</strong><p className="signal-subtle">公式URL：{item.url}</p></> : <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'タイトル不明'} ↗</a>}<p>発表日：{item.publishedAt ?? '不明'} · {{ in_period: '対象期間内', outside_period: '対象期間外', unknown: '日付不明' }[item.dateStatus]}</p><p>{item.selectionReason}</p></div>)}</details>;
}
