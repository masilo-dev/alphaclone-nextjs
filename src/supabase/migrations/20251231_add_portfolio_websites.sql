-- Add portfolio websites to showcase
-- These are completed client projects that should appear on the public portfolio page

-- Get the admin user's ID to use as owner for portfolio projects
WITH admin_user AS (
    SELECT id, name
    FROM public.profiles
    WHERE role = 'admin'
    LIMIT 1
)
INSERT INTO public.projects (
    owner_id,
    owner_name,
    name,
    category,
    status,
    current_stage,
    progress,
    due_date,
    team,
    description,
    contract_status,
    external_url,
    is_public,
    show_in_portfolio,
    image
)
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Yakazuma Store',
    'E-Commerce Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Modern e-commerce platform with seamless shopping experience and secure payment integration.',
    'Signed'::contract_status,
    'https://yakazuma.store/',
    true,
    true,
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80'
FROM admin_user
UNION ALL
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Movana',
    'Business Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Professional corporate website with elegant design and smooth user experience.',
    'Signed'::contract_status,
    'https://movana.com/',
    true,
    true,
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80'
FROM admin_user
UNION ALL
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Cozy Haven',
    'E-Commerce Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Cozy home decor e-commerce store with intuitive product browsing and checkout.',
    'Signed'::contract_status,
    'https://cozyhaven.co.uk/',
    true,
    true,
    'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&q=80'
FROM admin_user
UNION ALL
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Lunar Antiques',
    'E-Commerce Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Elegant antiques marketplace featuring vintage collections and secure transactions.',
    'Signed'::contract_status,
    'https://lunarantiques.co.uk/',
    true,
    true,
    'https://images.unsplash.com/photo-1582582621959-48d27397dc69?w=800&q=80'
FROM admin_user
UNION ALL
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Szymon Masaż',
    'Service Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Professional massage therapy website with online booking and service showcase.',
    'Signed'::contract_status,
    'https://szymon-masaz.pl/',
    true,
    true,
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'
FROM admin_user
UNION ALL
SELECT
    admin_user.id,
    'AlphaClone Portfolio',
    'Empowerement',
    'Business Website',
    'Completed'::project_status,
    'Deployment'::project_stage,
    100,
    '2024-12-31',
    ARRAY['AlphaClone Team'],
    'Empowerment coaching platform with modern design and engaging user experience.',
    'Signed'::contract_status,
    'https://empowerement.co.uk/',
    true,
    true,
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80'
FROM admin_user;

-- Verify the insert
SELECT name, external_url, is_public, show_in_portfolio
FROM public.projects
WHERE external_url IN (
    'https://yakazuma.store/',
    'https://movana.com/',
    'https://cozyhaven.co.uk/',
    'https://lunarantiques.co.uk/',
    'https://szymon-masaz.pl/',
    'https://empowerement.co.uk/'
)
ORDER BY created_at DESC;
