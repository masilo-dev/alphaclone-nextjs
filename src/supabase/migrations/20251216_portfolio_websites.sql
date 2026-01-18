-- Portfolio Website Data Migration
-- Adds completed website projects to showcase in portfolio
-- First, get or create an admin user ID
DO $$
DECLARE admin_user_id uuid;
BEGIN -- Try to find an existing admin user
SELECT id INTO admin_user_id
FROM profiles
WHERE role = 'admin'
LIMIT 1;
-- If no admin found, use a generated UUID (you can replace this with actual admin ID later)
IF admin_user_id IS NULL THEN admin_user_id := gen_random_uuid();
RAISE NOTICE 'No admin user found. Using generated UUID: %',
admin_user_id;
END IF;
-- Insert completed website projects
INSERT INTO projects (
        id,
        owner_id,
        owner_name,
        name,
        category,
        status,
        current_stage,
        progress,
        due_date,
        team,
        image,
        description,
        created_at,
        updated_at
    )
VALUES (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'Yakazuma Store',
        'E-commerce Website',
        'Completed',
        'Maintenance',
        100,
        '2024-11-15',
        ARRAY ['Frontend Team', 'Backend Team', 'Design Team'],
        'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
        'Modern e-commerce platform featuring advanced product filtering, secure payment processing, and responsive design. Built with React and Node.js.',
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '10 days'
    ),
    (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'Movana',
        'Corporate Website',
        'Completed',
        'Maintenance',
        100,
        '2024-10-20',
        ARRAY ['Frontend Team', 'Design Team'],
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
        'Professional corporate website with sleek design, interactive animations, and comprehensive service showcase. Optimized for SEO and performance.',
        NOW() - INTERVAL '120 days',
        NOW() - INTERVAL '30 days'
    ),
    (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'CozyHaven',
        'Real Estate Website',
        'Completed',
        'Maintenance',
        100,
        '2024-12-01',
        ARRAY ['Frontend Team', 'Backend Team'],
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'Elegant real estate showcase platform with virtual tours, advanced search filters, and integrated booking system. Features stunning property galleries.',
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '5 days'
    ),
    (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'TechFlow Solutions',
        'SaaS Platform',
        'Completed',
        'Maintenance',
        100,
        '2024-09-30',
        ARRAY ['Full Stack Team', 'DevOps'],
        'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80',
        'Enterprise SaaS platform with real-time collaboration features, analytics dashboard, and API integrations. Built for scalability and performance.',
        NOW() - INTERVAL '150 days',
        NOW() - INTERVAL '45 days'
    ),
    (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'Wellness Hub',
        'Mobile App',
        'Completed',
        'Maintenance',
        100,
        '2024-11-01',
        ARRAY ['Mobile Team', 'Backend Team'],
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
        'Health and wellness mobile application with workout tracking, nutrition planning, and social features. Available on iOS and Android.',
        NOW() - INTERVAL '100 days',
        NOW() - INTERVAL '20 days'
    ),
    (
        gen_random_uuid(),
        admin_user_id,
        'AlphaClone Systems',
        'AI Assistant Pro',
        'AI Application',
        'Completed',
        'Maintenance',
        100,
        '2024-10-15',
        ARRAY ['AI Team', 'Backend Team'],
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
        'AI-powered virtual assistant with natural language processing, task automation, and intelligent recommendations. Powered by advanced machine learning.',
        NOW() - INTERVAL '110 days',
        NOW() - INTERVAL '25 days'
    ) ON CONFLICT (id) DO NOTHING;
RAISE NOTICE 'Portfolio projects inserted successfully!';
END $$;
-- Verify the data was inserted
SELECT id,
    name,
    category,
    status,
    progress
FROM projects
WHERE status = 'Completed';