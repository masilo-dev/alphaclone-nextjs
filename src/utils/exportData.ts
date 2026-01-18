import { format } from 'date-fns';

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
    data: T[],
    filename: string,
    columns?: { key: keyof T; label: string }[]
): void {
    if (data.length === 0) {
        console.warn('No data to export');
        return;
    }

    // Determine columns
    const firstRow = data[0];
    if (!firstRow) return;
    const cols = columns || Object.keys(firstRow).map(key => ({ key, label: key }));

    // Create CSV header
    const header = cols.map(col => col.label).join(',');

    // Create CSV rows
    const rows = data.map(row =>
        cols
            .map(col => {
                const value = row[col.key];
                // Handle different value types
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                // Escape quotes and wrap in quotes if contains comma
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            })
            .join(',')
    );

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Download
    downloadFile(csv, filename, 'text/csv');
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T>(data: T, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, filename, 'application/json');
}

/**
 * Export table to PDF (basic implementation)
 * For advanced PDF features, consider using jsPDF or pdfmake
 */
export function exportToPDF(
    title: string,
    data: any[],
    columns: { key: string; label: string }[],
    _filename: string
): void {
    // Create HTML table
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #0f172a; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Generated on ${format(new Date(), 'PPpp')}</p>
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
                row =>
                    `<tr>${columns.map(col => `<td>${row[col.key] || ''}</td>`).join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}

/**
 * Helper function to download file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export projects to CSV
 */
export function exportProjects(projects: any[]): void {
    exportToCSV(
        projects,
        `projects-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        [
            { key: 'title', label: 'Title' },
            { key: 'description', label: 'Description' },
            { key: 'status', label: 'Status' },
            { key: 'progress', label: 'Progress (%)' },
            { key: 'created_at', label: 'Created Date' },
            { key: 'due_date', label: 'Due Date' },
        ]
    );
}

/**
 * Export messages to CSV
 */
export function exportMessages(messages: any[]): void {
    exportToCSV(
        messages,
        `messages-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        [
            { key: 'sender_name', label: 'Sender' },
            { key: 'text', label: 'Message' },
            { key: 'created_at', label: 'Date' },
        ]
    );
}

/**
 * Export invoices to CSV
 */
export function exportInvoices(invoices: any[]): void {
    exportToCSV(
        invoices,
        `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        [
            { key: 'id', label: 'Invoice ID' },
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'due_date', label: 'Due Date' },
        ]
    );
}

/**
 * Export activity logs to CSV
 */
export function exportActivityLogs(logs: any[]): void {
    exportToCSV(
        logs,
        `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        [
            { key: 'action', label: 'Action' },
            { key: 'entity_type', label: 'Type' },
            { key: 'created_at', label: 'Date' },
        ]
    );
}

export default {
    exportToCSV,
    exportToJSON,
    exportToPDF,
    exportProjects,
    exportMessages,
    exportInvoices,
    exportActivityLogs,
};
