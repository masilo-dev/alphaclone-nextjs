import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

interface BulkActionsProps<T extends { id: string }> {
    items: T[];
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    actions: {
        label: string;
        icon?: React.ReactNode;
        onClick: (selectedItems: T[]) => void | Promise<void>;
        variant?: 'default' | 'danger';
    }[];
    className?: string;
}

export function BulkActions<T extends { id: string }>({
    items,
    selectedIds,
    onSelectionChange,
    actions,
    className = '',
}: BulkActionsProps<T>) {
    const [isProcessing, setIsProcessing] = useState(false);

    const selectedItems = items.filter(item => selectedIds.has(item.id));
    const allSelected = items.length > 0 && selectedIds.size === items.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

    const toggleSelectAll = () => {
        if (allSelected) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(items.map(item => item.id)));
        }
    };

    const handleAction = async (action: typeof actions[0]) => {
        if (selectedItems.length === 0) return;

        setIsProcessing(true);
        try {
            await action.onClick(selectedItems);
            onSelectionChange(new Set()); // Clear selection after action
        } finally {
            setIsProcessing(false);
        }
    };

    if (selectedIds.size === 0) return null;

    return (
        <div className={`ac-workspace-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 ${className}`}>
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors"
                >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${allSelected
                            ? 'bg-teal-500 border-teal-500'
                            : someSelected
                                ? 'bg-teal-500/50 border-teal-500'
                                : 'border-[var(--ws-border-strong)]'
                        }`}>
                        {(allSelected || someSelected) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-medium">{selectedIds.size} selected</span>
                </button>

                <button
                    onClick={() => onSelectionChange(new Set())}
                    className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors"
                    title="Clear selection"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
                {actions.map((action, index) => (
                    <button
                        key={index}
                        onClick={() => handleAction(action)}
                        disabled={isProcessing}
                        className={`min-h-11 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border ${action.variant === 'danger'
                                ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] border-[color-mix(in_srgb,var(--danger)_28%,var(--ws-border))]'
                                : 'bg-[color-mix(in_srgb,var(--interactive-secondary)_12%,transparent)] text-[var(--interactive-secondary)] hover:bg-[color-mix(in_srgb,var(--interactive-secondary)_16%,transparent)] border-[color-mix(in_srgb,var(--interactive-secondary)_22%,var(--ws-border))]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {action.icon}
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Checkbox component for individual items
interface SelectableItemProps {
    id: string;
    isSelected: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
    className?: string;
}

export const SelectableItem: React.FC<SelectableItemProps> = ({
    id,
    isSelected,
    onToggle,
    children,
    className = '',
}) => {
    return (
        <div className={`relative ${className}`}>
            <div
                className={`absolute left-4 top-4 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(id);
                    }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app)] ${isSelected
                            ? 'bg-teal-500 border-teal-500'
                            : 'border-[var(--ws-border-strong)] hover:border-teal-500'
                        }`}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? 'Deselect item' : 'Select item'}
                >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>
            </div>
            {children}
        </div>
    );
};

export default BulkActions;
