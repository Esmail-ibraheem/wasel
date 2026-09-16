import { getCurrentUser } from "@/lib/auth/session";
import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events stream of new-transfer notifications for the logged-in user. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.businessId) return new Response("unauthorized", { status: 401 });
  const businessId = user.businessId;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      send("ready", { at: new Date().toISOString() });

      unsubscribe = subscribe(businessId, (e) => {
        const notificationId = e.notifications[user.id];
        if (!notificationId) return;
        send("transfer", {
          notificationId,
          transferId: e.transferId,
          title: e.title,
          body: e.body,
          createdAt: e.createdAt,
        });
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
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
