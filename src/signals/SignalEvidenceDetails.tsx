import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ComparisonMedia, Signal, SignalV2 } from './contract';
import { comparisonStatusLabel, designFactFieldLabel, designFactText, evidenceId } from './labels';

type SelectedEvidence =
  | { kind: 'observation'; id: string; value: Signal['visualObservations'][number] }
  | { kind: 'official'; id: string; value: Signal['officialFacts'][number] }
  | { kind: 'design'; id: string; value: Signal['designFacts'][number] }
  | { kind: 'media'; id: string; value: ComparisonMedia }
  | { kind: 'source'; id: string; value: Signal['sources'][number] }
  | { kind: 'unknown'; id: string };

// 保存された参照だけを選ぶ純粋関数。本文やIDの一部から対応を補わない。
// eslint-disable-next-line react-refresh/only-export-components
export function selectSignalEvidence(signal: Signal, ids: string[]): SelectedEvidence[] {
  return [...new Set(ids)].map((id): SelectedEvidence => {
    const observation = signal.visualObservations.find((item) => item.id === id);
    if (observation) return { kind: 'observation', id, value: observation };
    const official = signal.officialFacts.find((item) => item.id === id);
    if (official) return { kind: 'official', id, value: official };
    const design = signal.designFacts.find((item) => item.id === id);
    if (design) return { kind: 'design', id, value: design };
    const media = signal.media.find((item) => item.id === id);
    if (media) return { kind: 'media', id, value: media };
    const source = signal.sources.find((item) => item.id === id);
    return source ? { kind: 'source', id, value: source } : { kind: 'unknown', id };
  });
}

const observationLabels: Record<Signal['visualObservations'][number]['status'], string> = {
  change_candidate: '変化の候補', no_change: '変化は見られない', unknown: '判断不能',
};

function OriginalEvidenceLink({ id, label }: { id: string; label: string }) {
  return <a href={`#${evidenceId(id)}`} className="signal-evidence-links">根拠一覧の{label}へ</a>;
}

function SourceMetadata({ source }: { source: Signal['sources'][number] }) {
  const v2 = 'extractionVersion' in source ? source as SignalV2['sources'][number] : null;
  return <>
    <p><strong>出典：{source.title || 'タイトル不明'}</strong></p>
    <p className="signal-subtle">{v2 ? '発表日' : '公開日'}：{source.publishedAt ?? '不明'} · 取得日時：{source.retrievedAt}</p>
    {v2 ? <p className="signal-subtle">更新日：{v2.updatedAt ?? '不明'} · 発売日：{v2.releaseAt ?? '不明'}。発表日とは別の情報です。</p> : null}
    {source.retrospective ? <p className="signal-retrospective">事後照合：意匠の基準日より後の資料を含みます。</p> : null}
    <p className="signal-subtle readable-text">保存された参照先：{source.url}</p>
    <OriginalEvidenceLink id={source.id} label="出典" />
  </>;
}

function EvidenceMediaPreview({ media, signal, showImage }: { media: ComparisonMedia; signal: Signal; showImage: boolean }) {
  const [failed, setFailed] = useState(false);
  const records = 'recordFacts' in signal ? (signal as SignalV2).recordFacts : [];
  const record = records.find((item) => item.recordId === media.recordId);
  return <figure className="signal-media-card">
    <figcaption><strong>{media.role === 'comparisonA' ? '比較A' : '比較B'} · {media.label}</strong></figcaption>
    {failed ? <p role="status">画像の取得失敗：この図面は表示を確認できません。形状は不明のままです。保存された観察を変更したり、変化なしと判定したりはしません。</p>
      : showImage ? <img src={`/api/v1/media/${encodeURIComponent(media.id)}`} width={media.width} height={media.height} alt={`${media.label}。${media.view ?? '方向不明'}。${comparisonStatusLabel(media.comparisonStatus)}`} onError={() => setFailed(true)} /> : null}
    <dl className="signal-metadata">
      <div><dt>方向・比較条件</dt><dd>{media.view ?? '方向不明'} / {comparisonStatusLabel(media.comparisonStatus)}</dd></div>
      <div><dt>登録番号</dt><dd>{record?.registrationNumber ?? '不明'}</dd></div>
      <div><dt>公報日 / 出願日</dt><dd>{media.gazetteDate ?? '不明'} / {media.applicationDate ?? '不明'}</dd></div>
      <div><dt>情報源・利用条件</dt><dd>{media.sourceLabel} / {media.permission}</dd></div>
    </dl>
    <OriginalEvidenceLink id={media.id} label="図面" />
  </figure>;
}

