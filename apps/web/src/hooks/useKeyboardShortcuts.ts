import { useEffect } from "react";
import type { NavigateFn } from "@tanstack/react-router";

type ShortcutHandlers = {
  navigate: NavigateFn;
  openPalette: () => void;
  focusSearch: () => void;
  duplicateTimesheetRow?: () => void;
};

export const useKeyboardShortcuts = ({
  navigate,
  openPalette,
  focusSearch,
  duplicateTimesheetRow,
}: ShortcutHandlers) => {
  useEffect(() => {
    let pendingGo = false;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === ".") {
        event.preventDefault();
        openPalette();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        duplicateTimesheetRow?.();
        return;
      }

      if (pendingGo) {
        pendingGo = false;
        if (event.key.toLowerCase() === "t") {
          navigate({ to: "/tasks" });
        }
        if (event.key.toLowerCase() === "l") {
          navigate({ to: "/timesheet" });
        }
        if (event.key.toLowerCase() === "d") {
          navigate({ to: "/today" });
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingGo = true;
        window.setTimeout(() => {
          pendingGo = false;
        }, 900);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [duplicateTimesheetRow, focusSearch, navigate, openPalette]);
};
