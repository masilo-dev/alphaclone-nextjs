export interface ParsedContact {
    name?: string;
    email?: string;
    phone?: string;
    industry?: string;
    location?: string;
    description?: string;
    salesStage?: 'lead' | 'prospect' | 'customer' | 'lost';
    value?: number;
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === '"') {
            if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
            else quoted = !quoted;
        } else if (char === ',' && !quoted) {
            row.push(cell); cell = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && text[index + 1] === '\n') index += 1;
            row.push(cell); cell = '';
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
        } else cell += char;
    }
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
}

export const fileImportService = {
    /**
     * Import from Excel/CSV file
     */
    async importFromExcel(file: File): Promise<{ contacts: ParsedContact[]; error: string | null }> {
        try {
            const parseValue = (val: any) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
                return 0;
            };

            const normalizeKey = (key: unknown) => String(key || '').trim();

            const toContacts = (rows: Array<Record<string, any>>) =>
                rows
                    .map((row: any) => {
                        const rawValue =
                            row.value ||
                            row.Value ||
                            row.VALUE ||
                            row['Potential Value'] ||
                            row.amount ||
                            row.Amount ||
                            row.revenue ||
                            row.Revenue ||
                            0;

                        const rawStage = String(row.stage || row.Stage || row.status || row.Status || 'lead').toLowerCase();
                        let salesStage: ParsedContact['salesStage'] = 'lead';
                        if (rawStage.includes('prospect')) salesStage = 'prospect';
                        if (rawStage.includes('custom') || rawStage.includes('won')) salesStage = 'customer';
                        if (rawStage.includes('lost')) salesStage = 'lost';

                        const name =
                            row.company ||
                            row.Company ||
                            row.COMPANY ||
                            row.Organization ||
                            row.name ||
                            row.Name ||
                            row.NAME ||
                            row['Full Name'] ||
                            '';

                        return {
                            name,
                            email: row.email || row.Email || row.EMAIL || row['Email Address'] || '',
                            phone: row.phone || row.Phone || row.PHONE || row['Phone Number'] || '',
                            industry: row.industry || row.Industry || row.INDUSTRY || row.Sector || '',
                            location: row.location || row.Location || row.LOCATION || row.City || row.Address || '',
                            description: row.notes || row.Notes || row.NOTES || row.description || row.Description || '',
                            salesStage,
                            value: parseValue(rawValue),
                        } satisfies ParsedContact;
                    })
                    .filter((c) => c.name || c.email);

            const isCsv = file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv');

            if (isCsv) {
                const text = await file.text();
                const [headerCells = [], ...dataRows] = parseCsv(text.replace(/^\uFEFF/, ''));
                const headers = headerCells.map((header) => normalizeKey(header));
                const rows: Array<Record<string, any>> = [];
                for (const cells of dataRows) {
                    const row: Record<string, any> = {};
                    headers.forEach((h, i) => {
                        if (!h) return;
                        row[h] = (cells[i] || '').trim();
                    });
                    rows.push(row);
                }
                return { contacts: toContacts(rows), error: null };
            }

            const extension = file.name.toLowerCase().split('.').pop();
            if (!['xlsx', 'xlsm'].includes(extension || '')) {
                return { contacts: [], error: 'Upload a CSV, XLSX, or XLSM workbook.' };
            }

            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            // @ts-expect-error: exceljs types expect legacy Buffer; Buffer.from() is functionally correct at runtime
            await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
            const worksheet = workbook.worksheets[0];
            if (!worksheet) return { contacts: [], error: 'The workbook has no worksheets.' };

            const headers: string[] = [];
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: true }, (cell, column) => {
                headers[column - 1] = normalizeKey(cell.text || cell.value);
            });
            if (!headers.some(Boolean)) return { contacts: [], error: 'The first worksheet has no header row.' };

            const rows: Array<Record<string, any>> = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return;
                const record: Record<string, any> = {};
                headers.forEach((header, index) => {
                    if (!header) return;
                    const cell = row.getCell(index + 1);
                    record[header] = cell.text || cell.value || '';
                });
                if (Object.values(record).some((value) => String(value || '').trim())) rows.push(record);
            });
            return { contacts: toContacts(rows), error: null };
        } catch (err: any) {
            console.error('Error importing Excel:', err);
            return { contacts: [], error: err.message };
        }
    },

    /**
     * Import from PDF file (basic text extraction)
     */
    async importFromPDF(file: File): Promise<{ contacts: ParsedContact[]; error: string | null }> {
        try {
            const text = await this.extractTextFromPDF(file);
            const contacts = this.parseContactsFromText(text);

            return { contacts, error: null };
        } catch (err: any) {
            console.error('Error importing PDF:', err);
            return { contacts: [], error: err.message };
        }
    },

    /**
     * Import from Word document
     */
    async importFromWord(file: File): Promise<{ contacts: ParsedContact[]; error: string | null }> {
        try {
            // For Word docs, we'll extract text and parse
            const text = await this.extractTextFromWord(file);
            const contacts = this.parseContactsFromText(text);

            return { contacts, error: null };
        } catch (err: any) {
            console.error('Error importing Word:', err);
            return { contacts: [], error: err.message };
        }
    },

    /**
     * Extract text from PDF using pdfjs-dist
     */
    async extractTextFromPDF(file: File): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                // @ts-ignore
                const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
                const pdfjsLib = pdfjsModule.default || pdfjsModule;

                if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
                }

                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;

                let fullText = '';

                // Iterate through all pages
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items
                        .map((item: any) => item.str)
                        .join(' ');
                    fullText += pageText + '\n';
                }

                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        });
    },

    /** Extract text from a DOCX document using Mammoth's document parser. */
    async extractTextFromWord(file: File): Promise<string> {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (!result.value.trim()) throw new Error('No readable text was found in this Word document.');
        return result.value;
    },

    /**
     * Parse contacts from plain text using regex patterns
     */
    parseContactsFromText(text: string): ParsedContact[] {
        const contacts: ParsedContact[] = [];

        // Email regex
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        // Phone regex (various formats)
        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

        const emails = text.match(emailRegex) || [];
        const phones = text.match(phoneRegex) || [];

        // Create contacts from found emails
        emails.forEach((email, index) => {
            contacts.push({
                email,
                phone: phones[index] || undefined,
                name: this.extractNameNearEmail(text, email),
                salesStage: 'lead', // Default
                description: 'Imported from document'
            });
        });

        return contacts;
    },

    /**
     * Try to extract name near an email address
     */
    extractNameNearEmail(text: string, email: string): string | undefined {
        const emailIndex = text.indexOf(email);
        if (emailIndex === -1) return undefined;

        // Look for text before email (likely a name)
        const beforeEmail = text.substring(Math.max(0, emailIndex - 50), emailIndex);
        const lines = beforeEmail.split('\n');
        const lastLine = lines[lines.length - 1].trim();

        // Simple name extraction (words before email)
        const words = lastLine.split(/\s+/).filter(w => w.length > 1);
        if (words.length > 0 && words.length <= 4) {
            return words.join(' ');
        }

        return undefined;
    },

    /**
     * Validate and clean contact data
     */
    validateContact(contact: ParsedContact): boolean {
        return !!(contact.name || contact.email);
    }
};
