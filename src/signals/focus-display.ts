/** Read-only projections of saved observations. Never rewrite the Run or source quotations. */
export type ObservationLabel = { id: string; part: string };
export type TextExcerpt = { text: string; truncated: boolean };
export type ObservationExcerpt = { kind: 'pair'; a: TextExcerpt; b: TextExcerpt } | { kind: 'text'; excerpt: TextExcerpt };

function excerpt(text: string, maximum: number): TextExcerpt {
  const characters = Array.from(text);
  return { text: characters.slice(0, maximum).join(''), truncated: characters.length > maximum };
}

/** Only the explicit saved A/B format is split. Other versions remain a literal excerpt. */
export function savedObservationExcerpt(text: string): ObservationExcerpt {
  const pair = /^A：([^。]+)。B：([^。]+)。(?:描画上の比較：[\s\S]+)?$/u.exec(text);
  return pair
    ? { kind: 'pair', a: excerpt(pair[1], 90), b: excerpt(pair[2], 90) }
    : { kind: 'text', excerpt: excerpt(text, 150) };
}

export type ObservationReference = { kind: 'observation'; id: string; label: string };
export type ReferenceSegment = { kind: 'text'; text: string } | ObservationReference;
export type SavedInvestigation = { index: number; text: string; segments: ReferenceSegment[]; observationIds: string[] };

/** Match only known IDs, including punctuation, with no prefix matches inside another ID. */
export function observationReferences(text: string, observations: readonly ObservationLabel[]): ReferenceSegment[] {
  const labels = new Map(observations.map((item, index) => [item.id, `着目点 ${index + 1}：${item.part}`]));
  const ids = [...labels.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ids.length) return [{ kind: 'text', text }];
  const alternatives = ids.map(id => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Unicode IDは本文との境界を推測せず、区切りがある場合だけ対応付ける。
    const boundary = /[^\p{ASCII}]/u.test(id) ? '\\p{L}\\p{M}\\p{N}._:-' : 'A-Za-z0-9._:-';
    return `(?<![${boundary}])${escaped}(?![${boundary}])`;
  });
  const pattern = new RegExp(alternatives.join('|'), 'gu');
  const segments: ReferenceSegment[] = [];
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) segments.push({ kind: 'text', text: text.slice(offset, match.index) });
    segments.push({ kind: 'observation', id: match[0], label: labels.get(match[0])! });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) segments.push({ kind: 'text', text: text.slice(offset) });
  return segments.length ? segments : [{ kind: 'text', text }];
}

/** Explicit mentions establish display scope, not scientific support or product identity. */
export function investigationsForSelection(texts: readonly string[], observations: readonly ObservationLabel[], selectedId: string) {
  const items: SavedInvestigation[] = texts.map((text, index) => {
    const segments = observationReferences(text, observations);
    const observationIds = [...new Set(segments.flatMap(segment => segment.kind === 'observation' ? [segment.id] : []))];
    return { index, text, segments, observationIds };
  });
  return {
    selected: items.filter(item => item.observationIds.includes(selectedId)),
    other: items.filter(item => !item.observationIds.includes(selectedId)),
  };
}
