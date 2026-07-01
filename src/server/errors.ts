import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ErrorResponse, SuccessResponse } from "@/types/voucher";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  const payload: SuccessResponse<T> = { success: true, data };
  return NextResponse.json(payload, init);
}

export function fail(error: unknown) {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError("E-VALIDATION-400", "Invalid request input", 400, error.flatten())
      : new AppError("E-SYSTEM-500", "Unexpected server error", 500);
  const payload: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details
    }
  };
  return NextResponse.json(payload, { status: appError.status });
}
