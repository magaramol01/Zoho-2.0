import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, GhostButton, Surface } from "@zoho-power-grid/ui";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { isoToday, minutesToDisplay } from "@zoho-power-grid/shared";
const blankDraft = () => ({
    projectId: "",
    date: isoToday(),
    durationMinutes: 30,
    notes: "",
    billable: true,
});
export const TimesheetPanel = ({ metadata, duplicateSignal, }) => {
    const queryClient = useQueryClient();
    const [drafts, setDrafts] = useState([
        {
            ...blankDraft(),
            projectId: metadata.projects[0]?.id ?? "",
        },
    ]);
    const { data = [] } = useQuery({
        queryKey: ["timesheet"],
        queryFn: () => api.listTimesheet(),
    });
    const submitLogs = useMutation({
        mutationFn: () => api.bulkCreateTimesheet(drafts),
        onSuccess: () => {
            setDrafts([
                {
                    ...blankDraft(),
                    projectId: metadata.projects[0]?.id ?? "",
                },
            ]);
            queryClient.invalidateQueries({ queryKey: ["timesheet"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
    useEffect(() => {
        if (!duplicateSignal) {
            return;
        }
        setDrafts((current) => {
            const last = current.at(-1);
            return last ? [...current, { ...last }] : current;
        });
    }, [duplicateSignal]);
    return (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", children: [_jsxs(Surface, { title: "Rapid timesheet entry", subtitle: "Stage many logs locally, then submit in one pass.", children: [_jsx("div", { className: "space-y-3", children: drafts.map((draft, index) => (_jsxs("div", { className: "grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-12", children: [_jsx("select", { className: "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-3", value: draft.projectId, onChange: (event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, projectId: event.target.value } : item)), children: metadata.projects.map((project) => (_jsx("option", { value: project.id, children: project.name }, project.id))) }), _jsx("input", { type: "date", className: "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2", value: draft.date, onChange: (event) => setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, date: event.target.value } : item))) }), _jsx("input", { type: "number", min: 15, step: 15, className: "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2", value: draft.durationMinutes, onChange: (event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item)) }), _jsx("input", { placeholder: "Notes", className: "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-4", value: draft.notes ?? "", onChange: (event) => setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, notes: event.target.value } : item))) }), _jsxs("label", { className: "flex items-center justify-center gap-2 text-sm text-slate-600 md:col-span-1", children: [_jsx("input", { type: "checkbox", checked: draft.billable, onChange: (event) => setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, billable: event.target.checked } : item))) }), "Billable"] })] }, `${draft.projectId}-${index}`))) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx(GhostButton, { onClick: () => setDrafts((current) => [
                                    ...current,
                                    {
                                        ...blankDraft(),
                                        projectId: current.at(-1)?.projectId ?? metadata.projects[0]?.id ?? "",
                                    },
                                ]), children: "Add row" }), _jsx(GhostButton, { onClick: () => setDrafts((current) => (current.length > 1 ? [...current, { ...current.at(-1) }] : current)), children: "Duplicate last" }), _jsxs(Button, { onClick: () => submitLogs.mutate(), disabled: submitLogs.isPending || !drafts.length, children: ["Submit ", drafts.length, " logs"] })] })] }), _jsx(Surface, { title: "Recent logs", subtitle: "Fast review for the last submitted work.", children: _jsx("div", { className: "space-y-3", children: data.length ? (data.slice(0, 8).map((log) => (_jsxs("div", { className: "rounded-3xl border border-slate-200 bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-medium text-slate-900", children: log.taskName ?? log.projectName }), _jsx("span", { className: "text-sm text-slate-500", children: minutesToDisplay(log.durationMinutes) })] }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: log.date }), _jsx("p", { className: "mt-3 text-sm text-slate-600", children: log.notes })] }, log.id)))) : (_jsx("div", { className: "rounded-3xl bg-slate-50 p-4 text-sm text-slate-500", children: "No logs yet. Seed or connect Zoho to populate this." })) }) })] }));
};
