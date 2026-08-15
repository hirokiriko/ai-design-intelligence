import type { AnalysisResult } from '../../domain/types';

export interface EvidenceSelection {
  result: AnalysisResult | null;
  label: string;
  ids: string[];
}

export interface EvidenceInteractionState {
  highlightedEvidenceId: string | null;
  selection: EvidenceSelection | null;
  expandedResult: AnalysisResult | null;
  restoreFocus: boolean;
}

export type EvidenceInteractionAction =
  | {
      type: 'select';
      result: AnalysisResult | null;
      label: string;
      ids: string[];
      highlightedId: string | null;
    }
  | { type: 'clear' }
  | { type: 'toggle_expanded'; result: AnalysisResult }
  | { type: 'focus_restored' };

export const INITIAL_EVIDENCE_INTERACTION_STATE: EvidenceInteractionState = {
  highlightedEvidenceId: null,
  selection: null,
  expandedResult: null,
  restoreFocus: false,
};

export function evidenceInteractionReducer(
  state: EvidenceInteractionState,
  action: EvidenceInteractionAction,
): EvidenceInteractionState {
  switch (action.type) {
    case 'select':
      return {
        highlightedEvidenceId: action.highlightedId,
        selection: { result: action.result, label: action.label, ids: [...new Set(action.ids)] },
        expandedResult: action.result,
        restoreFocus: false,
      };
    case 'clear':
      return { ...state, highlightedEvidenceId: null, selection: null, restoreFocus: true };
    case 'toggle_expanded':
      return { ...state, expandedResult: state.expandedResult === action.result ? null : action.result };
    case 'focus_restored':
      return { ...state, restoreFocus: false };
  }
}

export function focusEvidenceSection(
  section: Pick<HTMLElement, 'focus' | 'scrollIntoView'> | null,
  activeSelection: EvidenceSelection | null,
  restoreFocus: boolean,
): void {
  if (!activeSelection && !restoreFocus) return;
  section?.focus({ preventScroll: true });
  if (activeSelection) section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
