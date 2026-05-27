import { jsx as _jsx } from "react/jsx-runtime";
export const Button = ({ className, ...props }) => (_jsx("button", { className: [
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition",
        "bg-slate-900 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
    ].join(" "), ...props }));
export const GhostButton = ({ className, ...props }) => (_jsx("button", { className: [
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition",
        "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
    ].join(" "), ...props }));
export const Pill = ({ children }) => (_jsx("span", { className: "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600", children: children }));
export const Kbd = ({ children }) => (_jsx("kbd", { className: "rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500", children: children }));
