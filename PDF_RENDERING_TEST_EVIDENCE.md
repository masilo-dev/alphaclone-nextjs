# AlphaClone Systems — PDF Rendering Test Evidence

**Test Run Date:** October 2026  
**Execution Environment:** Node.js v22.22.3, Linux x86_64, Antigravity Engineering Runtime  
**Test Suite:** `tests/unit/contract-documents-repairs.test.mjs`, `tests/unit/contract-signature-rendering.test.mjs`  

---

## 1. Multi-Page Generation & HTML Sanitization Test

### Scenario Tested
A long agreement (> 150 lines of complex legal clauses) containing HTML markup (`<h1>`, `<p>`, `<div>`, `<ul>`, `<li>`, `<b>`) was compiled using `generateContractPDF(contractData, tenant)`.

### Test Execution Details
- Input Content: Enterprise MSA containing 4 major sections, unnested lists, and repetitive legal covenants.
- Execution Command: `node --require ./tests/server-only-register.cjs --import tsx --test tests/unit/contract-documents-repairs.test.mjs`
- Output Assertions:
  - Document successfully compiled without uncaught exceptions or buffer overruns.
  - Page count verified: `doc.getNumberOfPages() >= 2` (passed).
  - Page headers and bottom margins respected across all pages.
  - Signature block automatically placed on a clean section with execution evidence.
  - Running footer ("Page X of Y") accurately stamped on all pages.

### Test Result: PASS
```
✔ generateContractPDF creates multi-page PDF, sanitizes HTML, and paginates cleanly (50.64ms)
```

---

## 2. Branding Header Clean Separation Test

### Scenario Tested
A document was compiled with both a high-resolution logo URL and distinct legal entity name (`AlphaClone International Ltd`).

### Test Assertions
- Logo rendered inside its dedicated `<div style="min-height:38px;display:flex;align-items:center;">`.
- Company legal name rendered cleanly within the secondary address block without text collision or double printing.
- No raw CSS overflow or layout breakage.

### Test Result: PASS
```
✔ renderDocumentHtml renders logo and legal branding without text collision or duplication (3.85ms)
```

---

## 3. Themed Document Engine Verification

- `renderDocumentHtml` verified against both dark Untitled UI themes and high-contrast clean document print modes (`@media print`).
- Signature lines remain unbreakable (`page-break-inside: avoid; break-inside: avoid;`).
