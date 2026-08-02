import { createHash } from "node:crypto";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { callDeepSeek } from "@/lib/ai/deepseek";
import { ENV } from "@/config/env";

type IntelligenceJob = {
  id: string;
  tenant_id: string;
  document_id: string;
  job_type:
    | "ocr"
    | "extract"
    | "classify"
    | "summarize"
    | "compare"
    | "validate"
    | "obligations";
  attempt_count: number;
  max_attempts: number;
};

type Finding = {
  finding_type: string;
  label: string;
  value: unknown;
  page_number?: number | null;
  confidence?: number | null;
  source_excerpt?: string | null;
  requires_review?: boolean;
};

function lineDiff(left: string, right: string) {
  const leftLines = left
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rightLines = right
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const leftSet = new Set(leftLines);
  const rightSet = new Set(rightLines);
  return {
    additions: rightLines.filter((line) => !leftSet.has(line)),
    removals: leftLines.filter((line) => !rightSet.has(line)),
  };
}

async function compareLatestVersions(tenantId: string, documentId: string) {
  const db = createSupabaseAdminClient();
  const { data: versions, error } = await db
    .from("document_versions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(2);
  if (error) throw error;
  if (!versions || versions.length < 2)
    throw new Error(
      "At least two document versions are required for comparison",
    );
  const [right, left] = versions;
  const leftText = String(left.extracted_text || "");
  const rightText = String(right.extracted_text || "");
  if (!leftText || !rightText)
    throw new Error("Both versions need extracted text before comparison");
  const diff = lineDiff(leftText, rightText);
  const raw = await callDeepSeek(
    `Compare these document versions. Identify material changes and new legal/financial/operational risk. Return JSON only: {"summary":"...","changes":[],"risk_findings":[]}\n\nOLD:\n${leftText.slice(0, 40000)}\n\nNEW:\n${rightText.slice(0, 40000)}`,
    { model: "deepseek-chat", maxTokens: 2400, temperature: 0.1 },
  );
  const analysis = parseJsonObject(raw);
  const { data: comparison, error: comparisonError } = await db
    .from("document_comparisons")
    .insert({
      tenant_id: tenantId,
      document_id: documentId,
      left_version_id: left.id,
      right_version_id: right.id,
      summary:
        typeof analysis.summary === "string"
          ? analysis.summary
          : `${diff.additions.length} additions and ${diff.removals.length} removals`,
      additions: diff.additions.slice(0, 1000),
      removals: diff.removals.slice(0, 1000),
      changes: Array.isArray(analysis.changes) ? analysis.changes : [],
      risk_findings: Array.isArray(analysis.risk_findings)
        ? analysis.risk_findings
        : [],
    })
    .select("*")
    .single();
  if (comparisonError) throw comparisonError;
  return comparison;
}

async function createObligationTasks(
  tenantId: string,
  document: Record<string, unknown>,
  findings: Array<Finding & { id?: string }>,
) {
  const db = createSupabaseAdminClient();
  const created: string[] = [];
  for (const finding of findings.filter(
    (item) => item.finding_type === "obligation" && item.id,
  )) {
    const { count } = await db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .contains("metadata", { document_finding_id: finding.id });
    if (count) continue;
    const value =
      finding.value && typeof finding.value === "object"
        ? (finding.value as Record<string, unknown>)
        : {};
    const dueDate =
      typeof value.due_date === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(value.due_date)
        ? value.due_date
        : null;
    const owner = String(
      value.owner_user_id ||
        document.owner_user_id ||
        document.uploaded_by ||
        "",
    ).trim();
    if (!owner) continue;
    const { data: task, error } = await db
      .from("tasks")
      .insert({
        tenant_id: tenantId,
        title: finding.label,
        description:
          finding.source_excerpt ||
          `Obligation extracted from ${document.title || document.name || "document"}`,
        assigned_to: owner,
        created_by: owner,
        status: "todo",
        priority: finding.requires_review ? "high" : "medium",
        due_date: dueDate,
        metadata: {
          source: "document_intelligence",
          document_id: document.id,
          document_finding_id: finding.id,
          page_number: finding.page_number || null,
        },
      })
      .select("id")
      .single();
    if (!error && task) created.push(task.id);
  }
  return created;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch {
    return {};
  }
}

async function downloadDocument(
  document: Record<string, unknown>,
): Promise<Buffer> {
  const path = String(document.storage_path || "");
  if (!path) throw new Error("Document has no stored file");
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    if (!response.ok)
      throw new Error(`Document download failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  const db = createSupabaseAdminClient();
  for (const bucket of ["uploads", "documents", "files"]) {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (!error && data) return Buffer.from(await data.arrayBuffer());
  }
  throw new Error("Document could not be downloaded from storage");
}

async function extractPdf(
  buffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: { str?: string }) => item.str || "")
      .join(" ")
      .trim();
    pages.push(`[Page ${pageNumber}]\n${text}`);
  }
  return { text: pages.join("\n\n"), pageCount: pdf.numPages };
}

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`[Sheet: ${sheet.name}]`);
    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      lines.push(
        values
          .map((value: ExcelJS.CellValue) => String(value ?? ""))
          .join("\t"),
      );
    });
  });
  return lines.join("\n");
}

async function ocrImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (!ENV.OPENAI_API_KEY) throw new Error("OCR requires OPENAI_API_KEY");
  const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe every visible word in reading order. Preserve headings and tables. Return plain text only.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${buffer.toString("base64")}`,
            },
          },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

async function ocrScannedPdf(buffer: Buffer): Promise<string> {
  if (!ENV.OPENAI_API_KEY) throw new Error("Scanned PDF OCR requires OPENAI_API_KEY");
  const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: "gpt-4o",
    max_output_tokens: 8000,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: "scanned-document.pdf",
            file_data: buffer.toString("base64"),
            detail: "high",
          },
          {
            type: "input_text",
            text: "OCR every page of this scanned PDF. Preserve headings, tables, dates, totals, names, and signature text. Prefix each page with [Page N]. Return transcription only and do not summarize.",
          },
        ],
      },
    ],
  });
  const text = response.output_text.trim();
  if (!text) throw new Error("Scanned PDF OCR returned no text");
  return text;
}

