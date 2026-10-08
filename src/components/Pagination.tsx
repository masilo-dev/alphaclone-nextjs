import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
    totalItems?: number;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
    className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage = 10,
    totalItems,
    onItemsPerPageChange,
    className = '',
}) => {
    const pages = generatePageNumbers(currentPage, totalPages);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    return (
        <div className={`flex items-center justify-between ${className}`}>
            {/* Items per page selector */}
            {onItemsPerPageChange && (
                <div className="flex items-center gap-1.5 type-caption text-[var(--ws-text-muted)]">
                    <span>Show</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] rounded-md px-2 py-0.5 text-xs text-[var(--ws-text-primary)] focus:outline-none focus:border-[var(--brand-teal)]"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>per page</span>
                </div>
            )}

            {/* Page info */}
            {totalItems !== undefined && (
                <div className="type-caption text-[var(--ws-text-muted)]">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to{' '}
                    {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
                </div>
            )}

            {/* Page navigation */}
            <div className="flex items-center gap-1 sm:gap-1.5">
                {/* First page */}
                <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="p-1 sm:p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-surface-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="First page"
                >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Previous page */}
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 sm:p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-surface-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Previous page"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                    {pages.map((page, index) =>
                        page === '...' ? (
                            <span key={`ellipsis-${index}`} className="px-2 py-0.5 text-xs text-[var(--ws-text-muted)]">
                                ...
                            </span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => goToPage(Number(page))}
                                className={`min-w-[28px] h-7 px-2 rounded-md text-xs font-semibold transition-colors ${currentPage === page
                                        ? 'bg-[var(--interactive-secondary,var(--brand-teal))] text-[var(--text-inverse)]'
                                        : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-surface-secondary)]'
                                    }`}
                            >
                                {page}
                            </button>
                        )
                    )}
                </div>

                {/* Next page */}
                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 sm:p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-surface-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next page"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Last page */}
                <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1 sm:p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-surface-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Last page"
                >
                    <ChevronsRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

// Helper to generate page numbers with ellipsis
function generatePageNumbers(current: number, total: number): (number | string)[] {
    const pages: (number | string)[] = [];
    const showEllipsis = total > 7;

    if (!showEllipsis) {
        // Show all pages if total <= 7
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);

        if (current > 3) {
            pages.push('...');
        }

        // Show pages around current
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (current < total - 2) {
            pages.push('...');
        }

        // Always show last page
        pages.push(total);
    }

    return pages;
}

export default Pagination;
