import { useState } from 'react';
import { SignalWorkspace } from './SignalWorkspace';
import { createDevelopmentApi } from './development-api';

export function SignalDevelopmentWorkspace() {
  const [api] = useState(() => createDevelopmentApi());
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const reset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await api.resetLocalData();
      const url = new URL(window.location.href);
      url.searchParams.delete('run');
      window.history.replaceState(null, '', url);
      setError(''); setRevision((value) => value + 1);
    } catch { setError('架空保存を消去できません。ブラウザーの保存設定を確認してください。実環境には接続していません。'); }
    finally { setResetting(false); }
  };
  return <>
    <section className="signal-development-banner" aria-label="ローカル開発モード">
      <strong>架空の操作例 · 実AI未実施 · このブラウザーだけに保存</strong>
      <p>自作の図面と固定の引用で、変化・裏付け・次の確認へ進む操作を試せます。実AI・公式サイト取得・永続DBには接続しません。</p>
      <details><summary>試し方・架空保存の初期化</summary><ol><li>「確認する条件」で架空ケースを選び、確かめる問いと比較組を選択します。</li><li>「この問いで分析を開始」で、選んだ問いと固定の模擬回答を保存します。図面観察・引用・支持と反証・不足資料を確認します。</li><li>別の架空ケース、履歴、再読み込みを試します。閲覧だけでは新しい結果を作りません。</li></ol><p>この開発モードの架空結果と追加条件だけを消します。実環境の履歴や保留情報は変更しません。</p><button className="signal-button" type="button" disabled={resetting} onClick={() => void reset()}>{resetting ? '架空保存を初期化しています…' : '架空保存を消して最初から'}</button></details>
      {error ? <p role="alert">{error}</p> : null}
    </section>
    <SignalWorkspace key={revision} api={api} developmentMode />
  </>;
}
