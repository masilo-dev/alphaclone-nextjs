'use client';

import { AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function DevSetupBanner() {
    if (process.env.NODE_ENV === 'production' || isSupabaseConfigured()) {
        return null;
    }

    return (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
            <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-1 text-xs text-amber-100/90">
                    <p className="font-semibold text-amber-300">Local setup required</p>
                    <p>
                        Supabase credentials are missing. Copy <code className="text-amber-200">.env.example</code> to{' '}
                        <code className="text-amber-200">.env.local</code>, add your project URL and anon key from the
                        Supabase dashboard, then restart the dev server.
                    </p>
                    <p className="text-amber-200/80">
                        See <code>QUICK_START.md</code> for the full setup guide.
                    </p>
                </div>
            </div>
        </div>
    );
}
