import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB check for the platform health probe. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, time: new Date().toISOString() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "db" }, { status: 503 });
  }
}