function ObservationEvidence({ value, signal, showImages, factsOnly, developmentMode }: { value: Signal['visualObservations'][number]; signal: Signal; showImages: boolean; factsOnly: boolean; developmentMode: boolean }) {
  return <>
    <p className="signal-evidence-kind">{developmentMode ? '架空図面の模擬観察（実AIは未実施）' : '図面からのAI観察候補'}</p>
    {factsOnly ? <p>画像・図面の分析は未実施です。この表示では画像や観察本文を読み込みません。</p> : <>
      <p><strong>{value.part}</strong> · {observationLabels[value.status]}</p>
      <p>{value.observation}</p>
      <p className="signal-subtle">比較A / Bは資料の役割です。商品の新旧世代や発売順を示しません。部位の記載を図面と照合してください。観察位置の座標は保存されていません。</p>
      <div className="signal-evidence-pair">{value.mediaIds.length ? [...new Set(value.mediaIds)].map((id) => {
        const media = signal.media.find((item) => item.id === id);
        return media ? <EvidenceMediaPreview key={id} media={media} signal={signal} showImage={showImages} /> : <p key={id}>対応図面を保存結果から確認できません。形状は不明です。</p>;
      }) : <p>対応図面は未記録です。形状を確認するための資料が不足しています。</p>}</div>
    </>}
    <OriginalEvidenceLink id={value.id} label="画像観察" />
  </>;
}

function SavedQuoteContext({ value, source }: { value: Signal['officialFacts'][number]; source: Signal['sources'][number] }) {
  const characters = Array.from(source.excerpt);
  const start = value.start - source.excerptStart;
  const end = value.end - source.excerptStart;
  if (![source.excerptStart, value.start, value.end].every(Number.isSafeInteger)
    || source.excerptStart < 0 || start < 0 || end <= start || end > characters.length
    || characters.slice(start, end).join('') !== value.quote) {
    return <p className="signal-subtle">保存抜粋と引用位置の一致を確認できません。引用箇所や前後の文脈を推定していません。</p>;
  }
  const contextStart = Math.max(0, start - 80);
  const contextEnd = Math.min(characters.length, end + 80);
  const v2 = 'extractionVersion' in source ? source as SignalV2['sources'][number] : null;
  return <div className="signal-quote-context">
    <p className="signal-subtle">同じ出典の保存抜粋と前後の文脈（引用箇所を強調）</p>
    <blockquote>{contextStart > 0 ? '…' : null}{characters.slice(contextStart, start).join('')}<mark>{characters.slice(start, end).join('')}</mark>{characters.slice(end, contextEnd).join('')}{contextEnd < characters.length ? '…' : null}</blockquote>
    <p className="signal-subtle">表示範囲：{source.excerptStart + contextStart}〜{source.excerptStart + contextEnd}。保存された抽出範囲であり、ページの全文ではありません。</p>
    {v2 ? <p className="signal-subtle">当時AIに提示した範囲は保存抜粋の先頭{v2.modelVisibleChars}文字です。{contextEnd > v2.modelVisibleChars ? 'この前後文脈には、当時AIに提示されなかった範囲を含みます。' : null}</p> : null}
  </div>;
}

