const STORAGE_KEY = 'ac_user_learning_v1';

export type LeadLearningProfile = {
  industries: string[];
  locations: string[];
  lastUpdated: string;
};

export type SocialLearningProfile = {
  recentCaptions: string[];
  tones: string[];
  lastUpdated: string;
};

type StoredShape = {
  lead?: LeadLearningProfile;
  social?: SocialLearningProfile;
};

function readStore(): StoredShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredShape;
  } catch {
    return {};
  }
}

function writeStore(next: StoredShape) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

function pushUnique(arr: string[], value: string, max: number): string[] {
  const v = value.trim();
  if (!v) return arr;
  const next = [v, ...arr.filter((x) => x.toLowerCase() !== v.toLowerCase())];
  return next.slice(0, max);
}

export const userLearningPreferencesService = {
  recordLeadSearch(industry: string, location: string) {
    const cur = readStore();
    const lead = cur.lead || { industries: [], locations: [], lastUpdated: new Date().toISOString() };
    writeStore({
      ...cur,
      lead: {
        industries: pushUnique(lead.industries, industry, 12),
        locations: pushUnique(lead.locations, location, 12),
        lastUpdated: new Date().toISOString(),
      },
    });
  },

  recordSocialPost(caption: string, tone?: string) {
    const cur = readStore();
    const social = cur.social || { recentCaptions: [], tones: [], lastUpdated: new Date().toISOString() };
    const snippet = caption.trim().slice(0, 280);
    writeStore({
      ...cur,
      social: {
        recentCaptions: snippet ? pushUnique(social.recentCaptions, snippet, 20) : social.recentCaptions,
        tones: tone ? pushUnique(social.tones, tone, 8) : social.tones,
        lastUpdated: new Date().toISOString(),
      },
    });
  },

  getLeadHints(): LeadLearningProfile | null {
    return readStore().lead || null;
  },

  getSocialHints(): SocialLearningProfile | null {
    return readStore().social || null;
  },
};
