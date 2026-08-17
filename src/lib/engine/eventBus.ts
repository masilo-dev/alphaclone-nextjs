import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export interface DomainEvent {
  id?: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, any>;
  actor_type?: "user" | "system" | "mcp" | "cron" | "agent";
  actor_id?: string;
  correlation_id?: string;
  created_at?: string;
}

export type DomainEventListener = (event: DomainEvent) => Promise<void> | void;

function getDbClient() {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    for (const file of envFiles) {
      try {
        const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
        for (const line of content.split("\n")) {
          const [k, ...v] = line.split("=");
          const trimmedK = k.trim();
          const val = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
          if (!url && (trimmedK === "NEXT_PUBLIC_SUPABASE_URL" || trimmedK === "VITE_SUPABASE_URL")) url = val;
          if (!key && trimmedK === "SUPABASE_SERVICE_ROLE_KEY") key = val;
        }
      } catch (e) {}
    }
  }

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export class DomainEventBus {
  private static instance: DomainEventBus;
  private listeners: Map<string, Set<DomainEventListener>> = new Map();

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * Subscribe to a specific domain event type or wildcard '*'.
   */
  public subscribe(eventType: string, listener: DomainEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  /**
   * Emit a domain event. Persists event to DB and wakes active workflow handlers.
   */
  public async emit(event: DomainEvent): Promise<DomainEvent> {
    const supabase = getDbClient();
    const eventTime = new Date().toISOString();

    const newEvent: DomainEvent = {
      tenant_id: event.tenant_id,
      event_type: event.event_type,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      payload: event.payload || {},
      actor_type: event.actor_type || "system",
      actor_id: event.actor_id || undefined,
      correlation_id: event.correlation_id || undefined,
      created_at: eventTime,
    };

    // 1. Save to domain_events table (or events fallback)
    try {
      const { data, error } = await supabase
        .from("domain_events")
        .insert({
          ...newEvent,
          actor_id: newEvent.actor_id || null,
          correlation_id: newEvent.correlation_id || null,
        })
        .select()
        .single();

      if (!error && data) {
        newEvent.id = data.id;
      }
    } catch (e) {
      // Ignore if table missing; try events table fallback
      try {
        await supabase.from("events").insert({
          tenant_id: event.tenant_id,
          type: event.event_type,
          data: event.payload,
          created_at: eventTime,
        });
      } catch (err) {}
    }

    // 2. Also log to agent_event_inbox for durable execution tracking
    try {
      await supabase.from("agent_event_inbox").insert({
        tenant_id: event.tenant_id,
        event_type: event.event_type,
        entity_type: event.aggregate_type,
        entity_id: event.aggregate_id,
        payload: event.payload,
        processing_status: "processed",
        processed_at: eventTime,
      });
    } catch (e) {}

    console.log(`[EventBus] Emitted event: '${event.event_type}' for ${event.aggregate_type}:${event.aggregate_id}`);

    // 3. Dispatch to registered in-process listeners
    const specificListeners = this.listeners.get(event.event_type) || new Set();
    const wildcardListeners = this.listeners.get("*") || new Set();
    const allListeners = [...Array.from(specificListeners), ...Array.from(wildcardListeners)];

    for (const listener of allListeners) {
      try {
        await listener(event);
      } catch (err: any) {
        console.error(`[EventBus] Error in listener for '${event.event_type}':`, err.message);
      }
    }

    return newEvent;
  }
}

export const eventBus = DomainEventBus.getInstance();
