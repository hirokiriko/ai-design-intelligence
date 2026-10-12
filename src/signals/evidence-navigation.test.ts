import { describe, expect, it, vi } from 'vitest';
import { revealEvidenceTarget } from './evidence-navigation';

function fixtureElement(parent: HTMLElement | null, tagName: string) {
  const attributes = new Map<string, string>();
  return { parentElement: parent, tagName, open: false,
    hasAttribute: (key: string) => attributes.has(key), setAttribute: (key: string, value: string) => attributes.set(key, value),
    focus: vi.fn(), scrollIntoView: vi.fn(), attributes,
  } as unknown as HTMLElement & { open: boolean; attributes: Map<string, string> };
}
describe('opening saved evidence without a new analysis', () => {
  it('opens all closed details around the saved target before moving keyboard focus', () => {
    const root = fixtureElement(null, 'ARTICLE');
    const outer = fixtureElement(root, 'DETAILS');
    const inner = fixtureElement(outer, 'DETAILS');
    const target = fixtureElement(inner, 'DIV');
    root.contains = (node) => node === outer || node === inner || node === target;
    expect(revealEvidenceTarget(root, target)).toBe(true);
    expect(outer.open).toBe(true); expect(inner.open).toBe(true);
    expect(target.attributes.get('tabindex')).toBe('-1');
    expect(target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior: 'auto' });
  });
  it('does not open or focus a target outside this saved result', () => {
    const root = fixtureElement(null, 'ARTICLE');
    const foreign = fixtureElement(null, 'DETAILS');
    root.contains = () => false;
    expect(revealEvidenceTarget(root, foreign)).toBe(false);
    expect(foreign.open).toBe(false);
    expect(foreign.focus).not.toHaveBeenCalled();
    expect(foreign.scrollIntoView).not.toHaveBeenCalled();
  });
});
