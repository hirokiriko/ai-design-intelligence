import type { CollectionContextV23, Run, RunV2, RunV21, RunV22, RunV23, RunV25, Signal, SignalV2 } from './contract';
import { SignalEvidenceDetails } from './SignalEvidenceDetails';
import { classificationSchemeLabel, comparisonStatusLabel, dataModeLabel, evidenceId, factsOnlyRun, partialSourceEvaluationRun, recordDisplayLabel, relationLabels } from './labels';

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
    {run.schemaVersion === '2.1.0' || run.schemaVersion === '2.2.0' || run.schemaVersion === '2.3.0' || run.schemaVersion === '2.5.0' ? <><SavedCollection label="比較A" collection={run.input.context.beforeDataset.collection} /><SavedCollection label="比較B" collection={run.input.context.afterDataset.collection} /></> : null}
    {run.schemaVersion === '2.2.0' || run.schemaVersion === '2.3.0' || run.schemaVersion === '2.5.0' ? <div className="signal-saved-pair"><h4>この実行に保存された比較組</h4>{run.input.comparisonPair ? <><p><strong>{run.input.comparisonPair.label}</strong></p><p>{run.input.comparisonPair.evidence}</p><dl className="signal-metadata">{run.input.comparisonPair.media.map((media) => <div key={media.id}><dt>{media.role === 'comparisonA' ? '比較A' : '比較B'}の対象</dt><dd>{media.label}<small>{media.view ?? '方向不明'} · {comparisonStatusLabel(media.comparisonStatus)}</small></dd></div>)}</dl></> : <p className="signal-subtle">登録済み比較組の選択は保存されていません。現在の候補から過去の入力を補完していません。</p>}</div> : null}
    <h4>確認条件に登録された商品情報</h4>
    {context.knownProducts.length ? <ul>{context.knownProducts.map((product, index) => <li key={index}><strong>{product.name ?? '商品名未確認'}{product.model ? ` / ${product.model}` : ''}</strong><p>{product.evidence}</p><p className="signal-subtle">対応を確認する意匠：{product.recordIds.map((recordId, position) => `候補${position + 1} ${recordDisplayLabel(run.signal?.recordFacts.find((fact) => fact.recordId === recordId), '物品名未確認')}`).join('、') || '未登録'}</p></li>)}</ul> : <p className="signal-subtle">商品名・型番は登録されていません。物品名と販売商品名は別の情報です。</p>}
  </section>;
}

