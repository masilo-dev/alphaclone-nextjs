/**
 * Live check of the Unified Inbox with a connected Zoho account found:
 *
 * - The message body rendered as white bars. Senders wrap text in
 *   `<span style="background-color:#fff">`; the reader forced every element to
 *   near-white text, so it became white-on-white. Email HTML must be rendered on
 *   a light surface with the sender's colours untouched.
 * - List previews showed raw entities (`you&#39;ve`). Zoho returns snippets
 *   pre-escaped; they must be decoded where the message is mapped.
 * - "Zoho not connected" + disabled Compose/Reply while Zoho mail was visibly
 *   loading: the status probe gave up after 5s and treated "slow" as "no". A
 *   provider that returns mail is connected, and a timeout must be reported as
 *   such (with a retry) rather than as "connect your email".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodeHtmlEntities } from '../../src/lib/email/decodeHtmlEntities.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

describe('decodeHtmlEntities', () => {
  it('decodes numeric, hex and named references', () => {
    assert.equal(decodeHtmlEntities('you&#39;ve &amp; me &lt;3 &quot;hi&quot; &#x41;&nbsp;'), 'you\'ve & me <3 "hi" A\u00a0');
    assert.equal(decodeHtmlEntities('Tracxn &lt;&gt; AlphaClone'), 'Tracxn <> AlphaClone');
  });

  it('leaves unknown or malformed references alone', () => {
    assert.equal(decodeHtmlEntities('AT&T &bogus; &#99999999;'), 'AT&T &bogus; &#99999999;');
    assert.equal(decodeHtmlEntities(''), '');
  });
});

describe('Zoho message mapping decodes escaped text fields', () => {
  const hook = read('../../src/hooks/useZohoEmails.ts');
  it('decodes subject and snippet', () => {
    assert.match(hook, /subject: decodeHtmlEntities\(String\(row\.subject/);
    assert.match(hook, /snippet: decodeHtmlEntities\(String\(row\.snippet/);
  });
});

describe('Unified inbox reader and connection gate', () => {
  const view = read('../../src/components/dashboard/business/UnifiedInboxView.tsx');

  it('renders email HTML on a light surface without forcing text colours', () => {
    assert.match(view, /EMAIL_BODY_SURFACE_CLASS =\s*'[^']*bg-white text-slate-900/);
    assert.doesNotMatch(view, /\[&_\*\]:!text-slate-100/);
    assert.doesNotMatch(view, /\[&_span\]:!text-slate-100/);
    assert.equal((view.match(/className=\{EMAIL_BODY_SURFACE_CLASS\}/g) || []).length, 2);
  });

  it('treats a provider that returns mail as connected', () => {
    assert.match(view, /const zohoLive = status\.zoho \|\| \(zoho\.emails\.length > 0 && !zoho\.error\)/);
    assert.match(view, /const microsoftLive = status\.microsoft \|\| \(microsoft\.emails\.length > 0 && !microsoft\.error\)/);
    assert.match(view, /const providerConnected = provider === 'microsoft' \? microsoftLive : zohoLive/);
  });

  it('gives the status probe a realistic budget and surfaces timeouts separately', () => {
    const budget = Number(view.match(/PROVIDER_STATUS_TIMEOUT_MS = (\d+)/)[1]);
    assert.ok(budget >= 12000, `status budget ${budget}ms is too short for the Zoho health route`);
    assert.match(view, /timedOut: microsoft === TIMED_OUT \|\| zoho === TIMED_OUT/);
    assert.match(view, /We could not reach your email accounts/);
    assert.match(view, /Check again/);
    assert.match(view, /setStatusAttempt\(\(n\) => n \+ 1\)/);
  });
});

describe('Zoho status route', () => {
  const route = read('../../src/app/api/auth/zoho/status/route.ts');
  it('runs the sender and campaigns checks in parallel', () => {
    assert.match(route, /Promise\.allSettled\(\[\s*zohoMailService\.getSenderAddresses\(\),\s*zohoCampaignsService\.checkCampaignsReady\(\),\s*\]\)/);
  });
});
