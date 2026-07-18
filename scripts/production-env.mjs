const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function firstPresent(env, names) {
  return names.find((name) => typeof env[name] === 'string' && env[name].trim().length > 0);
}

function checkUrl(value, { https = false, publicProduction = false } = {}) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (https && url.protocol !== 'https:') return false;
    if (publicProduction && (LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith('.vercel.app'))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateProductionEnv(env = process.env) {
  const errors = [];
  const configured = {};

  const requiredGroups = [
    {
      label: 'Supabase URL',
      names: ['NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'],
      validate: (value) => checkUrl(value, { https: true }),
    },
    {
      label: 'Supabase anonymous key',
      names: ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'],
    },
    {
      label: 'Supabase service-role key',
      names: ['SUPABASE_SERVICE_ROLE_KEY'],
    },
    {
      label: 'cron authentication secret',
      names: ['CRON_SECRET', 'INTERNAL_API_KEY'],
    },
    {
      label: 'platform transactional email key',
      names: ['BREVO_PLATFORM_API_KEY', 'BREVO_API_KEY', 'SENDINBLUE_API_KEY'],
    },
    {
      label: 'Cloudflare Turnstile secret',
      names: ['TURNSTILE_SECRET_KEY'],
    },
    {
      label: 'Cloudflare Turnstile site key',
      names: ['NEXT_PUBLIC_TURNSTILE_SITE_KEY'],
    },
  ];

  for (const group of requiredGroups) {
    const selected = firstPresent(env, group.names);
    if (!selected) {
      errors.push(`${group.label} is missing (${group.names.join(' or ')})`);
      continue;
    }
    const value = env[selected].trim();
    if (group.validate && !group.validate(value)) {
      errors.push(`${group.label} is invalid (${selected})`);
      continue;
    }
    configured[group.label] = selected;
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    errors.push('public application URL is missing (NEXT_PUBLIC_APP_URL)');
  } else if (!checkUrl(appUrl, { https: true, publicProduction: true })) {
    errors.push('public application URL must be a non-local HTTPS URL and must not use vercel.app');
  } else {
    configured['public application URL'] = 'NEXT_PUBLIC_APP_URL';
  }

  const encryptionSecret = env.ENCRYPTION_SECRET?.trim();
  if (!encryptionSecret) {
    errors.push('credential encryption secret is missing (ENCRYPTION_SECRET)');
  } else if (encryptionSecret.length !== 32) {
    errors.push('credential encryption secret must be exactly 32 characters (ENCRYPTION_SECRET)');
  } else {
    configured['credential encryption secret'] = 'ENCRYPTION_SECRET';
  }

  return { ok: errors.length === 0, errors, configured };
}
