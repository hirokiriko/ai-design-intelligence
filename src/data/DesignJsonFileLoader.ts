import {
  adaptBackendDesignExport,
  type BackendContractAdapterFailure,
  type BackendContractAdapterResult,
} from './BackendContractDataSource';
import { loadLocalJpoJson, type LocalJpoLoadResult } from './LocalJpoJsonDataSource';

export type DesignJsonFileLoadResult =
  | { kind: 'backend_contract'; result: BackendContractAdapterResult }
  | { kind: 'legacy'; result: LocalJpoLoadResult }
  | { kind: 'malformed_json'; result: BackendContractAdapterFailure };

const BACKEND_ENVELOPE_SENTINELS = [
  'contractVersion',
  'exportId',
  'generatedAt',
  'sourceUpdatedAt',
  'backendProcessingVersion',
] as const;

export function loadDesignJsonText(text: string, fileName: string): DesignJsonFileLoadResult {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
  } catch {
    return {
      kind: 'malformed_json',
      result: {
        ok: false,
        errors: [
          {
            code: 'MALFORMED_JSON',
            path: '$',
            message: 'JSONを解析できませんでした。ファイル形式を確認してください。',
          },
        ],
      },
    };
  }

  return loadDesignJsonValue(value, fileName);
}

export function loadDesignJsonValue(value: unknown, fileName: string): DesignJsonFileLoadResult {
  if (isBackendContractCandidate(value)) {
    return { kind: 'backend_contract', result: adaptBackendDesignExport(value) };
  }

  return { kind: 'legacy', result: loadLocalJpoJson(value, fileName) };
}

export function isBackendContractCandidate(value: unknown): boolean {
  if (!isObject(value)) return false;
  return BACKEND_ENVELOPE_SENTINELS.some((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
