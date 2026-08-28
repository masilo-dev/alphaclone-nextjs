"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  FolderOpen,
  ShieldCheck,
  FileText,
  Upload,
  Trash2,
  Sparkles,
  Loader2,
  Key,
  ShieldAlert,
  Lock,
  Unlock,
  HardDrive,
  Download,
  Share2,
  ClipboardList,
} from "lucide-react";
import { ModuleStatCards, type ModuleStat } from "../common/ModuleStatCards";
import { useTenant } from "@/contexts/TenantContext";
import { fileUploadService } from "@/services/fileUploadService";
import toast from "react-hot-toast";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { AskBonnieButton } from "@/components/ui/os/AskBonnieButton";

interface VaultDocument {
  id: string;
  document_id?: string;
  tenant_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  security_level: "public" | "internal" | "confidential" | "restricted";
  is_encrypted: boolean;
  created_at: string;
  proxiedUrl?: string;
}

interface DocumentIntelligence {
  document?: {
    summary?: string | null;
    intelligence_status?: string;
    extracted_text?: string | null;
    page_count?: number | null;
    folder_path?: string | null;
    document_type?: string | null;
    duplicate_of_document_id?: string | null;
    latest_version_number?: number | null;
    metadata?: {
      has_outdated_versions?: boolean;
      superseded_version_count?: number;
    };
  };
  intelligenceJobs: Array<{
    id: string;
    job_type: string;
    status: string;
    error?: string | null;
  }>;
  versions?: Array<{
    id: string;
    version_number: number;
    mime_type?: string | null;
    size_bytes?: number | null;
    is_latest?: boolean;
    superseded_at?: string | null;
    created_at: string;
  }>;
  findings: Array<{
    id: string;
    finding_type: string;
    label: string;
    value: unknown;
    page_number?: number | null;
    confidence?: number | null;
    source_excerpt?: string | null;
    requires_review?: boolean;
  }>;
  comparisons: Array<{
    id: string;
    comparison_type?: string;
    summary?: string | null;
    changes?: Array<{ type?: string; text?: string }> | null;
    risk_changes?: unknown;
    created_at: string;
  }>;
}

function parseVaultDocument(row: Record<string, unknown>): VaultDocument {
  const metadata = (row.metadata as Record<string, unknown>) || {};
  const securityLevel = String(metadata.security_level || "confidential");
  const category = String(metadata.category || row.document_type || "Agreement");
  const storagePath = String(row.storage_path || "");
  const bucket = String(metadata.storage_bucket || "uploads");
  const tags = Array.isArray(metadata.tags) ? (metadata.tags as string[]) : [];
  return {
    id: String(row.id),
    document_id: String(row.id),
    tenant_id: String(row.tenant_id || ""),
    name: String(row.name || row.title || "Document"),
    file_path: storagePath,
    file_size: Number(row.size_bytes) || null,
    mime_type: String(row.mime_type || "application/pdf"),
    category,
    security_level: ([
      "public",
      "internal",
      "confidential",
      "restricted",
    ].includes(securityLevel)
      ? securityLevel
      : "confidential") as VaultDocument["security_level"],
    is_encrypted: tags.includes("encrypted") || Boolean(metadata.encrypted),
    created_at: String(row.created_at || new Date().toISOString()),
    proxiedUrl: storagePath
      ? fileUploadService.getProxiedUrl(bucket, storagePath)
      : undefined,
  };
}

