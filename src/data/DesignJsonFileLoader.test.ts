import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDesignJsonText, loadDesignJsonValue } from './DesignJsonFileLoader';

describe('DesignJsonFileLoader', () => {
  it('routes the fictional Contract 0.1.0 fixture to the dedicated adapter', () => {
    const fixturePath = path.resolve('fixtures', 'backend-contract-v0.1.0', 'design-export-fictional.json');
    const result = loadDesignJsonText(fs.readFileSync(fixturePath, 'utf8'), 'design-export-fictional.json');

    expect(result.kind).toBe('backend_contract');
    if (result.kind !== 'backend_contract') return;
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    expect(result.result.meta.contractVersion).toBe('0.1.0');
    expect(result.result.summary).toMatchObject({ totalRecordCount: 7, acceptedCount: 3, excludedCount: 4 });
  });

  it('never falls back to the legacy loader for an unsupported version', () => {
    const result = loadDesignJsonValue({ contractVersion: '0.2.0', records: [] }, 'unsupported.json');

    expect(result.kind).toBe('backend_contract');
    if (result.kind !== 'backend_contract') return;
    expect(result.result).toMatchObject({
      ok: false,
      errors: [{ code: 'UNSUPPORTED_CONTRACT_VERSION' }],
    });
  });

  it('treats a versioned-looking envelope with a missing version as a Backend failure', () => {
    const result = loadDesignJsonValue({ exportId: 'FIXTURE-MISSING-VERSION', records: [] }, 'missing-version.json');

    expect(result.kind).toBe('backend_contract');
    if (result.kind !== 'backend_contract') return;
    expect(result.result).toMatchObject({ ok: false, errors: [{ code: 'INVALID_ENVELOPE' }] });
  });

  it('keeps an unversioned JSON object on the legacy path', () => {
    const result = loadDesignJsonValue({ recordCount: 0, records: [] }, 'legacy.json');

    expect(result.kind).toBe('legacy');
  });

  it('returns a fixed parse error without echoing input content', () => {
    const sensitiveSentinel = ['password', '=do-not-echo'].join('');
    const result = loadDesignJsonText(`{"records":[${sensitiveSentinel}`, 'broken.json');

    expect(result.kind).toBe('malformed_json');
    if (result.kind !== 'malformed_json') return;
    expect(JSON.stringify(result)).not.toContain(sensitiveSentinel);
    expect(result.result.errors[0]).toMatchObject({ code: 'MALFORMED_JSON', path: '$' });
  });
});
