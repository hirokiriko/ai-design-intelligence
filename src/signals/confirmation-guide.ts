import type { ComparisonMedia, SignalV2 } from './contract';

type Observation = Readonly<Omit<SignalV2['visualObservations'][number], 'mediaIds'> & { mediaIds: readonly string[] }>;
export type GuideKind = 'outline' | 'concentric' | 'separate_shapes' | 'mixed_lines' | 'general';
type Literal = { kind: 'pair'; a: string; b: string } | { kind: 'text'; text: string };
type Instruction = { title: string; question: string; ifConfirmed: string; ifUnclear: string };
export type ConfirmationGuide = Readonly<Instruction & {
  origin: 'fixed-confirmation-guide'; observationId: string; target: string; kind: GuideKind;
  literal: Literal; triggers: readonly { side: 'A' | 'B'; text: string }[];
  mediaIds: readonly string[]; pairedMedia: boolean;
}>;

const instructions: Record<GuideKind, Instruction> = {
  outline: {
    title: '外郭を区間に分けて追う',
    question: '外郭と記された線を区間に分け、同じ位置の線種をA/Bそれぞれで確かめられますか？',
    ifConfirmed: '同じ区間で読み取れた線種と、保存記述との一致・不一致を記録します。線種だけから形状の変更を結論にしません。',
    ifUnclear: '区間を特定できなければ原図を拡大し、同じ登録番号の別視図や図面の説明で位置を確認します。',
  },
  concentric: {
    title: '円ごとの位置と線の続き方を見る',
    question: '同心円と記された線を一つずつ区別し、位置と線の連続・断続をA/B別に確かめられますか？',
    ifConfirmed: '確認できた円ごとに位置と線種を記録します。未確認の線まで、同じ線種とまとめません。',
    ifUnclear: '線を分離して読めなければ原図を拡大します。円の数や線種は補わず、読めない箇所を残します。',
  },
  separate_shapes: {
    title: '記された形を分けて位置と線種を見る',
    question: '保存記述に挙がる形を一つずつ分け、各形の位置と線種をA/B別に確かめられますか？',
    ifConfirmed: '原図で確認できた形ごとに、位置・線種・保存記述との一致を記録します。形から操作機能は判断しません。',
    ifUnclear: 'どの形を指すか曖昧なら、原図の位置と別視図を確認します。個数や機能を推測で足しません。',
  },
  mixed_lines: {
    title: '混在する線を要素と区間で分ける',
    question: '線種が混在すると記された側で、どの要素・区間が実線か破線かを分け、もう一方と照合できますか？',
    ifConfirmed: '要素・区間ごとに確認した線種を記録します。一部の線種を、箇所全体の特徴に広げません。',
    ifUnclear: '混在する場所が読めなければ原図を拡大し、別視図や図面の説明で要素を確認します。未確認の線種は保留します。',
  },
  general: {
    title: '保存記述が指す箇所を原図で探す',
    question: 'この保存記述が指す箇所を原図で特定し、記述と一致する点・異なる点・読めない点を分けられますか？',
    ifConfirmed: '原図で確認した範囲だけを記録します。保存記述を確認済みの事実へ自動で置き換えません。',
    ifUnclear: 'A/Bの記述や対応図面が揃わない場合は、保存本文と図面の説明を確認します。対応箇所や線種を補いません。',
  },
};

// A/Bの明示形式だけを分割する。テンプレートの選択は保存文中の語に限る。
export function confirmationGuide(observation: Observation, media: readonly ComparisonMedia[]): ConfirmationGuide {
  const pair = /^A：([^。]+)。B：([^。]+)。(?:描画上の比較：[\s\S]+)?$/u.exec(observation.observation);
  const literal: Literal = pair ? { kind: 'pair', a: pair[1], b: pair[2] } : { kind: 'text', text: observation.observation };
  const referenced = media.filter(item => observation.mediaIds.includes(item.id));
  const pairedMedia = observation.mediaIds.length === 2 && new Set(observation.mediaIds).size === 2 && referenced.length === 2
    && referenced.filter(item => item.role === 'comparisonA').length === 1 && referenced.filter(item => item.role === 'comparisonB').length === 1;
  const sides = pair ? [{ side: 'A' as const, text: pair[1] }, { side: 'B' as const, text: pair[2] }] : [];
  let kind: GuideKind = 'general';
  let terms: RegExp | null = null;
  // 否定や曖昧な記述を、幾何形状が存在する根拠として利用しない。
  const ambiguous = sides.some(({ text }) => /ない|なし|なく|無い|無し|ません|見えず|認め(?:られ)?ず|不明|未確認|不確か|判別|判断不能|かもしれ|よう[にな]|可能性/u.test(text));
  if (pairedMedia && pair && !ambiguous) {
    const texts = sides.map(item => item.text);
    const matches: { kind: GuideKind; terms: RegExp }[] = [];
    if (texts.some(text => /混在/u.test(text) && /実線/u.test(text) && /破線/u.test(text))) matches.push({ kind: 'mixed_lines', terms: /実線|破線|混在/gu });
    if (texts.every(text => /同心円/u.test(text))) matches.push({ kind: 'concentric', terms: /同心円/gu });
    if (texts.every(text => /長円|楕円/u.test(text) && /円形/u.test(text.replace(/長円形?|楕円形?/gu, '')))) matches.push({ kind: 'separate_shapes', terms: /長円形?|楕円形?|円形/gu });
    if (texts.every(text => /外郭|外周/u.test(text))) matches.push({ kind: 'outline', terms: /外郭|外周/gu });
    // 複数の手順に該当するときは、どの形を指すか決めず原文の確認へ戻す。
    if (matches.length === 1) ({ kind, terms } = matches[0]);
  }
  const triggers = terms ? sides.flatMap(({ side, text }) => [...text.matchAll(terms)].map(match => ({ side, text: match[0] }))) : [];
  return { origin: 'fixed-confirmation-guide', observationId: observation.id, target: observation.part,
    literal, kind, triggers, mediaIds: referenced.map(item => item.id), pairedMedia, ...instructions[kind] };
}

// 日付だけで比較できる場合に限定。取得日、欠損値、時刻付き値を代入しない。
export function publicationCondition(publishedAt: string | null, before: string, after: string): string {
  if (publishedAt === null) return '発表日は不明です。取得日時から発表時期を推測できません。';
  const dateOnly = (value: string) => {
    const parsed = new Date(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (![publishedAt, before, after].every(dateOnly) || before > after) return '日付の粒度や比較範囲が揃わないため、期間内の発表とは判定できません。';
  if (publishedAt < before) return '比較Aの基準日より前の発表です。比較期間中の新しい発表とは扱いません。';
  if (publishedAt > after) return '比較Bの基準日より後の発表です。事後の照合資料として確認します。';
  return '発表日は保存されたA/B基準日の範囲内です。発売時期や、この意匠との対応を証明するものではありません。';
}
