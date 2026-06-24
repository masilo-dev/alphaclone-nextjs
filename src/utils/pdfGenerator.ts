import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, QuoteItem } from '../services/quoteService';
import { Tenant } from '../services/tenancy/types';

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r || 0, g || 0, b || 0];
}

export const generateQuotePDF = (quote: Quote, items: QuoteItem[], tenant: Tenant) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const brandColor = tenant?.brand_color_primary || '#0f172a';
    const accentColor = tenant?.brand_color_secondary || '#14b8a6';

    // --- Header ---
    const logoUrl = tenant?.logo_url && typeof tenant.logo_url === 'string' ? tenant.logo_url.trim() : '';

    if (logoUrl) {
        // Simple image add attempt - might need pre-fetching in real app due to async issues in synchronous jspdf flow
        // For now, we assume it works or falls back. In a robust app, we'd load the image to base64 first.
        try {
            doc.addImage(logoUrl, 'PNG', 20, 15, 30, 30, undefined, 'FAST');
        } catch (e) {
            console.warn("Could not load logo", e);
            doc.setFontSize(24);
            doc.setTextColor(brandColor);
            doc.text(tenant?.legal_name || tenant?.name || 'AlphaClone', 20, 25);
        }
    } else {
        doc.setFontSize(24);
        doc.setTextColor(brandColor);
        doc.text(tenant?.legal_name || tenant?.name || 'AlphaClone', 20, 25);
    }

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTE', pageWidth - 20, 16, { align: 'right' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${quote.quoteNumber}`, pageWidth - 20, 24, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`Prepared ${new Date(quote.createdAt).toLocaleDateString()}`, pageWidth - 20, 29, { align: 'right' });

    const startY = logoUrl ? 50 : 40;
    const addressLines = (tenant?.business_address || '').split('\n').filter(Boolean);
    let currentY = startY;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    addressLines.forEach(line => {
        doc.text(line, 20, currentY);
        currentY += 5;
    });

    if (tenant?.tax_id) {
        doc.text(`Tax ID: ${tenant.tax_id}`, 20, currentY + 4);
        currentY += 4;
    }

    const chipY = currentY + 12;
    const chip = (label: string, value: string, x: number, width: number) => {
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, chipY, width, 16, 3, 3);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x + 3, chipY + 5);
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 3, chipY + 11.5);
        doc.setFont('helvetica', 'normal');
    };

    chip('Client', quote.name, 20, 55);
    chip('Valid until', quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Open', 78, 44);
    chip('Currency', quote.currency || 'USD', 124, 30);
    chip('Status', quote.status, 156, 34);

    // --- Line Items Table ---
    const tableColumn = ["Item", "Description", "Quantity", "Unit Price", "Total"];
    const tableRows = items.map(item => [
        item.productName,
        item.description || '',
        item.quantity,
        new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(item.unitPrice),
        new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(item.lineTotal)
    ]);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: chipY + 22,
        theme: 'grid',
        headStyles: { fillColor: brandColor, textColor: '#ffffff' },
        alternateRowStyles: { fillColor: '#f8fafc' },
        styles: { fontSize: 9 },
    });

    // --- Totals ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Subtotal:`, pageWidth - 60, finalY);
    doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.subtotal), pageWidth - 20, finalY, { align: 'right' });

    // Discount
    if (quote.discountAmount > 0) {
        doc.text(`Discount:`, pageWidth - 60, finalY + 5);
        doc.text(`-${new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.discountAmount)}`, pageWidth - 20, finalY + 5, { align: 'right' });
    }

    // Tax
    if (quote.taxAmount > 0) {
        doc.text(`Tax (${quote.taxPercent}%):`, pageWidth - 60, finalY + 10);
        doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.taxAmount), pageWidth - 20, finalY + 10, { align: 'right' });
    }

    // Total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor);
    doc.text(`Total:`, pageWidth - 60, finalY + 20);
    doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.totalAmount), pageWidth - 20, finalY + 20, { align: 'right' });

    // --- Notes & Terms ---
    let noteY = finalY + 35;

    if (quote.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Notes:', 20, noteY);
        doc.setTextColor(60, 60, 60); // Slate-600

        const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 40);
        doc.text(splitNotes, 20, noteY + 5);
        noteY += 10 + (splitNotes.length * 5);
    }

    if (quote.termsAndConditions) {
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Terms & Conditions:', 20, noteY);
        doc.setTextColor(60, 60, 60);

        const splitTerms = doc.splitTextToSize(quote.termsAndConditions, pageWidth - 40);
        doc.text(splitTerms, 20, noteY + 5);
        noteY += 10 + (splitTerms.length * 5);
    }

    // --- Signature ---
    if (quote.signatureUrl) {
        doc.setDrawColor(203, 213, 225);
        doc.line(20, noteY + 15, 70, noteY + 15);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text('ACCEPTED BY (CLIENT SIGNATURE)', 20, noteY + 20);

        try {
            const cleanSigData = quote.signatureUrl.includes(',')
                ? quote.signatureUrl.split(',')[1]
                : quote.signatureUrl;
            doc.addImage(cleanSigData, 'PNG', 20, noteY - 10, 40, 20);

            if (quote.acceptedAt) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.text(`Signed: ${new Date(quote.acceptedAt).toLocaleString()}`, 20, noteY + 28);
            }
        } catch (e) {
            console.error('Failed to add drawn signature to PDF:', e);
        }
    }

    // --- Footer ---
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = "Generated by AlphaClone Systems";

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    // Save
    // doc.save(`Quote_${quote.quoteNumber}.pdf`); // removed from here to give caller control
    return doc;
};

