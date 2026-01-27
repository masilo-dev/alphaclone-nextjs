-- Create project_milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

-- Policies

-- Public Read Access: Allow if the parent project is public
CREATE POLICY "Public read access for project_milestones"
    ON project_milestones FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_milestones.project_id
            AND projects.is_public = true
        )
    );

-- Authenticated Management: Allow users to manage milestones for their own projects (or admins)
-- Assuming 'projects' uses owner_id for ownership and there's a tenant_id check
CREATE POLICY "Users can manage milestones for their projects"
    ON project_milestones FOR ALL
    USING (
        auth.uid() IN (
            SELECT owner_id FROM projects WHERE id = project_milestones.project_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_milestones.project_id 
            AND tenant_id IN (
                SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
        OR
        -- Super Admin Override (optional, adjust based on auth model)
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );
