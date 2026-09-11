-- Add deleted_at column for soft deletes
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Enable Row Level Security if not enabled (it likely is, but good practice)
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Add storage_limit to tenants (if not exists)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_limit BIGINT DEFAULT 104857600; -- Default 100MB
