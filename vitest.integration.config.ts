import { defineConfig } from 'vitest/config';

// 通常の FE テストとは分け、登録済み BE CI が生成した架空応答だけを入力にする。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/signals/backend-api-flow.ci.tsx'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
});
