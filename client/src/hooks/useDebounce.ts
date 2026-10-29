import { useState, useEffect } from 'react';

/**
 * Custom React hook for debouncing fast-changing values (e.g. search inputs, filter queries).
 * Delay defaults to 300ms.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
