/**
 * exportUtils.ts
 * Standardized utility for exporting JSON data to CSV and triggering a download.
 */

export const exportToCSV = (data: any[], fileName: string) => {
    if (!data || data.length === 0) {
        import('react-hot-toast').then(({ toast }) => {
            toast.error('No data available to export');
        });
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);

    // Create CSV rows
    const csvRows = [
        headers.join(','), // header row
        ...data.map(row => {
            return headers.map(header => {
                const val = row[header];
                // Handle null/undefined
                if (val === null || val === undefined) return '""';

                // Handle strings with commas or quotes
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',');
        })
    ].join('\n');

    // Create blob and trigger download
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
