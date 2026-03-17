-- Add portfolio visibility fields to projects table
-- These fields control whether projects appear on the public portfolio page

-- Add is_public field (whether project is visible to public)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add show_in_portfolio field (whether to display in portfolio showcase)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS show_in_portfolio BOOLEAN DEFAULT false;

-- Create index for faster public portfolio queries
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_visibility
ON public.projects(is_public, show_in_portfolio, status)
WHERE is_public = true AND show_in_portfolio = true;

-- Update existing completed/active projects to show in portfolio
UPDATE public.projects
SET
    is_public = true,
    show_in_portfolio = true
WHERE
    status IN ('Completed', 'Active')
    AND (is_public IS NULL OR show_in_portfolio IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN public.projects.is_public IS 'Whether this project is visible to the public (non-authenticated users)';
COMMENT ON COLUMN public.projects.show_in_portfolio IS 'Whether to display this project in the public portfolio showcase';
