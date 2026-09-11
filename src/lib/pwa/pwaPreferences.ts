export type PwaPreferences = {
  bottomNavModuleIds: string[];
  pushEnabled: boolean;
};

const STORAGE_KEY = 'alphaclone_pwa_prefs_v1';
const PREF_EVENT = 'alphaclone-pwa-prefs-changed';

const DEFAULT_PREFS: PwaPreferences = {
  bottomNavModuleIds: ['home', 'crm', 'work', 'money', 'bonnie'],
  pushEnabled: true,
};

export function readPwaPreferences(): PwaPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PwaPreferences>;
    return {
      bottomNavModuleIds: Array.isArray(parsed.bottomNavModuleIds)
        ? parsed.bottomNavModuleIds.slice(0, 5)
        : DEFAULT_PREFS.bottomNavModuleIds,
      pushEnabled: parsed.pushEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePwaPreferences(prefs: PwaPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent(PREF_EVENT));
}

export function subscribePwaPreferences(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => listener();
  window.addEventListener(PREF_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(PREF_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
