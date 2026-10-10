import type { Run } from './contract';
import type { AnalysisQuestionId } from './analysis-question';
export type SignalQuestion = AnalysisQuestionId;

const signalQuestions: { id: SignalQuestion; label: string; description: string; target: string }[] = [
  { id: 'drawings', label: '図面のどこが違う？', description: '同じ場所を見比べ、見える違いと判断できない点を確認。', target: 'signal-images' },
  { id: 'support', label: '公式の説明は図面を裏付ける？', description: '引用が支える範囲と、食い違う点・不足する根拠を確認。', target: 'signal-official' },
  { id: 'next', label: '次に何を確認すればよい？', description: '結論を急がず、必要な資料と次の確認事項を整理。', target: 'signal-next-checks' },
];

export function SignalPurposeIntro() {
  return <div className="signal-intro"><p className="signal-eyebrow">知財・企画・デザインの検討に</p><h1>競合のデザイン変化を、<br className="signal-mobile-break" />根拠と一緒に確かめる。</h1><p>収録された意匠の図面と企業の公式資料を見比べ、<strong>詳しく調べる動きと、次に必要な資料</strong>を確認するアプリです。知財担当から企画・開発へ、根拠つきの検討材料を届けます。</p></div>;
}

// 操作を説明する自作図形。保存結果・実資料・AIの評価とは分離する。
export function SignalValuePreview() {
  return <section className="signal-value-preview" aria-labelledby="signal-example-title">
    <div className="signal-preview-heading"><div><p className="signal-eyebrow">まず、得られるものを見る</p><h2 id="signal-example-title">「違いがある」の先を、根拠で確かめる。</h2></div><span className="signal-badge">架空の操作例 · 実AI未実施</span></div>
    <div className="signal-preview-layout"><div className="signal-preview-drawings" aria-label="自作の架空図形の比較">
      <figure><figcaption>比較A · 自作の図形</figcaption><svg viewBox="0 0 220 120" role="img" aria-label="角丸の外周の内側に、円の閉じた枠"><rect x="25" y="15" width="170" height="90" rx="18" fill="#fff" stroke="#355d68" strokeWidth="3" /><circle cx="110" cy="60" r="24" fill="#edf8f2" stroke="#096c68" strokeWidth="3" /></svg></figure>
      <figure><figcaption>比較B · 自作の図形</figcaption><svg viewBox="0 0 220 120" role="img" aria-label="同じ角丸の外周の内側に、長方形の閉じた枠"><rect x="25" y="15" width="170" height="90" rx="18" fill="#fff" stroke="#355d68" strokeWidth="3" /><rect x="79" y="39" width="62" height="42" fill="#edf8f2" stroke="#096c68" strokeWidth="3" /></svg></figure>
      <p className="signal-subtle">A/Bは比較する資料の役割です。発売順を示しません。</p>
    </div><div className="signal-preview-findings"><p><strong>見える違い</strong>：中央の枠は円と長方形。外周とは別に確認します。</p><p><strong>引用で確かめること</strong>：「中央に枠を配置した」という記載だけでは、機能や変更理由は分かりません。</p><p><strong>次の検討へ</strong>：製品との対応・枠の機能や寸法を説明する資料が必要です。</p><a className="signal-text-button" href="#signal-example-evidence">この見本の図形と引用を確かめる</a></div></div>
    <details className="signal-details signal-example-evidence"><summary>見本の根拠と、引用が支えない例</summary><div id="signal-example-evidence" tabIndex={-1}><h3>自作図形と、固定の架空引用</h3><p>上の図形は外周を同じ形に描き、中央枠だけを円と長方形にしています。実在する意匠・製品ではありません。</p><h4>公式資料の読み方を示す、架空の引用</h4><blockquote>架空操作器の作図例には、中央に閉じた枠を配置しました。実在する商品ではありません。</blockquote><p>この引用が支えるのは「中央に枠を配置した」ことです。円から長方形への変更理由や、製品の機能変更は記載されていません。発表日は不明です。</p><h4>引用が図面の説明を支えない例</h4><blockquote>架空図形ラボの本社を移転しました。実在する企業のお知らせではありません。</blockquote><p>本社移転の引用は、図面の形状変更を裏付けません。関係が分からないことも、次の確認に役立つ結果です。</p><p className="signal-subtle">説明用の固定例です。実AIの分析品質・法律判断・時間削減の実績を示すものではありません。保存履歴には入りません。</p></div></details>
  </section>;
}

