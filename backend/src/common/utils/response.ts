import type { Request, Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    page,
    limit: safeLimit,
    pageSize: safeLimit,
    total,
    totalPages,
  };
}

export function serializeBigInt<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value) as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInt(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigInt(v);
    }
    return out as T;
  }
  return value;
}

export interface SuccessEnvelopeMeta {
  requestId: string;
  timestamp: string;
  dataTag: 'DEMO_SAMPLE';
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: SuccessEnvelopeMeta;
}

export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  extraMeta?: Record<string, unknown>,
  statusCode = 200
): Response<SuccessEnvelope<T>> {
  const requestId = req.requestId ?? 'req_unknown';
  return res.status(statusCode).json({
    success: true,
    data: serializeBigInt(data),
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      dataTag: 'DEMO_SAMPLE',
      ...extraMeta,
    },
  });
}
