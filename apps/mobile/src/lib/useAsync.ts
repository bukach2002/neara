import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { messageFor } from './errors';

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    loader()
      .then((data) => {
        if (active) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState((current) => ({
            data: current.data,
            error: messageFor(error),
            loading: false,
          }));
        }
      });

    return () => {
      active = false;
    };
    // The caller controls reload semantics through the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, refresh, setData: (data: T) => setState({ data, error: null, loading: false }) };
}
