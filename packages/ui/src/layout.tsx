import type { PropsWithChildren, ReactNode } from "react";

type SurfaceProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}>;

export const Surface = ({ title, subtitle, actions, className, children }: SurfaceProps) => (
  <section
    className={[
      "rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur",
      className ?? "",
    ].join(" ")}
  >
    {(title || subtitle || actions) && (
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
    )}
    {children}
  </section>
);

export const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <Surface className="min-h-32">
    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
    {hint ? <p className="mt-3 text-sm text-slate-500">{hint}</p> : null}
  </Surface>
);
