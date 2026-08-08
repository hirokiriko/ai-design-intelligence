import { ALL_DESIGN_KINDS } from './labels';
import type { AnalysisPurpose, DesignKind } from './types';

export function resolveDesignKinds(
  purposes: AnalysisPurpose[],
  currentKinds: DesignKind[],
  manuallyChanged: boolean,
): DesignKind[] {
  if (manuallyChanged) return currentKinds;
  if (purposes.includes('ui_design')) return ['image'];
  return [...ALL_DESIGN_KINDS];
}
