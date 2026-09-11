/**
 * Comprehensive Industries Catalog
 * ─────────────────────────────────────────────────────────────────────────────
 * 50+ industries with specialized service packages and pricing
 * Each industry includes: keywords, services, common tax rates, and business models
 */

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  unit: string; // Made more flexible to handle various unit types
  category: string; // Added category field
  stages?: string[]; // Made optional
}

export interface Industry {
  id: string;
  name: string;
  keywords: string[];
  services: ServiceItem[];
  commonTaxRate: number; // Default tax rate for this industry
  businessModels: string[];
  description: string;
}

export const COMPREHENSIVE_INDUSTRIES: Industry[] = [
  // 1. Technology & IT
  {
    id: 'technology',
    name: 'Technology & IT Services',
    keywords: ['it service', 'software', 'tech', 'saas', 'web development', 'app development', 'cyber', 'data recovery', 'phone repair', 'it support', 'ai consult', 'cloud', 'devops', 'blockchain'],
    services: [
      { id: 'web_dev', name: 'Web Development', description: 'Custom website and web application development', defaultPrice: 5000, unit: 'project', category: 'Development' },
      { id: 'mobile_dev', name: 'Mobile App Development', description: 'iOS and Android application development', defaultPrice: 15000, unit: 'project', category: 'Development' },
      { id: 'cybersecurity', name: 'Cybersecurity Services', description: 'Security audits, penetration testing, and protection', defaultPrice: 200, unit: 'hour', category: 'Security' },
      { id: 'cloud_consulting', name: 'Cloud Migration', description: 'AWS, Azure, Google Cloud setup and migration', defaultPrice: 8000, unit: 'project', category: 'Infrastructure' },
      { id: 'data_analytics', name: 'Data Analytics', description: 'Business intelligence and data visualization', defaultPrice: 150, unit: 'hour', category: 'Analytics' },
      { id: 'it_support', name: 'IT Support', description: 'Managed IT services and technical support', defaultPrice: 120, unit: 'hour', category: 'Support' },
    ],
    commonTaxRate: 0,
    businessModels: ['SaaS', 'Project-based', 'Retainer', 'Hourly'],
    description: 'Software development, IT consulting, and technology solutions'
  },

  // 2. Healthcare
  {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    keywords: ['dentist', 'chiropr', 'optom', 'dermat', 'pediatr', 'veterinar', 'pharmacy', 'mental health', 'massage', 'urgent care', 'acupunct', 'hearing', 'physical therap', 'medical', 'clinic', 'hospital'],
    services: [
      { id: 'medical_consultation', name: 'Medical Consultation', description: 'General medical consultation and examination', defaultPrice: 150, unit: 'hour', category: 'Clinical' },
      { id: 'dental_services', name: 'Dental Services', description: 'General and specialized dental procedures', defaultPrice: 200, unit: 'hour', category: 'Dental' },
      { id: 'mental_health', name: 'Mental Health Counseling', description: 'Therapy and counseling services', defaultPrice: 120, unit: 'hour', category: 'Mental Health' },
      { id: 'physical_therapy', name: 'Physical Therapy', description: 'Rehabilitation and physical therapy sessions', defaultPrice: 100, unit: 'hour', category: 'Therapy' },
      { id: 'veterinary_services', name: 'Veterinary Care', description: 'Animal health and veterinary services', defaultPrice: 80, unit: 'hour', category: 'Veterinary' },
    ],
    commonTaxRate: 0,
    businessModels: ['Fee-for-service', 'Insurance', 'Subscription', 'Hourly'],
    description: 'Medical services, healthcare providers, and wellness services'
  },

  // 3. Construction & Trades
  {
    id: 'construction',
    name: 'Construction & Trades',
    keywords: ['contractor', 'cabinet', 'concrete', 'demolition', 'fencing', 'masonry', 'insulation', 'drywall', 'excavation', 'paving', 'construction', 'plumb', 'hvac', 'electric', 'roofing', 'landscap', 'pest control', 'locksmith', 'handyman', 'gutter', 'tree service', 'solar', 'pool', 'flooring', 'painting', 'garage door'],
    services: [
      { id: 'general_contracting', name: 'General Contracting', description: 'Full construction project management', defaultPrice: 50000, unit: 'project', category: 'Construction' },
      { id: 'plumbing', name: 'Plumbing Services', description: 'Installation and repair of plumbing systems', defaultPrice: 85, unit: 'hour', category: 'Trades' },
      { id: 'electrical', name: 'Electrical Services', description: 'Electrical installation and repair', defaultPrice: 95, unit: 'hour', category: 'Trades' },
      { id: 'hvac', name: 'HVAC Services', description: 'Heating, ventilation, and air conditioning', defaultPrice: 90, unit: 'hour', category: 'Trades' },
      { id: 'roofing', name: 'Roofing Services', description: 'Roof installation, repair, and maintenance', defaultPrice: 8000, unit: 'project', category: 'Construction' },
      { id: 'landscaping', name: 'Landscaping', description: 'Landscape design and maintenance', defaultPrice: 60, unit: 'hour', category: 'Outdoor' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Project-based', 'Hourly', 'Fixed-fee', 'Maintenance contracts'],
    description: 'Construction, home improvement, and skilled trades'
  },

  // 4. Professional Services
  {
    id: 'professional_services',
    name: 'Professional Services',
    keywords: ['law', 'lawyer', 'attorney', 'accountant', 'financial advisor', 'insurance', 'mortgage', 'consultant', 'marketing agency', 'advertising', 'pr firm', 'notary', 'tax consultant', 'real estate', 'business consulting'],
    services: [
      { id: 'legal_services', name: 'Legal Services', description: 'Legal consultation and representation', defaultPrice: 300, unit: 'hour', category: 'Legal' },
      { id: 'accounting', name: 'Accounting Services', description: 'Bookkeeping, tax preparation, and financial reporting', defaultPrice: 150, unit: 'hour', category: 'Finance' },
      { id: 'business_consulting', name: 'Business Consulting', description: 'Strategic business advice and planning', defaultPrice: 200, unit: 'hour', category: 'Consulting' },
      { id: 'marketing_agency', name: 'Marketing Services', description: 'Comprehensive marketing strategy and execution', defaultPrice: 2500, unit: 'month', category: 'Marketing' },
      { id: 'financial_advisory', name: 'Financial Advisory', description: 'Investment and financial planning services', defaultPrice: 180, unit: 'hour', category: 'Finance' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Retainer', 'Project-based', 'Success-based'],
    description: 'Legal, financial, consulting, and business advisory services'
  },

  // 5. Retail & E-commerce
  {
    id: 'retail',
    name: 'Retail & E-commerce',
    keywords: ['grocery', 'clothing', 'furniture', 'pet store', 'bookstore', 'gift shop', 'hardware', 'jewellery', 'electronics', 'retail', 'store', 'shop', 'ecommerce', 'online store'],
    services: [
      { id: 'retail_consulting', name: 'Retail Consulting', description: 'Store operations and retail strategy', defaultPrice: 120, unit: 'hour', category: 'Consulting' },
      { id: 'ecommerce_setup', name: 'E-commerce Setup', description: 'Online store development and setup', defaultPrice: 3000, unit: 'project', category: 'Digital' },
      { id: 'inventory_management', name: 'Inventory Management', description: 'Stock control and logistics optimization', defaultPrice: 80, unit: 'hour', category: 'Operations' },
      { id: 'merchandising', name: 'Visual Merchandising', description: 'Store layout and product display optimization', defaultPrice: 500, unit: 'project', category: 'Marketing' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['B2C', 'B2B', 'Marketplace', 'Subscription'],
    description: 'Physical retail stores and e-commerce businesses'
  },

  // 6. Hospitality & Food Service
  {
    id: 'hospitality',
    name: 'Hospitality & Food Service',
    keywords: ['restaurant', 'cafe', 'bakery', 'bar', 'catering', 'food truck', 'pizza', 'sushi', 'steakhouse', 'hotel', 'bed and breakfast', 'night club', 'event venue'],
    services: [
      { id: 'restaurant_consulting', name: 'Restaurant Consulting', description: 'Menu development and operations optimization', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'catering', name: 'Catering Services', description: 'Event and special occasion catering', defaultPrice: 25, unit: 'person', category: 'Food Service' },
      { id: 'event_planning', name: 'Event Planning', description: 'Complete event coordination and management', defaultPrice: 2000, unit: 'project', category: 'Events' },
      { id: 'hotel_management', name: 'Hotel Management', description: 'Hospitality operations and guest services', defaultPrice: 100, unit: 'hour', category: 'Management' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Direct sales', 'Subscription', 'Commission', 'Franchise'],
    description: 'Restaurants, hotels, bars, and food service businesses'
  },

  // 7. Education & Training
  {
    id: 'education',
    name: 'Education & Training',
    keywords: ['tutoring', 'driving school', 'music school', 'childcare', 'preschool', 'language school', 'art class', 'dance studio', 'education', 'training', 'online course', 'certification'],
    services: [
      { id: 'tutoring', name: 'Academic Tutoring', description: 'Subject-specific academic support', defaultPrice: 50, unit: 'hour', category: 'Education' },
      { id: 'corporate_training', name: 'Corporate Training', description: 'Professional development and skills training', defaultPrice: 150, unit: 'hour', category: 'Training' },
      { id: 'online_courses', name: 'Online Course Development', description: 'Digital course creation and deployment', defaultPrice: 3000, unit: 'project', category: 'Digital' },
      { id: 'childcare', name: 'Childcare Services', description: 'Daycare and early childhood education', defaultPrice: 12, unit: 'hour', category: 'Care' },
    ],
    commonTaxRate: 0,
    businessModels: ['Tuition', 'Subscription', 'Pay-per-course', 'Hourly'],
    description: 'Educational institutions, training centers, and online learning'
  },

  // 8. Manufacturing
  {
    id: 'manufacturing',
    name: 'Manufacturing & Production',
    keywords: ['manufacturing', 'production', 'factory', 'industrial', 'fabrication', 'assembly', 'machining', '3d printing', 'textile', 'food processing'],
    services: [
      { id: 'custom_manufacturing', name: 'Custom Manufacturing', description: 'Bespoke product manufacturing', defaultPrice: 10000, unit: 'project', category: 'Production' },
      { id: 'prototyping', name: 'Product Prototyping', description: 'Rapid prototyping and product development', defaultPrice: 5000, unit: 'project', category: 'Development' },
      { id: 'quality_control', name: 'Quality Control', description: 'Product testing and quality assurance', defaultPrice: 80, unit: 'hour', category: 'Quality' },
      { id: 'supply_chain', name: 'Supply Chain Management', description: 'Logistics and supply chain optimization', defaultPrice: 120, unit: 'hour', category: 'Logistics' },
    ],
    commonTaxRate: 0.07,
    businessModels: ['B2B', 'B2C', 'OEM', 'Contract manufacturing'],
    description: 'Industrial manufacturing and production facilities'
  },

  // 9. Transportation & Logistics
  {
    id: 'transportation',
    name: 'Transportation & Logistics',
    keywords: ['auto', 'car', 'towing', 'car wash', 'tire', 'moving', 'trucking', 'limousine', 'auto glass', 'transport', 'logistics', 'shipping', 'delivery', 'warehouse'],
    services: [
      { id: 'freight_services', name: 'Freight Services', description: 'Goods transportation and shipping', defaultPrice: 2, unit: 'mile', category: 'Transport' },
      { id: 'moving_services', name: 'Moving Services', description: 'Residential and commercial moving', defaultPrice: 150, unit: 'hour', category: 'Transport' },
      { id: 'auto_repair', name: 'Auto Repair', description: 'Vehicle maintenance and repair', defaultPrice: 85, unit: 'hour', category: 'Automotive' },
      { id: 'logistics_consulting', name: 'Logistics Consulting', description: 'Supply chain and logistics optimization', defaultPrice: 130, unit: 'hour', category: 'Consulting' },
    ],
    commonTaxRate: 0.06,
    businessModels: ['Per-mile', 'Hourly', 'Contract', 'Subscription'],
    description: 'Transportation, logistics, and automotive services'
  },

  // 10. Real Estate
  {
    id: 'real_estate',
    name: 'Real Estate',
    keywords: ['real estate', 'property management', 'realty', 'brokerage', 'rental', 'leasing', 'property development', 'commercial real estate'],
    services: [
      { id: 'property_management', name: 'Property Management', description: 'Residential and commercial property management', defaultPrice: 10, unit: 'month', category: 'Management' },
      { id: 'real_estate_consulting', name: 'Real Estate Consulting', description: 'Property investment and market analysis', defaultPrice: 200, unit: 'hour', category: 'Consulting' },
      { id: 'brokerage_services', name: 'Brokerage Services', description: 'Property buying and selling assistance', defaultPrice: 3, unit: 'percent', category: 'Sales' },
      { id: 'property_maintenance', name: 'Property Maintenance', description: 'Building maintenance and repairs', defaultPrice: 70, unit: 'hour', category: 'Maintenance' },
    ],
    commonTaxRate: 0,
    businessModels: ['Commission', 'Fee-based', 'Management fees', 'Hourly'],
    description: 'Real estate brokerage, property management, and development'
  },

  // 11. Finance & Insurance
  {
    id: 'finance',
    name: 'Finance & Insurance',
    keywords: ['banking', 'insurance', 'investment', 'financial planning', 'credit union', 'mortgage lending', 'wealth management', 'risk management'],
    services: [
      { id: 'financial_planning', name: 'Financial Planning', description: 'Personal and business financial planning', defaultPrice: 180, unit: 'hour', category: 'Planning' },
      { id: 'insurance_brokerage', name: 'Insurance Services', description: 'Insurance policy consultation and brokerage', defaultPrice: 200, unit: 'hour', category: 'Insurance' },
      { id: 'investment_advisory', name: 'Investment Advisory', description: 'Investment portfolio management and advice', defaultPrice: 1, unit: 'percent', category: 'Investment' },
      { id: 'risk_management', name: 'Risk Management', description: 'Business risk assessment and mitigation', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
    ],
    commonTaxRate: 0,
    businessModels: ['Fee-based', 'Commission', 'Assets under management', 'Subscription'],
    description: 'Banking, insurance, investment, and financial services'
  },

  // 12. Creative & Design
  {
    id: 'creative',
    name: 'Creative & Design',
    keywords: ['graphic design', 'web design', 'interior design', 'fashion design', 'photography', 'video production', 'animation', 'illustration', 'branding'],
    services: [
      { id: 'graphic_design', name: 'Graphic Design', description: 'Visual design and branding services', defaultPrice: 75, unit: 'hour', category: 'Design' },
      { id: 'web_design', name: 'Web Design', description: 'Website UI/UX design and development', defaultPrice: 4000, unit: 'project', category: 'Digital' },
      { id: 'interior_design', name: 'Interior Design', description: 'Residential and commercial interior design', defaultPrice: 120, unit: 'hour', category: 'Design' },
      { id: 'photography', name: 'Photography Services', description: 'Professional photography for various needs', defaultPrice: 200, unit: 'hour', category: 'Media' },
      { id: 'video_production', name: 'Video Production', description: 'Video creation and post-production', defaultPrice: 1500, unit: 'project', category: 'Media' },
    ],
    commonTaxRate: 0,
    businessModels: ['Project-based', 'Hourly', 'Retainer', 'License-based'],
    description: 'Design, photography, video, and creative services'
  },

  // 13. Entertainment & Media
  {
    id: 'entertainment',
    name: 'Entertainment & Media',
    keywords: ['entertainment', 'media', 'publishing', 'gaming', 'music', 'film', 'television', 'radio', 'streaming', 'events'],
    services: [
      { id: 'event_production', name: 'Event Production', description: 'Live event planning and production', defaultPrice: 5000, unit: 'project', category: 'Events' },
      { id: 'music_production', name: 'Music Production', description: 'Music recording and production services', defaultPrice: 100, unit: 'hour', category: 'Audio' },
      { id: 'content_creation', name: 'Content Creation', description: 'Digital content creation and management', defaultPrice: 80, unit: 'hour', category: 'Media' },
      { id: 'game_development', name: 'Game Development', description: 'Video game design and development', defaultPrice: 20000, unit: 'project', category: 'Development' },
    ],
    commonTaxRate: 0,
    businessModels: ['Project-based', 'Royalty', 'Subscription', 'Advertising'],
    description: 'Entertainment production, media, and content creation'
  },

  // 14. Agriculture & Farming
  {
    id: 'agriculture',
    name: 'Agriculture & Farming',
    keywords: ['agriculture', 'farming', 'livestock', 'crops', 'organic farming', 'dairy', 'poultry', 'aquaculture', 'horticulture'],
    services: [
      { id: 'farm_consulting', name: 'Farm Consulting', description: 'Agricultural business and operations consulting', defaultPrice: 100, unit: 'hour', category: 'Consulting' },
      { id: 'crop_management', name: 'Crop Management', description: 'Crop planning and management services', defaultPrice: 50, unit: 'acre', category: 'Agriculture' },
      { id: 'livestock_services', name: 'Livestock Services', description: 'Animal health and breeding services', defaultPrice: 75, unit: 'hour', category: 'Animal' },
      { id: 'organic_certification', name: 'Organic Certification', description: 'Organic farming certification assistance', defaultPrice: 2000, unit: 'project', category: 'Certification' },
    ],
    commonTaxRate: 0,
    businessModels: ['Direct sales', 'Wholesale', 'Subscription', 'Consulting'],
    description: 'Farming, agriculture, and food production'
  },

  // 15. Energy & Utilities
  {
    id: 'energy',
    name: 'Energy & Utilities',
    keywords: ['energy', 'utilities', 'electricity', 'gas', 'water', 'renewable energy', 'solar', 'wind', 'sustainability', 'green energy'],
    services: [
      { id: 'solar_installation', name: 'Solar Installation', description: 'Solar panel installation and maintenance', defaultPrice: 15000, unit: 'project', category: 'Renewable' },
      { id: 'energy_consulting', name: 'Energy Consulting', description: 'Energy efficiency and sustainability consulting', defaultPrice: 120, unit: 'hour', category: 'Consulting' },
      { id: 'utility_management', name: 'Utility Management', description: 'Utility cost optimization and management', defaultPrice: 80, unit: 'hour', category: 'Management' },
      { id: 'renewable_energy', name: 'Renewable Energy Solutions', description: 'Wind and renewable energy project development', defaultPrice: 50000, unit: 'project', category: 'Renewable' },
    ],
    commonTaxRate: 0,
    businessModels: ['Project-based', 'PPA', 'Leasing', 'Consulting'],
    description: 'Energy production, utilities, and renewable energy services'
  },

  // 16. Non-Profit & Social Services
  {
    id: 'nonprofit',
    name: 'Non-Profit & Social Services',
    keywords: ['nonprofit', 'charity', 'social services', 'community', 'foundation', 'ngo', 'fundraising', 'volunteer'],
    services: [
      { id: 'fundraising_consulting', name: 'Fundraising Consulting', description: 'Non-profit fundraising strategy and execution', defaultPrice: 100, unit: 'hour', category: 'Fundraising' },
      { id: 'grant_writing', name: 'Grant Writing', description: 'Grant proposal writing and management', defaultPrice: 80, unit: 'hour', category: 'Writing' },
      { id: 'program_management', name: 'Program Management', description: 'Non-profit program development and management', defaultPrice: 90, unit: 'hour', category: 'Management' },
      { id: 'volunteer_coordination', name: 'Volunteer Coordination', description: 'Volunteer recruitment and management', defaultPrice: 60, unit: 'hour', category: 'Management' },
    ],
    commonTaxRate: 0,
    businessModels: ['Grants', 'Donations', 'Service fees', 'Membership'],
    description: 'Charitable organizations and social service providers'
  },

  // 17. Government & Public Sector
  {
    id: 'government',
    name: 'Government & Public Sector',
    keywords: ['government', 'public sector', 'municipal', 'federal', 'state', 'public administration', 'civic'],
    services: [
      { id: 'public_consulting', name: 'Public Sector Consulting', description: 'Government process and efficiency consulting', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'policy_analysis', name: 'Policy Analysis', description: 'Public policy research and analysis', defaultPrice: 120, unit: 'hour', category: 'Research' },
      { id: 'civic_tech', name: 'Civic Technology', description: 'Digital solutions for public services', defaultPrice: 10000, unit: 'project', category: 'Technology' },
      { id: 'public_training', name: 'Public Sector Training', description: 'Government employee training and development', defaultPrice: 80, unit: 'hour', category: 'Training' },
    ],
    commonTaxRate: 0,
    businessModels: ['Contracts', 'Grants', 'Fee-for-service', 'Retainer'],
    description: 'Government agencies and public sector organizations'
  },

  // 18. Automotive
  {
    id: 'automotive',
    name: 'Automotive',
    keywords: ['automotive', 'car dealership', 'auto repair', 'car sales', 'vehicle', 'motorcycle', 'parts', 'accessories'],
    services: [
      { id: 'vehicle_sales', name: 'Vehicle Sales', description: 'New and used vehicle sales', defaultPrice: 500, unit: 'unit', category: 'Sales' },
      { id: 'auto_repair', name: 'Auto Repair & Maintenance', description: 'Vehicle repair and maintenance services', defaultPrice: 85, unit: 'hour', category: 'Service' },
      { id: 'parts_sales', name: 'Auto Parts', description: 'Automotive parts and accessories', defaultPrice: 25, unit: 'percent', category: 'Retail' },
      { id: 'vehicle_inspection', name: 'Vehicle Inspection', description: 'Safety and emissions inspections', defaultPrice: 50, unit: 'unit', category: 'Service' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Sales', 'Service', 'Parts', 'Financing'],
    description: 'Car dealerships, auto repair, and vehicle services'
  },

  // 19. Beauty & Personal Care
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    keywords: ['beauty', 'salon', 'spa', 'hair', 'nail', 'cosmetics', 'skincare', 'makeup', 'wellness', 'gym', 'yoga', 'pilates', 'tanning', 'massage'],
    services: [
      { id: 'hair_services', name: 'Hair Services', description: 'Hair cutting, styling, and coloring', defaultPrice: 60, unit: 'hour', category: 'Beauty' },
      { id: 'nail_services', name: 'Nail Services', description: 'Manicures, pedicures, and nail art', defaultPrice: 40, unit: 'hour', category: 'Beauty' },
      { id: 'skincare', name: 'Skincare Services', description: 'Facials and skin treatments', defaultPrice: 80, unit: 'hour', category: 'Beauty' },
      { id: 'massage_therapy', name: 'Massage Therapy', description: 'Therapeutic and relaxation massage', defaultPrice: 90, unit: 'hour', category: 'Wellness' },
      { id: 'fitness_training', name: 'Personal Training', description: 'Fitness and personal training services', defaultPrice: 70, unit: 'hour', category: 'Fitness' },
    ],
    commonTaxRate: 0,
    businessModels: ['Service-based', 'Membership', 'Product sales', 'Package deals'],
    description: 'Salons, spas, fitness centers, and personal care services'
  },

  // 20. Travel & Tourism
  {
    id: 'travel',
    name: 'Travel & Tourism',
    keywords: ['travel', 'tourism', 'travel agency', 'tour guide', 'hospitality', 'vacation', 'cruise', 'airline', 'hotel', 'resort'],
    services: [
      { id: 'travel_planning', name: 'Travel Planning', description: 'Custom travel itinerary planning', defaultPrice: 300, unit: 'project', category: 'Planning' },
      { id: 'tour_guides', name: 'Tour Guide Services', description: 'Guided tours and excursions', defaultPrice: 50, unit: 'hour', category: 'Tourism' },
      { id: 'travel_consulting', name: 'Travel Consulting', description: 'Travel industry consulting and advice', defaultPrice: 120, unit: 'hour', category: 'Consulting' },
      { id: 'hospitality_training', name: 'Hospitality Training', description: 'Tourism and hospitality staff training', defaultPrice: 80, unit: 'hour', category: 'Training' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Commission', 'Fee-based', 'Package deals', 'Subscription'],
    description: 'Travel agencies, tour operators, and tourism services'
  },

  // 21. Sports & Recreation
  {
    id: 'sports',
    name: 'Sports & Recreation',
    keywords: ['sports', 'recreation', 'fitness', 'golf', 'tennis', 'swimming', 'sports coaching', 'athletic training', 'sports equipment'],
    services: [
      { id: 'sports_coaching', name: 'Sports Coaching', description: 'Individual and team sports coaching', defaultPrice: 80, unit: 'hour', category: 'Coaching' },
      { id: 'athletic_training', name: 'Athletic Training', description: 'Sports performance and conditioning', defaultPrice: 100, unit: 'hour', category: 'Training' },
      { id: 'sports_consulting', name: 'Sports Consulting', description: 'Sports business and facility consulting', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'event_management', name: 'Sports Event Management', description: 'Sports tournament and event organization', defaultPrice: 5000, unit: 'project', category: 'Events' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Package deals', 'Membership', 'Event-based'],
    description: 'Sports coaching, training, and recreation services'
  },

  // 22. Cleaning & Maintenance
  {
    id: 'cleaning',
    name: 'Cleaning & Maintenance',
    keywords: ['cleaning', 'janitorial', 'maintenance', 'pressure washing', 'window cleaning', 'carpet cleaning', 'maid service', 'facility maintenance'],
    services: [
      { id: 'commercial_cleaning', name: 'Commercial Cleaning', description: 'Business and office cleaning services', defaultPrice: 40, unit: 'hour', category: 'Cleaning' },
      { id: 'residential_cleaning', name: 'Residential Cleaning', description: 'Home cleaning and maid services', defaultPrice: 50, unit: 'hour', category: 'Cleaning' },
      { id: 'carpet_cleaning', name: 'Carpet Cleaning', description: 'Professional carpet and upholstery cleaning', defaultPrice: 0.35, unit: 'sqft', category: 'Cleaning' },
      { id: 'pressure_washing', name: 'Pressure Washing', description: 'Exterior cleaning and pressure washing', defaultPrice: 0.25, unit: 'sqft', category: 'Cleaning' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Square footage', 'Monthly contracts', 'Per-room'],
    description: 'Professional cleaning and maintenance services'
  },

  // 23. Security Services
  {
    id: 'security',
    name: 'Security Services',
    keywords: ['security', 'private security', 'surveillance', 'alarm systems', 'security guards', 'private investigation', 'background checks'],
    services: [
      { id: 'security_guard', name: 'Security Guard Services', description: 'Armed and unarmed security personnel', defaultPrice: 25, unit: 'hour', category: 'Security' },
      { id: 'alarm_systems', name: 'Alarm Systems', description: 'Security system installation and monitoring', defaultPrice: 100, unit: 'month', category: 'Technology' },
      { id: 'surveillance', name: 'Surveillance Systems', description: 'CCTV and surveillance camera installation', defaultPrice: 2000, unit: 'project', category: 'Technology' },
      { id: 'investigation', name: 'Private Investigation', description: 'Private investigation and background checks', defaultPrice: 80, unit: 'hour', category: 'Investigation' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Monthly monitoring', 'Project-based', 'Retainer'],
    description: 'Security services, surveillance, and investigation'
  },

  // 24. Waste Management
  {
    id: 'waste',
    name: 'Waste Management & Recycling',
    keywords: ['waste management', 'recycling', 'garbage', 'trash', 'disposal', 'environmental', 'sustainability', 'composting'],
    services: [
      { id: 'waste_collection', name: 'Waste Collection', description: 'Residential and commercial waste collection', defaultPrice: 80, unit: 'month', category: 'Collection' },
      { id: 'recycling_services', name: 'Recycling Services', description: 'Recycling program management and processing', defaultPrice: 60, unit: 'month', category: 'Recycling' },
      { id: 'waste_consulting', name: 'Waste Consulting', description: 'Waste reduction and sustainability consulting', defaultPrice: 120, unit: 'hour', category: 'Consulting' },
      { id: 'hazardous_waste', name: 'Hazardous Waste Disposal', description: 'Specialized hazardous waste handling', defaultPrice: 500, unit: 'project', category: 'Disposal' },
    ],
    commonTaxRate: 0,
    businessModels: ['Monthly contracts', 'Per-ton', 'Consulting', 'Project-based'],
    description: 'Waste collection, recycling, and environmental services'
  },

  // 25. Telecommunications
  {
    id: 'telecommunications',
    name: 'Telecommunications',
    keywords: ['telecommunications', 'telecom', 'internet', 'phone service', 'voip', 'fiber optic', 'wireless', 'communications'],
    services: [
      { id: 'internet_service', name: 'Internet Service', description: 'High-speed internet and broadband services', defaultPrice: 80, unit: 'month', category: 'Service' },
      { id: 'phone_systems', name: 'Phone Systems', description: 'VoIP and business phone solutions', defaultPrice: 50, unit: 'month', category: 'Service' },
      { id: 'network_consulting', name: 'Network Consulting', description: 'Telecommunications network design and optimization', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'fiber_installation', name: 'Fiber Installation', description: 'Fiber optic cable installation and maintenance', defaultPrice: 10000, unit: 'project', category: 'Installation' },
    ],
    commonTaxRate: 0,
    businessModels: ['Monthly subscriptions', 'Installation fees', 'Consulting', 'Maintenance contracts'],
    description: 'Internet, phone, and telecommunications services'
  },

  // 26. Consulting (General)
  {
    id: 'consulting',
    name: 'Management Consulting',
    keywords: ['consulting', 'management consulting', 'business consulting', 'strategy consulting', 'operations consulting', 'hr consulting'],
    services: [
      { id: 'strategy_consulting', name: 'Strategy Consulting', description: 'Business strategy and planning consulting', defaultPrice: 250, unit: 'hour', category: 'Strategy' },
      { id: 'operations_consulting', name: 'Operations Consulting', description: 'Business process optimization and efficiency', defaultPrice: 200, unit: 'hour', category: 'Operations' },
      { id: 'hr_consulting', name: 'HR Consulting', description: 'Human resources and organizational development', defaultPrice: 180, unit: 'hour', category: 'HR' },
      { id: 'management_training', name: 'Management Training', description: 'Leadership and management development', defaultPrice: 150, unit: 'hour', category: 'Training' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Project-based', 'Retainer', 'Success-based'],
    description: 'Business consulting and advisory services'
  },

  // 27. Marketing & Advertising
  {
    id: 'marketing',
    name: 'Marketing & Advertising',
    keywords: ['marketing', 'advertising', 'digital marketing', 'social media', 'content marketing', 'branding', 'pr', 'market research'],
    services: [
      { id: 'digital_marketing', name: 'Digital Marketing', description: 'Online marketing and advertising campaigns', defaultPrice: 2000, unit: 'month', category: 'Digital' },
      { id: 'social_media', name: 'Social Media Marketing', description: 'Social media management and advertising', defaultPrice: 1500, unit: 'month', category: 'Social' },
      { id: 'content_marketing', name: 'Content Marketing', description: 'Content creation and marketing strategy', defaultPrice: 100, unit: 'hour', category: 'Content' },
      { id: 'market_research', name: 'Market Research', description: 'Market analysis and consumer research', defaultPrice: 120, unit: 'hour', category: 'Research' },
    ],
    commonTaxRate: 0,
    businessModels: ['Retainer', 'Project-based', 'Performance-based', 'Hourly'],
    description: 'Marketing, advertising, and promotional services'
  },

  // 28. Printing & Publishing
  {
    id: 'printing',
    name: 'Printing & Publishing',
    keywords: ['printing', 'publishing', 'graphic printing', 'digital printing', 'offset printing', 'book publishing', 'magazine', 'newspaper'],
    services: [
      { id: 'commercial_printing', name: 'Commercial Printing', description: 'Business and marketing material printing', defaultPrice: 0.10, unit: 'page', category: 'Printing' },
      { id: 'digital_printing', name: 'Digital Printing', description: 'Short-run and on-demand printing', defaultPrice: 0.25, unit: 'page', category: 'Printing' },
      { id: 'publishing_services', name: 'Publishing Services', description: 'Book and magazine publishing services', defaultPrice: 5000, unit: 'project', category: 'Publishing' },
      { id: 'graphic_design_print', name: 'Graphic Design for Print', description: 'Print-ready design and layout', defaultPrice: 75, unit: 'hour', category: 'Design' },
    ],
    commonTaxRate: 0,
    businessModels: ['Per-unit', 'Project-based', 'Hourly', 'Royalty'],
    description: 'Printing services and publishing companies'
  },

  // 29. Photography & Videography
  {
    id: 'photography',
    name: 'Photography & Videography',
    keywords: ['photography', 'videography', 'video production', 'photo studio', 'wedding photography', 'commercial photography', 'drone photography'],
    services: [
      { id: 'wedding_photography', name: 'Wedding Photography', description: 'Wedding and event photography', defaultPrice: 3000, unit: 'event', category: 'Events' },
      { id: 'commercial_photography', name: 'Commercial Photography', description: 'Product and business photography', defaultPrice: 150, unit: 'hour', category: 'Commercial' },
      { id: 'video_production', name: 'Video Production', description: 'Professional video creation and editing', defaultPrice: 1500, unit: 'project', category: 'Video' },
      { id: 'drone_services', name: 'Drone Photography', description: 'Aerial photography and videography', defaultPrice: 300, unit: 'hour', category: 'Aerial' },
    ],
    commonTaxRate: 0,
    businessModels: ['Package deals', 'Hourly', 'Project-based', 'License-based'],
    description: 'Professional photography and videography services'
  },

  // 30. Event Planning & Management
  {
    id: 'events',
    name: 'Event Planning & Management',
    keywords: ['event planning', 'event management', 'wedding planning', 'corporate events', 'concerts', 'festivals', 'conferences'],
    services: [
      { id: 'event_planning', name: 'Event Planning', description: 'Complete event planning and coordination', defaultPrice: 2000, unit: 'project', category: 'Planning' },
      { id: 'wedding_planning', name: 'Wedding Planning', description: 'Wedding coordination and planning', defaultPrice: 5000, unit: 'event', category: 'Wedding' },
      { id: 'corporate_events', name: 'Corporate Events', description: 'Business event planning and management', defaultPrice: 3000, unit: 'project', category: 'Corporate' },
      { id: 'event_coordination', name: 'Event Coordination', description: 'Day-of event coordination services', defaultPrice: 500, unit: 'day', category: 'Coordination' },
    ],
    commonTaxRate: 0,
    businessModels: ['Package deals', 'Percentage-based', 'Hourly', 'Project-based'],
    description: 'Event planning, coordination, and management services'
  },

  // 31. Pet Services
  {
    id: 'pet_services',
    name: 'Pet Services',
    keywords: ['pet', 'veterinary', 'pet grooming', 'pet boarding', 'dog walking', 'pet training', 'pet supplies', 'animal care'],
    services: [
      { id: 'veterinary_care', name: 'Veterinary Services', description: 'Pet medical care and treatment', defaultPrice: 80, unit: 'hour', category: 'Medical' },
      { id: 'pet_grooming', name: 'Pet Grooming', description: 'Pet bathing, grooming, and styling', defaultPrice: 60, unit: 'hour', category: 'Grooming' },
      { id: 'pet_boarding', name: 'Pet Boarding', description: 'Pet boarding and daycare services', defaultPrice: 40, unit: 'day', category: 'Boarding' },
      { id: 'dog_walking', name: 'Dog Walking', description: 'Dog walking and exercise services', defaultPrice: 25, unit: 'hour', category: 'Exercise' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Daily rates', 'Package deals', 'Subscription'],
    description: 'Veterinary care, grooming, boarding, and pet services'
  },

  // 32. Fitness & Wellness
  {
    id: 'fitness',
    name: 'Fitness & Wellness',
    keywords: ['fitness', 'gym', 'yoga', 'pilates', 'personal training', 'wellness', 'health club', 'crossfit', 'bootcamp'],
    services: [
      { id: 'gym_membership', name: 'Gym Membership', description: 'Fitness center access and equipment', defaultPrice: 50, unit: 'month', category: 'Membership' },
      { id: 'personal_training', name: 'Personal Training', description: 'One-on-one fitness training', defaultPrice: 70, unit: 'hour', category: 'Training' },
      { id: 'group_classes', name: 'Group Fitness Classes', description: 'Group fitness and yoga classes', defaultPrice: 20, unit: 'class', category: 'Classes' },
      { id: 'wellness_coaching', name: 'Wellness Coaching', description: 'Health and wellness coaching', defaultPrice: 80, unit: 'hour', category: 'Coaching' },
    ],
    commonTaxRate: 0,
    businessModels: ['Membership', 'Class packages', 'Hourly', 'Subscription'],
    description: 'Fitness centers, yoga studios, and wellness services'
  },

  // 33. Legal Services
  {
    id: 'legal',
    name: 'Legal Services',
    keywords: ['legal', 'lawyer', 'attorney', 'law firm', 'legal services', 'paralegal', 'notary', 'legal aid'],
    services: [
      { id: 'legal_consultation', name: 'Legal Consultation', description: 'Legal advice and consultation', defaultPrice: 250, unit: 'hour', category: 'Consultation' },
      { id: 'document_review', name: 'Document Review', description: 'Legal document review and analysis', defaultPrice: 200, unit: 'hour', category: 'Review' },
      { id: 'court_representation', name: 'Court Representation', description: 'Legal representation in court', defaultPrice: 300, unit: 'hour', category: 'Litigation' },
      { id: 'contract_drafting', name: 'Contract Drafting', description: 'Legal contract creation and review', defaultPrice: 500, unit: 'project', category: 'Contracts' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Flat fees', 'Retainer', 'Contingency'],
    description: 'Law firms and legal service providers'
  },

  // 34. Accounting & Bookkeeping
  {
    id: 'accounting',
    name: 'Accounting & Bookkeeping',
    keywords: ['accounting', 'bookkeeping', 'cfo services', 'tax preparation', 'payroll', 'financial reporting', 'auditing'],
    services: [
      { id: 'bookkeeping', name: 'Bookkeeping Services', description: 'Daily financial record keeping', defaultPrice: 80, unit: 'hour', category: 'Bookkeeping' },
      { id: 'tax_preparation', name: 'Tax Preparation', description: 'Individual and business tax preparation', defaultPrice: 300, unit: 'return', category: 'Tax' },
      { id: 'payroll_services', name: 'Payroll Services', description: 'Payroll processing and management', defaultPrice: 50, unit: 'month', category: 'Payroll' },
      { id: 'cfo_services', name: 'CFO Services', description: 'Part-time chief financial officer services', defaultPrice: 200, unit: 'hour', category: 'CFO' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Monthly retainer', 'Per-return', 'Project-based'],
    description: 'Accounting firms and bookkeeping services'
  },

  // 35. Insurance Services
  {
    id: 'insurance_services',
    name: 'Insurance Services',
    keywords: ['insurance', 'insurance agency', 'brokerage', 'risk management', 'claims', 'underwriting'],
    services: [
      { id: 'insurance_consulting', name: 'Insurance Consulting', description: 'Insurance policy analysis and recommendations', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'risk_assessment', name: 'Risk Assessment', description: 'Business risk evaluation and management', defaultPrice: 200, unit: 'hour', category: 'Risk' },
      { id: 'claims_assistance', name: 'Claims Assistance', description: 'Insurance claims filing and management', defaultPrice: 100, unit: 'hour', category: 'Claims' },
      { id: 'compliance_review', name: 'Compliance Review', description: 'Insurance regulatory compliance', defaultPrice: 180, unit: 'hour', category: 'Compliance' },
    ],
    commonTaxRate: 0,
    businessModels: ['Commission', 'Fee-based', 'Consulting', 'Retainer'],
    description: 'Insurance agencies and risk management services'
  },

  // 36. Architecture & Engineering
  {
    id: 'architecture',
    name: 'Architecture & Engineering',
    keywords: ['architecture', 'engineering', 'structural engineering', 'civil engineering', 'mechanical engineering', 'electrical engineering', 'design'],
    services: [
      { id: 'architectural_design', name: 'Architectural Design', description: 'Building design and architecture', defaultPrice: 150, unit: 'hour', category: 'Design' },
      { id: 'structural_engineering', name: 'Structural Engineering', description: 'Structural analysis and design', defaultPrice: 120, unit: 'hour', category: 'Engineering' },
      { id: 'civil_engineering', name: 'Civil Engineering', description: 'Infrastructure and civil engineering', defaultPrice: 100, unit: 'hour', category: 'Engineering' },
      { id: 'project_management', name: 'Project Management', description: 'Construction project management', defaultPrice: 110, unit: 'hour', category: 'Management' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Percentage of construction', 'Fixed fees', 'Retainer'],
    description: 'Architectural and engineering services'
  },

  // 37. Scientific Research & Development
  {
    id: 'research',
    name: 'Scientific Research & Development',
    keywords: ['research', 'r&d', 'scientific', 'laboratory', 'testing', 'development', 'innovation', 'biotechnology'],
    services: [
      { id: 'research_services', name: 'Research Services', description: 'Scientific research and analysis', defaultPrice: 150, unit: 'hour', category: 'Research' },
      { id: 'laboratory_testing', name: 'Laboratory Testing', description: 'Scientific testing and analysis', defaultPrice: 200, unit: 'hour', category: 'Testing' },
      { id: 'r_and_d', name: 'R&D Services', description: 'Research and development consulting', defaultPrice: 180, unit: 'hour', category: 'Development' },
      { id: 'data_analysis', name: 'Data Analysis', description: 'Scientific data analysis and interpretation', defaultPrice: 120, unit: 'hour', category: 'Analysis' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Project-based', 'Grants', 'Retainer'],
    description: 'Scientific research and development services'
  },

  // 38. Environmental Services
  {
    id: 'environmental',
    name: 'Environmental Services',
    keywords: ['environmental', 'environmental consulting', 'sustainability', 'green', 'eco-friendly', 'conservation', 'environmental testing'],
    services: [
      { id: 'environmental_consulting', name: 'Environmental Consulting', description: 'Environmental impact and compliance consulting', defaultPrice: 140, unit: 'hour', category: 'Consulting' },
      { id: 'sustainability_services', name: 'Sustainability Services', description: 'Sustainability planning and implementation', defaultPrice: 120, unit: 'hour', category: 'Sustainability' },
      { id: 'environmental_testing', name: 'Environmental Testing', description: 'Environmental sampling and testing', defaultPrice: 100, unit: 'hour', category: 'Testing' },
      { id: 'compliance_services', name: 'Environmental Compliance', description: 'Environmental regulatory compliance', defaultPrice: 130, unit: 'hour', category: 'Compliance' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Project-based', 'Retainer', 'Government contracts'],
    description: 'Environmental consulting and sustainability services'
  },

  // 39. Human Resources
  {
    id: 'hr',
    name: 'Human Resources',
    keywords: ['human resources', 'hr', 'recruiting', 'staffing', 'employment', 'training', 'payroll', 'benefits'],
    services: [
      { id: 'recruiting_services', name: 'Recruiting Services', description: 'Talent acquisition and recruitment', defaultPrice: 25, unit: 'percent', category: 'Recruiting' },
      { id: 'hr_consulting', name: 'HR Consulting', description: 'Human resources strategy and compliance', defaultPrice: 120, unit: 'hour', category: 'Consulting' },
      { id: 'training_development', name: 'Training & Development', description: 'Employee training and development', defaultPrice: 80, unit: 'hour', category: 'Training' },
      { id: 'payroll_services', name: 'Payroll Services', description: 'Payroll processing and administration', defaultPrice: 50, unit: 'month', category: 'Payroll' },
    ],
    commonTaxRate: 0,
    businessModels: ['Percentage of salary', 'Hourly', 'Monthly retainer', 'Project-based'],
    description: 'Human resources consulting and staffing services'
  },

  // 40. Warehouse & Storage
  {
    id: 'warehouse',
    name: 'Warehouse & Storage',
    keywords: ['warehouse', 'storage', 'fulfillment', 'logistics', 'distribution', 'inventory', 'self-storage'],
    services: [
      { id: 'warehouse_services', name: 'Warehouse Services', description: 'Warehousing and storage solutions', defaultPrice: 5, unit: 'pallet', category: 'Storage' },
      { id: 'fulfillment_services', name: 'Fulfillment Services', description: 'Order fulfillment and shipping', defaultPrice: 3, unit: 'order', category: 'Fulfillment' },
      { id: 'inventory_management', name: 'Inventory Management', description: 'Stock control and inventory optimization', defaultPrice: 80, unit: 'hour', category: 'Management' },
      { id: 'self_storage', name: 'Self Storage', description: 'Self-storage unit rentals', defaultPrice: 100, unit: 'month', category: 'Storage' },
    ],
    commonTaxRate: 0,
    businessModels: ['Per-unit', 'Per-order', 'Monthly', 'Hourly'],
    description: 'Warehousing, storage, and fulfillment services'
  },

  // 41. Equipment Rental
  {
    id: 'equipment_rental',
    name: 'Equipment Rental',
    keywords: ['equipment rental', 'tool rental', 'heavy equipment', 'machinery rental', 'party rentals', 'audiovisual'],
    services: [
      { id: 'heavy_equipment', name: 'Heavy Equipment Rental', description: 'Construction and industrial equipment rental', defaultPrice: 200, unit: 'day', category: 'Industrial' },
      { id: 'tool_rental', name: 'Tool Rental', description: 'Professional tools and equipment rental', defaultPrice: 50, unit: 'day', category: 'Tools' },
      { id: 'party_rentals', name: 'Party Rentals', description: 'Event and party equipment rental', defaultPrice: 100, unit: 'day', category: 'Events' },
      { id: 'av_rentals', name: 'Audiovisual Rental', description: 'Audiovisual equipment rental', defaultPrice: 150, unit: 'day', category: 'AV' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Daily rates', 'Hourly', 'Weekly', 'Monthly'],
    description: 'Equipment rental and leasing services'
  },

  // 42. Marine & Maritime
  {
    id: 'marine',
    name: 'Marine & Maritime',
    keywords: ['marine', 'maritime', 'boating', 'shipping', 'port', 'dock', 'boat repair', 'marine services'],
    services: [
      { id: 'boat_repair', name: 'Boat Repair', description: 'Marine vessel repair and maintenance', defaultPrice: 100, unit: 'hour', category: 'Repair' },
      { id: 'marine_consulting', name: 'Marine Consulting', description: 'Marine industry consulting services', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'port_services', name: 'Port Services', description: 'Port and maritime services', defaultPrice: 80, unit: 'hour', category: 'Maritime' },
      { id: 'marine_transport', name: 'Marine Transport', description: 'Water transportation services', defaultPrice: 5, unit: 'mile', category: 'Transport' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Project-based', 'Per-mile', 'Contract'],
    description: 'Marine services, boat repair, and maritime operations'
  },

  // 43. Aviation & Aerospace
  {
    id: 'aviation',
    name: 'Aviation & Aerospace',
    keywords: ['aviation', 'aerospace', 'aircraft', 'airport', 'airline', 'pilot training', 'aircraft maintenance'],
    services: [
      { id: 'aircraft_maintenance', name: 'Aircraft Maintenance', description: 'Aircraft maintenance and repair', defaultPrice: 150, unit: 'hour', category: 'Maintenance' },
      { id: 'pilot_training', name: 'Pilot Training', description: 'Flight training and certification', defaultPrice: 200, unit: 'hour', category: 'Training' },
      { id: 'aviation_consulting', name: 'Aviation Consulting', description: 'Aviation industry consulting', defaultPrice: 180, unit: 'hour', category: 'Consulting' },
      { id: 'airport_services', name: 'Airport Services', description: 'Ground support and airport services', defaultPrice: 100, unit: 'hour', category: 'Services' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Training packages', 'Consulting', 'Contracts'],
    description: 'Aviation services, training, and aircraft maintenance'
  },

  // 44. Art & Antiques
  {
    id: 'art',
    name: 'Art & Antiques',
    keywords: ['art', 'antiques', 'gallery', 'art dealer', 'auction', 'collectibles', 'fine art'],
    services: [
      { id: 'art_consulting', name: 'Art Consulting', description: 'Art collection and investment consulting', defaultPrice: 150, unit: 'hour', category: 'Consulting' },
      { id: 'art_restoration', name: 'Art Restoration', description: 'Artwork and antique restoration', defaultPrice: 120, unit: 'hour', category: 'Restoration' },
      { id: 'gallery_services', name: 'Gallery Services', description: 'Art gallery management and curation', defaultPrice: 100, unit: 'hour', category: 'Gallery' },
      { id: 'auction_services', name: 'Auction Services', description: 'Art and antique auction services', defaultPrice: 15, unit: 'percent', category: 'Auction' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Commission', 'Hourly', 'Consignment', 'Consulting'],
    description: 'Art galleries, antique dealers, and auction services'
  },

  // 45. Jewelry & Watches
  {
    id: 'jewelry',
    name: 'Jewelry & Watches',
    keywords: ['jewelry', 'watches', 'jewelry repair', 'custom jewelry', 'watch repair', 'gold', 'diamonds'],
    services: [
      { id: 'jewelry_repair', name: 'Jewelry Repair', description: 'Jewelry repair and restoration', defaultPrice: 80, unit: 'hour', category: 'Repair' },
      { id: 'custom_jewelry', name: 'Custom Jewelry Design', description: 'Custom jewelry design and creation', defaultPrice: 500, unit: 'project', category: 'Design' },
      { id: 'watch_repair', name: 'Watch Repair', description: 'Watch repair and maintenance', defaultPrice: 100, unit: 'hour', category: 'Repair' },
      { id: 'appraisal_services', name: 'Appraisal Services', description: 'Jewelry and watch appraisal', defaultPrice: 150, unit: 'hour', category: 'Appraisal' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Hourly', 'Project-based', 'Commission', 'Retail'],
    description: 'Jewelry stores, watch repair, and custom design'
  },

  // 46. Music & Entertainment
  {
    id: 'music',
    name: 'Music & Entertainment',
    keywords: ['music', 'music lessons', 'instrument repair', 'dj services', 'live music', 'music production', 'recording studio'],
    services: [
      { id: 'music_lessons', name: 'Music Lessons', description: 'Instrument and vocal lessons', defaultPrice: 60, unit: 'hour', category: 'Education' },
      { id: 'instrument_repair', name: 'Instrument Repair', description: 'Musical instrument repair and maintenance', defaultPrice: 70, unit: 'hour', category: 'Repair' },
      { id: 'dj_services', name: 'DJ Services', description: 'Mobile DJ and entertainment services', defaultPrice: 150, unit: 'hour', category: 'Entertainment' },
      { id: 'recording_services', name: 'Recording Services', description: 'Music recording and production', defaultPrice: 100, unit: 'hour', category: 'Production' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Package deals', 'Project-based', 'Performance-based'],
    description: 'Music education, production, and entertainment services'
  },

  // 47. Pest Control
  {
    id: 'pest_control',
    name: 'Pest Control',
    keywords: ['pest control', 'exterminator', 'pest management', 'termite', 'rodent control', 'insect control'],
    services: [
      { id: 'pest_control_services', name: 'Pest Control Services', description: 'General pest control and extermination', defaultPrice: 80, unit: 'hour', category: 'Control' },
      { id: 'termite_treatment', name: 'Termite Treatment', description: 'Termite inspection and treatment', defaultPrice: 500, unit: 'project', category: 'Treatment' },
      { id: 'wildlife_removal', name: 'Wildlife Removal', description: 'Wildlife and nuisance animal removal', defaultPrice: 200, unit: 'project', category: 'Removal' },
      { id: 'prevention_services', name: 'Prevention Services', description: 'Pest prevention and maintenance', defaultPrice: 60, unit: 'month', category: 'Prevention' },
    ],
    commonTaxRate: 0,
    businessModels: ['Hourly', 'Project-based', 'Monthly contracts', 'Per-treatment'],
    description: 'Pest control and wildlife removal services'
  },

  // 48. Home Inspection
  {
    id: 'home_inspection',
    name: 'Home Inspection',
    keywords: ['home inspection', 'property inspection', 'building inspection', 'home inspector', 'real estate inspection'],
    services: [
      { id: 'home_inspection', name: 'Home Inspection', description: 'Residential property inspection', defaultPrice: 400, unit: 'inspection', category: 'Inspection' },
      { id: 'radon_testing', name: 'Radon Testing', description: 'Radon gas testing and mitigation', defaultPrice: 150, unit: 'test', category: 'Testing' },
      { id: 'mold_inspection', name: 'Mold Inspection', description: 'Mold inspection and testing', defaultPrice: 300, unit: 'inspection', category: 'Inspection' },
      { id: 'sewer_inspection', name: 'Sewer Inspection', description: 'Sewer line inspection and testing', defaultPrice: 250, unit: 'inspection', category: 'Inspection' },
    ],
    commonTaxRate: 0,
    businessModels: ['Per-inspection', 'Package deals', 'Hourly', 'Retainer'],
    description: 'Property inspection and testing services'
  },

  // 49. Notary Services
  {
    id: 'notary',
    name: 'Notary Services',
    keywords: ['notary', 'notary public', 'document notarization', 'legal documents', 'mobile notary'],
    services: [
      { id: 'notary_services', name: 'Notary Services', description: 'Document notarization and certification', defaultPrice: 15, unit: 'document', category: 'Notary' },
      { id: 'mobile_notary', name: 'Mobile Notary', description: 'Mobile notary services at your location', defaultPrice: 25, unit: 'document', category: 'Mobile' },
      { id: 'apostille_services', name: 'Apostille Services', description: 'Document apostille and legalization', defaultPrice: 100, unit: 'document', category: 'Legalization' },
      { id: 'witness_services', name: 'Witness Services', description: 'Document witnessing and certification', defaultPrice: 20, unit: 'document', category: 'Witness' },
    ],
    commonTaxRate: 0,
    businessModels: ['Per-document', 'Mobile fees', 'Package deals', 'Hourly'],
    description: 'Notary public and document certification services'
  },

  // 50. Custom Fabrication
  {
    id: 'fabrication',
    name: 'Custom Fabrication',
    keywords: ['fabrication', 'welding', 'metal work', 'custom fabrication', 'welding services', 'metal fabrication'],
    services: [
      { id: 'welding_services', name: 'Welding Services', description: 'Professional welding and metal fabrication', defaultPrice: 80, unit: 'hour', category: 'Welding' },
      { id: 'metal_fabrication', name: 'Metal Fabrication', description: 'Custom metal fabrication and design', defaultPrice: 100, unit: 'hour', category: 'Fabrication' },
      { id: 'custom_projects', name: 'Custom Projects', description: 'Bespoke fabrication projects', defaultPrice: 2000, unit: 'project', category: 'Custom' },
      { id: 'repair_services', name: 'Repair Services', description: 'Metal repair and restoration', defaultPrice: 70, unit: 'hour', category: 'Repair' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Hourly', 'Project-based', 'Per-pound', 'Fixed fee'],
    description: 'Custom metal fabrication and welding services'
  },

  // 51. Dry Cleaning & Laundry
  {
    id: 'dry_cleaning',
    name: 'Dry Cleaning & Laundry',
    keywords: ['dry cleaning', 'laundry', 'dry cleaner', 'laundry service', 'commercial laundry', 'wash and fold'],
    services: [
      { id: 'dry_cleaning', name: 'Dry Cleaning', description: 'Professional dry cleaning services', defaultPrice: 8, unit: 'garment', category: 'Dry Cleaning' },
      { id: 'laundry_service', name: 'Laundry Service', description: 'Wash and fold laundry services', defaultPrice: 2, unit: 'pound', category: 'Laundry' },
      { id: 'commercial_laundry', name: 'Commercial Laundry', description: 'Business and commercial laundry services', defaultPrice: 1.5, unit: 'pound', category: 'Commercial' },
      { id: 'alterations', name: 'Alterations', description: 'Clothing alterations and repairs', defaultPrice: 20, unit: 'item', category: 'Alterations' },
    ],
    commonTaxRate: 0,
    businessModels: ['Per-item', 'Per-pound', 'Monthly contracts', 'Subscription'],
    description: 'Dry cleaning and laundry services'
  },

  // 52. Signage & Graphics
  {
    id: 'signage',
    name: 'Signage & Graphics',
    keywords: ['signage', 'signs', 'banners', 'vehicle graphics', 'window graphics', 'digital signs', 'custom signs'],
    services: [
      { id: 'sign_design', name: 'Sign Design', description: 'Custom sign design and consultation', defaultPrice: 75, unit: 'hour', category: 'Design' },
      { id: 'sign_fabrication', name: 'Sign Fabrication', description: 'Custom sign manufacturing', defaultPrice: 500, unit: 'project', category: 'Fabrication' },
      { id: 'vehicle_graphics', name: 'Vehicle Graphics', description: 'Vehicle wraps and graphics', defaultPrice: 1500, unit: 'vehicle', category: 'Graphics' },
      { id: 'installation', name: 'Sign Installation', description: 'Professional sign installation', defaultPrice: 80, unit: 'hour', category: 'Installation' },
    ],
    commonTaxRate: 0.08,
    businessModels: ['Project-based', 'Hourly', 'Per-square-foot', 'Package deals'],
    description: 'Custom sign design, fabrication, and installation'
  }
];

// Helper function to find industry by keywords
export function findIndustryByNameOrKeyword(input: string): Industry | null {
  const lowerInput = input.toLowerCase();
  
  // First try exact match
  let industry = COMPREHENSIVE_INDUSTRIES.find(ind => 
    ind.name.toLowerCase().includes(lowerInput) || 
    lowerInput.includes(ind.name.toLowerCase())
  );
  
  // Then try keyword matching
  if (!industry) {
    industry = COMPREHENSIVE_INDUSTRIES.find(ind => 
      ind.keywords.some(keyword => 
        lowerInput.includes(keyword) || keyword.includes(lowerInput)
      )
    );
  }
  
  return industry || null;
}

// Helper function to get all industry names for dropdown
export function getAllIndustryNames(): string[] {
  return COMPREHENSIVE_INDUSTRIES.map(ind => ind.name).sort();
}

// Helper function to get services by industry
export function getServicesByIndustry(industryId: string): ServiceItem[] {
  const industry = COMPREHENSIVE_INDUSTRIES.find(ind => ind.id === industryId);
  return industry?.services || [];
}

// Helper function to calculate tax for an industry
export function calculateTax(amount: number, industryId: string, taxRate?: number): number {
  const industry = COMPREHENSIVE_INDUSTRIES.find(ind => ind.id === industryId);
  const effectiveTaxRate = taxRate || industry?.commonTaxRate || 0;
  return amount * effectiveTaxRate;
}
