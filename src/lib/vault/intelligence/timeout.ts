/**
 * Race a promise against a hard timeout. Returns `null` if the timer wins,
 * letting the caller surface partialResult without throwing. Errors from
 * the inner promise are also coerced to `null` — engines should never take
 * down the orchestrator.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    promise
      .then((v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}
