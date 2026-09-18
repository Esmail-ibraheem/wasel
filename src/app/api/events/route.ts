import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Serverless hosts cap function time; the client reconnects when we close. */
export const maxDuration = 60;

const SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const STREAM_LIFETIME_MS = SERVERLESS ? 50_000 : 6 * 60 * 60 * 1000;
const POLL_MS = 3_000;
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream of new-transfer notifications for the logged-in user.
 *
 * Two delivery paths, deduplicated by notification id:
 *  - in-process event bus → instant when ingest ran on this same instance
 *  - database polling every few seconds → works across serverless instances
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.businessId) return new Response("unauthorized", { status: 401 });
  if (!user.access.ok) return new Response("business not active", { status: 403 });
  const businessId = user.businessId;
  const userId = user.id;

  const encoder = new TextEncoder();
  const url = new URL(req.url);
  // The client may resume from the last notification it saw (Last-Event-ID or ?since=ISO).
  const sinceParam = req.headers.get("last-event-id") || url.searchParams.get("since");
  let cursor = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : new Date();
  const sent = new Set<string>();

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poller: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: string, data: unknown, id?: string) =>
        write(`${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const deliver = (n: { id: string; transferId: string | null; title: string; body: string; createdAt: Date }) => {
        if (sent.has(n.id)) return;
        sent.add(n.id);
        if (n.createdAt > cursor) cursor = n.createdAt;
        send("transfer", { notificationId: n.id, transferId: n.transferId, title: n.title, body: n.body, createdAt: n.createdAt.toISOString() }, n.createdAt.toISOString());
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        if (poller) clearInterval(poller);
        if (lifetime) clearTimeout(lifetime);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      write("retry: 1500\n\n");
      send("ready", { at: new Date().toISOString(), serverless: SERVERLESS });

      unsubscribe = subscribe(businessId, (e) => {
        const notificationId = e.notifications[userId];
        if (!notificationId) return;
        deliver({ id: notificationId, transferId: e.transferId, title: e.title, body: e.body, createdAt: new Date(e.createdAt) });
      });

      let polling = false;
      poller = setInterval(async () => {
        if (polling || closed) return;
        polling = true;
        try {
          const rows = await db.notification.findMany({
            where: { userId, createdAt: { gt: new Date(cursor.getTime() - 1000) } },
            orderBy: { createdAt: "asc" },
            take: 50,
          });
          for (const n of rows) deliver(n);
        } catch {
          /* transient DB error: try again next tick */
        } finally {
          polling = false;
        }
      }, POLL_MS);

      heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);
      lifetime = setTimeout(cleanup, STREAM_LIFETIME_MS);
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
      if (poller) clearInterval(poller);
      if (lifetime) clearTimeout(lifetime);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
