import { useEffect, useRef } from 'react';

export const useVisibleInterval = (
  callback: () => void,
  intervalMs: number,
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const runWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };

    const intervalId = window.setInterval(runWhenVisible, intervalMs);
    document.addEventListener('visibilitychange', runWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', runWhenVisible);
    };
  }, [intervalMs]);
};
