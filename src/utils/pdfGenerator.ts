import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, QuoteItem } from '../services/quoteService';
import { Tenant } from '../services/tenancy/types';

export const generateQuotePDF = (quote: Quote, items: QuoteItem[], tenant: Tenant) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const brandColor = tenant.brand_color_primary || '#0f172a';
    const secondaryColor = tenant.brand_color_secondary || '#14b8a6';

    // --- Header ---
    // Logo or Name
    if (tenant.logo_url) {
        // Simple image add attempt - might need pre-fetching in real app due to async issues in synchronous jspdf flow
        // For now, we assume it works or falls back. In a robust app, we'd load the image to base64 first.
        try {
            doc.addImage(tenant.logo_url, 'PNG', 20, 15, 30, 30, undefined, 'FAST');
        } catch (e) {
            console.warn("Could not load logo", e);
            doc.setFontSize(24);
            doc.setTextColor(brandColor);
            doc.text(tenant.legal_name || tenant.name, 20, 25);
        }
    } else {
        doc.setFontSize(24);
        doc.setTextColor(brandColor);
        doc.text(tenant.legal_name || tenant.name, 20, 25);
    }

    // Header Right (Quote Info)
    doc.setFontSize(24);
    doc.setTextColor(33, 33, 33);
    doc.text('QUOTE', pageWidth - 20, 20, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`#${quote.quoteNumber}`, pageWidth - 20, 25, { align: 'right' });

    // Dates
    doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, pageWidth - 20, 35, { align: 'right' });
    if (quote.validUntil) {
        doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`, pageWidth - 20, 40, { align: 'right' });
    }

    // Tenant Address (Left, under logo/name)
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const startY = tenant.logo_url ? 50 : 35;
    const addressLines = (tenant.business_address || '').split('\n');
    let currentY = startY;

    addressLines.forEach(line => {
        doc.text(line, 20, currentY);
        currentY += 5;
    });

    if (tenant.tax_id) {
        doc.text(`Tax ID: ${tenant.tax_id}`, 20, currentY + 5);
        currentY += 5;
    }

    // --- Client Info ---
    const clientY = currentY + 15;
    doc.setFontSize(11);
    doc.setTextColor(brandColor);
    doc.text('Prepared For:', 20, clientY);

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(quote.name, 20, clientY + 6);

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
        startY: clientY + 15,
        theme: 'grid',
        headStyles: { fillColor: brandColor },
        styles: { fontSize: 9 },
    });

    // --- Totals ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
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
    doc.setTextColor(brandColor);
    doc.text(`Total:`, pageWidth - 60, finalY + 20);
    doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.totalAmount), pageWidth - 20, finalY + 20, { align: 'right' });

    // --- Notes & Terms ---
    let noteY = finalY + 35;

    if (quote.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Notes:', 20, noteY);
        doc.setTextColor(60, 60, 60); // Slate-600

        const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 40);
        doc.text(splitNotes, 20, noteY + 5);
        noteY += 10 + (splitNotes.length * 5);
    }

    if (quote.termsAndConditions) {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
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
 * Profit & Loss Statement PDF
 */
export const generatePnLPDF = (
    statement: any,
    tenant: Tenant,
    startDate: string,
    endDate: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const brandColor = tenant.brand_color_primary || '#0f172a';

    // Header
    doc.setFontSize(22);
    doc.setTextColor(brandColor);
    doc.text(tenant.legal_name || tenant.name, 20, 25);

    doc.setFontSize(16);
    doc.setTextColor(33, 33, 33);
    doc.text('Profit & Loss Statement', 20, 35);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, 20, 42);

    const currencyFormatter = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Revenue Section
    const revenueRows = (statement.revenue || []).map((acc: any) => [acc.accountName, currencyFormatter(acc.balance)]);
    autoTable(doc, {
        head: [['REVENUE ACCOUNT', 'BALANCE']],
        body: revenueRows,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: brandColor },
        foot: [['TOTAL REVENUE', currencyFormatter(statement.totalRevenue)]],
        footStyles: { fillColor: [20, 184, 166], textColor: [255, 255, 255] } // Teal-500
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Expenses Section
    const expenseRows = (statement.expenses || []).map((acc: any) => [acc.accountName, currencyFormatter(acc.balance)]);
    autoTable(doc, {
        head: [['EXPENSE ACCOUNT', 'BALANCE']],
        body: expenseRows,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: '#ef4444' }, // Red-500
        foot: [['TOTAL EXPENSES', currencyFormatter(statement.totalExpenses)]],
        footStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255] } // Rose-500
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Net Income
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(statement.netIncome >= 0 ? '#14b8a6' : '#ef4444');
    doc.text('NET INCOME:', 20, currentY);
    doc.text(currencyFormatter(statement.netIncome), pageWidth - 20, currentY, { align: 'right' });

    addFooter(doc, pageWidth, doc.internal.pageSize.height);

    return doc;
};

/**
 * Balance Sheet PDF
 */
export const generateBalanceSheetPDF = (
    statement: any,
    tenant: Tenant,
    asOfDate: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const brandColor = tenant.brand_color_primary || '#0f172a';

    // Header
    doc.setFontSize(22);
    doc.setTextColor(brandColor);
    doc.text(tenant.legal_name || tenant.name, 20, 25);

    doc.setFontSize(16);
    doc.setTextColor(33, 33, 33);
    doc.text('Balance Sheet', 20, 35);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`As of: ${new Date(asOfDate).toLocaleDateString()}`, 20, 42);

    const currencyFormatter = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Assets Table
    const assetRows = (statement.assets || []).map((acc: any) => [acc.accountName, currencyFormatter(acc.balance)]);
    autoTable(doc, {
        head: [['ASSETS', 'BALANCE']],
        body: assetRows,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: brandColor },
        foot: [['TOTAL ASSETS', currencyFormatter(statement.totalAssets)]],
        footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Liabilities Table
    const liabilityRows = (statement.liabilities || []).map((acc: any) => [acc.accountName, currencyFormatter(acc.balance)]);
    autoTable(doc, {
        head: [['LIABILITIES', 'BALANCE']],
        body: liabilityRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: '#ef4444' },
        foot: [['TOTAL LIABILITIES', currencyFormatter(statement.totalLiabilities)]],
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Equity Table
    const equityRows = (statement.equity || []).map((acc: any) => [acc.accountName, currencyFormatter(acc.balance)]);
    equityRows.push(['Net Income (Current Period)', currencyFormatter(statement.netIncome)]);

    autoTable(doc, {
        head: [['EQUITY', 'BALANCE']],
        body: equityRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: '#6366f1' }, // Indigo-500
        foot: [['TOTAL EQUITY', currencyFormatter(statement.totalEquity)]],
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Summary
    const totalLiabilitiesAndEquity = statement.totalLiabilities + statement.totalEquity;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL LIABILITIES & EQUITY:', 20, currentY);
    doc.text(currencyFormatter(totalLiabilitiesAndEquity), pageWidth - 20, currentY, { align: 'right' });

    addFooter(doc, pageWidth, doc.internal.pageSize.height);

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
