import { useEffect, useState } from 'react';

// The caller memoizes load(signal). Abort and ignore old responses on URL changes.
export default function useCategoryRequest(load, contextKey) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => load(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted)
            setResult({ load, revision, contextKey, data, error: null });
        },
        (error) => {
          if (!controller.signal.aborted)
            setResult({ load, revision, contextKey, data: null, error });
        }
      );
    return () => controller.abort();
  }, [load, revision, contextKey]);
  const current =
    result?.load === load && result.revision === revision && result.contextKey === contextKey;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    retry: () => setRevision((value) => value + 1),
  };
}
