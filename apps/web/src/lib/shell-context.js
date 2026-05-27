import { createContext, useContext } from "react";
export const ShellContext = createContext(null);
export const useShellState = () => {
    const state = useContext(ShellContext);
    if (!state) {
        throw new Error("Shell state missing");
    }
    return state;
};
