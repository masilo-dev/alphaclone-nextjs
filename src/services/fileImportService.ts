
import * as XLSX from 'xlsx';
// PDFJS is loaded dynamically when needed to prevent Next.js client-side Webpack errors


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
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet);

            const contacts: ParsedContact[] = data.map((row: any) => {
                // Parse value (remove likely currency symbols)
                const rawValue = row.value || row.Value || row.VALUE || row['Potential Value'] || row.amount || row.Amount || row.revenue || row.Revenue || 0;
                const parseValue = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
                    return 0;
                };

                // Map stage/status to valid salesStage
                const rawStage = (row.stage || row.Stage || row.status || row.Status || 'lead').toLowerCase();
                let salesStage: ParsedContact['salesStage'] = 'lead';
                if (rawStage.includes('prospect')) salesStage = 'prospect';
                if (rawStage.includes('custom') || rawStage.includes('won')) salesStage = 'customer';
                if (rawStage.includes('lost')) salesStage = 'lost';

                // Prioritize Company Name if available, else Person Name
                // Or combine them? For now, we'll stick to a single "Name" field which maps to BusinessClient.name
                const name = row.company || row.Company || row.COMPANY || row.Organization || row.name || row.Name || row.NAME || row['Full Name'] || '';

                return {
                    name: name,
                    email: row.email || row.Email || row.EMAIL || row['Email Address'] || '',
                    phone: row.phone || row.Phone || row.PHONE || row['Phone Number'] || '',
                    industry: row.industry || row.Industry || row.INDUSTRY || row.Sector || '',
                    location: row.location || row.Location || row.LOCATION || row.City || row.Address || '',
                    description: row.notes || row.Notes || row.NOTES || row.description || row.Description || '',
                    salesStage: salesStage,
                    value: parseValue(rawValue)
                };
            }).filter(c => c.name || c.email); // Filter out empty rows

            return { contacts, error: null };
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
                // Dynamically import pdfjs-dist via CDN to avoid SSR and Webpack evaluation crashes
                // @ts-ignore
                const pdfjsLib = await import(/* webpackIgnore: true */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs');

                if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs`;
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
