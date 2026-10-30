export class CliError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

export function failure(command, error) {
  const known = error instanceof CliError;
  const code = known ? error.code : 'INTERNAL_ERROR';
  const exitCode = { INVALID_ARGUMENT: 2, AUTH_REQUIRED: 3, FORBIDDEN: 3, RATE_LIMITED: 5,
    NOT_FOUND: 4, NOT_INDEXED: 4, INDEX_INVALID: 4, SNAPSHOT_INVALID: 4, UPSTREAM_FORMAT: 4, NOT_IMPLEMENTED: 4,
    REFRESH_REQUIRED:4,CAPTURE_IN_PROGRESS:4,DATE_NOT_CAPTURED:4,CAPTURE_FAILED:4 }[code] ?? 1;
  return {
    exitCode,
    payload: { ok: false, command, error: {
      code, message: known ? error.message : 'Unexpected internal error.',
      ...(known && error.hint ? { hint: error.hint } : {})
    } }
  };
}
