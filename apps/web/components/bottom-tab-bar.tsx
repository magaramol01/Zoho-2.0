'use client';

import { useCallback, useEffect, useRef, useState, type WheelEvent } from 'react';
import { Menu, Pin, PinOff, Plus } from 'lucide-react';

interface SheetTab {
  id: string;
  name: string;
}

interface BottomTabBarProps {
  sheets: SheetTab[];
  activeSheetId: string;
  pinnedSheetIds: string[];
  onSheetChange: (sheetId: string) => void;
  onTogglePin: (sheetId: string) => void;
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

export default function BottomTabBar({
  sheets,
  activeSheetId,
  pinnedSheetIds,
  onSheetChange,
  onTogglePin,
}: BottomTabBarProps) {
  const [horizontalMetrics, setHorizontalMetrics] = useState<HorizontalMetrics>(
    initialHorizontalMetrics,
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);

  const syncHorizontalMetrics = useCallback((nextScrollLeft?: number) => {
    const viewport = viewportRef.current;
    const content = contentRef.current;

    if (!viewport || !content) {
      return;
    }

    const clientWidth = viewport.clientWidth;
    const scrollWidth = Math.max(clientWidth, content.scrollWidth);

    setHorizontalMetrics((current) => {
      const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
      const scrollLeft = Math.max(
        0,
        Math.min(
          maxScrollLeft,
          typeof nextScrollLeft === 'number' ? nextScrollLeft : current.scrollLeft,
        ),
      );

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
  }, []);

  const setTabScrollLeft = useCallback(
    (nextScrollLeft: number) => {
      syncHorizontalMetrics(nextScrollLeft);
    },
    [syncHorizontalMetrics],
  );

  const handleScrollbarScroll = useCallback(() => {
    const scrollbar = scrollbarRef.current;

    if (!scrollbar) {
      return;
    }

    setTabScrollLeft(scrollbar.scrollLeft);
  }, [setTabScrollLeft]);

  const handleViewportWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const delta =
        Math.abs(event.deltaX) > 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;

      if (!delta) {
        return;
      }

      const maxScrollLeft = Math.max(
        0,
        horizontalMetrics.scrollWidth - horizontalMetrics.clientWidth,
      );

      if (!maxScrollLeft) {
        return;
      }

      event.preventDefault();
      setTabScrollLeft(horizontalMetrics.scrollLeft + delta);
    },
    [
      horizontalMetrics.clientWidth,
      horizontalMetrics.scrollLeft,
      horizontalMetrics.scrollWidth,
      setTabScrollLeft,
    ],
  );

  useEffect(() => {
    syncHorizontalMetrics();

    const viewport = viewportRef.current;
    const content = contentRef.current;

    if (!viewport || !content || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncHorizontalMetrics();
    });

    resizeObserver.observe(viewport);
    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sheets, syncHorizontalMetrics]);

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
  const pinnedSheetIdSet = new Set(pinnedSheetIds);

  return (
    <div className="flex w-full min-w-0 flex-col overflow-hidden border-t border-gray-300 bg-gray-50 text-sm">
      <div className="flex h-11 min-w-0 items-end overflow-hidden px-1 pb-1">
        <button
          type="button"
          title="Sheet menu"
          className="flex h-10 shrink-0 items-center px-2 text-gray-600 hover:bg-gray-200"
        >
          <Menu className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Add sheet"
          className="flex h-10 shrink-0 items-center px-2 text-gray-400"
          disabled
        >
          <Plus className="h-4 w-4" />
        </button>

        <div className="mx-1 h-6 w-px shrink-0 bg-gray-300" />

        <div
          ref={viewportRef}
          onWheel={handleViewportWheel}
          className="sheet-tabs-viewport min-w-0 flex-1 overflow-hidden"
        >
          <div
            ref={contentRef}
            className="flex h-10 w-max min-w-full"
            style={{
              transform: `translateX(-${horizontalMetrics.scrollLeft}px)`,
              willChange: 'transform',
            }}
          >
            {sheets.map((sheet) => {
              const isActive = activeSheetId === sheet.id;
              const isPinned = pinnedSheetIdSet.has(sheet.id);

              return (
                <div
                  key={sheet.id}
                  className={[
                    'flex h-full min-w-[148px] max-w-[260px] shrink-0 items-center border-r border-gray-300',
                    isActive
                      ? 'border-b-2 border-b-blue-600 bg-white font-medium text-blue-600 shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => onSheetChange(sheet.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left"
                  >
                    {isPinned ? (
                      <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : null}
                    <span className="truncate">{sheet.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePin(sheet.id)}
                    title={isPinned ? 'Unpin tab' : 'Pin tab'}
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  >
                    {isPinned ? (
                      <PinOff className="h-3.5 w-3.5" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-2 py-1">
        <div
          ref={scrollbarRef}
          onScroll={handleScrollbarScroll}
          className="sheet-tabs-scroll h-3 overflow-x-auto overflow-y-hidden"
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
