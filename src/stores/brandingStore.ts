import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_APP_NAME = 'Orkesta';
export const DEFAULT_APP_TAGLINE = 'Tu asistente de ventas inteligente';

interface BrandingState {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  setBranding: (data: Partial<Pick<BrandingState, 'appName' | 'logoUrl' | 'faviconUrl'>>) => void;
  reset: () => void;
}

/**
 * Persists custom branding (app name, logo, favicon) in localStorage so it
 * applies immediately on first render — before any async Supabase fetch.
 * When the user changes branding in Settings, values here are the source of
 * truth for the UI; SettingsPage also writes them to Supabase
 * (branding_settings table) when connected so they sync across devices.
 */
export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      appName: DEFAULT_APP_NAME,
      logoUrl: null,
      faviconUrl: null,
      setBranding: (data) => set((prev) => ({ ...prev, ...data })),
      reset: () =>
        set({ appName: DEFAULT_APP_NAME, logoUrl: null, faviconUrl: null }),
    }),
    { name: 'branding-settings' }
  )
);
