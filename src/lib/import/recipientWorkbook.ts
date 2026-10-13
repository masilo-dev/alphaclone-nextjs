export type ImportRow = Record<string, string>;
const aliases: Record<string, string> = { emailaddress: 'email', mail: 'email', fullname: 'name', businessname: 'name', contactname: 'contact_name', organisation: 'company', organization: 'company', business: 'company', phonenumber: 'phone', mobile: 'phone', websiteurl: 'website' };
export function normalizeRecipientRows(rows: ImportRow[]) {
  const records: ImportRow[] = []; const seen = new Set<string>();
  let invalid = 0; let duplicates = 0;
  for (const row of rows) {
    const record: ImportRow = {};
    for (const [key, value] of Object.entries(row)) {
      const header = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      record[aliases[header] || header] = String(value || '').trim().slice(0, 2000);
    }
    const email = (record.email || '').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid++; continue; }
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email); record.email = email;
    record.name ||= record.company || [record.firstname, record.lastname].filter(Boolean).join(' ') || email;
    records.push(record);
  }
  return { records, invalid, duplicates };
}
export async function readRecipientWorkbook(file: File): Promise<ImportRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Maximum file size is 5 MB.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Upload an Excel .xlsx workbook.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no worksheets.');
  if (sheet.rowCount > 1001 || sheet.columnCount > 50) throw new Error('Use up to 1,000 recipients and 50 columns per upload.');
  const text = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'object') {
      const cell = value as { formula?: string; sharedFormula?: string; text?: string; richText?: Array<{ text: string }> };
      if (cell.formula || cell.sharedFormula) return ''; // Never evaluate formulas or trust formula email results.
      return cell.text || cell.richText?.map(part => part.text).join('') || '';
    }
    return String(value);
  };
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => { headers[i - 1] = text(cell.value); });
  const rows: ImportRow[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row: ImportRow = {};
    headers.forEach((header, index) => { if (header) row[header] = text(sheet.getRow(i).getCell(index + 1).value); });
    if (Object.values(row).some(value => value.trim())) rows.push(row);
  }
  return rows;
}