export function ResultOverview({ run, developmentMode = false }: { run: Run; developmentMode?: boolean }) {
  const signal = run.signal;
  if (!signal) return null;
  const incomplete = run.status !== 'complete';
  const partialEvaluation = partialSourceEvaluationRun(run);
  const factsOnly = factsOnlyRun(run);
  const highlights = run.schemaVersion !== '1.0.0' ? run.signal?.recordFacts.filter((fact) => fact.selectionReason === 'newly_observed' || fact.selectionReason === 'comparison_pair') ?? [] : [];
  const observations = factsOnly ? [] : signal.visualObservations;
  const officialFacts = factsOnly ? [] : signal.officialFacts;
  const relationships = run.schemaVersion !== '1.0.0' ? run.signal?.relationships ?? [] : null;
  const question = run.schemaVersion === '2.5.0' ? run.input.analysisQuestion : null;
  const answer = run.schemaVersion === '2.5.0' ? run.signal?.questionAnswer : null;
  const limitationCount = signal.limitations.length + signal.hypotheses.reduce((count, item) => count + item.limitations.length, 0) + (answer?.limitations.length ?? 0);
  return <section className="signal-overview" aria-label={incomplete ? '保存された途中資料の概要' : '確認結果の概要'}><h3>{partialEvaluation ? '取得済み資料で確認した途中結果' : incomplete ? '停止前に取得・検証した参考資料' : '今回わかったこと'}</h3>
    {incomplete ? <p>{partialEvaluation ? '一部の公式資料は取得できませんでした。取得済みの資料だけを評価し、検証を通った根拠と検討材料を表示します。全体の分析は未完了で、人による内容評価は別に必要です。' : 'この実行で最後に検証が済んだ範囲の保存資料です。分析は未完了で、検証済みは内容の正しさを人が確認した意味ではありません。'}</p> : null}
    {question && answer ? <div className="signal-overview-answer"><p className="signal-eyebrow">この実行に保存された問い</p><p><strong>{question.text}</strong></p><p>{answer.status === 'not_evaluated' ? '回答は未評価です。以下の観察や引用を回答として補っていません。' : answer.status === 'insufficient' ? 'この問いの判断に必要な資料は不足しています。' : '保存された回答と、その支持・反証を確認できます。'}</p><a href="#signal-question-answer-title">この問いへの保存回答・根拠を見る</a></div> : null}
    <div><h4>収録範囲の新規観測・変化</h4><p>{signal.counts.comparable ? `比較Bの対象${signal.counts.after}件、収録範囲での新規観測${signal.counts.newlyObserved}件。` : '収録条件が異なるため、前後の増減を比較できません。'}</p><p className="signal-subtle">収録件数の差は、形状の変化や商品の世代差を示しません。</p></div>
    <div className="signal-outcome-evidence">
      <div><h4>{developmentMode ? '架空図面の固定の観察例' : '図面からの観察候補'}（{observations.length}件）</h4>{observations.length ? <><ul className="signal-overview-list">{observations.map((observation, index) => <li className="signal-overview-item" key={observation.id}><p><strong>画像観察{index + 1} · {observation.part}</strong> · {{ change_candidate: '変化の候補', no_change: '変化は見られない', unknown: '判断不能' }[observation.status]}</p><p>{observation.observation}</p><EvidenceLinks ids={[observation.id]} signal={signal} /></li>)}</ul><SignalEvidenceDetails ids={observations.map((item) => item.id)} signal={signal} factsOnly={factsOnly} developmentMode={developmentMode} label="この観察と図面をここで確かめる" /></> : <p>{factsOnly ? '書誌情報のみの比較です。図面は分析していません。' : '観察候補は保存されていません。形状が変わらなかったとは判断できません。'}</p>}</div>
      <div><h4>{developmentMode ? '架空資料の固定の引用例' : '公式資料に記載されたこと'}（{officialFacts.length}件）</h4>{officialFacts.length ? <><p className="signal-subtle">公式の記載と図面の対応は、下の支持・反証と不足する根拠で別に確認します。</p><ul className="signal-overview-list">{officialFacts.map((official, index) => <li className="signal-overview-item" key={official.id}><p><strong>公式記載{index + 1}</strong></p><p>{official.text}</p><EvidenceLinks ids={[official.id]} signal={signal} /></li>)}</ul><SignalEvidenceDetails ids={officialFacts.map((item) => item.id)} signal={signal} factsOnly={factsOnly} developmentMode={developmentMode} label="この記載の引用・出典をここで確かめる" /></> : <p>{factsOnly ? '記事本文は分析していません。参照先は保存資料で確認できます。' : '裏付けに使える公式の記載は保存されていません。'}</p>}</div>
    </div>
    <div className="signal-overview-relationships"><h4>支持・反証と、まだ判断できないこと</h4>{relationships?.length ? <ul className="signal-overview-list">{relationships.map((item) => <li className="signal-overview-relation" key={item.id}><p><strong>{incomplete ? `${partialEvaluation ? '途中結果' : '中間候補'} · ${item.relation === 'unknown' ? '対応不明' : relationLabels[item.relation]}` : relationLabels[item.relation]}</strong></p><p>{item.summary}</p><p className="signal-subtle">保存された支持 {item.supportingEvidenceIds.length}件 · 反証 {item.opposingEvidenceIds.length}件 · 不足 {item.missingEvidence.length}件。未記録の根拠がないことは示しません。</p><details className="signal-details"><summary>この対応の支持・反証と不足する根拠を見る</summary><dl className="signal-metadata"><div><dt>支持する根拠</dt><dd><EvidenceLinks ids={item.supportingEvidenceIds} signal={signal} /></dd></div><div><dt>不一致・反証の根拠</dt><dd><EvidenceLinks ids={item.opposingEvidenceIds} signal={signal} /></dd></div></dl>{item.missingEvidence.length ? <><h5>不足している根拠</h5><ul>{item.missingEvidence.map((text, index) => <li key={index}>{text}</li>)}</ul></> : <p>不足する根拠の説明は未記録です。</p>}<a href={`#signal-relation-${encodeURIComponent(item.id)}`}>この対応評価を詳しく見る</a></details></li>)}</ul> : <p>{relationships === null ? 'この旧形式には、支持・反証を区別した対応評価は保存されていません。' : '個別意匠と商品の対応評価は保存されていません。'}<a href="#signal-hypotheses">保存された検討材料を見る</a></p>}</div>
    <div className="signal-next-action signal-overview-followup"><h4>次に確認すること</h4>{answer?.nextChecks.length ? <div><h5>この問いの確認事項</h5><ol>{answer.nextChecks.map((text, index) => <li key={index}>{text}</li>)}</ol></div> : question ? <p>この問いの次の確認事項は未記録です。資料全体の確認事項とは区別しています。</p> : null}{signal.questionsForHuman.length ? question ? <details className="signal-details"><summary>資料全体の確認事項（{signal.questionsForHuman.length}件）を見る</summary><ol>{signal.questionsForHuman.map((text, index) => <li key={index}>{text}</li>)}</ol></details> : <ol>{signal.questionsForHuman.map((text, index) => <li key={index}>{text}</li>)}</ol> : <p>資料全体の確認事項は未記録です。追加確認が不要と判断した意味ではありません。</p>}<a href="#signal-next-checks">確認事項と不足情報をすべて見る</a></div>
    <details className="signal-details signal-overview-limits"><summary>限界・未確認事項（{limitationCount}件）を見る</summary>{answer?.limitations.length ? <div><h4>この問いへの回答の限界</h4><ul>{answer.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></div> : null}{signal.limitations.length ? <div><h4>資料全体の限界</h4><ul>{signal.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></div> : null}{signal.hypotheses.map((item, index) => item.limitations.length ? <div key={item.id}><h4>検討材料ごとの未確認事項</h4><a href={`#${evidenceId(item.id)}`}>検討材料{index + 1}と根拠を見る</a><ul>{item.limitations.map((text, position) => <li key={position}>{text}</li>)}</ul></div> : null)}{limitationCount === 0 ? <p>限界の説明は未記録です。不確実性がないことを示しません。</p> : null}</details>
    {highlights.length ? <div><h4>詳しく見る意匠</h4><details className="signal-details"><summary>選ばれた意匠（{highlights.length}件）を見る</summary><ul>{highlights.map((fact) => <li key={fact.id}><a href={`#${evidenceId(fact.id)}`}>{recordDisplayLabel(fact, '物品名未確認')}</a> · {fact.selectionReason === 'newly_observed' ? '収録範囲で新しく確認' : '画像の比較対象'}</li>)}</ul></details></div> : null}
    <nav className="signal-evidence-links" aria-label="確認結果の根拠へ"><a href="#signal-design-facts">意匠データの事実へ</a><a href="#signal-images">画像と観察へ</a><a href="#signal-official">公式発表へ</a><a href="#signal-hypotheses">検討材料・支持反証へ</a><a href="#signal-next-checks">次の確認事項へ</a></nav>
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

export function Relationships({ signal, factsOnly = false, incomplete = false, partialEvaluation = false, developmentMode = false }: { signal: SignalV2; factsOnly?: boolean; incomplete?: boolean; partialEvaluation?: boolean; developmentMode?: boolean }) {
  return <details className="signal-details" data-print-evidence><summary>{partialEvaluation ? '取得済み資料での対応評価（途中結果）' : incomplete ? '個別意匠と商品の対応の中間候補' : '個別意匠と商品の対応'}（{signal.relationships.length}件）</summary><p className="signal-subtle">{factsOnly ? '参照リンクと個別意匠が同じ製品を指すことは確認していません。' : partialEvaluation ? '取得済みの根拠だけを使った対応評価です。取得できなかった資料を含めた最終判定ではありません。' : incomplete ? '停止前の検討状況です。対応についての最終判定ではありません。' : '公式サイトの記載と、個別意匠が同じ製品であることの確認を分けています。'}</p>
    {signal.relationships.length ? signal.relationships.map((item) => <article className={`signal-fact signal-relation relation-${item.relation}`} key={item.id} id={`signal-relation-${encodeURIComponent(item.id)}`} tabIndex={-1}><h4>{incomplete ? `${partialEvaluation ? '途中結果' : '中間候補'} · ${item.relation === 'unknown' ? '対応不明' : relationLabels[item.relation]}` : relationLabels[item.relation]}</h4><p>{item.summary}</p><div><strong>支持する根拠</strong><EvidenceLinks ids={item.supportingEvidenceIds} signal={signal} />{item.supportingEvidenceIds.length ? <SignalEvidenceDetails ids={item.supportingEvidenceIds} signal={signal} factsOnly={factsOnly} developmentMode={developmentMode} label="支持する根拠をここで確認" /> : null}</div><div><strong>不一致・反証の根拠</strong><EvidenceLinks ids={item.opposingEvidenceIds} signal={signal} />{item.opposingEvidenceIds.length ? <SignalEvidenceDetails ids={item.opposingEvidenceIds} signal={signal} factsOnly={factsOnly} developmentMode={developmentMode} label="反証の根拠をここで確認" /> : null}</div>{item.missingEvidence.length ? <><h5>不足している根拠</h5><ul>{item.missingEvidence.map((text, index) => <li key={index}>{text}</li>)}</ul></> : null}</article>) : <p>個別意匠と商品の対応は評価されていません。</p>}
  </details>;
}

export function RecordFact({ fact }: { fact: SignalV2['recordFacts'][number] }) {
  return <dl className="signal-metadata"><div><dt>物品名</dt><dd>{fact.articleName ?? '不明'}</dd></div><div><dt>出願人</dt><dd>{fact.applicant.name ?? '不明'}</dd></div><div><dt>登録番号 / 出願番号</dt><dd>{fact.registrationNumber ?? '不明'} / {fact.applicationNumber ?? '不明'}</dd></div><div><dt>分類</dt><dd>{fact.classifications.map((item) => `${classificationSchemeLabel(item.scheme)} ${item.code}${item.label ? ` ${item.label}` : ''}`).join(' / ') || '未収録'}</dd></div><div><dt>出願日 / 公報日</dt><dd>{fact.applicationDate ?? '不明'} / {fact.gazetteDate ?? '不明'}</dd></div><div><dt>意匠の説明</dt><dd>{fact.description ?? '説明は未収録'}</dd></div><div><dt>物品の説明</dt><dd>{fact.articleDescription ?? '説明は未収録'}</dd></div><div><dt>データの検証状態</dt><dd>{{ pass: '検証済み', warning: '注意事項あり', quarantined: '保留' }[fact.quality]}</dd></div><div><dt>採用理由</dt><dd>{{ comparison_pair: '画像の比較対象', newly_observed: '収録範囲での新規観測', scope_sample: '対象範囲からの代表資料' }[fact.selectionReason]}</dd></div></dl>;
}

export function DiscoveryDetails({ run, developmentMode = false }: { run: RunV2 | RunV21 | RunV22 | RunV23 | RunV25; developmentMode?: boolean }) {
  const signal = run.signal;
  const discovery = signal?.discovery;
  if (!discovery) return null;
  const factsOnly = factsOnlyRun(run);
  return <details className="signal-details"><summary>公式資料の探索範囲と不足</summary><p>{factsOnly ? '公式記事の自動探索・本文取得は行っていません。手動で確認した参照先は下に表示します。' : discovery.state === 'not_started' ? '公式資料の探索は開始していません。資料がないことを意味しません。' : '登録された範囲の探索処理は終了しています。個別意匠との対応確認を意味しません。'}</p><p>{factsOnly ? `手動確認した参照先 ${signal.sources.length}件 · 自動探索の確認リンク ${discovery.scannedLinks}件` : `確認リンク ${discovery.scannedLinks}件 · 対象候補 ${discovery.eligibleCandidates}件 · 上限等による省略 ${discovery.omittedCandidates}件`}</p><ul>{discovery.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>{discovery.candidates.map((item) => <div className="signal-fact" key={item.id}>{factsOnly || developmentMode ? <><strong>{item.title || 'タイトル不明'}</strong><p className="signal-subtle">公式URL：{item.url}</p></> : <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'タイトル不明'} ↗</a>}<p>発表日：{item.publishedAt ?? '不明'} · {{ in_period: '対象期間内', outside_period: '対象期間外', unknown: '日付不明' }[item.dateStatus]}</p><p>{item.selectionReason}</p></div>)}</details>;
}
