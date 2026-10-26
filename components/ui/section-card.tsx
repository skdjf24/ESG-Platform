import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-[#e3e8e5] bg-white shadow-[0_1px_2px_rgba(20,40,30,0.02)] ${className}`}>
      {title || description || action ? (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf0ee] px-5 py-4 sm:px-6">
          <div>
            {title ? <h2 className="text-[15px] font-semibold text-[#1b2822]">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-[#77817c]">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}
