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

  const appUrl =
    env.PUBLIC_APP_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    errors.push('public application URL is missing (PUBLIC_APP_ORIGIN or NEXT_PUBLIC_APP_URL)');
  } else if (!checkUrl(appUrl, { https: true, publicProduction: true })) {
    errors.push('public application URL must be a non-local HTTPS URL and must not use vercel.app');
  } else {
    configured['public application URL'] = env.PUBLIC_APP_ORIGIN?.trim()
      ? 'PUBLIC_APP_ORIGIN'
      : 'NEXT_PUBLIC_APP_URL';
  }

  const mcpResource = env.PUBLIC_MCP_RESOURCE?.trim();
  if (mcpResource) {
    if (!checkUrl(mcpResource, { https: true, publicProduction: true })) {
      errors.push('PUBLIC_MCP_RESOURCE must be a non-local HTTPS URL');
    } else if (!mcpResource.includes('/api/mcp')) {
      errors.push('PUBLIC_MCP_RESOURCE must point at the /api/mcp resource path');
    } else {
      configured['MCP resource'] = 'PUBLIC_MCP_RESOURCE';
    }
  } else {
    configured['MCP resource'] = 'derived from public origin';
  }

  const encryptionSecret = env.ENCRYPTION_SECRET?.trim();
  if (!encryptionSecret) {
    errors.push('credential encryption secret is missing (ENCRYPTION_SECRET)');
  } else if (encryptionSecret.length !== 32) {
    errors.push('credential encryption secret must be exactly 32 characters (ENCRYPTION_SECRET)');
  } else {
    configured['credential encryption secret'] = 'ENCRYPTION_SECRET';
  }

  const redisUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const redisOptOut =
    env.REDIS_REQUIRED === 'false' ||
    env.REDIS_REQUIRED === '0' ||
    env.REQUIRE_REDIS === 'false';
  const redisRequired =
    !redisOptOut &&
    (env.NODE_ENV === 'production' ||
      env.REDIS_REQUIRED === 'true' ||
      env.REDIS_REQUIRED === '1' ||
      env.REQUIRE_REDIS === 'true');
  if (redisRequired) {
    if (!redisUrl || !redisToken) {
      errors.push(
        'Redis is required in production (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN). Set REDIS_REQUIRED=false only for emergency single-instance deploys.'
      );
    } else if (!checkUrl(redisUrl, { https: true })) {
      errors.push('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL');
    } else {
      configured.Redis = 'UPSTASH_REDIS_REST_URL';
    }
  } else if (redisUrl && redisToken) {
    configured.Redis = 'UPSTASH_REDIS_REST_URL';
  }

  return { ok: errors.length === 0, errors, configured };
}
