import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BackendContractDataSource } from '../data/BackendContractDataSource';
import { loadDesignJsonText } from '../data/DesignJsonFileLoader';
import {
  clearProductDomainFilter,
  createBackendContractDemoRequest,
  createDemoPresetRequest,
  createRequestForDataMode,
  getDemoPresetsForDataMode,
} from './presets';

describe('data-mode demo presets', () => {
  it('uses a non-zero all-data request for a successfully loaded Backend Contract', async () => {
    const source = loadFictionalBackendSource();
    const request = createBackendContractDemoRequest();

    expect(request).toMatchObject({
      scope: { mode: 'all_classes' },
      productDomain: '',
      period: 'last_2y',
      designKinds: ['article', 'image', 'interior'],
    });
    expect((await source.query(request)).length).toBeGreaterThan(0);
  });

  it('does not expose fixed-domain sample presets in Backend Contract mode', () => {
    const backendPresets = getDemoPresetsForDataMode('backend');
    const samplePresets = getDemoPresetsForDataMode('sample');
    const sampleRequest = createDemoPresetRequest(samplePresets[0]);
    const backendRequest = createRequestForDataMode(sampleRequest, 'backend');

    expect(backendPresets.map((preset) => preset.id)).toEqual(['backend_all']);
    expect(backendPresets[0].request.productDomain).toBe('');
    expect(backendRequest.productDomain).toBe('');
    expect(backendRequest.period).toBe('last_2y');
    expect(samplePresets.map((preset) => preset.id)).toEqual(['market', 'image']);
    expect(samplePresets.map((preset) => preset.request.productDomain)).toEqual([
      '家電・映像機器',
      '画像意匠',
    ]);
    expect(createRequestForDataMode(sampleRequest, 'sample').productDomain).toBe(
      '家電・映像機器',
    );
  });

  it('keeps explicit Backend product-domain filtering and recovers by clearing that condition', async () => {
    const source = loadFictionalBackendSource();
    const recommendedRequest = createBackendContractDemoRequest();
    const matchingRequest = { ...recommendedRequest, productDomain: '架空案内' };
    const zeroResultRequest = { ...recommendedRequest, productDomain: '架空非該当領域' };

    expect((await source.query(matchingRequest)).map((record) => record.id)).toEqual([
      'kds_fixture_beta',
    ]);
    expect(await source.query(zeroResultRequest)).toEqual([]);

    const clearedRequest = clearProductDomainFilter(zeroResultRequest);
    expect(clearedRequest.productDomain).toBe('');
    expect((await source.query(clearedRequest)).length).toBeGreaterThan(0);
  });
});

function loadFictionalBackendSource(): BackendContractDataSource {
  const fixturePath = path.resolve(
    'fixtures',
    'backend-contract-v0.1.0',
    'design-export-fictional.json',
  );
  const routed = loadDesignJsonText(
    fs.readFileSync(fixturePath, 'utf8'),
    'design-export-fictional.json',
  );
  if (routed.kind !== 'backend_contract' || !routed.result.ok) {
    throw new Error('The fictional Backend Contract fixture must be accepted.');
  }
  return new BackendContractDataSource(routed.result);
}
