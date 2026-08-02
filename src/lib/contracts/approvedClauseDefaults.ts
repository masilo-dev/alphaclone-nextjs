export const approvedContractClauseDefaults = [
  {
    title: "Confidentiality",
    category: "confidentiality",
    risk_level: "low",
    variables: ["confidentiality_period"],
    body: "Each party must protect the other party’s Confidential Information using at least reasonable care, use it only to perform this agreement, and disclose it only to personnel bound by equivalent confidentiality duties. These obligations continue for {{confidentiality_period}} after termination.",
  },
  {
    title: "Limitation of liability",
    category: "liability",
    risk_level: "moderate",
    variables: ["liability_cap"],
    body: "Except for fraud, wilful misconduct, confidentiality breaches, intellectual-property infringement, and amounts that cannot legally be limited, each party’s aggregate liability is limited to {{liability_cap}}. Neither party is liable for indirect or consequential losses where exclusion is permitted by law.",
  },
  {
    title: "Termination for cause",
    category: "termination",
    risk_level: "low",
    variables: ["cure_period_days"],
    body: "Either party may terminate for a material breach that remains uncured for {{cure_period_days}} days after written notice. Termination does not affect accrued payment obligations, confidentiality, intellectual-property rights, or provisions intended to survive.",
  },
  {
    title: "Payment terms",
    category: "commercial",
    risk_level: "low",
    variables: ["payment_days", "late_interest"],
    body: "Undisputed invoices are payable within {{payment_days}} days of receipt. Overdue undisputed amounts may accrue interest at {{late_interest}}, subject to applicable law. The customer must identify a disputed amount and its reasons promptly.",
  },
  {
    title: "Intellectual property ownership",
    category: "intellectual_property",
    risk_level: "moderate",
    variables: ["deliverables_owner"],
    body: "Each party retains its pre-existing materials and know-how. On full payment, ownership of specifically commissioned deliverables transfers to {{deliverables_owner}}, excluding provider tools, templates, methods, and reusable components, for which a perpetual licence is granted as required to use the deliverables.",
  },
  {
    title: "Data protection",
    category: "privacy",
    risk_level: "moderate",
    variables: ["governing_privacy_law"],
    body: "Each party will comply with {{governing_privacy_law}} and other applicable privacy laws. Where the provider processes personal data for the customer, the parties will execute the required data-processing terms and maintain appropriate technical and organisational safeguards.",
  },
] as const;

export async function ensureApprovedContractClauseDefaults(
  admin: any,
  tenantId: string,
) {
  const rows = approvedContractClauseDefaults.map((item) => ({
    tenant_id: tenantId,
    ...item,
    version_number: 1,
    approval_status: "approved",
    language_code: "en",
    approved_at: new Date().toISOString(),
  }));
  const { error } = await admin
    .from("contract_clauses")
    .upsert(rows, {
      onConflict: "tenant_id,title,version_number",
      ignoreDuplicates: true,
    });
  if (error) throw error;
}
