type SupabaseLikeError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  name?: unknown;
};

const hasErrorShape = (value: unknown): value is SupabaseLikeError =>
  typeof value === 'object' && value !== null;

export function getErrorMessage(error: unknown, fallback = 'Ha ocurrido un error inesperado.'): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (hasErrorShape(error)) {
    const message = typeof error.message === 'string' ? error.message.trim() : '';
    if (message) return message;

    const details = typeof error.details === 'string' ? error.details.trim() : '';
    if (details) return details;

    const hint = typeof error.hint === 'string' ? error.hint.trim() : '';
    if (hint) return hint;
  }

  return fallback;
}

export function logSupabaseError(context: string, error: unknown) {
  if (!__DEV__) return;

  if (hasErrorShape(error)) {
    console.error(context, {
      name: error.name,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      raw: error,
    });
    return;
  }

  console.error(context, error);
}
