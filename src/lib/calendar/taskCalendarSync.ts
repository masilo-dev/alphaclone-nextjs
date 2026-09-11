import { googleCalendarService } from '@/services/googleCalendarService';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | string;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '11',
  high: '5',
  medium: '9',
  low: '10',
};

function getPriorityColor(priority?: TaskPriority): string {
  return PRIORITY_COLORS[String(priority || 'medium').toLowerCase()] || '9';
}

function addHours(isoDate: string, hours: number): string {
  const d = new Date(isoDate);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export type CalendarSyncTask = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: TaskPriority;
  google_calendar_event_id?: string | null;
};

export async function syncTaskToCalendar(
  tenantId: string,
  task: CalendarSyncTask
): Promise<{ eventId?: string; skipped?: boolean }> {
  if (!task.due_date) return { skipped: true };

  const resource = {
    summary: `[Task] ${task.title}`,
    description: task.description || undefined,
    start: { dateTime: task.due_date },
    end: { dateTime: addHours(task.due_date, 1) },
    colorId: getPriorityColor(task.priority),
    extendedProperties: {
      private: {
        alphaclone_task_id: task.id,
        type: 'task',
      },
    },
  };

  if (task.google_calendar_event_id) {
    try {
      await googleCalendarService.updateEvent(tenantId, task.google_calendar_event_id, resource);
      return { eventId: task.google_calendar_event_id };
    } catch {
      // Fall through to create if update fails (event deleted externally)
    }
  }

  const created = await googleCalendarService.createEvent(tenantId, resource);
  return { eventId: String(created?.id || '') || undefined };
}

export async function syncTaskToAllCalendars(
  tenantId: string,
  userId: string,
  task: CalendarSyncTask & { status?: string | null; related_to_project?: string | null }
): Promise<{ eventId?: string; skipped?: boolean }> {
  const googleResult = task.due_date
    ? await syncTaskToCalendar(tenantId, task).catch(() => ({ skipped: true as const }))
    : { skipped: true as const };

  void import('@/lib/calendar/nativeCalendarSync')
    .then(async ({ syncTaskToNativeCalendar, getProjectCalendarContext }) => {
      let clientId: string | null = null;
      if (task.related_to_project) {
        const ctx = await getProjectCalendarContext(task.related_to_project);
        clientId = ctx?.clientId ?? null;
      }
      await syncTaskToNativeCalendar(tenantId, userId, {
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        status: task.status,
        priority: task.priority,
        client_id: clientId,
      });
    })
    .catch((err) => console.error('[taskCalendarSync] native calendar sync failed:', err));

  return googleResult;
}