export function SignalQuestionPicker({ selected, disabled, onSelect, analysisSupported = false, developmentMode = false }: { selected: SignalQuestion | null; disabled: boolean; onSelect: (question: SignalQuestion) => void; analysisSupported?: boolean; developmentMode?: boolean }) {
  return <section className="signal-question-picker" id="signal-question" tabIndex={-1} aria-labelledby="signal-question-title"><p className="signal-eyebrow">1 · {analysisSupported ? '分析する問いを選ぶ' : '閲覧する問いを選ぶ'}</p><h2 id="signal-question-title">{analysisSupported ? 'この資料で、何を確かめたい？' : 'どこから根拠を見ますか？'}</h2><p className="signal-subtle">{analysisSupported ? '次の実行の目的を選び、企業・資料を確かめて開始します。' : '結果で最初に見る観点です。企業・資料は次に選びます。'}この選択だけでは分析は始まりません。</p><p className="signal-subtle">{analysisSupported ? developmentMode ? '選んだ問いと固定の模擬回答を、このブラウザーに保存します。実AIは実行しません。' : '開始時の問いを分析入力に渡し、回答・根拠と一緒に結果へ保存します。今見ている保存結果の問いは変わりません。' : '問いを指定した実AI分析は、まだ利用できません。この選択は分析入力として保存されません。'}</p><div className="signal-question-options">{signalQuestions.map((question) => <button className="signal-question-option" type="button" key={question.id} disabled={disabled} aria-pressed={selected === question.id} onClick={() => onSelect(question.id)}><strong>{question.label}</strong><span>{question.description}</span>{selected === question.id ? <span className="signal-question-selected">{analysisSupported ? '次の分析の問いを選択中' : '閲覧の問いを選択中'} · 次は対象資料へ</span> : null}</button>)}</div></section>;
}

export function SignalQuestionFocus({ question, hasEvidence = true }: { question: SignalQuestion | null; hasEvidence?: boolean }) {
  const selected = signalQuestions.find((item) => item.id === question);
  if (!selected) return null;
  return <nav className="signal-question-focus" aria-label="この画面で選んだ閲覧の問い"><p><strong>閲覧する問い：{selected.label}</strong></p>{hasEvidence ? <a className="signal-text-button" href={`#${selected.target}`}>保存結果のこの項目を見る</a> : <p>この観点の根拠はまだ保存されていません。実行状態を確認してください。</p>}<p className="signal-subtle">閲覧の案内です。この結果の実行入力や、保存された問いではありません。観点の選択で結果を書き換えたり、分析し直したりはしません。</p></nav>;
}

export function SignalSavedQuestion({ run }: { run?: Run }) {
  const saved = run?.schemaVersion === '2.5.0' ? run.input.analysisQuestion : null;
  return <div className="signal-question-focus" aria-label="実行時点の問い"><p><strong>実行時の問い：{saved?.text ?? '未記録'}</strong></p><p className="signal-subtle">{saved ? 'この実行に保存された分析目的です。今の選択や現在のカタログから補完していません。' : 'この結果は登録した企業・資料の確認結果です。実行時の問いは保存されていません。画面で選んだ閲覧の問いから、実行時の目的を推測していません。'}</p>{saved ? <details className="signal-details"><summary>問いと回答の照合情報</summary><p>問いの識別子：{saved.id} · 版：{saved.version} · 実行：{run?.id}</p></details> : null}</div>;
}

export function SignalEmptyJourney({ developmentMode = false, factsOnly = false, questionSupported = false }: { developmentMode?: boolean; factsOnly?: boolean; questionSupported?: boolean }) {
  return <section className="signal-panel signal-welcome"><p className="signal-eyebrow">3 · 選んだ資料で確認を始める</p><h2>この企業・資料で、何が分かる？</h2><p>{questionSupported ? '問いと対象資料を選び、「この問いで分析を開始」を押してください。' : '対象と比較A/Bの資料を確かめ、「更新を確認」を押してください。'}</p>{factsOnly ? <><p><strong>この接続先は書誌事項のみの比較です。</strong>図面・記事本文の分析は未実施です。</p><ol><li>収録件数と意匠の書誌事項の変化を確認</li><li>登録した参照先と、収録範囲を確認</li><li>不足する資料と次の確認を整理</li></ol></> : <ol><li>図面を見比べ、見える違いと判断できない点を確認</li><li>公式の引用が説明を支えるか、食い違いも確認</li><li>不足する資料と、次に確認することを整理</li></ol>}<p className="signal-subtle">{developmentMode ? '架空の固定結果をこのブラウザーに保存します。実AIは実行しません。' : '実施できる分析は資料と接続先のモードにより異なり、結果に表示します。'}変化なし・資料不足も保存します。</p><a className="signal-text-button" href="#signal-conditions">対象資料と開始ボタンへ</a></section>;
}
