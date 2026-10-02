/**
 * Backfill script for 20 leads researched on 2026-10-02.
 * Extracts fit scores, differentiates business websites from directory URLs,
 * sets structured metadata.research, and preserves strict non-outreach guarantee.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DIRECTORY_DOMAINS = [
  'servicemeonline.com',
  'afronex.com',
  'evepla.com',
  'foodbevg.com',
  'facebook.com',
  'yellowpages.co.za',
  'cylex.net.za',
  'brabys.com',
];

function isDirectoryUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return DIRECTORY_DOMAINS.some((d) => host.includes(d));
  } catch {
    return false;
  }
}

async function main() {
  console.log('Fetching leads created today (>= 2026-10-02T00:00:00Z)...');

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, business_name, email, phone, website, score, stage, status, source, notes, metadata, created_at')
    .gte('created_at', '2026-10-02T00:00:00Z')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error.message);
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log('No leads found for today.');
    return;
  }

  console.log(`Found ${leads.length} leads. Beginning structured backfill...`);

  let updatedCount = 0;
  for (const lead of leads) {
    const notes = String(lead.notes || '');

    // 1. Extract fit score
    const scoreMatch = notes.match(/Fit score (\d+)\/100/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : lead.score || 0;

    // 2. Extract evidence/source URL
    const evMatch = notes.match(/Evidence\/source:\s*(\S+)/i);
    const evidenceUrl = evMatch ? evMatch[1].trim() : null;

    // 3. Separate business website from directory URL
    let website: string | null = null;
    let websiteStatus: 'confirmed' | 'not_found' = 'not_found';
    let directoryUrl: string | null = null;

    if (evidenceUrl) {
      const isDir = isDirectoryUrl(evidenceUrl) || /independent website not confirmed/i.test(notes);
      if (isDir) {
        website = null;
        websiteStatus = 'not_found';
        directoryUrl = evidenceUrl;
      } else {
        website = evidenceUrl;
        websiteStatus = 'confirmed';
        directoryUrl = null;
      }
    }

    // 4. Construct structured research metadata
    const prevMetadata = (lead.metadata as Record<string, unknown>) || {};
    const researchMeta = {
      qualification_state: 'research_qualified',
      fit_score: score,
      evidence_source_url: evidenceUrl,
      website_status: websiteStatus,
      directory_url: directoryUrl,
      business_website: website,
      research_date: '2026-10-02',
      research_method: 'chatgpt_public_web_research',
      email_verification_state: 'publicly_listed_deliverability_unverified',
      outreach_sent: false,
      unsolicited_outreach_suppressed: true,
      last_backfill_at: new Date().toISOString(),
    };

    const newMetadata = {
      ...prevMetadata,
      research: researchMeta,
    };

    // 5. Update lead record in Supabase
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        intelligence_score: score,
        website,
        source_details: evidenceUrl,
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error(`Failed to update ${lead.business_name} (${lead.id}):`, updateError.message);
    } else {
      updatedCount++;
      console.log(`[OK] ${lead.business_name}: score=${score}, website=${website || 'null (directory: ' + directoryUrl + ')'}`);
    }
  }

  console.log(`\nBackfill complete! Updated ${updatedCount}/${leads.length} records.`);
}

main().catch((err) => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
