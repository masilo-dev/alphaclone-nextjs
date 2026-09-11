import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/email/renderEmail';
import { resolveEmailLogoUrl, validateEmailLogoUrl, VERIFIED_EMAIL_LOGO_URL } from '../src/lib/email/emailConfig';

mkdirSync('tmp/email-previews', { recursive: true });

const desktop = renderEmail({
  type: 'transactional',
  subject: 'AlphaClone transactional preview',
  heading: 'Account update',
  recipientName: 'Alex',
  content: 'Your settings were saved successfully.',
  cta: { label: 'Open dashboard', url: 'https://alphaclonesystems.com/dashboard' },
});

const mobile = renderEmail({
  type: 'outreach',
  subject: 'AlphaClone outreach preview',
  heading: 'Following up',
  content: 'Just checking in on our conversation.',
  footerType: 'outreach',
  unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=preview',
});

const blocked = renderEmail({
  type: 'marketing_campaign',
  subject: 'AlphaClone marketing preview',
  heading: 'Product update',
  content: 'Here is what changed this week.',
  footerType: 'marketing',
  unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=preview',
});
blocked.html = blocked.html.replace(/src="[^"]+"/g, 'src=""');

writeFileSync('tmp/email-previews/gmail-desktop-transactional.html', desktop.html);
writeFileSync('tmp/email-previews/gmail-mobile-outreach.html', mobile.html);
writeFileSync('tmp/email-previews/images-blocked-marketing.html', blocked.html);

const prodLogo = await validateEmailLogoUrl(VERIFIED_EMAIL_LOGO_URL);
const configured = await validateEmailLogoUrl(resolveEmailLogoUrl());

console.log(
  JSON.stringify(
    {
      configuredLogo: resolveEmailLogoUrl(),
      configured,
      productionLogo: prodLogo,
      previewFiles: [
        'tmp/email-previews/gmail-desktop-transactional.html',
        'tmp/email-previews/gmail-mobile-outreach.html',
        'tmp/email-previews/images-blocked-marketing.html',
      ],
    },
    null,
    2,
  ),
);
