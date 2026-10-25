import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-visible={visible} style={{ transitionDelay: `${delay}ms` }} className={cn("reveal", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string | undefined }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-ink">{eyebrow}</p>}
      <h2 className="text-3xl md:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function PageHeader({ title, sub }: { title: string; sub?: string | undefined }) {
  return (
    <section className="relative overflow-hidden bg-soft pixel-grid">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20 text-center">
        <h1 className="text-4xl md:text-5xl text-gradient">{title}</h1>
        {sub && <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{sub}</p>}
      </div>
    </section>
  );
}
