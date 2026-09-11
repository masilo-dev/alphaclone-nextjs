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

export type CalendarSyncProject = {
  id: string;
  name: string;
  description?: string | null;
  due_date?: string | null;
  status?: string | null;
  google_calendar_event_id?: string | null;
};

function projectDeadlineColor(dueDate: string): string {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (due < now) return '11';
  if (due - now <= sevenDays) return '6';
  return '10';
}

export async function syncTaskToCalendar(
  userId: string,
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
      await googleCalendarService.updateEvent(userId, task.google_calendar_event_id, resource);
      return { eventId: task.google_calendar_event_id };
    } catch {
      // Fall through to create if update fails (event deleted externally)
    }
  }

  const created = await googleCalendarService.createEvent(userId, resource);
  return { eventId: String(created?.id || '') || undefined };
}

export async function syncTaskToAllCalendars(
  tenantId: string,
  userId: string,
  task: CalendarSyncTask & { status?: string | null; related_to_project?: string | null }
): Promise<{ eventId?: string; skipped?: boolean }> {
  const googleResult = task.due_date
    ? await syncTaskToCalendar(userId, task).catch(() => ({ skipped: true as const }))
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

export async function syncProjectDeadlineToCalendar(
  userId: string,
  project: CalendarSyncProject
): Promise<{ eventId?: string; skipped?: boolean }> {
  if (!project.due_date) return { skipped: true };

  const resource = {
    summary: `[Project] ${project.name} — Deadline`,
    description: project.description || undefined,
    start: { date: project.due_date.split('T')[0] },
    end: { date: project.due_date.split('T')[0] },
    colorId: projectDeadlineColor(project.due_date),
    extendedProperties: {
      private: {
        alphaclone_project_id: project.id,
        type: 'project',
      },
    },
  };

  if (project.google_calendar_event_id) {
    try {
      await googleCalendarService.updateEvent(userId, project.google_calendar_event_id, resource);
      return { eventId: project.google_calendar_event_id };
    } catch {
      // recreate below
    }
  }

  const created = await googleCalendarService.createEvent(userId, resource);
  return { eventId: String(created?.id || '') || undefined };
}
