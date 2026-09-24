'use client';

import React from 'react';

export interface SignatureSigner {
  role: string;
  name: string;
  title?: string;
  email?: string;
  date?: string | Date;
  signed?: boolean;
  signatureUrl?: string;
}

export interface DocumentSignatureProps {
  signers: SignatureSigner[];
  title?: string;
  notes?: string;
  className?: string;
}

function formatDate(val?: string | Date): string | null {
  if (!val) return null;
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(val);
  }
}

export function DocumentSignature({
  signers,
  title = 'Authorized Signatures',
  notes,
  className = '',
}: DocumentSignatureProps) {
  if (!signers || signers.length === 0) return null;

  return (
    <div className={`doc-signature doc-avoid-break my-8 pt-6 border-t border-slate-200 ${className}`}>
      {title && (
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
          {title}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {signers.map((signer, idx) => (
          <div key={idx} className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {signer.role}
            </div>

            {/* Signature Area */}
            <div className="min-h-[64px] flex items-end border-b border-slate-300 pb-2">
              {signer.signatureUrl ? (
                <img
                  src={signer.signatureUrl}
                  alt={`Signature of ${signer.name}`}
                  className="max-h-14 max-w-[200px] object-contain"
                />
              ) : signer.signed ? (
                <div className="font-serif italic text-slate-800 text-lg">
                  {signer.name}
                  <span className="text-[10px] not-italic text-emerald-600 block font-sans">
                    ✓ Signed electronically
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-300 italic">Signature required</div>
              )}
            </div>

            {/* Signer Details */}
            <div className="text-xs text-slate-700 space-y-0.5">
              <div className="font-semibold text-slate-900">{signer.name}</div>
              {signer.title && <div className="text-slate-500">{signer.title}</div>}
              {signer.email && <div className="text-slate-500">{signer.email}</div>}
              {signer.date && (
                <div className="text-slate-400">Date: {formatDate(signer.date)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {notes && (
        <p className="text-xs text-slate-400 mt-6 leading-relaxed italic">{notes}</p>
      )}
    </div>
  );
}
