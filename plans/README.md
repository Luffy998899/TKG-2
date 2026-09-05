# Animation plans

Produced by the `improve-animations` audit on 2026-09-05 (the project is not
a git repository, so plans carry a date stamp instead of a commit). Each plan
is self-contained: an executor with no other context can apply it.

## Audit summary

The scroll engine (Lenis + GSAP ticker, the scrubbed camera timeline, the
one-shot `Reveal` entrances at 700ms / 60ms stagger) was found to be right
for a marketing surface and is out of scope by instruction. No `ease-in`,
`transition: all` or `scale(0)` exists anywhere. The findings are in the
interactive chrome, where several transitions silently never fire, two
high-frequency controls have no or wrong entrance motion, and hover motion
is ungated on a phone-first site.

## Plans

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Fix press/hide transitions that target the wrong CSS property | HIGH | DONE |
| 002 | Header dropdown: interruptible transition from its trigger, not a 550ms keyframe | HIGH | DONE |
| 003 | Mobile menu sheet: slide in from the header instead of appearing | HIGH | DONE |
| 004 | FAQ accordion: reveal the answer instead of teleporting it | MEDIUM | DONE |
| 005 | Gate hover motion behind hover-capable input | MEDIUM | DONE |
| 006 | Reduced motion: drop movement, keep colour and opacity feedback | MEDIUM | DONE |
| 007 | Form success: ease into the "sent" card instead of swapping it | LOW | DONE |

## Recommended order and dependencies

1. **001** — smallest change, biggest felt improvement; no dependencies.
2. **002** — introduces the `--ease-ui-out` token that 004 and 007 reuse.
3. **003** — introduces `--ease-drawer`; same pattern as 002 (`data-open` + visibility-delayed transition).
4. **004**, **007** — depend on `--ease-ui-out` from 002 (each plan says to add it if absent, so they can also run standalone).
5. **005** — independent; touches the Tailwind config, so rebuild CSS afterwards.
6. **006** — last, because its selector list names the classes 002–004 and 007 introduce (harmless if they are absent, but most useful once they exist).

## Deliberately not planned

- `.frame-img` 600ms hover zoom — a premium-image convention; kept as designed.
- `Reveal` timing (700ms, `power3.out`, 60ms stagger) — within the marketing budget; the stagger already never blocks interaction.
- The hamburger icon swap — high-frequency, correctly instant.
- The 3D journey and the sticky CTA bar's 300ms slide — already interruptible transitions on `transform`.
