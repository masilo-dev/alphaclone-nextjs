-- Migration to backfill data for new Project Hub features
-- This must run AFTER the schema update to avoid enum transaction issues

-- Set defaults for existing rows to prevent null issues in UI
UPDATE projects SET health = 'On Track' WHERE health IS NULL;
UPDATE projects SET risk = 'Low' WHERE risk IS NULL;
UPDATE projects SET current_stage = 'Initiation' WHERE current_stage IS NULL;
