export type BackendContractDataClassification =
  | 'fictional_contract_fixture'
  | 'approved_public_design_demo'
  | 'unclassified_contract';

interface BackendContractDataClassificationInput {
  exportId: string;
  approvedPublicDesignDemo?: boolean;
}

const FICTIONAL_CONTRACT_EXPORT_ID_PREFIX = 'FIXTURE-';

export function classifyBackendContractData({
  exportId,
  approvedPublicDesignDemo = false,
}: BackendContractDataClassificationInput): BackendContractDataClassification {
  if (exportId.startsWith(FICTIONAL_CONTRACT_EXPORT_ID_PREFIX)) {
    return 'fictional_contract_fixture';
  }

  return approvedPublicDesignDemo ? 'approved_public_design_demo' : 'unclassified_contract';
}
