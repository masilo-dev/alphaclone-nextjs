import { NextRequest, NextResponse } from "next/server";
import { denyIfCronUnauthorized } from "@/lib/cronAuth";
import { processAutomaticContractSignatureReminders } from "@/services/contractSignatureReminderService";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    results: await processAutomaticContractSignatureReminders(),
  });
}
