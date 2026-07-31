import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 doesn't forward rejected promises to error middleware on its own —
 * wrap every async route handler so a thrown/rejected error becomes a 500 instead
 * of an unhandled rejection that silently hangs the request. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
