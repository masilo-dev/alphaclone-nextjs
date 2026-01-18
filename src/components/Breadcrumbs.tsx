import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

interface BreadcrumbItem {
    label: string;
    path: string;
}

interface BreadcrumbsProps {
    items?: BreadcrumbItem[];
    className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
    const pathname = usePathname();
    const router = useRouter();

    // Auto-generate breadcrumbs from path if not provided
    const breadcrumbs = items || generateBreadcrumbs(pathname || '');

    const handleClick = (path: string) => {
        router.push(path);
    };

    return (
        <nav className={`flex items-center gap-2 text-sm ${className}`}>
            <button
                onClick={() => handleClick('/dashboard')}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
            </button>

            {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.path}>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                    {index === breadcrumbs.length - 1 ? (
                        <span className="text-white font-medium">{item.label}</span>
                    ) : (
                        <button
                            onClick={() => handleClick(item.path)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            {item.label}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

// Helper to generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    let currentPath = '';
    segments.forEach((segment, index) => {
        if (index === 0 && segment === 'dashboard') return; // Skip 'dashboard' as it's the home

        currentPath += `/${segment}`;
        breadcrumbs.push({
            label: formatLabel(segment),
            path: currentPath,
        });
    });

    return breadcrumbs;
}

function formatLabel(segment: string): string {
    return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export default Breadcrumbs;