async function extractContent(
  document: Record<string, unknown>,
): Promise<{ text: string; pageCount: number | null; hash: string }> {
  const buffer = await downloadDocument(document);
  const mime = String(document.mime_type || "").toLowerCase();
  const name = String(document.name || document.title || "").toLowerCase();
  let text = "";
  let pageCount: number | null = null;
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    const result = await extractPdf(buffer);
    text = result.text;
    pageCount = result.pageCount;
    const visibleCharacters = text
      .replace(/\[Page \d+\]/g, "")
      .replace(/\s+/g, "")
      .length;
    if (visibleCharacters < Math.max(20, result.pageCount * 8)) {
      text = await ocrScannedPdf(buffer);
    }
  } else if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (mime.includes("spreadsheetml") || name.endsWith(".xlsx")) {
    text = await extractSpreadsheet(buffer);
  } else if (mime.startsWith("image/")) {
    text = await ocrImage(buffer, mime || "image/png");
    pageCount = 1;
  } else if (
    mime.startsWith("text/") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt")
  ) {
    text = buffer.toString("utf8");
  } else {
    throw new Error(`Unsupported extraction format: ${mime || name}`);
  }
  return {
    text: text.trim(),
    pageCount,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function analyzeText(
  jobType: IntelligenceJob["job_type"],
  text: string,
): Promise<{ output: Record<string, unknown>; findings: Finding[] }> {
  if (!text.trim()) throw new Error("No extracted text is available");
  const clipped = text.slice(0, 80_000);
  const instruction =
    jobType === "summarize"
      ? 'Create a concise executive summary grounded only in the document. Cite supporting [Page N] markers in the summary, for example "Payment is due in 30 days [Page 4]." Also return each cited point as a finding. Return JSON: {"summary":"... [Page 1]","findings":[{"finding_type":"summary_citation","label":"Supporting point","value":{},"page_number":1,"confidence":0.9,"source_excerpt":"exact supporting excerpt","requires_review":false}]}'
      : jobType === "classify"
        ? 'Classify and organize the document. Return JSON only: {"document_type":"contract|invoice|receipt|proposal|identity|tax|financial|policy|correspondence|general_file","confidence":0.0,"suggested_name":"descriptive filename without extension","folder_path":"Clients/Client Name/Contracts or another concise hierarchy","findings":[]}. Never invent a client name not present in the document.'
        : jobType === "obligations"
          ? 'Extract obligations, owners, due dates, renewal dates, termination notice periods, totals, and signatures. Include page numbers whenever [Page N] markers support them. Return JSON: {"findings":[{"finding_type":"obligation","label":"...","value":{},"page_number":1,"confidence":0.9,"source_excerpt":"...","requires_review":false}]}'
          : 'Find missing fields, inconsistent dates/totals, expired terms, unsigned signature blocks, and legal or operational risks. Return JSON: {"findings":[{"finding_type":"risk","label":"...","value":{},"page_number":1,"confidence":0.9,"source_excerpt":"...","requires_review":true}]}';
  const raw = await callDeepSeek(`${instruction}\n\nDOCUMENT:\n${clipped}`, {
    model: "deepseek-chat",
    maxTokens: 2600,
    temperature: 0.1,
  });
  const output = parseJsonObject(raw);
  const findings = Array.isArray(output.findings)
    ? output.findings.filter((item): item is Finding =>
        Boolean(
          item &&
          typeof item === "object" &&
          "label" in item &&
          "finding_type" in item,
        ),
      )
    : [];
  return { output, findings };
}

export async function processDocumentIntelligenceJob(job: IntelligenceJob) {
  const db = createSupabaseAdminClient();
  const attempt = job.attempt_count + 1;
  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await db
    .from("document_intelligence_jobs")
    .update({
      status: "running",
      attempt_count: attempt,
      started_at: startedAt,
      updated_at: startedAt,
      error: null,
    })
    .eq("id", job.id)
    .eq("tenant_id", job.tenant_id)
    .in("status", ["queued", "retry_scheduled"])
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { jobId: job.id, skipped: true };
  try {
    const { data: document, error } = await db
      .from("documents")
      .select("*")
      .eq("tenant_id", job.tenant_id)
      .eq("id", job.document_id)
      .single();
    if (error) throw error;
    let text = String(document.extracted_text || "");
    let output: Record<string, unknown> = {};
    if (job.job_type === "ocr" || job.job_type === "extract") {
      const extracted = await extractContent(document);
      text = extracted.text;
      output = {
        characters: text.length,
        page_count: extracted.pageCount,
        content_hash: extracted.hash,
      };
      await db
        .from("documents")
        .update({
          extracted_text: text,
          page_count: extracted.pageCount,
          content_hash: extracted.hash,
          intelligence_status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", job.tenant_id)
        .eq("id", job.document_id);
      const { data: duplicate } = await db
        .from("documents")
        .select("id")
        .eq("tenant_id", job.tenant_id)
        .eq("content_hash", extracted.hash)
        .neq("id", job.document_id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (duplicate) {
        await db
          .from("documents")
          .update({ duplicate_of_document_id: duplicate.id })
          .eq("tenant_id", job.tenant_id)
          .eq("id", job.document_id);
        output.duplicate_of_document_id = duplicate.id;
      }
      const { data: existingVersion } = await db
        .from("document_versions")
        .select("id")
        .eq("tenant_id", job.tenant_id)
        .eq("document_id", job.document_id)
        .eq("content_hash", extracted.hash)
        .maybeSingle();
      if (!existingVersion) {
        const { data: latestVersion } = await db
          .from("document_versions")
          .select("version_number")
          .eq("tenant_id", job.tenant_id)
          .eq("document_id", job.document_id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        const versionNumber = Number(latestVersion?.version_number || 0) + 1;
        const supersededAt = new Date().toISOString();
        await db
          .from("document_versions")
          .update({ is_latest: false, superseded_at: supersededAt })
          .eq("tenant_id", job.tenant_id)
          .eq("document_id", job.document_id)
          .eq("is_latest", true);
        await db
          .from("document_versions")
          .insert({
            tenant_id: job.tenant_id,
            document_id: job.document_id,
            version_number: versionNumber,
            storage_path: document.storage_path || null,
            mime_type: document.mime_type || null,
            size_bytes: document.size_bytes || 0,
            content_hash: extracted.hash,
            extracted_text: text,
            created_by: document.uploaded_by || null,
            is_latest: true,
          });
        await db
          .from("documents")
          .update({
            latest_version_number: versionNumber,
            metadata: {
              ...((document.metadata as Record<string, unknown>) || {}),
              has_outdated_versions: versionNumber > 1,
              superseded_version_count: Math.max(0, versionNumber - 1),
            },
          })
          .eq("tenant_id", job.tenant_id)
          .eq("id", job.document_id);
      }
    } else if (job.job_type === "compare") {
      const comparison = await compareLatestVersions(
        job.tenant_id,
        job.document_id,
      );
      output = {
        comparison_id: comparison.id,
        summary: comparison.summary,
        additions: comparison.additions,
        removals: comparison.removals,
        changes: comparison.changes,
        risk_findings: comparison.risk_findings,
      };
    } else {
      if (!text) {
        const extracted = await extractContent(document);
        text = extracted.text;
        await db
          .from("documents")
          .update({
            extracted_text: text,
            page_count: extracted.pageCount,
            content_hash: extracted.hash,
          })
          .eq("tenant_id", job.tenant_id)
          .eq("id", job.document_id);
      }
      const analysis = await analyzeText(job.job_type, text);
      output = analysis.output;
      if (analysis.findings.length) {
        const { data: insertedFindings, error: findingError } = await db
          .from("document_findings")
          .insert(
            analysis.findings.map((finding) => ({
              tenant_id: job.tenant_id,
              document_id: job.document_id,
              finding_type: finding.finding_type,
              label: finding.label,
              value: finding.value ?? {},
              page_number: finding.page_number ?? null,
              confidence: finding.confidence ?? null,
              source_excerpt: finding.source_excerpt ?? null,
              requires_review: finding.requires_review ?? false,
            })),
          )
          .select("*");
        if (findingError) throw findingError;
        if (job.job_type === "obligations")
          output.created_task_ids = await createObligationTasks(
            job.tenant_id,
            document,
            insertedFindings || [],
          );
      }
      const updates: Record<string, unknown> = {
        intelligence_status: "processing",
        updated_at: new Date().toISOString(),
      };
      if (job.job_type === "summarize" && typeof output.summary === "string")
        updates.summary = output.summary;
      if (job.job_type === "classify") {
        updates.document_type = output.document_type;
        updates.classification_confidence = output.confidence;
        updates.auto_classified_at = new Date().toISOString();
        if (typeof output.folder_path === "string" && output.folder_path.trim())
          updates.folder_path = output.folder_path
            .trim()
            .replace(/\.{2,}|[\\]/g, "/")
            .slice(0, 500);
        if (
          typeof output.suggested_name === "string" &&
          output.suggested_name.trim()
        ) {
          const originalName = String(
            document.name || document.title || "document",
          );
          const extension = originalName.match(/\.[a-z0-9]{1,10}$/i)?.[0] || "";
          const cleanName = output.suggested_name
            .trim()
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .slice(0, Math.max(1, 280 - extension.length));
          updates.name = `${cleanName}${extension}`;
          updates.title = cleanName;
          updates.auto_named_at = new Date().toISOString();
        }
      }
      await db
        .from("documents")
        .update(updates)
        .eq("tenant_id", job.tenant_id)
        .eq("id", job.document_id);
    }
    const completedAt = new Date().toISOString();
    await db
      .from("document_intelligence_jobs")
      .update({
        status: "completed",
        output,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", job.id)
      .eq("tenant_id", job.tenant_id);
    const { count } = await db
      .from("document_intelligence_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", job.tenant_id)
      .eq("document_id", job.document_id)
      .in("status", ["queued", "running", "retry_scheduled"]);
    if (!count)
      await db
        .from("documents")
        .update({ intelligence_status: "completed", updated_at: completedAt })
        .eq("tenant_id", job.tenant_id)
        .eq("id", job.document_id);
    return { jobId: job.id, completed: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = attempt < job.max_attempts;
    const nextRetryAt = retry
      ? new Date(Date.now() + Math.min(60, 2 ** attempt) * 60_000).toISOString()
      : null;
    await db
      .from("document_intelligence_jobs")
      .update({
        status: retry ? "retry_scheduled" : "failed",
        error: message.slice(0, 4000),
        next_retry_at: nextRetryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("tenant_id", job.tenant_id);
    if (!retry)
      await db
        .from("documents")
        .update({
          intelligence_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", job.tenant_id)
        .eq("id", job.document_id);
    return { jobId: job.id, completed: false, retry, error: message };
  }
}

export async function processQueuedDocumentIntelligence(limit = 8) {
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("document_intelligence_jobs")
    .select("id, tenant_id, document_id, job_type, attempt_count, max_attempts")
    .in("status", ["queued", "retry_scheduled"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at")
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error) throw error;
  const results = [];
  for (const job of (data || []) as IntelligenceJob[])
    results.push(await processDocumentIntelligenceJob(job));
  return results;
}
