/**
 * Aura Finance — Global Panel/Overlay State Store (Zustand)
 * ─────────────────────────────────────────────────────────────────
 * Exclusive-open: only one side panel (Goals, Settings, Budget) can be open at a time.
 * Prevents overlap and manages backdrop + z-index stacking.
 */

import { create } from 'zustand';

export type PanelType = 'goals' | 'settings' | 'budget' | 'bankConnect' | 'aiAdvisor' | null;

interface PanelState {
  activePanel: PanelType;
  openPanel: (panel: PanelType) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelType) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  activePanel: null,
  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),
  togglePanel: (panel) =>
    set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
}));
