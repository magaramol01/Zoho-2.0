'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BodyScrollEvent,
  type CellKeyDownEvent,
  type CellValueChangedEvent,
  type ColDef,
  type FilterChangedEvent,
  type GridApi,
  type GridReadyEvent,
  type SideBarDef,
  type ValueFormatterParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export type GridRow = Record<string, string | number | null>;

interface GridSpaceProps {
  rowData: GridRow[];
  columnDefs: ColDef<GridRow>[];
  filterStorageKey: string | null;
  columnStorageKey?: string | null;
  onCellValueChanged?: (event: CellValueChangedEvent<GridRow>) => void;
}

type HorizontalMetrics = {
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
};

const initialHorizontalMetrics: HorizontalMetrics = {
  clientWidth: 0,
  scrollWidth: 0,
  scrollLeft: 0,
};

const valueFormatter = (params: ValueFormatterParams<GridRow>) => {
  if (params.value === null || params.value === undefined) {
    return '';
  }

  return String(params.value);
};

export default function GridSpace({
  rowData,
  columnDefs,
  filterStorageKey,
  columnStorageKey,
  onCellValueChanged,
}: GridSpaceProps) {
  const [horizontalMetrics, setHorizontalMetrics] = useState<HorizontalMetrics>(
    initialHorizontalMetrics,
  );
  const [popupParent, setPopupParent] = useState<HTMLDivElement | null>(null);

  const gridRootRef = useRef<HTMLDivElement | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const gridApiRef = useRef<GridApi<GridRow> | null>(null);

  const defaultColDef = useMemo<ColDef<GridRow>>(
    () => ({
      cellDataType: false,
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: false,
      editable: false,
      minWidth: 140,
      valueFormatter,
    }),
    [],
  );

  const columns = useMemo<ColDef<GridRow>[]>(
    () => [
      {
        colId: 'row-number',
        headerName: '',
        valueGetter: (params) => String((params.node?.rowIndex ?? 0) + 1),
        editable: false,
        sortable: false,
        resizable: false,
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        pinned: 'left',
        lockPosition: 'left',
        cellClass: 'ag-row-number-cell',
        headerClass: 'ag-row-number-header',
      },
      ...columnDefs,
    ],
    [columnDefs],
  );

  const getCenterViewport = useCallback(
    () =>
      gridRootRef.current?.querySelector<HTMLElement>('.ag-center-cols-viewport') ?? null,
    [],
  );

  const getCenterContainer = useCallback(
    () =>
      gridRootRef.current?.querySelector<HTMLElement>('.ag-center-cols-container') ?? null,
    [],
  );

  const syncHorizontalMetrics = useCallback(
    (nextScrollLeft?: number) => {
      const viewport = getCenterViewport();
      if (!viewport) {
        return;
      }

      const container = getCenterContainer();
      const clientWidth = viewport.clientWidth;
      const scrollWidth = Math.max(
        clientWidth,
        viewport.scrollWidth,
        container?.scrollWidth ?? 0,
      );
      const scrollLeft =
        typeof nextScrollLeft === 'number' ? nextScrollLeft : viewport.scrollLeft;

      setHorizontalMetrics((current) => {
        if (
          current.clientWidth === clientWidth &&
          current.scrollWidth === scrollWidth &&
          current.scrollLeft === scrollLeft
        ) {
          return current;
        }

        return {
          clientWidth,
          scrollWidth,
          scrollLeft,
        };
      });
    },
    [getCenterContainer, getCenterViewport],
  );

  const handleBodyScroll = useCallback(
    (event: BodyScrollEvent<GridRow>) => {
      if (event.direction !== 'horizontal' || syncingScrollRef.current) {
        return;
      }

      syncHorizontalMetrics(event.left);
    },
    [syncHorizontalMetrics],
  );

  const handleExternalScrollbarScroll = useCallback(() => {
    const scrollbar = scrollbarRef.current;
    const viewport = getCenterViewport();

    if (!scrollbar || !viewport) {
      return;
    }

    const nextScrollLeft = scrollbar.scrollLeft;
    syncingScrollRef.current = true;
    viewport.scrollLeft = nextScrollLeft;
    syncHorizontalMetrics(nextScrollLeft);

    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [getCenterViewport, syncHorizontalMetrics]);

  useEffect(() => {
    syncHorizontalMetrics();

    const viewport = getCenterViewport();
    const container = getCenterContainer();

    if (!viewport || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncHorizontalMetrics();
    });

    resizeObserver.observe(viewport);

    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [getCenterContainer, getCenterViewport, syncHorizontalMetrics, rowData.length]);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;

    if (!scrollbar) {
      return;
    }

    if (Math.abs(scrollbar.scrollLeft - horizontalMetrics.scrollLeft) > 1) {
      scrollbar.scrollLeft = horizontalMetrics.scrollLeft;
    }
  }, [horizontalMetrics.scrollLeft]);

  const scrollbarContentWidth = Math.max(
    horizontalMetrics.clientWidth,
    horizontalMetrics.scrollWidth,
  );

  const restoreFilterModel = useCallback((api: GridApi<GridRow>) => {
    if (!filterStorageKey || typeof window === 'undefined') {
      return;
    }

    try {
      const savedFilterModel = window.localStorage.getItem(filterStorageKey);
      if (!savedFilterModel) {
        return;
      }

      api.setFilterModel(JSON.parse(savedFilterModel));
    } catch {
      window.localStorage.removeItem(filterStorageKey);
    }
  }, [filterStorageKey]);

  const restoreColumnState = useCallback((api: GridApi<GridRow>) => {
    if (!columnStorageKey || typeof window === 'undefined') {
      return;
    }

    try {
      const savedState = window.localStorage.getItem(columnStorageKey);
      if (!savedState) {
        return;
      }

      api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
    } catch {
      window.localStorage.removeItem(columnStorageKey);
    }
  }, [columnStorageKey]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<GridRow>) => {
      gridApiRef.current = event.api;
      restoreFilterModel(event.api);
      restoreColumnState(event.api);
      syncHorizontalMetrics();
    },
    [restoreFilterModel, restoreColumnState, syncHorizontalMetrics],
  );

  const handleFilterChanged = useCallback(
    (event: FilterChangedEvent<GridRow>) => {
      if (!filterStorageKey || typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(
        filterStorageKey,
        JSON.stringify(event.api.getFilterModel()),
      );
    },
    [filterStorageKey],
  );

  const handleColumnStateChanged = useCallback((event: any) => {
    if (!columnStorageKey || typeof window === 'undefined') {
      return;
    }

    const state = event.api.getColumnState();
    window.localStorage.setItem(columnStorageKey, JSON.stringify(state));
  }, [columnStorageKey]);

  const handleCellKeyDown = useCallback(
    (event: CellKeyDownEvent<GridRow>) => {
      if (!(event.event instanceof KeyboardEvent)) {
        return;
      }

      const keyboardEvent = event.event;

      if (
        keyboardEvent.defaultPrevented ||
        (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey) ||
        keyboardEvent.key.toLowerCase() !== 'c'
      ) {
        return;
      }

      const target = keyboardEvent.target;
      if (
        target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return;
      }

      keyboardEvent.preventDefault();
      event.api.copyToClipboard();
    },
    [],
  );

  const handleGridContainerRef = useCallback((node: HTMLDivElement | null) => {
    gridRootRef.current = node;
    setPopupParent(node);
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div
        ref={handleGridContainerRef}
        className="ag-theme-alpine sheet-grid min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <AgGridReact<GridRow>
          rowData={rowData}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          theme="legacy"
          popupParent={popupParent}
          cellSelection={true}
          headerHeight={32}
          rowHeight={32}
          animateRows
          singleClickEdit
          onGridReady={handleGridReady}
          onCellKeyDown={handleCellKeyDown}
          onFilterChanged={handleFilterChanged}
          onColumnMoved={handleColumnStateChanged}
          onColumnPinned={handleColumnStateChanged}
          onColumnVisible={handleColumnStateChanged}
          onColumnResized={handleColumnStateChanged}
          onSortChanged={handleColumnStateChanged}
          onBodyScroll={handleBodyScroll}
          onCellValueChanged={onCellValueChanged}
          onFirstDataRendered={() => syncHorizontalMetrics()}
          onGridSizeChanged={() => syncHorizontalMetrics()}
        />
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-2 py-1">
        <div
          ref={scrollbarRef}
          onScroll={handleExternalScrollbarScroll}
          className="sheet-view-scrollbar h-3 overflow-x-auto overflow-y-hidden"
        >
          <div
            style={{
              width: `${scrollbarContentWidth}px`,
              minWidth: '100%',
            }}
            className="h-px"
          />
        </div>
      </div>
    </div>
  );
}
