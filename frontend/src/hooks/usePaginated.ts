import { useCallback, useEffect, useRef, useState } from 'react';

export interface PaginationParams {
  start: number;
  size: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string | number | boolean | undefined>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  start: number;
  size: number;
}

export interface UsePaginatedOptions extends Partial<PaginationParams> {
  autoFetch?: boolean;
}

export interface UsePaginatedReturn<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
  start: number;
  size: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search: string;
  filters: Record<string, string | number | boolean | undefined>;
  setPage: (page: number) => void;
  setStart: (start: number) => void;
  setSize: (size: number) => void;
  setSort: (sortBy: string, sortOrder?: 'asc' | 'desc') => void;
  toggleSort: (sortBy: string) => void;
  setSearch: (search: string) => void;
  setFilter: (
    key: string,
    value: string | number | boolean | undefined,
  ) => void;
  setFilters: (
    filters: Record<string, string | number | boolean | undefined>,
  ) => void;
  refetch: () => Promise<void>;
}

export function usePaginated<T>(
  fetcher: (params: PaginationParams) => Promise<PaginatedResult<T>>,
  initial?: UsePaginatedOptions,
): UsePaginatedReturn<T> {
  const [start, setStartState] = useState<number>(initial?.start ?? 0);
  const [size, setSizeState] = useState<number>(initial?.size ?? 25);
  const [sortBy, setSortByState] = useState<string | undefined>(
    initial?.sortBy,
  );
  const [sortOrder, setSortOrderState] = useState<'asc' | 'desc'>(
    initial?.sortOrder ?? 'desc',
  );
  const [search, setSearchState] = useState<string>(initial?.search ?? '');
  const [filters, setFiltersState] = useState<
    Record<string, string | number | boolean | undefined>
  >(initial?.filters ?? {});

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current({
        start,
        size,
        sortBy,
        sortOrder,
        search: search || undefined,
        filters,
      });
      if (reqId !== requestIdRef.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [start, size, sortBy, sortOrder, search, filters]);

  useEffect(() => {
    if (initial?.autoFetch === false) return;
    void refetch();
  }, [refetch, initial?.autoFetch]);

  const setPage = useCallback(
    (page: number) => {
      // page is 1-indexed
      const safePage = Math.max(1, Math.floor(page));
      setStartState((safePage - 1) * size);
    },
    [size],
  );

  const setStart = useCallback((value: number) => {
    setStartState(Math.max(0, Math.floor(value)));
  }, []);

  const setSize = useCallback((value: number) => {
    const next = Math.max(1, Math.floor(value));
    setSizeState(next);
    setStartState(0);
  }, []);

  const setSort = useCallback(
    (field: string, order?: 'asc' | 'desc') => {
      setSortByState(field);
      if (order) setSortOrderState(order);
      setStartState(0);
    },
    [],
  );

  const toggleSort = useCallback((field: string) => {
    setSortByState((prevField) => {
      if (prevField === field) {
        setSortOrderState((o) => (o === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortOrderState('desc');
      return field;
    });
    setStartState(0);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setStartState(0);
  }, []);

  const setFilter = useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      setFiltersState((prev) => {
        const next = { ...prev };
        if (value === undefined) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
      setStartState(0);
    },
    [],
  );

  const setFilters = useCallback(
    (value: Record<string, string | number | boolean | undefined>) => {
      setFiltersState(value);
      setStartState(0);
    },
    [],
  );

  return {
    items,
    total,
    loading,
    error,
    start,
    size,
    sortBy,
    sortOrder,
    search,
    filters,
    setPage,
    setStart,
    setSize,
    setSort,
    toggleSort,
    setSearch,
    setFilter,
    setFilters,
    refetch,
  };
}
