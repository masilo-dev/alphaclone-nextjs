import React from 'react';
// @ts-ignore - react-window types may not be installed
import { FixedSizeList as List } from 'react-window';
// @ts-ignore - react-virtualized-auto-sizer types may not be installed
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    className?: string;
    emptyMessage?: string;
}

export function VirtualList<T>({
    items,
    itemHeight,
    renderItem,
    className = '',
    emptyMessage = 'No items to display',
}: VirtualListProps<T>) {
    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 text-slate-400 ${className}`}>
                {emptyMessage}
            </div>
        );
    }

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const item = items[index];
        if (!item) return null;
        return <div style={style}>{renderItem(item, index)}</div>;
    };

    return (
        <div className={className} style={{ height: '100%', width: '100%' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={items.length}
                        itemSize={itemHeight}
                        width={width}
                        className="custom-scrollbar"
                    >
                        {Row}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
}

// Grid variant for card layouts
interface VirtualGridProps<T> {
    items: T[];
    itemHeight: number;
    itemsPerRow: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    className?: string;
    gap?: number;
}

export function VirtualGrid<T>({
    items,
    itemHeight,
    itemsPerRow,
    renderItem,
    className = '',
    gap = 16,
}: VirtualGridProps<T>) {
    const rows = Math.ceil(items.length / itemsPerRow);

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const startIdx = index * itemsPerRow;
        const rowItems = items.slice(startIdx, startIdx + itemsPerRow);

        return (
            <div style={{ ...style, display: 'flex', gap: `${gap}px` }}>
                {rowItems.map((item, i) => (
                    <div key={startIdx + i} style={{ flex: 1 }}>
                        {renderItem(item, startIdx + i)}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={className} style={{ height: '100%', width: '100%' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={rows}
                        itemSize={itemHeight + gap}
                        width={width}
                        className="custom-scrollbar"
                    >
                        {Row}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
}

export default VirtualList;
