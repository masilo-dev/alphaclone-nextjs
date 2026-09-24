'use client';

import React from 'react';

const PRINT_CSS = `
  @page {
    size: A4;
    margin: 15mm 12mm;
  }
  @page {
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #64748b;
    }
  }
  @media print {
    html, body {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #0f172a !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .no-print,
    nav,
    aside,
    button:not(.doc-print-allow),
    .toast-container {
      display: none !important;
    }
    .doc-page-container {
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      border-radius: 0 !important;
    }
    .doc-avoid-break,
    .doc-table-row,
    .doc-signature,
    .doc-totals,
    .doc-section,
    .doc-header,
    .doc-party-info {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .doc-table thead {
      display: table-header-group !important;
    }
    .doc-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    a {
      text-decoration: none !important;
      color: inherit !important;
    }
  }
`;

/**
 * Standard CSS rules for clean, professional paper printing and PDF conversion.
 * Ensures white background, avoided page breaks inside sensitive blocks,
 * and hides non-printable UI controls.
 */
export function DocumentPrintStyles() {
  return (
    <style
      id="alpha-document-print-styles"
      dangerouslySetInnerHTML={{ __html: PRINT_CSS }}
    />
  );
}
