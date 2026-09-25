import { useState } from 'react';
import { adaptBackendDesignExport, type BackendRecordViewModel } from '../data/BackendContractDataSource';
import { requestJson } from './api';
import type { Watch } from './contract';
import { classificationSchemeLabel } from './labels';

type EvidenceRecord = Pick<BackendRecordViewModel, 'articleName' | 'applicants' | 'gazetteDate' | 'applicationDate' | 'registrationNumber' | 'applicationNumber' | 'classifications' | 'description' | 'articleDescription' | 'adapterDisposition'>;
type EvidenceEntry = { datasetId: string; record: EvidenceRecord };

export function RecordEvidenceDetails({ entries, watch }: { entries: EvidenceEntry[]; watch: Watch }) {
  return entries.map(({ datasetId, record }) => {
    const side = datasetId === watch.beforeDatasetId ? '比較A' : '比較B';
    return <section key={datasetId}>
      <h4>{record.articleName ?? '物品名不明'} · {side}</h4>
      <dl className="signal-metadata">
        <div><dt>企業</dt><dd>{record.applicants.map((party) => party.displayName ?? '不明').join('、')}</dd></div>
        <div><dt>公報日 / 出願日</dt><dd>{record.gazetteDate ?? '不明'} / {record.applicationDate ?? '不明'}</dd></div>
        <div><dt>登録番号 / 出願番号</dt><dd>{record.registrationNumber ?? '不明'} / {record.applicationNumber ?? '不明'}</dd></div>
        <div><dt>分類</dt><dd>{record.classifications.map((item) => `${classificationSchemeLabel(item.scheme)} ${item.code}${item.label ? ` ${item.label}` : ''}`).join('、')}</dd></div>
        <div><dt>説明</dt><dd>{record.description ?? record.articleDescription ?? '説明未取得'}</dd></div>
        <div><dt>分析対象</dt><dd>{record.adapterDisposition.status === 'accepted' ? '対象' : '除外'} · {side}</dd></div>
      </dl>
    </section>;
  });
}

export function SignalRecordEvidence({ recordId, watch, label }: { recordId: string; watch: Watch; label: string }) {
  const [records, setRecords] = useState<EvidenceEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (records || loading) return;
    setLoading(true); setError('');
    try {
      const result = await Promise.all([...new Set([watch.beforeDatasetId, watch.afterDatasetId])].map(async (datasetId) => {
        const contract = adaptBackendDesignExport(await requestJson(`/datasets/${encodeURIComponent(datasetId)}/export`));
        if (!contract.ok) throw new Error('invalid_contract');
        return contract.records.filter((record) => record.id === recordId).map((record) => ({ datasetId, record }));
      }));
      if (!result.flat().length) throw new Error('missing_record');
      setRecords(result.flat());
    } catch { setError('対応する収録データと根拠意匠を検証できません。情報を補わず表示を停止しました。'); }
    finally { setLoading(false); }
  };
  return <div className="signal-record-evidence"><button type="button" className="signal-text-button" aria-expanded={open} disabled={loading} onClick={() => void load()}>根拠意匠：{label} {open ? 'を閉じる' : 'を確認'}</button>{open ? <div className="signal-record-detail">{loading ? <p role="status">根拠意匠を取得しています。AIは実行しません。</p> : null}{error ? <p role="alert">{error}</p> : null}{records ? <RecordEvidenceDetails entries={records} watch={watch} /> : null}</div> : null}</div>;
}
