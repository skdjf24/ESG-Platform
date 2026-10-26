export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[#e5ebe8] ${className}`} aria-label={`完成进度 ${value}%`}>
      <div className="h-full rounded-full bg-[#176b52] transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
