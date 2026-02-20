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

export const generatePnLPDF = (
    statement: any,
    tenant: Tenant,
    startDate: string,
    endDate: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const brandColor = tenant.brand_color_primary || '#0f172a';

    // Header
    doc.setFontSize(20);
    doc.setTextColor(brandColor);
    doc.text(tenant.legal_name || tenant.name, 20, 20);

    doc.setFontSize(16);
    doc.setTextColor(33, 33, 33);
    doc.text('Profit & Loss Statement', 20, 30);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, 20, 38);

    // Revenue Section
    doc.setFontSize(12);
    doc.setTextColor(brandColor);
    doc.text('Revenue', 20, 50);

    let currentY = 58;
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    if (statement.revenue && statement.revenue.length > 0) {
        statement.revenue.forEach((acc: any) => {
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.text(acc.accountName, 25, currentY);
            doc.text(currencyFormatter.format(acc.balance), pageWidth - 20, currentY, { align: 'right' });
            currentY += 8;
        });
    } else {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('No revenue recorded.', 25, currentY);
        currentY += 8;
    }

    // Total Revenue
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Total Revenue', 20, currentY + 5);
    doc.text(currencyFormatter.format(statement.totalRevenue), pageWidth - 20, currentY + 5, { align: 'right' });
    currentY += 20;

    // Expenses Section
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(brandColor);
    doc.text('Expenses', 20, currentY);
    currentY += 8;

    if (statement.expenses && statement.expenses.length > 0) {
        statement.expenses.forEach((acc: any) => {
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.text(acc.accountName, 25, currentY);
            doc.text(currencyFormatter.format(acc.balance), pageWidth - 20, currentY, { align: 'right' });
            currentY += 8;
        });
    } else {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('No expenses recorded.', 25, currentY);
        currentY += 8;
    }

    // Total Expenses
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Total Expenses', 20, currentY + 5);
    doc.text(currencyFormatter.format(statement.totalExpenses), pageWidth - 20, currentY + 5, { align: 'right' });
    currentY += 20;

    // Net Income
    doc.setFontSize(14);
    doc.setTextColor(statement.netIncome >= 0 ? '#14b8a6' : '#ef4444');
    doc.text('Net Income', 20, currentY);
    doc.text(currencyFormatter.format(statement.netIncome), pageWidth - 20, currentY, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = "Generated by AlphaClone Systems";
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    return doc;
};
