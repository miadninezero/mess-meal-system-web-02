import { useCallback, useRef, useState } from 'react';
import { createSingleFlightLock } from '../utils/asyncActionGuard';

export function useAsyncAction() {
  const lockRef = useRef(createSingleFlightLock());
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, task: () => Promise<T>): Promise<{ executed: boolean; value?: T }> => {
      if (lockRef.current.isLocked(key)) {
        return { executed: false };
      }
      setPendingKey(key);
      try {
        return await lockRef.current.run(key, task);
      } finally {
        setPendingKey((current) => (current === key ? null : current));
      }
    },
    []
  );

  const isPending = useCallback(
    (key?: string) => (key ? pendingKey === key : pendingKey !== null),
    [pendingKey]
  );

  return { run, isPending, pendingKey };
}
