// Tiny helper for Server-Sent Events.

import type { Request, Response } from "express";

export function openSse(req: Request, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Comment lines keep proxies from closing an idle connection.
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => clearInterval(keepAlive));

  return {
    send(data: unknown, id?: number) {
      if (id !== undefined) res.write(`id: ${id}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    onClose(fn: () => void) {
      req.on("close", fn);
    },
  };
}
