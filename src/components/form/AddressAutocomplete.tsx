'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useController, type Control } from 'react-hook-form';
import type { FieldConfig } from '@/lib/form-schema';
import type { AddressSuggestion } from '@/app/api/address/route';
import { SpinnerIcon } from '@/components/icons';

/**
 * An address field that suggests real addresses as you type.
 *
 * Suggestions come from /api/address (Google Places when a key is configured,
 * OpenStreetMap otherwise). The value stored in the form is the full one-line
 * address string, so whatever the customer picked is what the inquiry carries.
 *
 * WHY A CUSTOM COMBOBOX rather than Google's own widget: the widget renders
 * into its own DOM with its own styles, cannot be driven by react-hook-form
 * without a second source of truth, and its dropdown is famously awkward inside
 * a scrolling page on iOS. This is the WAI-ARIA combobox pattern - a real
 * <input> with aria-expanded/aria-activedescendant and a <ul role="listbox"> -
 * so it types, announces and scrolls like the rest of the form.
 *
 * MOBILE. Three things matter and all three are handled here:
 *   - the list is selected on `pointerdown`, before the input's `blur`, so a
 *     tap does not close the list out from under the finger;
 *   - rows are 44px+ touch targets;
 *   - `autoComplete="off"` keeps the browser's own address autofill sheet from
 *     covering our list. The user can still paste or type freely.
 *
 * Free text is always allowed. If the lookup service is down or the address is
 * too new to be in it, whatever was typed is submitted as-is.
 */
export function AddressAutocomplete({
  field,
  control,
  id,
  describedBy,
  invalid,
}: {
  field: FieldConfig;
  control: Control<any>;
  id: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const { field: rhf } = useController({ name: field.name, control });
  const value = typeof rhf.value === 'string' ? rhf.value : '';

  const listId = `${useId()}-listbox`;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  /** The last value that came from a click/Enter on a suggestion. */
  const chosen = useRef<string>('');
  /**
   * One session token per address the user is picking. Google bills an
   * autocomplete session rather than each keystroke, so this is what keeps the
   * lookup cheap. Rotated after every selection.
   */
  const session = useRef<string>(newSession());

  /* --------------------------------------------------------------- lookup */
  useEffect(() => {
    const query = value.trim();

    // Nothing to look up, or the text is exactly what was just picked.
    if (query.length < 3 || query === chosen.current) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    // Debounced: a phone keyboard produces a lot of keystrokes, and each one
    // would otherwise be a request.
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/address?q=${encodeURIComponent(query)}&session=${session.current}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
        if ((data.suggestions ?? []).length > 0) setOpen(true);
      } catch {
        /* Aborted, offline, or the service is down. The field stays usable. */
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  /* ------------------------------------------------- close on outside tap */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const select = useCallback(
    (suggestion: AddressSuggestion) => {
      chosen.current = suggestion.label;
      session.current = newSession();
      rhf.onChange(suggestion.label);
      setOpen(false);
      setSuggestions([]);
      setActive(-1);
    },
    [rhf],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) setOpen(true);
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case 'Enter':
        if (active >= 0) {
          event.preventDefault();
          select(suggestions[active]);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const expanded = open && suggestions.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        // Our list, not the browser's - see the note above.
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="search"
        placeholder={field.placeholder}
        className="field-control"
        name={rhf.name}
        ref={rhf.ref}
        value={value}
        onChange={(event) => rhf.onChange(event.target.value)}
        onBlur={rhf.onBlur}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {loading ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute"
        >
          <SpinnerIcon />
        </span>
      ) : null}

      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-paper py-1.5 shadow-lift"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // pointerdown, not click: it fires before the input blurs, so the
              // tap always lands on the row the finger is actually over.
              onPointerDown={(event) => {
                event.preventDefault();
                select(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={[
                'flex min-h-[44px] cursor-pointer flex-col justify-center px-4 py-2.5 text-left',
                index === active ? 'bg-accent-soft' : '',
              ].join(' ')}
            >
              <span className="text-body font-medium text-ink">{suggestion.main}</span>
              {suggestion.secondary ? (
                <span className="text-caption text-ink-mute">{suggestion.secondary}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Opaque per-selection id. crypto.randomUUID is not on older Safari. */
function newSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
