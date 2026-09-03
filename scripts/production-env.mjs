const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const CREDENTIAL_ENCRYPTION_ENV_CANDIDATES = [
  "INTEGRATION_TOKEN_ENCRYPTION_SECRET",
  "ENCRYPTION_SECRET",
  "ZOHO_ENCRYPTION_SECRET",
  "TOKEN_ENCRYPTION_SECRET",
  "MCP_ENCRYPTION_KEY",
  "CREDENTIAL_ENCRYPTION_KEY",
];

const MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH = 32;

function resolveCredentialEncryptionFromEnv(env) {
  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = env[name]?.trim();
    if (raw && raw.length >= MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH) {
      return { secret: raw, source: name };
    }
  }
  return null;
}

function describeCredentialEncryptionEnv(env) {
  const errors = [];
  let hasValid = false;

  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    if (raw.length >= MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH) {
      hasValid = true;
    } else {
      errors.push(
        `${name} is set but must be at least ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH} characters for MCP credential encryption`,
      );
    }
  }

  if (!hasValid) {
    errors.push(
      `credential encryption secret is missing or invalid (${CREDENTIAL_ENCRYPTION_ENV_CANDIDATES.join(" or ")}, ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH}+ chars)`,
    );
  }

  return errors;
}

function firstPresent(env, names) {
  return names.find(
    (name) => typeof env[name] === "string" && env[name].trim().length > 0,
  );
}

function isSupabaseServiceRoleKey(key) {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  const parts = trimmed.split(".");
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function resolveSupabaseServiceRoleKey(env) {
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"]) {
    const key = env[name]?.trim();
    if (key && isSupabaseServiceRoleKey(key)) return { key, source: name };
  }
  return null;
}

