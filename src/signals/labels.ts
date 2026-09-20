import type { Run } from './contract';

export const runLabels: Record<Run['status'], string> = {
  running: '進行中', complete: '確認完了', partial: '一部完了', failed: 'API・AI処理の失敗', interrupted: '中断',
};
