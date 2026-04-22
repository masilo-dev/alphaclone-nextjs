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
                const [headerLine, ...lines] = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                const headers = (headerLine || '').split(',').map((h) => normalizeKey(h));
                const rows: Array<Record<string, any>> = [];
                for (const line of lines) {
                    const cells = line.split(',');
                    const row: Record<string, any> = {};
                    headers.forEach((h, i) => {
                        if (!h) return;
                        row[h] = (cells[i] || '').trim();
                    });
                    rows.push(row);
                }
                return { contacts: toContacts(rows), error: null };
            }

            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const buffer = await file.arrayBuffer();
            await workbook.xlsx.load(buffer as any);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                return { contacts: [], error: 'Workbook has no sheets' };
            }

            const headerRow = worksheet.getRow(1);
            const headers = (headerRow.values as any[]).slice(1).map((v) => normalizeKey(v));
            const rows: Array<Record<string, any>> = [];
            for (let r = 2; r <= worksheet.rowCount; r++) {
                const row = worksheet.getRow(r);
                const obj: Record<string, any> = {};
                let hasAny = false;
                for (let c = 0; c < headers.length; c++) {
                    const key = headers[c] || `Column${c + 1}`;
                    const cell = row.getCell(c + 1).value as any;
                    const value =
                        cell && typeof cell === 'object' && 'text' in cell ? String(cell.text || '') : cell ?? '';
                    if (String(value).trim().length > 0) hasAny = true;
                    obj[key] = value;
                }
                if (hasAny) rows.push(obj);
            }

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

    /**
     * Extract text from Word document (simplified version)
     */
    async extractTextFromWord(file: File): Promise<string> {
        // This is a placeholder - in production use mammoth.js
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                resolve(text);
            };
            reader.readAsText(file);
        });
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
