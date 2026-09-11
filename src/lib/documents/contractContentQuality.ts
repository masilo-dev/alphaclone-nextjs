const PLACEHOLDER_PATTERNS = [
  /\[(?:client|company|vendor|party|name|date|amount|insert|todo|tbd)[^\]]*\]/i,
  /\b(?:TBD|TODO|Lorem ipsum|INSERT HERE|YOUR COMPANY|CLIENT NAME HERE)\b/i,
  /\$\s*[xX]{1,3}\b/,
  /\b(?:xxx+|000\.00 placeholder)\b/i,
];

export type ContractContentQualityIssue = {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
};

export function assessContractContentQuality(content: string): {
  ok: boolean;
  issues: ContractContentQualityIssue[];
} {
  const text = String(content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const issues: ContractContentQualityIssue[] = [];

  if (text.length < 400) {
    issues.push({
      id: 'too-short',
      severity: 'critical',
      message: 'Contract content is too short to be legally usable.',
    });
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        id: 'placeholder-text',
        severity: 'critical',
        message: 'Placeholder or unfinished language detected — replace before sending to clients.',
      });
      break;
    }
  }

  if (!/signature|signed by|\/s\//i.test(text)) {
    issues.push({
      id: 'missing-signature-block',
      severity: 'warning',
      message: 'No signature block detected.',
    });
  }

  if (!/governing law|jurisdiction|confidential|payment|term/i.test(text)) {
    issues.push({
      id: 'missing-core-clauses',
      severity: 'warning',
      message: 'Core commercial clauses may be missing (payment, term, jurisdiction).',
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'critical'),
    issues,
  };
}
