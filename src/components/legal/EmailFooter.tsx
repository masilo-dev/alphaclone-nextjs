import type { CSSProperties } from 'react';

const wrapperStyle: CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: 1.6,
  textAlign: 'center',
};

export const emailFooterText = [
  'Alphaclone Systems, LLC',
  'alphaclonesystems.com',
  'Unsubscribe: {{{unsubscribe_url}}}',
  'Privacy Policy: https://alphaclonesystems.com/privacy-policy',
  'Terms: https://alphaclonesystems.com/terms-of-service',
  'If you received this email in error, please disregard and delete it.',
].join('\n');

export default function EmailFooter({ marketing = false }: { marketing?: boolean }) {
  return (
    <div style={wrapperStyle}>
      <div style={{ borderTop: '1px solid #334155', margin: '16px 0', width: '100%' }} />
      <div>Alphaclone Systems, LLC</div>
      <div>
        <a href="https://alphaclonesystems.com" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          alphaclonesystems.com
        </a>
      </div>
      <div>
        <a href="{{{unsubscribe_url}}}" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          Unsubscribe
        </a>
        {' | '}
        <a href="https://alphaclonesystems.com/privacy-policy" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          Privacy Policy
        </a>
        {' | '}
        <a href="https://alphaclonesystems.com/terms-of-service" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          Terms
        </a>
      </div>
      <div>If you received this email in error, please disregard and delete it.</div>
      {marketing && (
        <div>You are receiving this because you signed up at alphaclonesystems.com or opted in to our communications.</div>
      )}
    </div>
  );
}
