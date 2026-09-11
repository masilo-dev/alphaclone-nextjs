export interface BusinessEvent {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  eventType: string;
  attendees: string[];
  createdBy?: string;
  createdAt: string;
}

async function request(tenantId: string, init?: RequestInit) {
  const response = await fetch(`/api/tenant/${tenantId}/business-events`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Calendar operation failed');
  return payload;
}

export const businessEventService = {
  async getEvents(tenantId: string): Promise<{ events: BusinessEvent[]; error: string | null }> {
    try { return { events: (await request(tenantId)).events || [], error: null }; }
    catch (error) { return { events: [], error: error instanceof Error ? error.message : 'Calendar events could not be loaded' }; }
  },
  async createEvent(tenantId: string, event: Partial<BusinessEvent>): Promise<{ event: BusinessEvent | null; error: string | null }> {
    try { return { event: (await request(tenantId, { method: 'POST', body: JSON.stringify(event) })).event, error: null }; }
    catch (error) { return { event: null, error: error instanceof Error ? error.message : 'Calendar event could not be created' }; }
  },
  async updateEvent(tenantId: string, eventId: string, updates: Partial<BusinessEvent>): Promise<{ error: string | null }> {
    try { await request(tenantId, { method: 'PATCH', body: JSON.stringify({ eventId, ...updates }) }); return { error: null }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'Calendar event could not be updated' }; }
  },
  async deleteEvent(tenantId: string, eventId: string): Promise<{ error: string | null }> {
    try { await request(tenantId, { method: 'DELETE', body: JSON.stringify({ eventId }) }); return { error: null }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'Calendar event could not be deleted' }; }
  },
};
