export type AppErrorCode =
  | "missing_key"
  | "invalid_key"
  | "model_unavailable"
  | "rate_limited"
  | "ai_unavailable"
  | "ai_bad_response"
  | "bad_request"
  | "unreadable_files"
  | "internal";

const HTTP_STATUS: Record<AppErrorCode, number> = {
  missing_key: 500,
  invalid_key: 401,
  model_unavailable: 400,
  rate_limited: 429,
  ai_unavailable: 503,
  ai_bad_response: 502,
  bad_request: 400,
  unreadable_files: 422,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: string[];

  constructor(code: AppErrorCode, message: string, details?: string[]) {
    super(message);
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export interface ApiErrorBody {
  error: { code: AppErrorCode; message: string; details?: string[] };
}

export function errorResponse(error: unknown): Response {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("internal", "Algo salió mal en el servidor. Revisa la terminal para más detalles.");
  if (!(error instanceof AppError)) console.error("[papita-quiz]", error);
  const body: ApiErrorBody = {
    error: { code: appError.code, message: appError.message, details: appError.details },
  };
  return Response.json(body, { status: appError.status });
}
