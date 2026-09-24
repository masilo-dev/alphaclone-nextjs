'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface WorkspaceStateConfig<TFilters extends Record<string, any> = Record<string, any>> {
  /** Unique key identifying the workspace (e.g., 'crm_leads', 'billing_invoices') */
  workspaceKey: string;
  /** Initial/default filter values */
  defaultFilters?: TFilters;
  /** Initial/default search string */
  defaultSearch?: string;
  /** Initial/default sort string */
  defaultSort?: string;
  /** Initial/default page number */
  defaultPage?: number;
  /** Initial/default view mode (e.g., 'table', 'board', 'list') */
  defaultView?: string;
  /** Whether to sync state to URL search parameters (default: true) */
  syncUrl?: boolean;
  /** Whether to persist to sessionStorage across same-session navigations (default: true) */
  persistSession?: boolean;
}

export function useWorkspaceState<TFilters extends Record<string, any> = Record<string, any>>({
  workspaceKey,
  defaultFilters = {} as TFilters,
  defaultSearch = '',
  defaultSort = '',
  defaultPage = 1,
  defaultView = 'table',
  syncUrl = true,
  persistSession = true,
}: WorkspaceStateConfig<TFilters>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sessionKey = `alphaclone:ws:${workspaceKey}`;

  // Read saved session state if available and URL params are empty
  const readSessionState = useCallback(() => {
    if (!persistSession || typeof window === 'undefined') return null;
    try {
      const stored = window.sessionStorage.getItem(sessionKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [persistSession, sessionKey]);

  // Initialize state from URL params > Session Storage > Defaults
  const initialData = useMemo(() => {
    const session = readSessionState();

    // 1. Search
    const urlSearch = searchParams?.get('q') ?? searchParams?.get('search');
    const search = urlSearch !== null ? urlSearch : (session?.search ?? defaultSearch);

    // 2. Sort
    const urlSort = searchParams?.get('sort');
    const sort = urlSort !== null ? urlSort : (session?.sort ?? defaultSort);

    // 3. Page
    const urlPage = searchParams?.get('page');
    const parsedPage = urlPage ? parseInt(urlPage, 10) : NaN;
    const page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : (session?.page ?? defaultPage);

    // 4. View
    const urlView = searchParams?.get('view');
    const view = urlView !== null ? urlView : (session?.view ?? defaultView);

    // 5. Filters
    const filters = { ...defaultFilters, ...(session?.filters || {}) };
    if (searchParams) {
      searchParams.forEach((val, key) => {
        if (!['q', 'search', 'sort', 'page', 'view', 'create', 'quickAdd'].includes(key)) {
          (filters as any)[key] = val;
        }
      });
    }

    return { search, sort, page, view, filters };
  }, [searchParams, defaultSearch, defaultSort, defaultPage, defaultView, defaultFilters, readSessionState]);

  const [search, setSearchState] = useState<string>(initialData.search);
  const [sort, setSortState] = useState<string>(initialData.sort);
  const [page, setPageState] = useState<number>(initialData.page);
  const [view, setViewState] = useState<string>(initialData.view);
  const [filters, setFiltersState] = useState<TFilters>(initialData.filters);

  // Sync to Session Storage
  useEffect(() => {
    if (!persistSession || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ search, sort, page, view, filters })
      );
    } catch {
      // Storage errors are non-fatal
    }
  }, [search, sort, page, view, filters, persistSession, sessionKey]);

  // Sync to URL Search Params (debounced or atomic replace)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);

    // Search
    if (search) currentParams.set('search', search);
    else {
      currentParams.delete('search');
      currentParams.delete('q');
    }

    // Sort
    if (sort && sort !== defaultSort) currentParams.set('sort', sort);
    else currentParams.delete('sort');

    // Page
    if (page > 1) currentParams.set('page', String(page));
    else currentParams.delete('page');

    // View
    if (view && view !== defaultView) currentParams.set('view', view);
    else currentParams.delete('view');

    // Filters
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        currentParams.set(k, String(v));
      } else {
        currentParams.delete(k);
      }
    });

    const newQuery = currentParams.toString();
    const newRelativePathQuery = newQuery ? `${pathname}?${newQuery}` : pathname;

    // Use replaceState to avoid cluttering browser history stack with every keystroke
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [search, sort, page, view, filters, syncUrl, pathname, defaultSort, defaultView]);

  const setSearch = useCallback((newSearch: string) => {
    setSearchState(newSearch);
    setPageState(1); // Reset page on new search
  }, []);

  const setSort = useCallback((newSort: string) => {
    setSortState(newSort);
    setPageState(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const setView = useCallback((newView: string) => {
    setViewState(newView);
  }, []);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, val: TFilters[K]) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: val,
    }));
    setPageState(1); // Reset to page 1 on filter change
  }, []);

  const setFilters = useCallback((next: TFilters | ((prev: TFilters) => TFilters)) => {
    setFiltersState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      return resolved;
    });
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchState(defaultSearch);
    setSortState(defaultSort);
    setPageState(defaultPage);
    setViewState(defaultView);
    setFiltersState(defaultFilters);

    if (persistSession && typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(sessionKey);
      } catch {
        // Safe to ignore
      }
    }
  }, [defaultSearch, defaultSort, defaultPage, defaultView, defaultFilters, persistSession, sessionKey]);

  // Compute active non-default filter count for badges
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search && search !== defaultSearch) count++;
    Object.entries(filters).forEach(([k, v]) => {
      const def = (defaultFilters as any)[k];
      if (v !== def && v !== undefined && v !== null && v !== '' && v !== 'all') {
        count++;
      }
    });
    return count;
  }, [filters, search, defaultSearch, defaultFilters]);

  return {
    search,
    setSearch,
    sort,
    setSort,
    page,
    setPage,
    view,
    setView,
    filters,
    setFilter,
    setFilters,
    resetFilters,
    activeFilterCount,
  };
}
