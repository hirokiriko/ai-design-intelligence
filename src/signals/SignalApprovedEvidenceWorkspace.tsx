import { useEffect, useRef, useState } from 'react';
import { loadApprovedPreview, type ApprovedPreview } from './approved-preview';
import { evidenceId } from './labels';
import { revealEvidenceLink, revealEvidenceTarget } from './evidence-navigation';
import { SignalEvidenceDetails } from './SignalEvidenceDetails';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';
import { SignalPurposeIntro, type SignalQuestion } from './SignalPurposeJourney';
import './signals.css';

type PreviewState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; preview: ApprovedPreview };
const questions: { id: SignalQuestion; label: string; description: string; target: string }[] = [
  { id: 'drawings', label: '図面のどこを見る？', description: '外周・内側の円・下部の線を見比べる', target: 'signal-approved-drawings' },
  { id: 'support', label: '公式引用が支えるのは？', description: '製品名・発売の記載と、引用の前後を確認する', target: 'signal-approved-sources' },
  { id: 'next', label: '次の検討に必要な資料は？', description: '図面との対応や機能を確かめる追加資料へ', target: 'signal-approved-next' },
];

function PreviewImage({ preview, id }: { preview: ApprovedPreview; id: string }) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const media = preview.run.signal!.media.find((item) => item.id === id)!;
  const record = preview.run.signal!.recordFacts.find((item) => item.recordId === media.recordId);
  const path = `/__signals-local-preview/approved/media/${encodeURIComponent(id)}`;
  const observationIds = preview.observations.filter((item) => item.mediaIds.includes(id)).map((item) => `signal-approved-${item.id}`).join(' ') || undefined;
  return <figure className="signal-media-card" id={evidenceId(id)} tabIndex={-1}>
    <figcaption><strong>{media.label}</strong></figcaption>
    {failed ? <p role="status">図面を表示できません。「保存資料を読み直す」で再取得できます。表示できるまで、形状は判断しません。</p> : <button className="signal-image-button" type="button" aria-label={`${media.label}を拡大`} onClick={() => dialog.current?.showModal()}><img src={path} width={media.width} height={media.height} alt={media.label} aria-describedby={observationIds} onError={() => setFailed(true)} /><span>図面を拡大して確かめる</span></button>}
    <dl className="signal-metadata"><div><dt>登録番号</dt><dd>{record?.registrationNumber ?? '不明'}</dd></div><div><dt>公報日 / 出願日</dt><dd>{media.gazetteDate ?? '不明'} / {media.applicationDate ?? '不明'}</dd></div><div><dt>出典</dt><dd>{media.sourceLabel}</dd></div></dl>
    <p className="signal-subtle">比較A/Bは資料の役割です。製品の世代・発売順・型番との対応は未確認です。</p>
    <dialog ref={dialog} className="signal-image-dialog" aria-label={`${media.label}の拡大画像`}><form method="dialog"><button className="signal-button" autoFocus>閉じる</button></form><p><strong>{media.label}</strong></p>{!failed ? <img src={path} alt={media.label} aria-describedby={observationIds} /> : null}<p className="signal-subtle">図面の線を確かめるための引用です。機能・寸法・法的範囲の結論を示すものではありません。</p></dialog>
  </figure>;
}

