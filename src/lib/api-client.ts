import type { ErrorResponse, SuccessResponse } from "@/types/voucher";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as SuccessResponse<T> | ErrorResponse;
  if (!payload.success) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}
