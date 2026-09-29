import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function MonthSwitcher({ base, label, previous, next }: { base: string; label: string; previous: string; next: string | null }) {
  const link = 'inline-flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper-raised hover:bg-paper-sunk';
  return (
    <div className="flex items-center gap-2">
      <Link href={`${base}?month=${previous}`} className={link} aria-label="Previous month">
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold">{label}</span>
      {next ? (
        <Link href={`${base}?month=${next}`} className={link} aria-label="Next month">
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${link} opacity-40`} aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
