import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalSavedEntry } from './SignalSavedEntry';
import { SignalResult } from './SignalResult';
import { fictionalRunV22 } from './fixtures-v22';

const hooks = vi.hoisted(() => ({ active: false, index: 0, states: [] as unknown[] }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: ((initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.index++;
      if (index >= hooks.states.length) hooks.states[index] = initial;
      return [hooks.states[index], (value: unknown) => { hooks.states[index] = value; }];
    }) as typeof actual.useState,
    useRef: ((initial: unknown) => hooks.active ? { current: initial } : actual.useRef(initial)) as typeof actual.useRef,
    useEffect: ((effect, dependencies) => { if (!hooks.active) actual.useEffect(effect, dependencies); }) as typeof actual.useEffect,
  };
});
type ViewProps = { children?: ReactNode; className?: string; src?: string; onLoad?: () => void; onError?: () => void };
function find(node: ReactNode, match: (item: ReactElement<ViewProps>) => boolean): ReactElement<ViewProps> | undefined {
  for (const item of Children.toArray(node)) {
    if (!isValidElement<ViewProps>(item)) continue;
    if (match(item)) return item;
    const child = find(item.props.children, match);
    if (child) return child;
  }
}
function render(operation: () => ReactNode): ReactNode {
  hooks.index = 0; hooks.active = true;
  try { return operation(); } finally { hooks.active = false; }
}
function component(node: ReactNode, name: string): () => ReactNode {
  const selected = find(node, item => typeof item.type === 'function' && item.type.name === name);
  if (!selected) throw new Error(`Missing ${name}`);
  return () => (selected.type as (props: ViewProps) => ReactNode)(selected.props);
}
beforeEach(() => { hooks.states = []; hooks.index = 0; hooks.active = false; });

describe('saved media delivery failures', () => {
  it('replaces a broken saved thumbnail and retains the exact saved explanation and official link', () => {
    const run = structuredClone(fictionalRunV22);
    const before = JSON.stringify(run);
    const entry = SignalSavedEntry({ run });
    const draw = component(entry, 'SavedDrawing');
    let tree = render(draw);
    expect(renderToStaticMarkup(tree)).toContain('図面を読み込み中');
    find(tree, item => item.type === 'img')!.props.onError!();
    tree = render(draw);
    const failed = renderToStaticMarkup(tree);
    expect(failed).toContain('図面を表示できません'); expect(failed).toContain('形状は未確認');
    expect(failed).not.toContain('<img'); expect(failed).not.toContain('aria-busy="true"');
    const html = renderToStaticMarkup(entry);
    expect(html).toContain(`href="${run.signal!.sources[0].url}"`);
    expect(html).toContain(run.signal!.sources[0].excerpt);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('finishes loading only on the browser load event', () => {
    const draw = component(SignalSavedEntry({ run: fictionalRunV22 }), 'SavedDrawing');
    const tree = render(draw);
    find(tree, item => item.type === 'img')!.props.onLoad!();
    const loaded = renderToStaticMarkup(render(draw));
    expect(loaded).toContain('<img'); expect(loaded).not.toContain('図面を読み込み中');
    expect(loaded).not.toContain('aria-busy="true"');
  });

  it('handles an enlarged image failure independently while retaining the original image and metadata', () => {
    const card = component(render(() => SignalResult({ run: fictionalRunV22 })), 'MediaCard');
    hooks.states = [];
    let tree = render(card);
    const dialog = find(tree, item => item.type === 'dialog')!;
    find(dialog.props.children, item => item.type === 'img')!.props.onError!();
    tree = render(card);
    const failedDialog = renderToStaticMarkup(find(tree, item => item.type === 'dialog'));
    expect(failedDialog).toContain('拡大画像を表示できません'); expect(failedDialog).toContain('閉じる');
    expect(failedDialog).toContain(fictionalRunV22.signal!.media[0].sourceLabel);
    expect(failedDialog).not.toContain('<img'); expect(failedDialog).not.toContain('拡大画像を読み込み中');
    expect(find(tree, item => item.type === 'img')).toBeDefined();
  });
});
