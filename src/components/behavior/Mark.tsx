/** How one day looks: a colored star, a colored token, or N dots out of max. Server-safe. */
export type MarkShape = "star" | "token" | "dots";

export function Star({ fill, stroke, size = 24, label }: { fill: string; stroke: string; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function Mark({ shape, fill, stroke, count, max, size = 24, label }: { shape: MarkShape; fill?: string; stroke?: string; count?: number | null; max?: number | null; size?: number; label?: string }) {
  if (shape === "dots") {
    const m = max ?? 3;
    const n = count ?? 0;
    const dot = Math.max(6, Math.round(size / 3.2));
    return (
      <span role={label ? "img" : undefined} aria-label={label} className="inline-flex flex-wrap items-center justify-center gap-[3px]" style={{ maxWidth: size * 1.6 }}>
        {Array.from({ length: m }, (_, i) => (
          <span key={i} className="rounded-full" style={{ width: dot, height: dot, background: count == null ? "#e2e8f0" : i < n ? fill : "#e2e8f0" }} />
        ))}
      </span>
    );
  }
  // Not logged: faint, so it never looks like a real (e.g. white) star.
  if (shape === "star")
    return fill ? <Star fill={fill} stroke={stroke ?? fill} size={size} label={label} /> : <span className="opacity-30"><Star fill="#f8fafc" stroke="#94a3b8" size={size} label={label} /></span>;
  return <span role={label ? "img" : undefined} aria-label={label} className="inline-block rounded-full" style={{ width: size * 0.8, height: size * 0.8, background: fill ?? "transparent", border: fill ? `2px solid ${stroke ?? fill}` : "2px dashed #cbd5e1" }} />;
}
