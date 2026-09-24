/**
 * Centralized timeout constants for AlphaClone.
 *
 * Keep all timeout values here so they can be referenced consistently across
 * the codebase and adjusted without hunting through multiple files.
 *
 * CATEGORIES
 * ----------
 * DB_INTERACTIVE   — Supabase queries initiated by a live user request (short).
 * DB_BACKGROUND    — Supabase queries inside cron/worker tasks (longer budget).
 * EXTERNAL_API     — Third-party REST calls (LinkedIn, Facebook, Cal.com, etc.).
 * AI               — LLM inference calls (OpenAI, Claude, DeepSeek, OpenRouter).
 * OAUTH            — OAuth token exchange / revocation flows.
 * SCRAPER          — Website crawling / page fetch.
 * HEALTH           — Readiness probe DB ping.
 * WORKER_TICK      — Max wall-clock budget for one background worker tick.
 */

/** Database — interactive (user-initiated) queries */
export const DB_INTERACTIVE_TIMEOUT_MS = 8_000;

/** Database — background / cron queries */
export const DB_BACKGROUND_TIMEOUT_MS = 25_000;

/** External REST API calls (social, calendar, CRM integrations) */
export const EXTERNAL_API_TIMEOUT_MS = 15_000;

/** AI inference (standard models) */
export const AI_TIMEOUT_MS = 60_000;

/** AI inference (long-running or streaming) */
export const AI_LONG_TIMEOUT_MS = 120_000;

/** OAuth token exchange / revocation */
export const OAUTH_TIMEOUT_MS = 10_000;

/** Website crawl / public page fetch */
export const SCRAPER_PAGE_TIMEOUT_MS = 8_000;

/** Website crawl total budget */
export const SCRAPER_CRAWL_TIMEOUT_MS = 45_000;

/** Health/readiness DB ping */
export const HEALTH_DB_TIMEOUT_MS = 3_000;

/** Background worker — max budget for a single tick */
export const WORKER_TICK_TIMEOUT_MS = 55_000;

/** MCP tool — synchronous execution budget */
export const MCP_SYNC_TIMEOUT_MS = 15_000;

/** MCP tool — heavy synchronous execution budget */
export const MCP_HEAVY_SYNC_TIMEOUT_MS = 25_000;

/** MCP tool — social publish budget */
export const MCP_SOCIAL_PUBLISH_TIMEOUT_MS = 45_000;
