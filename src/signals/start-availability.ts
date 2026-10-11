export interface StartAvailability {
  busy: boolean;
  historyLoading: boolean;
  pendingUnavailable: boolean;
  selectedWatchPending: boolean;
  selectedRunRunning: boolean;
  questionMissing: boolean;
  pairRequired: boolean;
  pairState: 'loading' | 'ready' | 'error';
  pairMissing: boolean;
}

// 説明だけを返す。受付ON/OFFを推測せず、既存の開始条件・通信は変更しない。
export function startUnavailableReason(state: StartAvailability): string | null {
  if (state.busy) return '確認処理中です。完了するまでお待ちください。開始ボタンを押し直す必要はありません。';
  if (state.historyLoading) return '保存履歴を読み込んでいます。読み込みが終わるまでお待ちください。';
  if (state.pendingUnavailable) return '保留情報を確認できないため開始できません。ブラウザーの保存設定を確認してください。保存結果は閲覧できます。';
  if (state.selectedWatchPending) return '前の要求の成否が未確認です。「保留した実行の状態を確認」で保存状態を確認してください。新しい要求は再送しません。';
  if (state.selectedRunRunning) return 'この条件の保存結果は処理中です。「履歴を再取得」で状態を確認してください。分析は再送しません。';
  if (state.questionMissing) return '上の「この資料で、何を確かめたい？」から問いを選んでください。選択だけでは分析は始まりません。';
  if (state.pairRequired && state.pairState === 'loading') return '比較組を読み込んでいます。読み込みが終わるまでお待ちください。';
  if (state.pairRequired && state.pairState === 'error') return '比較組を確認できません。「比較組を再取得」で候補を確認してください。分析は始まりません。';
  if (state.pairRequired && state.pairMissing) return '「次の実行に使う比較組」から資料を選んでください。選択だけでは分析は始まりません。';
  return null;
}
