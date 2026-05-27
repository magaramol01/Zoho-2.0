import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const Surface = ({ title, subtitle, actions, className, children }) => (_jsxs("section", { className: [
        "rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur",
        className ?? "",
    ].join(" "), children: [(title || subtitle || actions) && (_jsxs("header", { className: "mb-4 flex items-start justify-between gap-4", children: [_jsxs("div", { children: [title ? _jsx("h2", { className: "text-lg font-semibold text-slate-900", children: title }) : null, subtitle ? _jsx("p", { className: "mt-1 text-sm text-slate-500", children: subtitle }) : null] }), actions] })), children] }));
export const StatCard = ({ label, value, hint, }) => (_jsxs(Surface, { className: "min-h-32", children: [_jsx("p", { className: "text-sm uppercase tracking-[0.2em] text-slate-400", children: label }), _jsx("p", { className: "mt-4 text-3xl font-semibold text-slate-900", children: value }), hint ? _jsx("p", { className: "mt-3 text-sm text-slate-500", children: hint }) : null] }));
