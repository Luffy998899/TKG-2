'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** False during server render and before hydration; true once React owns the page. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
