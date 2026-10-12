/** Display only: the saved source title, excerpts and hashes remain untouched. */
export function sourceDisplayTitle(title: string): string {
  return title.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim() || 'タイトル不明';
}

/** Generated explanations can embed an HTML line break from a source title.
 * Keep all wording and the saved DTO; citations and excerpts do not use this. */
export function explanationDisplayText(text: string | null): string {
  return (text ?? '').replace(/<br\s*\/?>/gi, ' ');
}
