
export interface ServiceCategory {
    name: string;
    services: ServiceItem[];
}

export interface ServiceItem {
    id: string;
    name: string;
    description: string;
    defaultPrice: number;
    unit: 'hour' | 'project' | 'month' | 'day';
    stages: string[];
}

/**
 * All individual service names from the catalog (50+), sorted for dropdowns.
 * Used by the contract generator and aligned with Settings → service sectors.
 */
export function getContractProjectTypeOptions(): string[] {
    const names = new Set<string>();
    for (const cat of UNIVERSAL_SERVICE_CATALOG) {
        for (const s of cat.services) {
            names.add(s.name);
        }
    }
    names.add('Other (describe fully in scope below)');
    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** Service line items belonging to tenant-selected sector categories (Settings). */
export function getPreferredContractProjectTypes(serviceSectorCategoryNames: string[]): string[] {
    if (!serviceSectorCategoryNames?.length) return [];
    const wanted = new Set(serviceSectorCategoryNames.map(s => s.trim()).filter(Boolean));
    const preferred: string[] = [];
    for (const cat of UNIVERSAL_SERVICE_CATALOG) {
        if (wanted.has(cat.name)) {
            for (const s of cat.services) preferred.push(s.name);
        }
    }
    return preferred;
}

export const UNIVERSAL_SERVICE_CATALOG: ServiceCategory[] = [
    {
        name: 'Creative & Design',
        services: [
            {
                id: 'graphic_design',
                name: 'Graphic Design',
                description: 'Professional visual content creation including logos, branding, and marketing materials.',
                defaultPrice: 500,
                unit: 'project',
                stages: ['Concept Development', 'Drafting', 'Revision Phase', 'Final Delivery']
            },
            {
                id: 'video_production',
                name: 'Video Production',
                description: 'Full-cycle video creation from storyboarding to final post-production editing.',
                defaultPrice: 2000,
                unit: 'project',
                stages: ['Pre-production', 'Filming', 'Post-production', 'Review', 'Final Export']
            },
            {
                id: 'photography',
                name: 'Professional Photography',
                description: 'Commercial photography for products, corporate events, or headshots.',
                defaultPrice: 150,
                unit: 'hour',
                stages: ['Shoot Planning', 'On-site Session', 'Photo Selection', 'Editing/Retouching']
            },
            {
                id: 'copywriting',
                name: 'Copywriting & Content',
                description: 'Persuasive writing for websites, blogs, and marketing campaigns.',
                defaultPrice: 0.1,
                unit: 'project', // price per word usually, but we'll use project default
                stages: ['Research', 'Drafting', 'Proofreading', 'Final Polish']
            }
        ]
    },
    {
        name: 'Digital Marketing',
        services: [
            {
                id: 'seo_optimization',
                name: 'SEO Optimization',
                description: 'Improving search engine visibility through technical and on-page improvements.',
                defaultPrice: 1200,
                unit: 'month',
                stages: ['Site Audit', 'Keyword Planning', 'On-Page Implementation', 'Backlink Building']
            },
            {
                id: 'social_media_mgmt',
                name: 'Social Media Management',
                description: 'Complete management of social profiles, content scheduling, and engagement.',
                defaultPrice: 1500,
                unit: 'month',
                stages: ['Content Calendar', 'Posting/Scheduling', 'Community Mgmt', 'Reporting']
            },
            {
                id: 'ppc_advertising',
                name: 'PPC Campaign Management',
                description: 'Management of paid search and social campaigns to drive traffic/leads.',
                defaultPrice: 800,
                unit: 'month',
                stages: ['Account Setup', 'Ad Creative', 'A/B Testing', 'Optimization']
            }
        ]
    },
    {
        name: 'Professional & Business Services',
        services: [
            {
                id: 'legal_consultation',
                name: 'Legal Consultation',
                description: 'Specialized legal advice for business contracts, IP, and compliance.',
                defaultPrice: 250,
                unit: 'hour',
                stages: ['Intake/Discovery', 'Document Review', 'Consultation', 'Summary Report']
            },
            {
                id: 'financial_planning',
                name: 'Financial Advisory',
                description: 'Strategic planning, bookkeeping, and tax preparation services.',
                defaultPrice: 150,
                unit: 'hour',
                stages: ['Data Collection', 'Analysis', 'Strategy Planning', 'Implementation']
            },
            {
                id: 'hr_consulting',
                name: 'HR & Talent Consulting',
                description: 'Talent acquisition, policy development, and employee relations.',
                defaultPrice: 120,
                unit: 'hour',
                stages: ['Needs Assessment', 'Policy Draft', 'Training Phase', 'Ongoing Support']
            },
            {
                id: 'business_coaching',
                name: 'Executive Coaching',
                description: 'Leadership development and strategic business performance coaching.',
                defaultPrice: 300,
                unit: 'hour',
                stages: ['Discovery Session', 'Action Plan', 'Coaching Cycles', 'Results Review']
            }
        ]
    },
    {
        name: 'Technical & Development',
        services: [
            {
                id: 'web_dev',
                name: 'Web Application Development',
                description: 'Building custom web platforms with modern frontend and backend tech.',
                defaultPrice: 5000,
                unit: 'project',
                stages: ['Discovery', 'Design', 'Frontend', 'Backend', 'QA/Launch']
            },
            {
                id: 'mobile_dev',
                name: 'Mobile App Development',
                description: 'Native or cross-platform apps for iOS and Android.',
                defaultPrice: 8000,
                unit: 'project',
                stages: ['UI/UX Design', 'Core Development', 'Integration', 'Store Deployment']
            },
            {
                id: 'it_security',
                name: 'Cyber Security Audit',
                description: 'Comprehensive security assessments, penetration testing, and hardening.',
                defaultPrice: 3000,
                unit: 'project',
                stages: ['Vulnerability Scan', 'Penetration Test', 'Remediation', 'Certification']
            },
            {
                id: 'data_analytics',
                name: 'Data Analytics & BI',
                description: 'Analyzing complex data sets to drive business insights.',
                defaultPrice: 150,
                unit: 'hour',
                stages: ['Data Gathering', 'Cleaning', 'Analysis', 'Dashboard Creation']
            }
        ]
    },
    {
        name: 'Home & Facilities Services',
        services: [
            {
                id: 'interior_design',
                name: 'Interior Design',
                description: 'Space planning, material selection, and aesthetic design for interiors.',
                defaultPrice: 200,
                unit: 'hour',
                stages: ['Concept Board', 'Design Development', 'Procurement', 'Installation']
            },
            {
                id: 'construction_mgmt',
                name: 'Construction Management',
                description: 'Overseeing construction projects from planning to final walkthrough.',
                defaultPrice: 0,
                unit: 'project',
                stages: ['Site Planning', 'Vendor Selection', 'Phased Building', 'Site Closeout']
            },
            {
                id: 'cleaning_services',
                name: 'Commercial Cleaning',
                description: 'Deep cleaning and maintenance for office and commercial spaces.',
                defaultPrice: 300,
                unit: 'project',
                stages: ['Audit', 'Initial Deep Clean', 'Recurring Cleaning Cycle']
            },
            {
                id: 'event_planning',
                name: 'Event Management',
                description: 'Corporate and personal event planning, coordination, and execution.',
                defaultPrice: 2500,
                unit: 'project',
                stages: ['Venue Search', 'Vendor Coordination', 'Logistics', 'Event Day Support']
            }
        ]
    },
    {
        name: 'Logistics & Supply Chain',
        services: [
            {
                id: 'freight_forwarding',
                name: 'Freight Forwarding',
                description: 'International cargo shipping and customs clearance management.',
                defaultPrice: 1500,
                unit: 'project',
                stages: ['Booking', 'Documentation', 'Transit', 'Customs Clearance', 'Last Mile']
            },
            {
                id: 'warehouse_mgmt',
                name: 'Inventory & Warehousing',
                description: 'Storage solutions and inventory management services.',
                defaultPrice: 2000,
                unit: 'month',
                stages: ['Inbound Receiving', 'Storage Optimization', 'Cycle Counting', 'Outbound Fulfillment']
            },
            {
                id: 'last_mile_delivery',
                name: 'Last Mile Delivery',
                description: 'End-to-end delivery services from local hubs to customers.',
                defaultPrice: 15,
                unit: 'project',
                stages: ['Pickup', 'Sorting', 'Out for Delivery', 'Customer Handover']
            }
        ]
    },
    {
        name: 'Healthcare & Wellness',
        services: [
            {
                id: 'telehealth_consult',
                name: 'Telehealth Consultation',
                description: 'Remote medical consultations and wellness advisory.',
                defaultPrice: 80,
                unit: 'hour',
                stages: ['Intake', 'Consultation', 'Prescription/Referral', 'Follow-up']
            },
            {
                id: 'medical_transcription',
                name: 'Medical Transcription',
                description: 'Converting voice recordings from physicians into written reports.',
                defaultPrice: 50,
                unit: 'hour',
                stages: ['Recording Intake', 'Transcription', 'Quality Review', 'Report Delivery']
            },
            {
                id: 'wellness_coaching',
                name: 'Wellness & Nutrition Coaching',
                description: 'Personalized wellness plans and nutritional guidance.',
                defaultPrice: 120,
                unit: 'month',
                stages: ['Initial Assessment', 'Plan Creation', 'Weekly Sessions', 'Progress Tracking']
            }
        ]
    },
    {
        name: 'Education & Training',
        services: [
            {
                id: 'academic_tutoring',
                name: 'Academic Tutoring',
                description: 'One-on-one or group educational support in specific subjects.',
                defaultPrice: 45,
                unit: 'hour',
                stages: ['Assessment', 'Learning Plan', 'Instruction Sessions', 'Evaluation']
            },
            {
                id: 'course_development',
                name: 'E-Learning Development',
                description: 'Creating digital course content and LMS integration.',
                defaultPrice: 3000,
                unit: 'project',
                stages: ['Curriculum Design', 'Content Creation', 'Interactive Logic', 'Deployment']
            }
        ]
    },
    {
        name: 'Manufacturing & Industrial',
        services: [
            {
                id: 'prototyping_3d',
                name: 'Rapid Prototyping',
                description: '3D printing and rapid manufacturing of product prototypes.',
                defaultPrice: 500,
                unit: 'project',
                stages: ['CAD Review', 'Print/Build', 'Post-processing', 'Inspection']
            },
            {
                id: 'quality_control',
                name: 'Quality Assurance Audit',
                description: 'On-site or remote inspection of manufacturing quality and compliance.',
                defaultPrice: 1200,
                unit: 'day',
                stages: ['Audit Planning', 'Floor Inspection', 'Testing', 'Certification Report']
            }
        ]
    },
    {
        name: 'Hospitality & Tourism',
        services: [
            {
                id: 'concierge_premium',
                name: 'Premium Concierge',
                description: 'Exclusively tailored services for high-end travel and luxury needs.',
                defaultPrice: 500,
                unit: 'month',
                stages: ['Enquiry', 'Recommendation', 'Booking/Reservation', 'Execution']
            },
            {
                id: 'housekeeping_mgmt',
                name: 'Hospitality Housekeeping',
                description: 'Comprehensive cleaning and maintenance for hotels and resorts.',
                defaultPrice: 2000,
                unit: 'month',
                stages: ['Site Audit', 'Staff Allocation', 'Daily Maintenance', 'Quality Review']
            }
        ]
    }
];
