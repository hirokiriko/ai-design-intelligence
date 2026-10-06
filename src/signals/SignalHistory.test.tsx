import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalHistory } from './SignalHistory';
import { fictionalRun } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';

describe('saved history fetch states', () => {
  it.each(['loading', 'error'] as const)('does not claim no saved runs during %s', (state) => {
    const html = renderToStaticMarkup(createElement(SignalHistory, { runs: [], state, disabled: false, onSelect: () => undefined }));
    expect(html).not.toContain('まだ保存結果はありません');
    expect(html).toContain(state === 'loading' ? '保存履歴を読み込んでいます' : '保存履歴を取得できません');
  });
  it('shows empty history only after successful read and retains known saved results on later failure', () => {
    const props = { runs: [], state: 'ready' as const, disabled: false, onSelect: () => undefined };
    expect(renderToStaticMarkup(createElement(SignalHistory, props))).toContain('まだ保存結果はありません');
    const html = renderToStaticMarkup(createElement(SignalHistory, { ...props, state: 'error', runs: [fictionalRun], selectedId: fictionalRun.id }));
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('まだ保存結果はありません');
  });
  it('shows the saved pair on new runs without consulting the current catalog', () => {
    const html = renderToStaticMarkup(createElement(SignalHistory, { runs: [fictionalRunV22, fictionalRun], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(html).toContain('保存された比較組：架空の操作部比較 1');
    expect(html).not.toContain('現在の比較組');
  });
});
