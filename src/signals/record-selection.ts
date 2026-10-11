import { createContext } from 'react';
import type { RunV23 } from './contract';

export const RecordSelectionContext = createContext<{ selectedId: string | null; select: (id: string) => void }>({ selectedId: null, select: () => undefined });

export function recordIdFromUrl(run: RunV23): string | null {
  const id = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('record');
  return run.signal?.recordFacts.some((fact) => fact.recordId === id) ? id : null;
}
