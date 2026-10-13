/** Display only: the saved source title, excerpts and hashes remain untouched. */
export function sourceDisplayTitle(title: string): string {
  return title.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim() || 'タイトル不明';
}

/** Generated explanations can embed an HTML line break from a source title.
 * Keep all wording and the saved DTO; citations and excerpts do not use this. */
export function explanationDisplayText(text: string | null): string {
  return (text ?? '').replace(/<br\s*\/?>/gi, ' ');
}

/** 保存された調査文の既知資料IDだけを題名へ表示変換する。引用・原文には使わない。 */
export function sourceReferenceText(text: string, sources: readonly { id: string; title: string }[]): string {
  const labels = new Map(sources.map((source, index) => [source.id, `資料${index + 1}：${sourceDisplayTitle(source.title)}`]));
  const ids = [...labels.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ids.length) return text;
  const alternatives = ids.map(id => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = /[^\p{ASCII}]/u.test(id) ? '\\p{L}\\p{M}\\p{N}._:-' : 'A-Za-z0-9._:-';
    return `(?<![${boundary}])${escaped}(?![${boundary}])`;
  });
  return text.replace(new RegExp(alternatives.join('|'), 'gu'), id => labels.get(id)!);
}