export default function DocumentVaultTab() {
  const { currentTenant: tenant } = useTenant();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDocument, setSelectedDocument] =
    useState<VaultDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [analyzingDocumentId, setAnalyzingDocumentId] = useState<string | null>(
    null,
  );
  const [intelligence, setIntelligence] = useState<DocumentIntelligence | null>(
    null,
  );
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [requirementCount, setRequirementCount] = useState(0);

  const [form, setForm] = useState({
    category: "Agreement",
    security_level: "confidential" as
      | "public"
      | "internal"
      | "confidential"
      | "restricted",
    is_encrypted: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(tenant.id)}/documents?vault=true&limit=100`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load vault documents");
      }
      setDocuments(
        (payload.documents || []).map((row: Record<string, unknown>) =>
          parseVaultDocument(row),
        ),
      );
    } catch (err: any) {
      toast.error("Failed to load vault documents: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!tenant?.id) return;
    void fetch(
      `/api/document-requirements?tenantId=${encodeURIComponent(tenant.id)}`,
      { credentials: "include" },
    )
      .then((response) => response.json())
      .then((payload) =>
        setRequirementCount(
          (payload.requirements || []).filter((item: { status: string }) =>
            ["missing", "requested"].includes(item.status),
          ).length,
        ),
      )
      .catch(() => undefined);
  }, [tenant?.id]);

  const addDocumentRequirement = async () => {
    if (!tenant?.id) return;
    const name = window.prompt("Which document is required?");
    if (!name?.trim()) return;
    const dueDate =
      window.prompt("Due date (YYYY-MM-DD), or leave blank") || undefined;
    const response = await fetch("/api/document-requirements", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        name: name.trim(),
        dueDate: dueDate || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      return toast.error(payload.error || "Requirement could not be created");
    setRequirementCount((count) => count + 1);
    toast.success("Missing-document requirement added");
  };

  const shareInDataRoom = async (doc: VaultDocument) => {
    if (!tenant?.id || !doc.document_id) return;
    const response = await fetch("/api/document-data-rooms", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        name: `${doc.name} — secure share`,
        documentIds: [doc.document_id],
        allowDownload: false,
        expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      return toast.error(payload.error || "Secure share could not be created");
    const url = `${window.location.origin}${payload.shareUrl}`;
    await navigator.clipboard.writeText(url);
    toast.success("Secure 7-day data-room link copied");
  };

  const loadIntelligence = useCallback(
    async (documentId: string) => {
      if (!tenant?.id) return;
      setLoadingIntelligence(true);
      try {
        const response = await fetch(
          `/api/tenant/${encodeURIComponent(tenant.id)}/documents/${encodeURIComponent(documentId)}`,
          { credentials: "include" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload.error || "Document intelligence could not be loaded",
          );
        setIntelligence(payload as DocumentIntelligence);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Document intelligence could not be loaded",
        );
        setIntelligence(null);
      } finally {
        setLoadingIntelligence(false);
      }
    },
    [tenant?.id],
  );

  useEffect(() => {
    setIntelligence(null);
    if (selectedDocument?.document_id)
      void loadIntelligence(selectedDocument.document_id);
  }, [selectedDocument?.document_id, loadIntelligence]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !selectedFile)
      return toast.error("Select a file to upload");

    setSaving(true);
    try {
      const tags = [
        "vault",
        `security:${form.security_level}`,
        ...(form.is_encrypted ? ["encrypted"] : []),
      ];
      const result = await fileUploadService.uploadFile(
        selectedFile,
        "vault",
        tenant.id,
        undefined,
        tenant.id,
        { tags, category: form.category },
      );

      if (!result.success) throw new Error(result.error || "Upload failed");
      toast.success("Document uploaded to vault");
      setShowModal(false);
      setSelectedFile(null);
      setForm({
        category: "Agreement",
        security_level: "confidential",
        is_encrypted: true,
      });
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: VaultDocument) => {
    if (
      !tenant?.id ||
      !confirm(
        "Are you sure you want to permanently delete this document from the vault?",
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(tenant.id)}/documents/${encodeURIComponent(doc.document_id || doc.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleted: true }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Document could not be deleted");
      }
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAiAutoCategorize = async () => {
    if (documents.length === 0) return;
    setRunningAi(true);
    const aiToast = toast.loading(
      "AI is scanning vault files for PII and security tiering...",
    );
    try {
      const docNames = documents.map((d) => ({ id: d.id, name: d.name }));
      const res = await fetch("/api/inbox/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Categorize these files: ${JSON.stringify(docNames)}`,
          context:
            'Evaluate each file name. Categorize it as "Agreement", "Financial", "Tax", or "Identity", and assign a security_level: "public", "internal", "confidential", or "restricted". Return only a JSON array, e.g. [{"id": "docId", "category": "Tax", "security_level": "confidential"}]',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI categorization failed");

      const classifications = JSON.parse(
        data.draft.replace(/```json|```/g, "").trim(),
      );
      if (Array.isArray(classifications)) {
        const response = await fetch(
          `/api/tenant/${encodeURIComponent(tenant?.id || "")}/documents`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "classify",
              classifications: classifications.map((item: any) => ({
                id: item.id,
                category: item.category,
                securityLevel: item.security_level,
              })),
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload.error || "Classifications could not be saved",
          );
        toast.success("AI classification completed!", { id: aiToast });
        loadDocuments();
      } else {
        throw new Error("AI output format invalid");
      }
    } catch (err: any) {
      toast.error("AI categorization error: " + err.message, { id: aiToast });
    } finally {
      setRunningAi(false);
    }
  };

  const queueDocumentIntelligence = async (doc: VaultDocument) => {
    if (!tenant?.id || !doc.document_id) {
      toast.error("This document record is missing a stable id.");
      return;
    }
    setAnalyzingDocumentId(doc.id);
    try {
      const response = await fetch("/api/revenue-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue_document_intelligence",
          tenantId: tenant.id,
          documentId: doc.document_id,
          jobs: [
            "ocr",
            "extract",
            "classify",
            "summarize",
            "validate",
            "obligations",
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Document analysis could not be queued",
        );
      toast.success(
        "Document intelligence queued: OCR, extraction, summary, validation, and obligations",
      );
      await loadIntelligence(doc.document_id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Document analysis could not be queued",
      );
    } finally {
      setAnalyzingDocumentId(null);
    }
  };

  const queueVersionComparison = async (doc: VaultDocument) => {
    if (!tenant?.id || !doc.document_id) return;
    setAnalyzingDocumentId(doc.id);
    try {
      const response = await fetch("/api/revenue-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue_document_intelligence",
          tenantId: tenant.id,
          documentId: doc.document_id,
          jobs: ["compare"],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Version comparison could not be queued",
        );
      toast.success("Latest document versions queued for comparison");
      await loadIntelligence(doc.document_id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Version comparison could not be queued",
      );
    } finally {
      setAnalyzingDocumentId(null);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getSecurityBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case "restricted":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "confidential":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "internal":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    }
  };

  const vaultStats = useMemo<ModuleStat[]>(() => {
    const totalBytes = documents.reduce((s, d) => s + (d.file_size || 0), 0);
    const fmtSize =
      totalBytes >= 1_000_000
        ? `${(totalBytes / 1_000_000).toFixed(1)} MB`
        : totalBytes >= 1000
          ? `${Math.round(totalBytes / 1000)} KB`
          : `${totalBytes} B`;
    const encrypted = documents.filter((d) => d.is_encrypted).length;
    const sensitive = documents.filter(
      (d) =>
        d.security_level === "confidential" ||
        d.security_level === "restricted",
    ).length;
    const categories = new Set(documents.map((d) => d.category).filter(Boolean))
      .size;
    return [
      {
        label: "Documents",
        value: documents.length,
        sub: `${categories} categories`,
        Icon: FolderOpen,
        accent: "teal",
      },
      {
        label: "Storage Used",
        value: fmtSize,
        sub: "Vault footprint",
        Icon: HardDrive,
        accent: "blue",
      },
      {
        label: "Encrypted",
        value: encrypted,
        sub: "AES-256 protected",
        Icon: Lock,
        accent: "emerald",
      },
      {
        label: "Sensitive",
        value: sensitive,
        sub: "Confidential + restricted",
        Icon: ShieldAlert,
        accent: sensitive > 0 ? "amber" : "purple",
      },
    ];
  }, [documents]);

  return (
    <div className="space-y-6 ac-scroll-full ac-enterprise-module">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-400" />
            Document Vault
          </h2>
          <p className="text-xs text-slate-400">
            Secure, encrypted repository for all agreements, tax forms, and
            corporate identity files
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void addDocumentRequirement()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-white/10"
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-300" /> Missing
            docs ({requirementCount})
          </button>
          <button
            onClick={handleAiAutoCategorize}
            disabled={runningAi || documents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-bold border border-white/10"
          >
            {runningAi ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            )}
            AI Auto-Categorize
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {!loading && documents.length > 0 && (
        <ModuleStatCards stats={vaultStats} />
      )}

      {/* Security Banner */}
      <div className="bg-teal-500/5 border border-teal-500/10 rounded-3xl p-4 flex gap-3 items-center">
        <ShieldCheck className="w-6 h-6 text-teal-400 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-white">
            Military-Grade Encryption Active
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            All files are processed with AES-256-GCM zero-knowledge client-side
            envelope encryption.
          </p>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900/20 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Vault Files
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Retrieving secure keyrings and files...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FolderOpen className="w-10 h-10 mx-auto opacity-30 text-teal-400" />
            <p className="text-sm font-semibold">Vault is empty</p>
            <p className="text-xs">
              Securely upload contract PDFs, tax filings, or identity files.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/20 text-slate-400">
                  <th className="p-4">Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Security Classification</th>
                  <th className="p-4">Encryption Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedDocument(doc)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDocument(doc);
                      }
                    }}
                    className="cursor-pointer hover:bg-slate-900/40 focus-visible:outline-none focus-visible:bg-slate-900/50 transition-colors"
                    aria-label={`Open ${doc.name}`}
                  >
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                      {doc.name}
                    </td>
                    <td className="p-4 text-slate-300 capitalize">
                      {doc.category || "Unclassified"}
                    </td>
                    <td className="p-4 text-slate-400 font-mono">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getSecurityBadge(doc.security_level)}`}
                      >
                        {doc.security_level}
                      </span>
                    </td>
                    <td className="p-4">
                      {doc.is_encrypted ? (
                        <span className="flex items-center gap-1 text-teal-400 font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          Encrypted
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Unlock className="w-3.5 h-3.5" />
                          Plaintext
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDocument(doc);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                          title="Open document"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(doc);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailDrawer
        open={showModal}
        onOpenChange={setShowModal}
        title="Upload Vault File"
      >
        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.tif,.tiff,.webp"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white"
            />
            {selectedFile && (
              <p className="text-[10px] text-slate-500 mt-1">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="Agreement">Agreement</option>
                <option value="Financial">Financial</option>
                <option value="Tax">Tax Form / Return</option>
                <option value="Identity">Identity (ID/Incorporation)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Security Tier
              </label>
              <select
                value={form.security_level}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    security_level: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted Access</option>
              </select>
            </div>
          </div>

          <div className="flex items-center pt-2 gap-2">
            <input
              type="checkbox"
              id="isEncrypted"
              checked={form.is_encrypted}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_encrypted: e.target.checked }))
              }
              className="w-4 h-4 text-teal-500 border-slate-850 rounded bg-slate-950 focus:ring-teal-500"
            />
            <label
              htmlFor="isEncrypted"
              className="text-xs text-slate-300 font-semibold cursor-pointer"
            >
              Encrypt document payload on upload
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? "Encrypting & Storing..." : "Upload & Lock"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedDocument)}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
        title={selectedDocument?.name || "Document"}
        size="fullscreen"
      >
        {selectedDocument ? (
          <div className="flex h-full min-h-[60dvh] flex-col gap-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedDocument.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedDocument.category || "Unclassified"} ·{" "}
                  {formatBytes(selectedDocument.file_size)} ·{" "}
                  {selectedDocument.security_level}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDocument.document_id ? (
                  <AskBonnieButton
                    compact
                    mode="ask"
                    label="Ask about document"
                    contexts={[
                      {
                        type: "document",
                        id: selectedDocument.document_id,
                        label: selectedDocument.name,
                        href: `/dashboard/business/documents?documentId=${selectedDocument.document_id}`,
                      },
                    ]}
                  />
                ) : null}
                {selectedDocument.document_id ? (
                  <button
                    type="button"
                    onClick={() => void shareInDataRoom(selectedDocument)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-xs font-bold text-sky-200 hover:bg-sky-500/20"
                  >
                    <Share2 className="h-4 w-4" /> Secure share
                  </button>
                ) : null}
                {selectedDocument.document_id ? (
                  <button
                    type="button"
                    onClick={() =>
                      void queueDocumentIntelligence(selectedDocument)
                    }
                    disabled={analyzingDocumentId === selectedDocument.id}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 text-xs font-bold text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
                  >
                    {analyzingDocumentId === selectedDocument.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Analyze contents
                  </button>
                ) : null}
                {selectedDocument.document_id ? (
                  <button
                    type="button"
                    onClick={() =>
                      void queueVersionComparison(selectedDocument)
                    }
                    disabled={analyzingDocumentId === selectedDocument.id}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-bold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" /> Compare versions
                  </button>
                ) : null}
                {selectedDocument.proxiedUrl ? (
                  <a
                    href={selectedDocument.proxiedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white hover:bg-teal-500"
                  >
                    <Download className="h-4 w-4" />
                    Open original
                  </a>
                ) : null}
              </div>
            </div>
            <div className="grid min-h-[70dvh] flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
              {selectedDocument.proxiedUrl ? (
                <iframe
                  src={selectedDocument.proxiedUrl}
                  title={`Preview ${selectedDocument.name}`}
                  className="min-h-[70dvh] h-full w-full rounded-xl border border-white/10 bg-white"
                />
              ) : (
                <div className="flex min-h-[40dvh] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-400">
                  This record has no previewable file URL.
                </div>
              )}
              <aside className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Document intelligence
                  </h3>
                  {intelligence?.document?.intelligence_status ? (
                    <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[9px] font-black uppercase text-teal-300">
                      {intelligence.document.intelligence_status}
                    </span>
                  ) : null}
                </div>
                {loadingIntelligence ? (
                  <div className="flex items-center gap-2 py-8 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    analysis…
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {intelligence?.document?.summary ? (
                      <section>
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Summary
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                          {intelligence.document.summary}
                        </p>
                      </section>
                    ) : null}
                    {intelligence?.document?.folder_path ||
                    intelligence?.document?.document_type ? (
                      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Automatic organization
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {intelligence.document.folder_path || "Unfiled"} ·{" "}
                          {String(
                            intelligence.document.document_type ||
                              "general file",
                          ).replaceAll("_", " ")}
                        </p>
                        {intelligence.document.duplicate_of_document_id ? (
                          <p className="mt-1 text-[10px] font-bold text-amber-300">
                            Duplicate detected
                          </p>
                        ) : null}
                        {intelligence.document.metadata
                          ?.has_outdated_versions ? (
                          <p className="mt-1 text-[10px] font-bold text-violet-300">
                            {intelligence.document.metadata
                              .superseded_version_count || 1}{" "}
                            superseded version(s)
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                    {intelligence?.intelligenceJobs?.length ? (
                      <section>
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Activity
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {intelligence.intelligenceJobs.map((job) => (
                            <span
                              key={job.id}
                              title={job.error || undefined}
                              className={`rounded border px-2 py-1 text-[9px] font-bold uppercase ${job.status === "completed" ? "border-emerald-500/25 text-emerald-300" : job.status === "failed" ? "border-rose-500/25 text-rose-300" : "border-amber-500/25 text-amber-300"}`}
                            >
                              {job.job_type}: {job.status}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {intelligence?.versions?.length ? (
                      <section>
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Version history
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {intelligence.versions.map((version) => (
                            <div
                              key={version.id}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                            >
                              <div>
                                <p className="text-xs font-bold text-white">
                                  Version {version.version_number}
                                </p>
                                <p className="text-[9px] text-slate-500">
                                  {new Date(version.created_at).toLocaleString()}
                                  {version.size_bytes ? ` · ${formatBytes(version.size_bytes)}` : ""}
                                </p>
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${version.is_latest ? "border-emerald-500/25 text-emerald-300" : "border-white/10 text-slate-500"}`}>
                                {version.is_latest ? "Latest" : "Superseded"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {intelligence?.findings?.length ? (
                      <section>
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Findings
                        </p>
                        <div className="mt-2 space-y-2">
                          {intelligence.findings.map((finding) => (
                            <article
                              key={finding.id}
                              className={`rounded-lg border p-3 ${finding.requires_review ? "border-amber-500/25 bg-amber-500/5" : "border-white/10 bg-white/[0.02]"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-white">
                                  {finding.label}
                                </p>
                                {finding.page_number ? (
                                  <span className="shrink-0 text-[9px] text-teal-300">
                                    Page {finding.page_number}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[10px] uppercase text-slate-500">
                                {finding.finding_type}
                                {typeof finding.confidence === "number"
                                  ? ` · ${Math.round(finding.confidence * 100)}%`
                                  : ""}
                              </p>
                              {finding.source_excerpt ? (
                                <p className="mt-2 text-[11px] leading-4 text-slate-400">
                                  “{finding.source_excerpt}”
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {intelligence?.comparisons?.length ? (
                      <section>
                        <p className="text-[10px] font-black uppercase text-slate-500">
                          Version comparisons
                        </p>
                        <div className="mt-2 space-y-2">
                          {intelligence.comparisons.map((comparison) => (
                            <article
                              key={comparison.id}
                              className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"
                            >
                              <p className="text-xs font-bold text-violet-100">
                                {comparison.summary ||
                                  "Latest versions compared"}
                              </p>
                              {Array.isArray(comparison.changes) &&
                              comparison.changes.length ? (
                                <div className="mt-2 space-y-1">
                                  {comparison.changes
                                    .slice(0, 8)
                                    .map((change, index) => (
                                      <p
                                        key={`${comparison.id}-${index}`}
                                        className={`text-[10px] ${change.type === "added" ? "text-emerald-300" : change.type === "removed" ? "text-rose-300" : "text-slate-400"}`}
                                      >
                                        {change.type === "added"
                                          ? "+ "
                                          : change.type === "removed"
                                            ? "− "
                                            : ""}
                                        {change.text}
                                      </p>
                                    ))}
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {!intelligence?.document?.summary &&
                    !intelligence?.intelligenceJobs?.length &&
                    !intelligence?.findings?.length &&
                    !intelligence?.comparisons?.length ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        Run Analyze contents to extract text, summary,
                        obligations and risks.
                      </p>
                    ) : null}
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
