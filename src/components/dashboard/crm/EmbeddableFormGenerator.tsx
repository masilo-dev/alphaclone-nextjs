'use client';

import React, { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Code, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export function EmbeddableFormGenerator() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || 'YOUR_TENANT_ID';

  const embedCode = `<!-- AlphaClone Lead Capture Form -->
<form id="alphaclone-lead-form" style="max-width:400px;font-family:sans-serif;display:flex;flex-direction:column;gap:12px;">
  <input type="hidden" name="tenant_id" value="${tenantId}" />
  <input type="text" name="name" placeholder="Full Name" required style="padding:10px;border-radius:6px;border:1px solid #ccc;" />
  <input type="email" name="email" placeholder="Email Address" required style="padding:10px;border-radius:6px;border:1px solid #ccc;" />
  <input type="tel" name="phone" placeholder="Phone Number" style="padding:10px;border-radius:6px;border:1px solid #ccc;" />
  <input type="text" name="company" placeholder="Company Name" style="padding:10px;border-radius:6px;border:1px solid #ccc;" />
  <textarea name="message" placeholder="How can we help?" style="padding:10px;border-radius:6px;border:1px solid #ccc;"></textarea>
  <button type="submit" style="padding:12px;background:#0d9488;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
    Submit Inquiry
  </button>
</form>

<script>
document.getElementById('alphaclone-lead-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch('https://alphaclonesystems.com/api/leads/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert('Thank you! Your inquiry has been submitted.');
      e.target.reset();
    }
  } catch (err) {
    alert('Submission error. Please try again.');
  }
});
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success('Embed snippet copied to clipboard');
  };

  return (
    <div className="ac-workspace-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Globe size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Embeddable Lead Form Generator</h4>
            <p className="text-[11px] text-slate-400">Embed this HTML snippet on any external website</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors shadow-md shadow-teal-500/10"
        >
          <Copy size={13} /> Copy Snippet
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Copy and paste the HTML snippet below into your website, landing page, or WordPress site. Submissions stream instantly into your AlphaClone CRM leads board.
      </p>

      <div className="relative">
        <pre className="p-4 bg-slate-950 border border-white/10 rounded-xl text-[11px] text-teal-300 font-mono overflow-x-auto max-h-48">
          {embedCode}
        </pre>
      </div>
    </div>
  );
}
