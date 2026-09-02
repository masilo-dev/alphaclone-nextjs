-- Media proxy compatibility: document internal vs public URLs (no schema break).
-- public_url continues to store internal Supabase location for legacy rows.
-- Client-facing URLs are computed at runtime via /api/media/:assetId.

COMMENT ON COLUMN media_assets.public_url IS
  'Internal storage location (Supabase). Never expose in MCP/user responses; use /api/media/:id proxy.';

COMMENT ON COLUMN media_assets.storage_path IS
  'Private bucket path. Served only through authenticated/proxy media endpoint.';
