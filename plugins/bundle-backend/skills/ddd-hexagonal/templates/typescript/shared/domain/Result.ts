/**
 * Result type para errores esperados de negocio. Serializable (sin clases), así puede
 * cruzar la frontera Server Action -> cliente sin transformación.
 * Excepciones quedan para bugs e infraestructura.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;

/** Encadena sin anidar ifs: map sobre el valor, deja pasar el error. */
export const map = <T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> =>
  r.ok ? ok(fn(r.value)) : r;

export const andThen = <T, U, E>(r: Result<T, E>, fn: (t: T) => Result<U, E>): Result<U, E> =>
  r.ok ? fn(r.value) : r;

/** Para tests y adaptadores que prefieren lanzar. */
export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (r.ok) return r.value;
  throw new Error(`Unwrapped an error result: ${JSON.stringify(r.error)}`);
};
