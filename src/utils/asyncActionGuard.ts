export interface SingleFlightLock {
  isLocked: (key?: string) => boolean;
  run: <T>(key: string, task: () => Promise<T>) => Promise<{ executed: boolean; value?: T }>;
}

/**
 * Pure synchronous in-flight guard that prevents duplicate async submissions
 * (for example, rapid double-clicks while a Firestore write is pending).
 */
export function createSingleFlightLock(): SingleFlightLock {
  const activeKeys = new Set<string>();

  return {
    isLocked(key = 'default'): boolean {
      return activeKeys.has(key);
    },

    async run<T>(key: string, task: () => Promise<T>): Promise<{ executed: boolean; value?: T }> {
      if (activeKeys.has(key)) {
        return { executed: false };
      }
      activeKeys.add(key);
      try {
        const value = await task();
        return { executed: true, value };
      } finally {
        activeKeys.delete(key);
      }
    },
  };
}
