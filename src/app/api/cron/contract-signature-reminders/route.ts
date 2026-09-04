import { NextRequest, NextResponse } from "next/server";
import { denyIfCronUnauthorized } from "@/lib/cronAuth";
import { processAutomaticContractSignatureReminders } from "@/services/contractSignatureReminderService";
import { delegateLegacyFollowUpAllTenants } from "@/lib/chaser/chaseLegacyDelegation";
import { shouldDelegateLegacyScannersToChaser } from "@/lib/chaser/chaseConfig";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
  if (shouldDelegateLegacyScannersToChaser()) {
    const delegated = await delegateLegacyFollowUpAllTenants('contract_signature_reminders');
    return NextResponse.json({ success: true, delegated: true, ...delegated });
  }
  return NextResponse.json({
    success: true,
    results: await processAutomaticContractSignatureReminders(),
  });
}
