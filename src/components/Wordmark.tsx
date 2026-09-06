import { site } from '@/config/site';

/**
 * Typographic wordmark. No image request, scales with the user's text size,
 * and stays crisp at every DPR. Tracking is tightened because it is set large.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.4em] ${className}`}>
      <span
        data-wordmark-primary
        className="font-display text-[1.125rem] font-bold leading-none tracking-[-0.035em] text-ink"
      >
        {site.name.split(' ')[0]}
      </span>
      <span
        data-wordmark-secondary
        className="font-display text-[1.125rem] font-medium leading-none tracking-[-0.025em] text-ink-mute"
      >
        {site.name.split(' ').slice(1).join(' ')}
      </span>
    </span>
  );
}
