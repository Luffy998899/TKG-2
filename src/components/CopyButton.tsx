'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';

/**
 * Copies a value to the clipboard and says so.
 *
 * WHY THIS EXISTS. A `mailto:` link does nothing visible on a machine with no
 * mail client registered - which is most desktop browsers now, where mail
 * lives on a web page. The link is not broken, but from the customer's side it
 * is a button that does not work. So the address keeps its mailto link for
 * anyone who does have a client, and this sits beside it for everyone else.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** What is being copied, for the screen-reader label. */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older Safari, and any browser refusing clipboard permission. Falls
      // back to the oldest trick there is, which still works everywhere.
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
      } catch {
        return;
      } finally {
        document.body.removeChild(field);
      }
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-caption font-semibold text-ink-soft transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent-ink',
        className ?? '',
      ].join(' ')}
    >
      {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