function OfficialEvidence({ value, signal, factsOnly, developmentMode }: { value: Signal['officialFacts'][number]; signal: Signal; factsOnly: boolean; developmentMode: boolean }) {
  const source = signal.sources.find((item) => item.id === value.sourceId);
  return <>
    <p className="signal-evidence-kind">{developmentMode ? '架空資料の記載・固定の引用例' : '公式資料に記載された事実'}</p>
    {factsOnly ? <p>公式記事の本文・引用の分析は未実施です。この表示では本文や引用を表示しません。</p> : <>
      <p>{value.text}</p>
      <blockquote>{value.quote}</blockquote>
      <p className="signal-subtle">保存された引用位置：{value.start}〜{value.end}（先頭を0とし、終端は含みません）。引用が支える範囲を確認してください。</p>
      <p className="signal-subtle">公式記載と図面が同じ製品を指すことや、機能・法的範囲の確認とは区別します。</p>
      {source ? <SavedQuoteContext value={value} source={source} /> : null}
    </>}
    {source ? <SourceMetadata source={source} /> : <p>出典は保存結果から確認できません。引用の参照先は不明です。</p>}
    <OriginalEvidenceLink id={value.id} label="公式記載" />
  </>;
}

export function SignalEvidenceDetails({ signal, ids, factsOnly = false, developmentMode = false, label = 'この検討材料の根拠をここで確認' }: { signal: Signal; ids: string[]; factsOnly?: boolean; developmentMode?: boolean; label?: string }) {
  const [showImages, setShowImages] = useState(false);
  const [printImages, setPrintImages] = useState(false);
  const printing = useRef(false);
  useEffect(() => {
    // 印刷はtoggleイベントを待たずにDOMを同期更新する。通常の開閉状態は別に保つ。
    const preparePrint = () => {
      printing.current = true;
      flushSync(() => setPrintImages(true));
    };
    const restorePrint = () => {
      flushSync(() => setPrintImages(false));
      printing.current = false;
    };
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', restorePrint);
    return () => {
      window.removeEventListener('beforeprint', preparePrint);
      window.removeEventListener('afterprint', restorePrint);
      printing.current = false;
    };
  }, []);
  const entries = selectSignalEvidence(signal, ids);
  return <details className="signal-details signal-evidence-detail" data-print-evidence onToggle={(event) => {
    if (!printing.current) setShowImages(event.currentTarget.open);
  }}>
    <summary>{label}（{entries.length}件）</summary>
    <p className="signal-subtle">この主張に保存された参照だけを表示します。観察・公式記載・書誌事項を分け、追加のAI分析や公式ページの再取得は行いません。</p>
    {entries.length ? entries.map((entry) => <article className="signal-evidence-inline" key={entry.id}>
      {entry.kind === 'observation' ? <ObservationEvidence value={entry.value} signal={signal} showImages={showImages || printImages} factsOnly={factsOnly} developmentMode={developmentMode} />
        : entry.kind === 'official' ? <OfficialEvidence value={entry.value} signal={signal} factsOnly={factsOnly} developmentMode={developmentMode} />
          : entry.kind === 'design' ? <>
            <p className="signal-evidence-kind">意匠データの書誌事項</p><p>{designFactText(entry.value.text, entry.value.field)}</p>
            <p className="signal-subtle">項目：{designFactFieldLabel(entry.value.field)}。図面から観察した形状や、公式記事の発表内容とは区別します。</p>
            <OriginalEvidenceLink id={entry.id} label="意匠の事実" />
          </> : entry.kind === 'media' ? <>
            <p className="signal-evidence-kind">図面資料のみの参照</p><p>資料の参照はありますが、この主張への対応は未確認です。観察内容や支持・反証の意味を資料IDだけから補いません。</p>
            <p className="signal-subtle">比較A / Bは資料の役割であり、商品の新旧世代や発売順を示しません。</p>
            {factsOnly ? <p>画像・図面の分析は未実施です。この表示では画像を読み込みません。</p> : <EvidenceMediaPreview media={entry.value} signal={signal} showImage={showImages || printImages} />}
          </> : entry.kind === 'source' ? <>
            <p className="signal-evidence-kind">公式資料のみの参照</p><p>資料の参照はありますが、この主張への対応は未確認です。対応する公式事実・引用は指定されていません。</p>
            <SourceMetadata source={entry.value} />
          </> : <><p className="signal-evidence-kind">根拠の参照不明</p><p>参照先をこの保存結果から確認できません。対応する観察・事実・引用を確認する資料が不足しています。</p></>}
    </article>) : <p>この主張の根拠は登録されていません。判断に必要な資料は未確認です。</p>}
  </details>;
}