/**
 * Profit & Loss Statement PDF - Enhanced Professional Styling
 */
export const generatePnLPDF = (
    statement: any,
    tenant: Tenant,
    startDate: string,
    endDate: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const brandColor = tenant?.brand_color_primary || '#0f172a';
    const isDarkBrand = brandColor === '#0f172a' || brandColor.toLowerCase().includes('0f172a');
    const headerTextColor = isDarkBrand ? [255, 255, 255] : [255, 255, 255];

    const currencyFormatter = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // === Professional Header Bar ===
    const brandRgb = hexToRgb(brandColor);
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo / Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    doc.text(tenant?.legal_name || tenant?.name || 'AlphaClone', 20, 20);

    // Report Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Profit & Loss Statement', 20, 32);

    // Period
    doc.setFontSize(9);
    doc.text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 20, 40);

    // Generated date on right
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 20, 40, { align: 'right' });

    let startY = 55;

    // === Revenue Section ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 184, 166); // Teal-500
    doc.text('REVENUE', 20, startY);

    const revenueRows = (statement.revenue || []).map((acc: any) => [
        acc.accountName,
        currencyFormatter(acc.balance)
    ]);

    autoTable(doc, {
        head: [['Account', 'Amount']],
        body: revenueRows,
        startY: startY + 5,
        theme: 'grid',
        headStyles: {
            fillColor: [20, 184, 166],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' }
        },
        foot: [['TOTAL REVENUE', currencyFormatter(statement.totalRevenue)]],
        footStyles: {
            fillColor: [20, 184, 166],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // === Expenses Section ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // Red-500
    doc.text('EXPENSES', 20, currentY);

    const expenseRows = (statement.expenses || []).map((acc: any) => [
        acc.accountName,
        currencyFormatter(acc.balance)
    ]);

    autoTable(doc, {
        head: [['Account', 'Amount']],
        body: expenseRows,
        startY: currentY + 5,
        theme: 'grid',
        headStyles: {
            fillColor: [239, 68, 68],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' }
        },
        foot: [['TOTAL EXPENSES', currencyFormatter(statement.totalExpenses)]],
        footStyles: {
            fillColor: [239, 68, 68],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: { fillColor: [254, 242, 242] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // === Net Income Summary Box ===
    const boxHeight = 25;
    const boxColor = statement.netIncome >= 0 ? [20, 184, 166] : [239, 68, 68];

    // Background box
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.roundedRect(20, currentY, pageWidth - 40, boxHeight, 3, 3, 'F');

    // Net Income text
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('NET INCOME', 30, currentY + 10);

    doc.setFontSize(14);
    doc.text(currencyFormatter(statement.netIncome), pageWidth - 30, currentY + 16, { align: 'right' });

    // Margin indicator
    const revenue = statement.totalRevenue || 0;
    const margin = revenue > 0 ? ((statement.netIncome / revenue) * 100).toFixed(1) : '0.0';
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Profit Margin: ${margin}%`, 30, currentY + 20);

    // === Key Metrics Summary (if space allows) ===
    if (currentY + boxHeight + 40 < pageHeight - 30) {
        const metricsY = currentY + boxHeight + 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('KEY METRICS', 20, metricsY);

        // Simple metrics line
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        const metrics = [
            `Gross Revenue: ${currencyFormatter(revenue)}`,
            `Total Expenses: ${currencyFormatter(statement.totalExpenses || 0)}`,
            `Net Result: ${currencyFormatter(statement.netIncome || 0)}`
        ];

        let lineY = metricsY + 8;
        metrics.forEach(metric => {
            doc.text(metric, 20, lineY);
            lineY += 6;
        });
    }

    addFooter(doc, pageWidth, pageHeight);

    return doc;
};

/**
 * Balance Sheet PDF - Enhanced Professional Styling
 */
export const generateBalanceSheetPDF = (
    statement: any,
    tenant: Tenant,
    asOfDate: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const brandColor = tenant?.brand_color_primary || '#0f172a';

    const currencyFormatter = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // === Professional Header Bar ===
    const brandRgb = hexToRgb(brandColor);
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo / Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(tenant?.legal_name || tenant?.name || 'AlphaClone', 20, 20);

    // Report Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Balance Sheet', 20, 32);

    // As Of Date
    doc.setFontSize(9);
    doc.text(`As of: ${new Date(asOfDate).toLocaleDateString()}`, 20, 40);

    // Generated date on right
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 20, 40, { align: 'right' });

    let startY = 55;

    // === Assets Section ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // Green-500
    doc.text('ASSETS', 20, startY);

    const assetRows = (statement.assets || []).map((acc: any) => [
        acc.accountName,
        currencyFormatter(acc.balance)
    ]);

    autoTable(doc, {
        head: [['Account', 'Amount']],
        body: assetRows,
        startY: startY + 5,
        theme: 'grid',
        headStyles: {
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' }
        },
        foot: [['TOTAL ASSETS', currencyFormatter(statement.totalAssets)]],
        footStyles: {
            fillColor: [20, 83, 45],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: { fillColor: [240, 253, 244] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // === Liabilities Section ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // Red-500
    doc.text('LIABILITIES', 20, currentY);

    const liabilityRows = (statement.liabilities || []).map((acc: any) => [
        acc.accountName,
        currencyFormatter(acc.balance)
    ]);

    autoTable(doc, {
        head: [['Account', 'Amount']],
        body: liabilityRows,
        startY: currentY + 5,
        theme: 'grid',
        headStyles: {
            fillColor: [239, 68, 68],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' }
        },
        foot: [['TOTAL LIABILITIES', currencyFormatter(statement.totalLiabilities)]],
        footStyles: {
            fillColor: [153, 27, 27],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: { fillColor: [254, 242, 242] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // === Equity Section ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241); // Indigo-500
    doc.text('EQUITY', 20, currentY);

    const equityRows = (statement.equity || []).map((acc: any) => [
        acc.accountName,
        currencyFormatter(acc.balance)
    ]);
    equityRows.push(['Net Income (Current Period)', currencyFormatter(statement.netIncome)]);

    autoTable(doc, {
        head: [['Account', 'Amount']],
        body: equityRows,
        startY: currentY + 5,
        theme: 'grid',
        headStyles: {
            fillColor: [99, 102, 241],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' }
        },
        foot: [['TOTAL EQUITY', currencyFormatter(statement.totalEquity)]],
        footStyles: {
            fillColor: [67, 56, 202],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        alternateRowStyles: { fillColor: [238, 242, 255] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // === Balance Check Summary Box ===
    const totalLiabilitiesAndEquity = statement.totalLiabilities + statement.totalEquity;
    const isBalanced = Math.abs(statement.totalAssets - totalLiabilitiesAndEquity) < 0.01;

    const boxHeight = 30;
    const boxColor = isBalanced ? [34, 197, 94] : [239, 68, 68];

    // Background box
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.roundedRect(20, currentY, pageWidth - 40, boxHeight, 3, 3, 'F');

    // Summary title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(isBalanced ? 'BALANCE SHEET BALANCED' : 'BALANCE CHECK', 30, currentY + 10);

    // Summary values
    doc.setFontSize(10);
    doc.text(`Total Assets: ${currencyFormatter(statement.totalAssets)}`, 30, currentY + 19);
    doc.text(`Total Liabilities + Equity: ${currencyFormatter(totalLiabilitiesAndEquity)}`,
             pageWidth - 30, currentY + 19, { align: 'right' });

    // Verification indicator
    doc.setFontSize(8);
    doc.text(isBalanced ? '✓ Accounting equation satisfied' : '⚠ Check accounts for discrepancies',
             30, currentY + 26);

    addFooter(doc, pageWidth, pageHeight);

    return doc;
};

/**
 * Common PDF Footer
 */
const addFooter = (doc: jsPDF, pageWidth: number, pageHeight: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = "Generated by AlphaClone Systems";
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }
};

/**
 * Invoice PDF generator
 */
export interface InvoiceItem {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface InvoiceData {
    id: string;
    invoiceNumber: string;
    status: string;
    subtotal: number;
    taxRate: number;
    tax: number;
    discountAmount: number;
    total: number;
    currency: string;
    dueDate?: string;
    issueDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export const generateInvoicePDF = (
    invoice: InvoiceData,
    items: InvoiceItem[],
    tenant: Tenant
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const brandColor = tenant?.brand_color_primary || '#0f172a';
    const accentColor = tenant?.brand_color_secondary || '#14b8a6';
    const currency = invoice.currency || 'USD';
    const fmt = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

    // Header bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth - 20, 16, { align: 'right' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${invoice.invoiceNumber}`, pageWidth - 20, 24, { align: 'right' });

    // Company name
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(tenant?.legal_name || tenant?.name || 'AlphaClone', 20, 22);

    // Meta chips
    const chipY = 44;
    const chip = (label: string, value: string, x: number, width: number) => {
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, chipY, width, 16, 3, 3);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x + 3, chipY + 5);
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 3, chipY + 11.5);
        doc.setFont('helvetica', 'normal');
    };

    chip('Status', invoice.status || 'draft', 20, 35);
    chip('Issue Date', invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : new Date(invoice.createdAt).toLocaleDateString(), 58, 44);
    chip('Due Date', invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'On receipt', 105, 44);
    chip('Currency', currency, 152, 30);

    // Line items table
    const tableColumn = ['Description', 'Qty', 'Rate', 'Amount'];
    const tableRows = items.map(item => [
        item.description || '',
        item.quantity,
        fmt(item.rate),
        fmt(item.amount),
    ]);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: chipY + 22,
        theme: 'grid',
        headStyles: { fillColor: brandColor, textColor: '#ffffff' },
        alternateRowStyles: { fillColor: '#f8fafc' },
        styles: { fontSize: 9 },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Subtotal:', pageWidth - 60, finalY);
    doc.text(fmt(invoice.subtotal), pageWidth - 20, finalY, { align: 'right' });

    if (invoice.discountAmount > 0) {
        doc.text('Discount:', pageWidth - 60, finalY + 6);
        doc.text(`-${fmt(invoice.discountAmount)}`, pageWidth - 20, finalY + 6, { align: 'right' });
    }

    if (invoice.tax > 0) {
        doc.text(`Tax (${invoice.taxRate}%):`, pageWidth - 60, finalY + 12);
        doc.text(fmt(invoice.tax), pageWidth - 20, finalY + 12, { align: 'right' });
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor);
    doc.text('Total:', pageWidth - 60, finalY + 22);
    doc.text(fmt(invoice.total), pageWidth - 20, finalY + 22, { align: 'right' });

    // Notes
    if (invoice.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Notes:', 20, finalY + 36);
        doc.setTextColor(60, 60, 60);
        const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 40);
        doc.text(splitNotes, 20, finalY + 42);
    }

    addFooter(doc, pageWidth, pageHeight);
    return doc;
};
