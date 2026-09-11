export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

async function request(tenantId: string, init?: RequestInit, query = '') {
  const response = await fetch(`/api/tenant/${tenantId}/google-calendar/events${query}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Google Calendar request failed');
  return payload;
}

export const googleCalendarService = {
  async listEvents(tenantId: string): Promise<{ connected: boolean; events: GoogleCalendarEvent[] }> {
    const payload = await request(tenantId);
    return { connected: Boolean(payload.connected), events: payload.events || [] };
  },
  async createEvent(tenantId: string, event: Partial<GoogleCalendarEvent>) {
    return (await request(tenantId, { method: 'POST', body: JSON.stringify({ event }) })).event;
  },
  async updateEvent(tenantId: string, eventId: string, event: Record<string, unknown>) {
    return (await request(tenantId, { method: 'PATCH', body: JSON.stringify({ eventId, event }) })).event;
  },
  async deleteEvent(tenantId: string, eventId: string) {
    await request(tenantId, { method: 'DELETE' }, `?eventId=${encodeURIComponent(eventId)}`);
  },
};

export default googleCalendarService;
