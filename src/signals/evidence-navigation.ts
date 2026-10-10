import type { MouseEvent } from 'react';

export function revealEvidenceTarget(root: HTMLElement, target: HTMLElement): boolean {
  if (!root.contains(target)) return false;
  for (let element: HTMLElement | null = target; element && element !== root; element = element.parentElement) {
    if (element.tagName === 'DETAILS') (element as HTMLDetailsElement).open = true;
  }
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start', behavior: 'auto' });
  return true;
}

export function revealEvidenceLink(event: MouseEvent<HTMLElement>): void {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  const fragment = link?.getAttribute('href');
  if (!fragment?.startsWith('#signal-')) return;
  const target = event.currentTarget.ownerDocument.getElementById(fragment.slice(1));
  if (target && revealEvidenceTarget(event.currentTarget, target)) event.preventDefault();
}
