import { createContext, useContext } from "react";

export type ShellState = {
  search: string;
  deferredSearch: string;
  setSearch: (value: string) => void;
  duplicateSignal: number;
  selectedProjectId: string | null;
  setSelectedProjectId: (value: string | null) => void;
};

export const ShellContext = createContext<ShellState | null>(null);

export const useShellState = () => {
  const state = useContext(ShellContext);
  if (!state) {
    throw new Error("Shell state missing");
  }
  return state;
};
