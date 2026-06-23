/** EU / EEA governing jurisdictions for contract drafting (AI Lawyer + contract builder). */
export const EU_JURISDICTIONS: { code: string; label: string; governingLaw: string }[] = [
  { code: 'AT', label: 'Austria', governingLaw: 'Laws of the Republic of Austria' },
  { code: 'BE', label: 'Belgium', governingLaw: 'Laws of Belgium' },
  { code: 'BG', label: 'Bulgaria', governingLaw: 'Laws of the Republic of Bulgaria' },
  { code: 'HR', label: 'Croatia', governingLaw: 'Laws of the Republic of Croatia' },
  { code: 'CY', label: 'Cyprus', governingLaw: 'Laws of the Republic of Cyprus' },
  { code: 'CZ', label: 'Czech Republic', governingLaw: 'Laws of the Czech Republic' },
  { code: 'DK', label: 'Denmark', governingLaw: 'Laws of the Kingdom of Denmark' },
  { code: 'EE', label: 'Estonia', governingLaw: 'Laws of the Republic of Estonia' },
  { code: 'FI', label: 'Finland', governingLaw: 'Laws of the Republic of Finland' },
  { code: 'FR', label: 'France', governingLaw: 'Laws of the French Republic' },
  { code: 'DE', label: 'Germany', governingLaw: 'Laws of the Federal Republic of Germany' },
  { code: 'GR', label: 'Greece', governingLaw: 'Laws of the Hellenic Republic' },
  { code: 'HU', label: 'Hungary', governingLaw: 'Laws of Hungary' },
  { code: 'IE', label: 'Ireland', governingLaw: 'Laws of Ireland' },
  { code: 'IT', label: 'Italy', governingLaw: 'Laws of the Italian Republic' },
  { code: 'LV', label: 'Latvia', governingLaw: 'Laws of the Republic of Latvia' },
  { code: 'LT', label: 'Lithuania', governingLaw: 'Laws of the Republic of Lithuania' },
  { code: 'LU', label: 'Luxembourg', governingLaw: 'Laws of the Grand Duchy of Luxembourg' },
  { code: 'MT', label: 'Malta', governingLaw: 'Laws of the Republic of Malta' },
  { code: 'NL', label: 'Netherlands', governingLaw: 'Laws of the Kingdom of the Netherlands' },
  { code: 'PL', label: 'Poland', governingLaw: 'Laws of the Republic of Poland' },
  { code: 'PT', label: 'Portugal', governingLaw: 'Laws of the Portuguese Republic' },
  { code: 'RO', label: 'Romania', governingLaw: 'Laws of Romania' },
  { code: 'SK', label: 'Slovakia', governingLaw: 'Laws of the Slovak Republic' },
  { code: 'SI', label: 'Slovenia', governingLaw: 'Laws of the Republic of Slovenia' },
  { code: 'ES', label: 'Spain', governingLaw: 'Laws of the Kingdom of Spain' },
  { code: 'SE', label: 'Sweden', governingLaw: 'Laws of the Kingdom of Sweden' },
  { code: 'IS', label: 'Iceland (EEA)', governingLaw: 'Laws of Iceland' },
  { code: 'LI', label: 'Liechtenstein (EEA)', governingLaw: 'Laws of Liechtenstein' },
  { code: 'NO', label: 'Norway (EEA)', governingLaw: 'Laws of the Kingdom of Norway' },
  { code: 'CH', label: 'Switzerland', governingLaw: 'Laws of the Swiss Confederation' },
  { code: 'GB', label: 'United Kingdom', governingLaw: 'Laws of England and Wales' },
];

export function findEuJurisdiction(codeOrLabel: string) {
  const q = codeOrLabel.trim().toLowerCase();
  return EU_JURISDICTIONS.find(
    (j) => j.code.toLowerCase() === q || j.label.toLowerCase() === q || j.label.toLowerCase().includes(q)
  );
}
