import type { Run } from './contract';

export function savedStopExplanation(run: Run): string | null {
  if (!['partial', 'failed', 'interrupted'].includes(run.status)) return null;
  if (run.versions.model !== 'facts-only-deterministic') {
    switch (run.errorCode) {
      case 'MODEL_INPUT_BUDGET_EXCEEDED':
        return 'モデル入力の上限により停止しました。分析は未完了です。';
      case 'MODEL_HTTP_GATEWAY_TIMEOUT':
      case 'MODEL_HTTP_REQUEST_TIMEOUT':
      case 'MODEL_TRANSPORT_TIMEOUT':
        return 'AIサービスからの応答待ちがタイムアウトしたため停止しました。分析は未完了です。';
      case 'MODEL_TIMEOUT':
        return 'モデル処理の制限時間に達したため停止しました。分析は未完了です。';
    }
  }
  const reason = run.signal?.stopReason.trim();
  if (!reason) return '詳しい停止理由は保存されていません。';
  const characters = Array.from(reason);
  return characters.length <= 200 ? reason : `${characters.slice(0, 200).join('')}…`;
}

export function savedSourcesSummary(run: Run): string | null {
  if (!run.signal || run.signal.officialFacts.length > 0 || run.signal.sources.length === 0) return null;
  const sources = run.signal.sources;
  const excerpts = sources.filter((source) => source.excerpt.trim().length > 0).length;
  return `公式資料の参照先が${sources.length}件、保存された抜粋が${excerpts}件あります。この結果に採用された公式の記載・引用はありません。資料の保存は、AIによる照合や回答の完了を意味しません。`;
}
