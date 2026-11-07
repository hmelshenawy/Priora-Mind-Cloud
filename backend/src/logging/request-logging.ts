import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';

type Failure = {
  error_code: string;
  stage: string;
  level: 'warn' | 'error';
  upstream_http_status?: number;
};
export type RequestState = {
  requestId: string;
  failure?: Failure;
  cancelled?: boolean;
  counts?: Record<string, number>;
};
export const requestContext = new AsyncLocalStorage<RequestState>();
export const validRequestId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value !== '-' &&
  /^[A-Za-z0-9_-]{1,64}$/.test(value);
export const resolveRequestId = (value: unknown) =>
  validRequestId(value) ? value : randomUUID();
export const requestId = () =>
  requestContext.getStore()?.requestId ?? randomUUID();
export const elapsed = (start: number) =>
  Math.max(0, Math.floor(performance.now() - start));
export function failure(
  error_code: string,
  stage: string,
  level: 'warn' | 'error' = 'error',
  upstream_http_status?: number,
) {
  const state = requestContext.getStore();
  if (state && !state.failure)
    state.failure = { error_code, stage, level, upstream_http_status };
}
// Only explicit scalar metadata is accepted. Never pass payloads or errors here.
const allowed = new Set([
  'operation',
  'status',
  'duration_ms',
  'http_status',
  'upstream_http_status',
  'error_code',
  'stage',
  'method',
  'route',
  'dependency',
  'result_count',
  'saved_count',
  'history_count',
  'chunk_count',
  'output_chars',
  'input_count',
  'attempt',
  'max_attempts',
  'will_retry',
  'job_correlation_id',
  'kind',
  'port',
]);
export function event(
  name: string,
  fields: Record<string, unknown>,
  id = requestContext.getStore()?.requestId ?? '-',
) {
  const safe = Object.entries(fields).filter(
    ([key, value]) =>
      allowed.has(key) &&
      (typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
        (typeof value === 'string' && /^[A-Za-z0-9_./:-]{1,120}$/.test(value))),
  );
  return `request_id=${validRequestId(id) ? id : '-'} service=backend ${name} ${safe.map(([k, v]) => `${k}=${v}`).join(' ')}`;
}

function routeInfo(req: Request) {
  const route =
    typeof req.route?.path === 'string'
      ? req.route.path.replace(/^\/api\/v1/, '') || '/'
      : '';
  const method = req.method;
  const exact: Record<string, string> = {
    'GET /': 'app.hello',
    'GET /users': 'users.placeholder',
    'POST /auth/register': 'auth.register',
    'POST /auth/login': 'auth.login',
    'GET /auth/me': 'auth.me',
    'POST /memory': 'memory.create',
    'POST /memory/search': 'memory.search',
    'POST /memory/event': 'memory.event.create',
    'POST /memory/event/search': 'memory.event.search',
    'POST /documents': 'documents.upload',
    'GET /documents': 'documents.list',
    'DELETE /documents/:id': 'documents.delete',
    'POST /documents/generated': 'documents.generated',
    'POST /documents/test-queue': 'documents.test_queue',
    'POST /conversations/:id/messages': 'messages.create',
    'GET /conversations/:id/messages': 'messages.list',
  };
  let operation = exact[`${method} ${route}`];
  const match =
    /^\/(tasks|notes|mindspaces|conversations|user-skills)(\/:[A-Za-z]+)?$/.exec(
      route,
    );
  if (!operation && match) {
    const action = {
      GET: match[2] ? 'get' : 'list',
      POST: 'create',
      PATCH: 'update',
      DELETE: 'delete',
    }[method];
    if (action) operation = `${match[1].replace('-', '_')}.${action}`;
  }
  return {
    operation: operation ?? 'unknown',
    route: operation ? `/api/v1${route === '/' ? '' : route}` : 'unmatched',
  };
}
const httpLogger = new Logger('HTTP');
export function requestLogging(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ids: string[] = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === 'x-request-id')
      ids.push(req.rawHeaders[i + 1]);
  }
  const state: RequestState = {
    requestId: resolveRequestId(ids.length === 1 ? ids[0] : undefined),
  };
  res.locals.requestLog = state;
  res.setHeader('X-Request-ID', state.requestId);
  const start = performance.now();
  const method = [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
    'PUT',
    'OPTIONS',
    'HEAD',
  ].includes(req.method)
    ? req.method
    : 'OTHER';
  let finished = false;
  const finish = (closed: boolean) => {
    if (finished) return;
    finished = true;
    state.cancelled = closed && !res.writableFinished;
    const code = res.headersSent ? res.statusCode : undefined;
    const failed = state.failure;
    const status = failed
      ? failed.level === 'warn'
        ? 'rejected'
        : 'failed'
      : state.cancelled
        ? 'cancelled'
        : code && code >= 400
          ? code >= 500
            ? 'failed'
            : 'rejected'
          : 'completed';
    const level =
      failed?.level ??
      (state.cancelled
        ? 'debug'
        : code && code >= 500
          ? 'error'
          : code && code >= 400
            ? 'warn'
            : 'log');
    httpLogger[level](
      event(
        'request.finished',
        {
          ...routeInfo(req),
          method,
          status,
          duration_ms: elapsed(start),
          http_status: code,
          ...state.counts,
          ...failed,
          error_code:
            failed?.error_code ??
            (state.cancelled
              ? 'client_disconnected'
              : code && code >= 400
                ? statusCode(code)
                : undefined),
        },
        state.requestId,
      ),
    );
  };
  res.once('finish', () => finish(false));
  res.once('close', () => finish(true));
  requestContext.run(state, () => {
    httpLogger.debug(
      event('request.started', {
        operation: 'unknown',
        status: 'started',
        method,
      }),
    );
    next();
  });
}
function statusCode(status: number) {
  return (
    {
      400: 'validation_failed',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      429: 'rate_limited',
    }[status] ?? (status >= 500 ? 'internal_error' : 'request_rejected')
  );
}
@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const state: RequestState | undefined = host.switchToHttp().getResponse()
      .locals?.requestLog;
    const code =
      exception instanceof HttpException
        ? exception.getStatus()
        : this.isHttpError(exception)
          ? (exception as any).statusCode
          : 500;
    if (state && !state.failure)
      state.failure = {
        error_code: statusCode(code),
        stage: 'request',
        level: code >= 500 ? 'error' : 'warn',
      };
    super.catch(exception, host);
  }
  // Preserve Nest's response mapping, but never pass the exception to its logger.
  handleUnknownError(exception: any, host: ArgumentsHost, adapter: any) {
    const body = this.isHttpError(exception)
      ? { statusCode: exception.statusCode, message: exception.message }
      : { statusCode: 500, message: 'Internal server error' };
    const response = host.getArgByIndex(1);
    if (!adapter.isHeadersSent(response))
      adapter.reply(response, body, body.statusCode);
    else adapter.end(response);
  }
}
