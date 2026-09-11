-- Demo Data Generator for Dashboard Stats
-- Run this to populate your dashboard with realistic sample data

-- 1. Create sample clients (tenant_users with role='client')
INSERT INTO tenant_users (tenant_id, user_id, role, permissions)
SELECT 
    t.id as tenant_id,
    p.id as user_id,
    'client' as role,
    '[]'::jsonb as permissions
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id, name, email 
    FROM profiles 
    WHERE role = 'admin' 
    LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_users tu 
    WHERE tu.tenant_id = t.id AND tu.role = 'client'
)
LIMIT 3;

-- 2. Create sample projects
INSERT INTO projects (tenant_id, owner_id, name, category, status, progress, created_at)
SELECT 
    t.id as tenant_id,
    p.id as owner_id,
    'Website Redesign' as name,
    'Web Development' as category,
    'Active' as status,
    65 as progress,
    NOW() - INTERVAL '7 days' as created_at
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE tenant_id = t.id AND name = 'Website Redesign'
);

INSERT INTO projects (tenant_id, owner_id, name, category, status, progress, created_at)
SELECT 
    t.id as tenant_id,
    p.id as owner_id,
    'Mobile App Development' as name,
    'Mobile Development' as category,
    'Active' as status,
    35 as progress,
    NOW() - INTERVAL '14 days' as created_at
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE tenant_id = t.id AND name = 'Mobile App Development'
);

-- 3. Create sample leads
INSERT INTO leads (tenant_id, owner_id, company_name, contact_name, email, status, value, created_at)
SELECT 
    t.id as tenant_id,
    p.id as owner_id,
    'Tech Corp Inc' as company_name,
    'John Smith' as contact_name,
    'john@techcorp.com' as email,
    'new' as status,
    15000.00 as value,
    NOW() - INTERVAL '2 days' as created_at
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM leads 
    WHERE tenant_id = t.id AND company_name = 'Tech Corp Inc'
);

INSERT INTO leads (tenant_id, owner_id, company_name, contact_name, email, status, value, created_at)
SELECT 
    t.id as tenant_id,
    p.id as owner_id,
    'StartupXYZ' as company_name,
    'Sarah Johnson' as contact_name,
    'sarah@startupxyz.com' as email,
    'contacted' as status,
    8500.00 as value,
    NOW() - INTERVAL '5 days' as created_at
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM leads 
    WHERE tenant_id = t.id AND company_name = 'StartupXYZ'
);

-- 4. Create sample invoices (if business_invoices table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_invoices') THEN
        INSERT INTO business_invoices (tenant_id, user_id, total, status, created_at, due_date)
        SELECT 
            t.id as tenant_id,
            p.id as user_id,
            5000.00 as total,
            'paid' as status,
            NOW() - INTERVAL '30 days' as created_at,
            NOW() - INTERVAL '15 days' as due_date
        FROM tenants t
        CROSS JOIN LATERAL (
            SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
        ) p
        WHERE NOT EXISTS (
            SELECT 1 FROM business_invoices 
            WHERE tenant_id = t.id AND total = 5000.00
        );
        
        INSERT INTO business_invoices (tenant_id, user_id, total, status, created_at, due_date)
        SELECT 
            t.id as tenant_id,
            p.id as user_id,
            7500.00 as total,
            'sent' as status,
            NOW() - INTERVAL '10 days' as created_at,
            NOW() + INTERVAL '15 days' as due_date
        FROM tenants t
        CROSS JOIN LATERAL (
            SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
        ) p
        WHERE NOT EXISTS (
            SELECT 1 FROM business_invoices 
            WHERE tenant_id = t.id AND total = 7500.00
        );
    END IF;
END $$;

-- 5. Create sample activity logs
INSERT INTO activity_logs (tenant_id, user_id, action, created_at)
SELECT 
    t.id as tenant_id,
    p.id as user_id,
    'dashboard_view' as action,
    NOW() - INTERVAL '1 hour' as created_at
FROM tenants t
CROSS JOIN LATERAL (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
) p
WHERE NOT EXISTS (
    SELECT 1 FROM activity_logs 
    WHERE tenant_id = t.id AND created_at > NOW() - INTERVAL '2 hours'
);

-- 6. Create sample deals (if deals table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
        INSERT INTO deals (tenant_id, owner_id, company_name, value, stage, probability, created_at)
        SELECT 
            t.id as tenant_id,
            p.id as owner_id,
            'Tech Corp Inc' as company_name,
            15000.00 as value,
            'proposal' as stage,
            60 as probability,
            NOW() - INTERVAL '2 days' as created_at
        FROM tenants t
        CROSS JOIN LATERAL (
            SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
        ) p
        WHERE NOT EXISTS (
            SELECT 1 FROM deals 
            WHERE tenant_id = t.id AND company_name = 'Tech Corp Inc'
        );
    END IF;
END $$;

-- Return success message
SELECT 'Demo data created successfully! Refresh your dashboard to see the stats.' as result;
