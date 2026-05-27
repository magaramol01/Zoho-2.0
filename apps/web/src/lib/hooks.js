import { useEffect, useState, startTransition, useDeferredValue } from "react";
import { useQueryClient } from "@tanstack/react-query";
export const useLiveInvalidation = () => {
    const queryClient = useQueryClient();
    useEffect(() => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
        const events = new EventSource(`${baseUrl}/events`, { withCredentials: true });
        events.onmessage = () => {
            startTransition(() => {
                queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                queryClient.invalidateQueries({ queryKey: ["timesheet"] });
            });
        };
        return () => {
            events.close();
        };
    }, [queryClient]);
};
export const useDeferredSearch = () => {
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    return { search, deferredSearch, setSearch };
};
