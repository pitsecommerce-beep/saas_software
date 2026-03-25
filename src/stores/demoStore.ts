import { create } from 'zustand';

interface DemoState {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

/**
 * Controls whether pages show pre-loaded sample data.
 * Off by default so new teams start with a clean slate.
 */
export const useDemoStore = create<DemoState>((set) => ({
  isDemoMode: false,
  setDemoMode: (value) => set({ isDemoMode: value }),
}));
