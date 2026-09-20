import { describe, expect, it } from 'vitest';
import { classifyBackendContractData } from './BackendContractDataClassification';

describe('classifyBackendContractData', () => {
  it('always classifies the FIXTURE namespace as fictional', () => {
    expect(classifyBackendContractData({ exportId: 'FIXTURE-PUBLIC-SAFE-V1' })).toBe(
      'fictional_contract_fixture',
    );
    expect(
      classifyBackendContractData({
        exportId: 'FIXTURE-PUBLIC-SAFE-V1',
        approvedPublicDesignDemo: true,
      }),
    ).toBe('fictional_contract_fixture');
  });

  it('keeps a non-fixture Contract unclassified without explicit local approval', () => {
    expect(classifyBackendContractData({ exportId: 'TEST-CONTRACT-PUBLIC-SAFE-V1' })).toBe(
      'unclassified_contract',
    );
  });

  it('requires explicit local approval for the approved public design demo classification', () => {
    expect(
      classifyBackendContractData({
        exportId: 'TEST-CONTRACT-PUBLIC-SAFE-V1',
        approvedPublicDesignDemo: true,
      }),
    ).toBe('approved_public_design_demo');
  });
});
