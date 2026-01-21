-- Migration to support Resource Allocation and Team Management
-- Adds necessary columns to profiles and projects tables

-- 1. Add skills and status to profiles for Team Members
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available'; -- 'Available', 'Busy', 'Offline', etc.

-- 2. Add team assignment array to projects
-- Storing simple array of user_ids for quick assignment
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS team UUID[] DEFAULT '{}';

-- 3. Add index for faster team lookups in projects
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects USING GIN (team);

-- 4. Update existing profiles with default values if needed
UPDATE profiles 
SET skills = '{General Access}' 
WHERE skills IS NULL;

UPDATE profiles 
SET status = 'Available' 
WHERE status IS NULL;