export function ApprovedEvidenceContent({ preview, question, onQuestion, replay, onReplay }: { preview: ApprovedPreview; question: SignalQuestion | null; onQuestion: (value: SignalQuestion) => void; replay: boolean; onReplay: (value: boolean) => void }) {
  const { run } = preview;
  const signal = run.signal!;
  const selected = questions.find((item) => item.id === question);
  const questionTarget = selected?.target;
  const warning = useRef<HTMLHeadingElement>(null);
  const materialHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const target = replay ? warning.current : (questionTarget ? materialHeading.current?.ownerDocument.getElementById(questionTarget) : null) ?? materialHeading.current;
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [replay, run.id, questionTarget]);
  if (replay) return <main className="signal-approved-content" onClickCapture={revealEvidenceLink}>
    <section className="signal-panel" id="signal-conditions" tabIndex={-1}><p className="signal-eyebrow">許可された保存例1件のみを再表示</p><h1 ref={warning} tabIndex={-1}>品質未達のp23保存例 · V2 FAIL / V4 FAIL</h1><p>{run.createdAt} · モデル {run.versions.model} · prompt {run.versions.prompt}</p><div className="signal-error" role="note"><strong>V2 FAIL / V4 FAIL · 本人受入は未実施</strong><p>以下のAI観察・仮説には線種の混同、内側の円の観察不足、根拠のない法的意味、具体的な設計検討の不足があります。保存当時の内容を変更せず表示しています。今回の成功見本ではありません。</p></div><button className="signal-button secondary" type="button" onClick={() => onReplay(false)}>保存例を閉じて資料から確認した事実へ戻る</button><p className="signal-subtle">新しいAI分析は始めません。このURLの再読込も保存例の再表示です。実行時の問いは未記録です。</p></section>
    <SignalResult run={run} focusOnLoad={false} showReview={false} />
  </main>;
  return <main className="signal-approved-content" onClickCapture={revealEvidenceLink}>
    <SignalPurposeIntro />
    <section className="signal-value-preview" id="signal-conditions" tabIndex={-1} aria-labelledby="signal-approved-title">
      <div className="signal-preview-heading"><div><p className="signal-eyebrow">実資料から、根拠の読み方を試す</p><h2 ref={materialHeading} tabIndex={-1} id="signal-approved-title">{run.input.context.entity.name ?? '企業名不明'}の図面と公式資料</h2></div><span className="signal-badge">承認された保存資料 · 読み取りのみ</span></div>
      <p>まず確かめたい問いを選び、図面と引用の根拠を開いて、次に必要な資料を確認します。ここに示す資料の事実は、新たなAI分析で生成したものではありません。</p>
      <div className="signal-question-options">{questions.map((item) => <button key={item.id} type="button" className="signal-question-option" aria-pressed={question === item.id} onClick={(event) => {
        onQuestion(item.id);
        const root = event.currentTarget.closest('main');
        const target = root?.ownerDocument.getElementById(item.target);
        if (root && target) revealEvidenceTarget(root, target);
      }}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div>
      {selected ? <nav className="signal-question-focus" aria-label="この画面の閲覧の問い"><p><strong>{selected.label}</strong></p><a className="signal-text-button" href={`#${selected.target}`}>この問いの資料へ</a></nav> : null}
      <p className="signal-subtle">閲覧の問いは分析入力・保存結果に入りません。この読み取り画面では新しい分析を開始しません。</p>
      <div className="signal-counts"><div><span>保存結果の比較Aの対象</span><strong>{signal.counts.before}<small>件</small></strong></div><div><span>比較Bの対象</span><strong>{signal.counts.after}<small>件</small></strong></div><div><span>収録範囲での新規観測</span><strong>{signal.counts.newlyObserved}<small>件</small></strong></div></div>
      <p className="signal-subtle">選択した資料の分類・企業で集計した保存値です。日本の全意匠・市場・製品数の変化を表しません。資料全体の件数増を、対象製品の形状変化と読み替えません。</p>
      <a className="signal-text-button" href="#signal-approved-drawings">まず、図面と内側の線を確かめる</a>
    </section>
    <section className="signal-panel" id="signal-approved-drawings" tabIndex={-1} aria-labelledby="signal-approved-drawings-title"><p className="signal-eyebrow">資料から確認した事実 · 図面</p><h2 id="signal-approved-drawings-title">外周と、内側の円・下部の線を分けて見る</h2><div className="signal-media-grid">{preview.media.map((item) => <PreviewImage key={item.id} preview={preview} id={item.id} />)}</div>
      {preview.observations.map((item) => <div className="signal-fact" key={item.id}><p id={`signal-approved-${item.id}`}>{item.text}</p><div className="signal-evidence-links">{item.mediaIds.map((id) => <a key={id} href={`#${evidenceId(id)}`}>{signal.media.find((media) => media.id === id)!.label}へ</a>)}</div></div>)}
      <p className="signal-subtle">保存画像を照合した観察です。線種の違いから、製品の機能変更・変更理由・法的範囲を推論していません。本人による受入確認は未実施です。</p>
    </section>
    <section className="signal-panel" id="signal-approved-sources" tabIndex={-1} aria-labelledby="signal-approved-sources-title"><p className="signal-eyebrow">資料から確認した事実 · 公式引用</p><h2 id="signal-approved-sources-title">引用は発売の説明を支えます。図面との対応は未確定です。</h2>
      {signal.officialFacts.map((fact, index) => {
        const source = signal.sources.find((item) => item.id === fact.sourceId)!;
        const firstFactForSource = signal.officialFacts.findIndex((item) => item.sourceId === fact.sourceId) === index;
        return <article className="signal-source" id={evidenceId(fact.id)} tabIndex={-1} key={fact.id}><p><strong>保存された確認内容</strong>：{fact.text}</p><blockquote>{fact.quote}</blockquote><p>保存された公式資料の発売に関する記載です。この引用だけでは、上の登録図面と同じ製品を指すか、機能やデザインの変更理由は分かりません。</p><div id={firstFactForSource ? evidenceId(fact.sourceId) : undefined} tabIndex={-1}><SignalEvidenceDetails signal={signal} ids={[fact.id]} label="この引用の位置・出典を確かめる" /><details className="signal-details" data-print-evidence><summary>保存抜粋を確認する</summary><blockquote>{source.excerpt}</blockquote><p className="signal-subtle">保存された抽出範囲です。ページの全文ではありません。先頭{source.modelVisibleChars}文字が当時モデルに提示された範囲で、抽出対象は{source.extractedChars}文字です。</p></details></div></article>;
      })}
      <p className="signal-subtle">発表日・更新日・正確な発売日は不明のままです。引用にある月の表現から年・日を補っていません。公式ページの追加取得は行いません。</p>
    </section>
    <section className="signal-panel" id="signal-approved-next" tabIndex={-1} aria-labelledby="signal-approved-next-title"><p className="signal-eyebrow">設計の検討へ · 追加確認の案</p><h2 id="signal-approved-next-title">輪郭と内側の線を分けて、検討に必要な資料をそろえる</h2><p>図面に同心円状の線が見えることと、公式資料に製品名・発売の記載があることは確認できます。両者の対応と、円や下部の部分の機能はまだ確認できません。</p><ol><li>両登録図面の説明・他の方向の図を確認し、外周、内側の円、下部の線を部位別に記録する。</li><li>公式製品画像や仕様の資料で、図面との対応と部位の名称・機能を照合する。</li><li>対応が確認できたら、輪郭と内側の要素を別々の設計検討項目として比較する。現時点では具体的な形状・機能の変更案を確定しない。</li></ol><p className="signal-subtle">次に集める資料の案です。実AIによる設計提案、製品戦略の確定、法律判断ではありません。</p><a className="signal-text-button" href="#signal-approved-drawings">図面へ戻って確かめる</a></section>
    <section className="signal-panel" id="signal-approved-history" tabIndex={-1} aria-labelledby="signal-approved-history-title"><h2 id="signal-approved-history-title">保存済みp23結果を再表示する</h2><p>実AIで生成し保存された過去の結果です。<strong>V2・V4はFAILのまま</strong>で、今回の成功見本として扱いません。線種の混同、内側の円の観察不足、根拠のない法的意味、具体的な設計検討の不足が残っています。</p><p className="signal-subtle">{run.createdAt} · モデル {run.versions.model} · prompt {run.versions.prompt}。新規AIは実行しません。以下は許可されたこの保存例1件のみの履歴です。</p>
      <SignalHistory runs={[run]} selectedId={replay ? run.id : undefined} state="ready" disabled={false} onSelect={() => onReplay(true)} />
      <button className="signal-button" type="button" onClick={() => onReplay(true)}>品質未達のp23保存例を見る</button>
    </section>
    <section className="signal-panel"><h2>操作だけを試す補助例</h2><p>架空資料では、明示的な開始・模擬進行・このブラウザーへの保存・履歴の操作を試せます。実資料の読み取り画面とは別の保存領域です。</p><a className="signal-text-button" href="?signalsDemo=fictional">架空の操作例へ</a></section>
  </main>;
}

export function SignalApprovedEvidenceWorkspace({ load = loadApprovedPreview }: { load?: () => Promise<ApprovedPreview> }) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [question, setQuestion] = useState<SignalQuestion | null>(null);
  const [replay, setReplay] = useState(false);
  useEffect(() => {
    let active = true;
    void load().then((preview) => {
      if (!active) return;
      setQuestion(null);
      setReplay(new URLSearchParams(window.location.search).get('run') === preview.run.id);
      setState({ status: 'ready', preview });
    }).catch(() => { if (active) { setQuestion(null); setReplay(false); setState({ status: 'error' }); } });
    return () => { active = false; };
  }, [attempt, load]);
  const showReplay = (value: boolean) => {
    if (state.status !== 'ready') return;
    setReplay(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('run', state.preview.run.id); else url.searchParams.delete('run');
    window.history.replaceState(null, '', url);
  };
  const refresh = () => { setQuestion(null); setReplay(false); setState({ status: 'loading' }); setAttempt((value) => value + 1); };
  return <div className="signals-app"><header className="signal-header"><strong>KIRIKO Design Signals</strong><span>実資料のローカル確認</span></header><section className="signal-development-banner" aria-label="実資料の読み取りモード"><strong>承認済み資料のローカル表示 · 新規AI未実施</strong><p>既存の図面・引用と指定された保存例だけを読みます。DB・実行受付・外部取得には接続しません。図面は比較と批評のための引用で、一般の再配布許可を意味しません。</p><button className="signal-button secondary" type="button" disabled={state.status === 'loading'} onClick={refresh}>保存資料を読み直す</button></section>
    {state.status === 'loading' ? <main className="signal-panel" role="status"><h1>保存資料を読んでいます</h1><p>新しい分析は開始しません。</p></main> : state.status === 'error' ? <main className="signal-panel" role="alert"><h1>保存資料を確認できません</h1><p>「もう一度読み込む」で保存資料を再取得できます。新しい分析は始まりません。</p><button className="signal-button" type="button" onClick={refresh}>もう一度読み込む</button></main> : <ApprovedEvidenceContent key={`${state.preview.run.id}:${attempt}`} preview={state.preview} question={question} onQuestion={setQuestion} replay={replay} onReplay={showReplay} />}
  </div>;
}
