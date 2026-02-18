-- Migration to support new Project Hub features (5-stage lifecycle, health dashboard)

-- 1. Update Project Stage Enum
-- Safely add new enum values to support the 5-stage lifecycle
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'Initiation';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'Planning';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'Execution';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'Review';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'Closure';

-- 2. Add Missing Columns to Projects Table from Phase 7 & 9
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS risk text DEFAULT 'Low';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS health text DEFAULT 'On Track';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS resources text[] DEFAULT '{}';

-- 3. Optional: Set defaults for existing rows to prevent null issues in UI
-- NOTE: Data updates moved to separate file to avoid "unsafe use of new enum value" error
-- UPDATE projects SET health = 'On Track' WHERE health IS NULL;
-- UPDATE projects SET risk = 'Low' WHERE risk IS NULL;
-- UPDATE projects SET current_stage = 'Initiation' WHERE current_stage IS NULL;
