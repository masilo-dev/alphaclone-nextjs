import { createBrowserClient } from '@supabase/ssr';
import { ENV } from '@/config/env';
import { createUnavailableSupabaseClient } from './supabase-shared';

const isPlaceholder = (val?: string) => !val || val === 'undefined' || val.includes('placeholder');

export const createSupabaseBrowserClient = () => {
  if (isPlaceholder(ENV.NEXT_PUBLIC_SUPABASE_URL) || isPlaceholder(ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return createUnavailableSupabaseClient('SupabaseBrowser');
  }

  return createBrowserClient(
    ENV.NEXT_PUBLIC_SUPABASE_URL!,
    ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};
