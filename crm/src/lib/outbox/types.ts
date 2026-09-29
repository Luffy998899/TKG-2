/**
 * THE EVENTS OUTBOX - consumer interface (requirement 11).
 *
 * Every meaningful change writes one row to `public.events` in the same
 * transaction as the change itself (database triggers / functions), so an
 * event exists if and only if the change committed. Payloads carry ids and a
 * few fields - never contact details. Consumers fetch whatever else they need.
 *
 *   lead.created               { deal_id, customer_id, pipeline_id, source, matched_existing_customer? }
 *   deal.stage_changed         { deal_id, customer_id, from_stage, to_stage, actor_id }
 *   deal.assigned              { deal_id, customer_id, from_user, to_user, actor_id }
 *   contract.expiry_milestone  { task_id, contract_id, deal_id, customer_id, milestone,
 *                                end_date, days_left, assigned_to, unassigned, for_date }
 *   activity.logged            { activity_id, deal_id, customer_id, type, actor_id }
 *
 * Consuming (service role, server-side only):
 *
 *   const events = await service.rpc('claim_events', { p_consumer, p_types, p_limit });
 *   // ...process each event idempotently (it may be redelivered after a crash)...
 *   await service.rpc('complete_events', { p_consumer, p_done: ids, p_failed: [{ id, error }] });
 *
 * claim_events uses FOR UPDATE SKIP LOCKED, so two workers never take the same
 * event; complete_events sets events.processed_at once every consumer
 * registered for that type (app.consumers_for) has finished.
 *
 * ADDING A CHANNEL (e.g. WhatsApp reminders): implement OutboxConsumer in a
 * new server-only module, register its name in app.consumers_for(), and call
 * it from the daily cron. The expiry engine that emits the events is untouched.
 */
export type EventType =
  | 'lead.created'
  | 'deal.stage_changed'
  | 'deal.assigned'
  | 'contract.expiry_milestone'
  | 'activity.logged';

export interface EventPayloads {
  'lead.created': { deal_id: string; customer_id: string; pipeline_id: string; source: string; matched_existing_customer?: boolean };
  'deal.stage_changed': { deal_id: string; customer_id: string; from_stage: string; to_stage: string; actor_id: string | null };
  'deal.assigned': { deal_id: string; customer_id: string; from_user: string | null; to_user: string | null; actor_id: string | null };
  'contract.expiry_milestone': {
    task_id: string; contract_id: string; deal_id: string; customer_id: string; milestone: 120 | 90 | 60 | 30;
    end_date: string; days_left: number; assigned_to: string; unassigned: boolean; for_date: string;
  };
  'activity.logged': { activity_id: string; deal_id: string; customer_id: string; type: string; actor_id: string | null };
}

export interface OutboxEvent<T extends EventType = EventType> {
  id: number;
  type: T;
  payload: EventPayloads[T];
  created_at: string;
}

export interface OutboxConsumer {
  /** Stable id stored in event_deliveries.consumer, e.g. 'email_digest', later 'whatsapp'. */
  name: string;
  handles: EventType[];
  /** Must be idempotent: an event can be delivered again after a crash. */
  handle(events: OutboxEvent[]): Promise<{ done: number[]; failed: { id: number; error: string }[] }>;
}