function checkUrl(value, { https = false, publicProduction = false } = {}) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (https && url.protocol !== "https:") return false;
    if (
      publicProduction &&
      (LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".vercel.app"))
    ) {
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

  for (const name of Object.keys(env)) {
    if (
      /^(?:NEXT_PUBLIC_|VITE_)/.test(name) &&
      /(?:SERVICE_ROLE|DATABASE_URL|SMTP_PASS|WEBHOOK_SECRET|ENCRYPTION_SECRET|PRIVATE_KEY)/.test(name) &&
      typeof env[name] === "string" &&
      env[name].trim()
    ) {
      errors.push(`server secret must not use a public environment prefix (${name})`);
    }
  }

  const requiredGroups = [
    {
      label: "Supabase URL",
      names: ["NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"],
      validate: (value) => checkUrl(value, { https: true }),
    },
    {
      label: "Supabase anonymous key",
      names: [
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_PUBLISHABLE_KEY",
      ],
    },
    {
      label: "Supabase service-role key",
      names: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"],
    },
    {
      label: "cron authentication secret",
      names: ["CRON_SECRET", "INTERNAL_API_KEY"],
    },
    {
      label: "platform transactional email key",
      names: ["BREVO_PLATFORM_API_KEY", "BREVO_API_KEY", "SENDINBLUE_API_KEY"],
    },
    {
      label: "Cloudflare Turnstile secret",
      names: ["TURNSTILE_SECRET", "TURNSTILE_SECRET_KEY"],
    },
    {
      label: "Cloudflare Turnstile site key",
      names: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
    },
  ];

  for (const group of requiredGroups) {
    const selected = firstPresent(env, group.names);
    if (!selected) {
      errors.push(`${group.label} is missing (${group.names.join(" or ")})`);
      continue;
    }
    const value = env[selected].trim();
    if (group.validate && !group.validate(value)) {
      errors.push(`${group.label} is invalid (${selected})`);
      continue;
    }
    configured[group.label] = selected;
  }

  const serviceRole = resolveSupabaseServiceRoleKey(env);
  if (!serviceRole) {
    const rawKeyName = firstPresent(env, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"]);
    if (rawKeyName) {
      errors.push(
        `${rawKeyName} is set but is not a verified service_role JWT — use the Supabase service role key, not the anon/publishable key`,
      );
    }
  } else {
    configured["Supabase service-role key"] = serviceRole.source;
  }

  const appUrl =
    env.PUBLIC_APP_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    errors.push(
      "public application URL is missing (PUBLIC_APP_ORIGIN or NEXT_PUBLIC_APP_URL)",
    );
  } else if (!checkUrl(appUrl, { https: true, publicProduction: true })) {
    errors.push(
      "public application URL must be a non-local HTTPS URL and must not use vercel.app",
    );
  } else {
    configured["public application URL"] = env.PUBLIC_APP_ORIGIN?.trim()
      ? "PUBLIC_APP_ORIGIN"
      : "NEXT_PUBLIC_APP_URL";
  }

  const configuredOrigins = [
    ["PUBLIC_APP_ORIGIN", env.PUBLIC_APP_ORIGIN],
    ["NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL],
    ["NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL],
    ["APP_URL", env.APP_URL],
    ["SUPABASE_AUTH_REDIRECT_URL", env.SUPABASE_AUTH_REDIRECT_URL],
  ].filter(([, value]) => typeof value === "string" && value.trim());
  const normalizedOrigins = new Set(
    configuredOrigins.flatMap(([, value]) => {
      try { return [new URL(value.trim()).origin.toLowerCase()]; }
      catch { return []; }
    }),
  );
  if (normalizedOrigins.size > 1) {
    errors.push(`contradictory public URL variables (${configuredOrigins.map(([name]) => name).join(", ")})`);
  }

  const mcpResource = env.PUBLIC_MCP_RESOURCE?.trim();
  if (mcpResource) {
    if (!checkUrl(mcpResource, { https: true, publicProduction: true })) {
      errors.push("PUBLIC_MCP_RESOURCE must be a non-local HTTPS URL");
    } else if (!mcpResource.includes("/api/mcp")) {
      errors.push(
        "PUBLIC_MCP_RESOURCE must point at the /api/mcp resource path",
      );
    } else {
      configured["MCP resource"] = "PUBLIC_MCP_RESOURCE";
    }
  } else {
    configured["MCP resource"] = "derived from public origin";
  }

  const encryptionErrors = describeCredentialEncryptionEnv(env);
  for (const error of encryptionErrors) {
    errors.push(error);
  }
  const encryptionResolved = resolveCredentialEncryptionFromEnv(env);
  if (encryptionResolved) {
    configured["credential encryption secret"] = encryptionResolved.source;
  }

  const redisUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  // Opt-in only. Defaulting Redis-required on NODE_ENV=production blocked Railway
  // healthchecks when Upstash was unset (process exited before `next start` listened).
  const redisRequired =
    env.REDIS_REQUIRED === "true" ||
    env.REDIS_REQUIRED === "1" ||
    env.REQUIRE_REDIS === "true";
  if (redisRequired) {
    if (!redisUrl || !redisToken) {
      errors.push(
        "Redis is required when REDIS_REQUIRED=true (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).",
      );
    } else if (!checkUrl(redisUrl, { https: true })) {
      errors.push("UPSTASH_REDIS_REST_URL must be a valid HTTPS URL");
    } else {
      configured.Redis = "UPSTASH_REDIS_REST_URL";
    }
  } else if (redisUrl && redisToken) {
    configured.Redis = "UPSTASH_REDIS_REST_URL";
  }

  const smtpValues = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]
    .filter((name) => typeof env[name] === "string" && env[name].trim());
  if (smtpValues.length > 0 && smtpValues.length < 4) {
    errors.push("SMTP configuration is incomplete (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)");
  }

  if (env.STRIPE_SECRET_KEY?.trim() && !env.STRIPE_WEBHOOK_SECRET?.trim()) {
    errors.push("STRIPE_WEBHOOK_SECRET is required when Stripe is configured");
  }

  const emailLogoUrl =
    env.EMAIL_LOGO_URL?.trim() ||
    env.NEXT_PUBLIC_EMAIL_LOGO_URL?.trim() ||
    (appUrl ? `${appUrl.replace(/\/$/, "")}/email-assets/alphaclone-email-logo.png` : "");
  if (!emailLogoUrl) {
    errors.push("EMAIL_LOGO_URL is missing (or derive from PUBLIC_APP_ORIGIN + /email-assets/alphaclone-email-logo.png)");
  } else if (!checkUrl(emailLogoUrl, { https: true, publicProduction: true })) {
    errors.push("EMAIL_LOGO_URL must be an absolute HTTPS URL on the production domain");
  } else if (/placeholder|via\.placeholder|logo-email\.png|alphaclone\.tech/i.test(emailLogoUrl)) {
    errors.push("EMAIL_LOGO_URL must not use placeholder, legacy, or temporary domains");
  } else {
    configured["email logo URL"] = env.EMAIL_LOGO_URL?.trim() ? "EMAIL_LOGO_URL" : "derived";
  }

  const oauthProviders = [
    ['Microsoft OAuth', ['AZURE_CLIENT_ID', 'NEXT_PUBLIC_AZURE_CLIENT_ID', 'VITE_AZURE_CLIENT_ID'], ['AZURE_CLIENT_SECRET']],
    ['Zoho OAuth', ['ZOHO_CLIENT_ID', 'NEXT_PUBLIC_ZOHO_CLIENT_ID'], ['ZOHO_CLIENT_SECRET', 'ZOHO_ENCRYPTION_SECRET']],
    ['Google OAuth', ['GOOGLE_CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'], ['GOOGLE_CLIENT_SECRET']],
    ['LinkedIn OAuth', ['LINKEDIN_CLIENT_ID', 'NEXT_PUBLIC_LINKEDIN_CLIENT_ID'], ['LINKEDIN_CLIENT_SECRET']],
    ['HubSpot OAuth', ['HUBSPOT_CLIENT_ID', 'NEXT_PUBLIC_HUBSPOT_CLIENT_ID'], ['HUBSPOT_CLIENT_SECRET']],
    ['Slack OAuth', ['SLACK_CLIENT_ID'], ['SLACK_CLIENT_SECRET']],
    ['Zoom OAuth', ['ZOOM_CLIENT_ID', 'NEXT_PUBLIC_ZOOM_CLIENT_ID'], ['ZOOM_CLIENT_SECRET']],
  ];

  for (const [label, clientNames, requiredNames] of oauthProviders) {
    const clientName = firstPresent(env, clientNames);
    const configuredRequired = requiredNames.filter((name) => Boolean(env[name]?.trim()));
    if (!clientName && configuredRequired.length === 0) continue;
    if (!clientName) {
      errors.push(`${label} client ID is missing (${clientNames.join(' or ')})`);
      continue;
    }
    const missing = requiredNames.filter((name) => !env[name]?.trim());
    if (missing.length) {
      errors.push(`${label} configuration is incomplete (${missing.join(', ')} missing)`);
      continue;
    }
    configured[label] = clientName;
  }

  return { ok: errors.length === 0, errors, configured };
}
