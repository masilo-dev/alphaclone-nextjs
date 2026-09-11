import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendEmailServer } from "@/lib/email/sendEmailServer";
import { contractEmailTemplates } from "@/lib/email/contractEmailTemplates";
import { AppUrls } from "@/lib/urls";

export async function sendOrderedContractSignatureReminders(options: {
  tenantId: string;
  contractId: string;
  actorUserId?: string;
  force?: boolean;
}) {
  const db = createSupabaseAdminClient();
  const { data: contract, error } = await db
    .from("contracts")
    .select("id,tenant_id,title,type,status,lifecycle_status,created_by")
    .eq("tenant_id", options.tenantId)
    .eq("id", options.contractId)
    .maybeSingle();
  if (error) throw error;
  if (!contract) throw new Error("Contract not found");
  if (
    ["fully_signed", "signed", "active", "terminated"].includes(
      String(contract.lifecycle_status || contract.status),
    )
  )
    return { sent: 0, skipped: 0, complete: true };
  const { data: parties, error: partyError } = await db
    .from("contract_parties")
    .select("*")
    .eq("tenant_id", options.tenantId)
    .eq("contract_id", options.contractId)
    .eq("signature_required", true)
    .neq("signature_status", "signed")
    .order("signing_order");
  if (partyError) throw partyError;
  const pending = parties || [];
  if (!pending.length) return { sent: 0, skipped: 0, complete: true };
  const numbered = pending.filter((party) =>
    Number.isFinite(Number(party.signing_order)),
  );
  const firstOrder = numbered.length
    ? Math.min(...numbered.map((party) => Number(party.signing_order)))
    : null;
  const eligible =
    firstOrder === null
      ? pending
      : pending.filter((party) => Number(party.signing_order) === firstOrder);
  const { data: tenant } = await db
    .from("tenants")
    .select("name")
    .eq("id", options.tenantId)
    .maybeSingle();
  const workspaceName = tenant?.name || "AlphaClone Systems";
  let sent = 0;
  let skipped = 0;
  for (const party of eligible) {
    const email = String(party.party_snapshot?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }
    if (!options.force) {
      const since = new Date(Date.now() - 3 * 86400_000).toISOString();
      const { count } = await db
        .from("contract_signature_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", options.tenantId)
        .eq("contract_id", options.contractId)
        .eq("signer_email", email)
        .in("event_type", ["requested", "delivered"])
        .gte("occurred_at", since);
      if (count) {
        skipped += 1;
        continue;
      }
    }
    const now = new Date().toISOString();
    const { data: existingToken } = await db
      .from("contract_signing_tokens")
      .select("token,expires_at")
      .eq("tenant_id", options.tenantId)
      .eq("contract_id", options.contractId)
      .eq("signer_email", email)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const token = existingToken?.token || randomBytes(32).toString("hex");
    if (!existingToken) {
      const { error: tokenError } = await db
        .from("contract_signing_tokens")
        .insert({
          tenant_id: options.tenantId,
          contract_id: options.contractId,
          token,
          signer_email: email,
          signer_role: party.role || "client",
          expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
          created_by: options.actorUserId || contract.created_by || null,
          metadata: {
            source: "ordered_signature_reminder",
            party_id: party.id,
          },
        });
      if (tokenError) throw tokenError;
    }
    const signingUrl = AppUrls.signContract(token);
    const result = await sendEmailServer({
      tenantId: options.tenantId,
      to: email,
      subject: `Signature reminder: ${contract.title}`,
      html: contractEmailTemplates.signatureRequest({
        recipientEmail: email,
        tenantId: options.tenantId,
        contractTitle: contract.title,
        contractType: contract.type || "Agreement",
        signingUrl,
        workspaceName,
        customMessage:
          "Your signature is the next required step. Please review and sign using the secure link.",
      }),
      isPlatformNotification: true,
      skipFooter: true,
    });
    if (!result.success) {
      skipped += 1;
      continue;
    }
    sent += 1;
    await Promise.all([
      db
        .from("contract_parties")
        .update({ signature_status: "requested" })
        .eq("tenant_id", options.tenantId)
        .eq("id", party.id),
      db
        .from("contract_signature_events")
        .insert({
          tenant_id: options.tenantId,
          contract_id: options.contractId,
          party_id: party.id,
          event_type: "requested",
          signer_email: email,
          signing_order: party.signing_order || null,
          provider: "email",
          provider_event_id:
            result.emailId || `reminder:${party.id}:${Date.now()}`,
          evidence: {
            signing_url_created: true,
            token_reused: Boolean(existingToken),
            provider_accepted: true,
            delivery_verified: false,
          },
        }),
      db
        .from("contract_audit_trail")
        .insert({
          tenant_id: options.tenantId,
          contract_id: options.contractId,
          action: "signature_reminder_sent",
          actor_id: options.actorUserId || null,
          actor_role: options.actorUserId ? "user" : "system",
          actor_email: email,
          details: {
            party_id: party.id,
            signing_order: party.signing_order,
            provider_message_id: result.emailId || null,
          },
        }),
    ]);
  }
  return {
    sent,
    skipped,
    eligible: eligible.length,
    pending: pending.length,
    complete: false,
  };
}

export async function processAutomaticContractSignatureReminders(limit = 100) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("contracts")
    .select("id,tenant_id")
    .in("lifecycle_status", ["sent", "viewed", "negotiating"])
    .order("updated_at")
    .limit(limit);
  if (error) throw error;
  const results = [];
  for (const contract of data || [])
    results.push({
      contractId: contract.id,
      ...(await sendOrderedContractSignatureReminders({
        tenantId: contract.tenant_id,
        contractId: contract.id,
      })),
    });
  return results;
}
