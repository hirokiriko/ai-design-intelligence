import { describe, expect, it } from 'vitest';
import { loadDemoShowcaseJson } from './DemoShowcaseDataSource';

describe('DemoShowcaseDataSource', () => {
  it('loads demo_showcase_records style JSON and removes unsafe references', () => {
    const loaded = loadDemoShowcaseJson(
      {
        recordCount: 1,
        records: [
          {
            id: 'fixture-demo-1',
            articleName: 'Remote control',
            applicantsDisplay: ['Demo Applicant Inc.'],
            rightHolders: [{ name: 'Demo Right Holder Inc.', address: 'private address' }],
            registrationNumber: 'SAMPLE-REG-DEMO-001',
            applicationNumber: 'SAMPLE-APP-DEMO-001',
            gazetteDate: '2026-06-09',
            designClass: 'H7-122',
            drawingRefCount: 2,
            drawingLabels: ['正面図', '背面図'],
            sourceXmlFile: 'C:\\private\\sample-demo-001.xml',
            whyDemoFriendly: '図面メタデータあり / 物品名が説明しやすい',
          },
        ],
      },
      'fixture-demo-showcase.json',
    );

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0].partyLabel).toBe('Demo Applicant Inc.');
    expect(loaded.records[0].drawingRefCount).toBe(2);
    expect(loaded.records[0].drawingLabels).toEqual(['正面図', '背面図']);
    expect(loaded.records[0].sourceXmlFile).toBeNull();
    expect(JSON.stringify(loaded.records)).not.toMatch(/https?:\/\//i);
    expect(JSON.stringify(loaded.records)).not.toMatch(/[A-Za-z]:\\/);
    expect(JSON.stringify(loaded.records)).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
  });
});
