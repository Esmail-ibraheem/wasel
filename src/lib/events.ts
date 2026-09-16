import { EventEmitter } from "node:events";

/**
 * In-process pub/sub used to push new transfers/notifications to SSE clients.
 * Stored on globalThis so it survives Next.js dev-mode module reloads.
 * (Single-instance only — swap for Redis pub/sub if the app is scaled out.)
 */

export interface TransferEvent {
  type: "transfer";
  businessId: string;
  transferId: string;
  /** userId → notificationId, so each SSE client can learn its own notification id */
  notifications: Record<string, string>;
  title: string;
  body: string;
  createdAt: string;
}

export type WaselEvent = TransferEvent;

const g = globalThis as unknown as { __waselBus?: EventEmitter };
const bus = g.__waselBus ?? (g.__waselBus = new EventEmitter());
bus.setMaxListeners(0);

export function publish(event: WaselEvent): void {
  bus.emit(`business:${event.businessId}`, event);
}

export function subscribe(businessId: string, handler: (event: WaselEvent) => void): () => void {
  const channel = `business:${businessId}`;
  bus.on(channel, handler);
  return () => bus.off(channel, handler);
}
