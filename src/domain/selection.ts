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

export function getDesignKindSelectionStatus(manuallyChanged: boolean): string {
  return manuallyChanged
    ? '手動設定中です。分析目的を変更しても、現在の意匠種別を維持します。'
    : '自動設定中です。分析目的に合わせて意匠種別を設定し、必要なら手動で変更できます。';
}
