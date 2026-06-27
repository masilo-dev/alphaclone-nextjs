'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveTableDesktop,
  ResponsiveTableMobile,
  MobileDataCard,
} from '@/components/ui/ResponsiveTable';

export interface EnterpriseColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  /** Shown in mobile card header row */
  mobilePrimary?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

interface EnterpriseDataTableProps<T> {
  columns: EnterpriseColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Extra fields revealed in mobile accordion / desktop expand */
  renderExpanded?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

type SortDir = 'asc' | 'desc';

export function EnterpriseDataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  renderExpanded,
  emptyMessage = 'No records found',
  className,
}: EnterpriseDataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedData = useMemo(() => {
    if (!sortCol) return data;
    const col = columns.find((c) => c.id === sortCol);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [columns, data, sortCol, sortDir]);

  const toggleSort = (col: EnterpriseColumn<T>) => {
    if (!col.sortable) return;
    if (sortCol === col.id) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col.id);
      setSortDir('asc');
    }
  };

  const primaryCols = columns.filter((c) => c.mobilePrimary);
  const mobilePrimary = primaryCols.length > 0 ? primaryCols : columns.slice(0, 3);

  if (data.length === 0) {
    return (
      <p className="text-center py-12 text-sm text-slate-500">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn('ac-scroll-full', className)}>
      <ResponsiveTableDesktop>
        <table className="ac-data-table w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(col.sortable && 'cursor-pointer select-none')}
                  onClick={() => toggleSort(col)}
                  aria-sort={
                    sortCol === col.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortCol === col.id ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
              {renderExpanded ? <th className="w-10" aria-label="Expand" /> : null}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => {
              const id = getRowId(row);
              const isExpanded = expandedId === id;
              return (
                <React.Fragment key={id}>
                  <tr
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.id}>{col.accessor(row)}</td>
                    ))}
                    {renderExpanded ? (
                      <td>
                        <button
                          type="button"
                          className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-teal-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : id);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  {renderExpanded && isExpanded ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="bg-slate-900/50">
                        <div className="p-4">{renderExpanded(row)}</div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </ResponsiveTableDesktop>

      <ResponsiveTableMobile>
        {sortedData.map((row) => {
          const id = getRowId(row);
          const isExpanded = expandedId === id;
          return (
            <MobileDataCard
              key={id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="space-y-2">
                {mobilePrimary.map((col) => (
                  <div key={col.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500 shrink-0">{col.header}</span>
                    <span className="text-white text-right min-w-0">{col.accessor(row)}</span>
                  </div>
                ))}
              </div>
              {renderExpanded ? (
                <>
                  <button
                    type="button"
                    className="w-full min-h-11 text-xs font-medium text-teal-400 flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : id);
                    }}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {isExpanded ? <div className="pt-2 border-t border-slate-800">{renderExpanded(row)}</div> : null}
                </>
              ) : null}
            </MobileDataCard>
          );
        })}
      </ResponsiveTableMobile>
    </div>
  );
}
