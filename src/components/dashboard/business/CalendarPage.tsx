import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, Project } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessEventService, BusinessEvent } from '../../../services/businessEventService';
import { taskService, Task } from '../../../services/taskService';
import { projectService } from '../../../services/projectService';
import { dealService, Deal } from '../../../services/dealService';
import { supabase } from '../../../lib/supabase';
import { googleCalendarService, GoogleCalendarEvent } from '../../../services/googleCalendarService';
import {
    Calendar as CalendarIcon,
    Plus,
    ChevronLeft,
    ChevronRight,
    X,
    CheckSquare,
    Briefcase,
    TrendingUp,
    Clock,
    User as UserIcon,
    Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { EmptyStatePlaceholder } from '../../ui/EmptyStatePlaceholder';
import { SubNavigation } from '@/components/ui/os';
import { getModuleSubnav } from '@/lib/dashboard/moduleSubnav';

interface CalendarPageProps {
    user: User;
}

// Unified calendar event with source tracking
interface CalendarEvent {
    id: string;
    title: string;
    date: string; // ISO date string
    startTime?: string;
    endTime?: string;
    source: 'event' | 'task' | 'project' | 'deal' | 'booking' | 'google';
    priority?: string;
    status?: string;
    description?: string;
    // Booking-specific
    clientName?: string;
    clientEmail?: string;
    // Deal-specific
    value?: number;
    currency?: string;
}

const SOURCE_CONFIG = {
    booking: {
        label: 'Booking',
        bg: 'bg-violet-500/15',
        text: 'text-violet-300',
        dot: 'bg-violet-500',
        border: 'border-violet-500/30',
    },
    task: {
        label: 'Task',
        bg: 'bg-teal-500/15',
        text: 'text-teal-300',
        dot: 'bg-teal-500',
        border: 'border-teal-500/30',
    },
    project: {
        label: 'Project',
        bg: 'bg-blue-500/15',
        text: 'text-blue-300',
        dot: 'bg-blue-500',
        border: 'border-blue-500/30',
    },
    deal: {
        label: 'Deal',
        bg: 'bg-amber-500/15',
        text: 'text-amber-300',
        dot: 'bg-amber-500',
        border: 'border-amber-500/30',
    },
    event: {
        label: 'Meeting',
        bg: 'bg-sky-500/15',
        text: 'text-sky-300',
        dot: 'bg-sky-500',
        border: 'border-sky-500/30',
    },
    google: {
        label: 'Connected calendar',
        bg: 'bg-rose-500/15',
        text: 'text-rose-300',
        dot: 'bg-rose-500',
        border: 'border-rose-500/30',
    },
};

const CalendarPage: React.FC<CalendarPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const router = useRouter();
    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeFilters, setActiveFilters] = useState<Set<CalendarEvent['source']>>(
        new Set(['event', 'task', 'project', 'booking'])
    );
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    const loadAllEvents = useCallback(async () => {
        if (!currentTenant) return;
        setLoading(true);

        const unified: CalendarEvent[] = [];

        // 1. Business events
        try {
            const { events } = await businessEventService.getEvents(currentTenant.id);
            events.forEach((e: BusinessEvent) => {
                unified.push({
                    id: `event-${e.id}`,
                    title: e.title,
                    date: e.startTime,
                    startTime: e.startTime,
                    endTime: e.endTime,
                    source: 'event',
                    description: e.description,
                });
            });
        } catch (_) { /* silent */ }

        // 2. Calendly bookings (Legacy & New Sync)
        try {
            const [bookingRes, syncedRes] = await Promise.all([
                supabase
                    .from('bookings')
                    .select('*')
                    .eq('tenant_id', currentTenant.id)
                    .neq('status', 'canceled'),
                supabase
                    .from('calendar_events')
                    .select('*')
                    .eq('tenant_id', currentTenant.id)
                    .not('metadata->>calendly_event_uri', 'is', null)
            ]) as [any, any];

            const allBookings = [
                ...(bookingRes.data || []),
                ...(syncedRes.data || []).map((event: any) => ({
                    id: event.id,
                    client_name: event.title,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    status: 'confirmed',
                    source: 'calendly',
                    client_notes: event.description
                }))
            ];

            allBookings.forEach((b: any) => {
                unified.push({
                    id: `booking-${b.id}`,
                    title: `📅 ${b.client_name || 'Booking'}`,
                    date: b.start_time,
                    startTime: b.start_time,
                    endTime: b.end_time,
                    source: 'booking',
                    clientName: b.client_name,
                    clientEmail: b.client_email,
                    description: b.client_notes,
                });
            });
        } catch (_) { /* silent */ }

        // 3. Tasks with due dates
        try {
            const { tasks } = await taskService.getTasks({ limit: 200 });
            (tasks || []).forEach((t: Task) => {
                if (t.dueDate && t.status !== 'completed' && t.status !== 'cancelled') {
                    unified.push({
                        id: `task-${t.id}`,
                        title: `✓ ${t.title}`,
                        date: t.dueDate,
                        source: 'task',
                        priority: t.priority,
                        status: t.status,
                        description: t.description,
                    });
                }
            });
        } catch (_) { /* silent */ }

        // 4. Projects with due dates
        try {
            const { projects } = await projectService.getProjects(user.id, user.role as any, 200);
            (projects || []).forEach((p: Project) => {
                if (p.dueDate && p.status !== 'Completed') {
                    unified.push({
                        id: `project-${p.id}`,
                        title: `📁 ${p.name}`,
                        date: p.dueDate,
                        source: 'project',
                        status: p.status,
                        description: p.description,
                    });
                }
            });
        } catch (_) { /* silent */ }

        // 5. Deals with expected close dates
        try {
            const { deals } = await dealService.getDeals();
            (deals || []).forEach((d: Deal) => {
                if (d.expectedCloseDate && d.stage !== 'closed_won' && d.stage !== 'closed_lost') {
                    unified.push({
                        id: `deal-${d.id}`,
                        title: `💰 ${d.name}`,
                        date: d.expectedCloseDate,
                        source: 'deal',
                        status: d.stage,
                        value: d.value,
                        currency: d.currency,
                        description: d.description,
                    });
                }
            });
        } catch (_) { /* silent */ }

        // 6. Google Calendar events
        try {
            if (currentTenant?.id) {
                const { connected, events: googleEvents } = await googleCalendarService.listEvents(currentTenant.id);
                setIsGoogleConnected(connected);
                googleEvents.forEach((ge: GoogleCalendarEvent) => {
                    unified.push({
                        id: `google-${ge.id}`,
                        title: ge.summary || '(No title)',
                        date: ge.start.dateTime || ge.start.date || '',
                        startTime: ge.start.dateTime,
                        endTime: ge.end.dateTime,
                        source: 'google',
                        description: ge.description,
                    });
                });
            } else setIsGoogleConnected(false);
        } catch (_) { /* silent */ }

        setAllEvents(unified);
        setLoading(false);
    }, [currentTenant, user.id, user.role]);

    const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);

    const handleUpdateEvent = useCallback(async (eventId: string, updates: Partial<BusinessEvent>) => {
        try {
            if (!currentTenant?.id) return;
            const { error } = await businessEventService.updateEvent(currentTenant.id, eventId, updates);
            if (!error) {
                toast.success('Event updated');
                loadAllEvents();
                setEditingEvent(null);
                setSelectedEvent(null);
            } else {
                toast.error('Failed to update event');
            }
        } catch (_) {
            toast.error('An error occurred');
        }
    }, [currentTenant?.id, loadAllEvents]);

    const handleDeleteEvent = useCallback(async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            if (!currentTenant?.id) return;
            const { error } = await businessEventService.deleteEvent(currentTenant.id, eventId);
            if (!error) {
                toast.success('Event deleted');
                loadAllEvents();
                setSelectedEvent(null);
            } else {
                toast.error('Failed to delete event');
            }
        } catch (_) {
            toast.error('An error occurred');
        }
    }, [currentTenant?.id, loadAllEvents]);

    const handleAddEvent = useCallback(async (eventData: Partial<BusinessEvent>) => {
        if (!currentTenant) return;
        const { event, error } = await businessEventService.createEvent(currentTenant.id, {
            ...eventData,
            createdBy: user.id,
        });
        if (!error && event) {
            toast.success('Event created');
            loadAllEvents();
            setShowAddModal(false);
        } else {
            toast.error(error || 'Failed to create event');
        }
    }, [currentTenant, user.id, loadAllEvents]);

    useEffect(() => {
        if (currentTenant) {
            loadAllEvents();
        }
    }, [currentTenant, loadAllEvents]);

    const handleGoogleConnect = () => {
        if (!currentTenant?.id) return;
        window.location.href = `/api/auth/google/calendar/connect?tenantId=${encodeURIComponent(currentTenant.id)}`;
    };

    const toggleFilter = (source: CalendarEvent['source']) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(source)) {
                next.delete(source);
            } else {
                next.add(source);
            }
            return next;
        });
    };

    const filteredEvents = allEvents.filter(e => activeFilters.has(e.source));

    const calendarStats = useMemo<ModuleStat[]>(() => {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const thisMonth = filteredEvents.filter(e => {
            const d = new Date(e.date);
            return d >= monthStart && d <= monthEnd;
        });
        const bookings = thisMonth.filter(e => e.source === 'booking').length;
        const tasks = thisMonth.filter(e => e.source === 'task').length;
        const deals = thisMonth.filter(e => e.source === 'deal').length;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = filteredEvents.filter(e => {
            const d = new Date(e.date); d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        }).length;
        return [
            { label: 'This Month', value: thisMonth.length, sub: currentDate.toLocaleDateString('en-US', { month: 'long' }), Icon: CalendarIcon, accent: 'teal' },
            { label: 'Today', value: todayCount, sub: 'Scheduled items', Icon: Clock, accent: 'amber' },
            { label: 'Bookings', value: bookings, sub: `${tasks} tasks · ${deals} deals`, Icon: Briefcase, accent: 'purple' },
            { label: 'Sources', value: activeFilters.size, sub: 'Active filters', Icon: TrendingUp, accent: 'blue' },
        ];
    }, [filteredEvents, currentDate, activeFilters.size]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        return {
            daysInMonth: lastDay.getDate(),
            startingDayOfWeek: firstDay.getDay(),
        };
    };

    const getEventsForDate = (date: Date) => {
        return filteredEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

    const isCalendlyConnected = !!(currentTenant as any)?.settings?.calendly?.enabled;

    if (loading) {
        return (
            <div className="space-y-4 ac-scroll-full ac-enterprise-module" data-module="calendar">
                <SubNavigation
                    moduleId="calendar"
                    items={getModuleSubnav('calendar')}
                    activeHref="/dashboard/business/calendar"
                />
                <div className="flex items-center justify-center min-h-[320px]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[var(--brand-violet-500)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[var(--ws-text-muted)] text-sm">Loading calendar...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 ac-scroll-full ac-enterprise-module" data-module="calendar">
            <SubNavigation
                moduleId="calendar"
                items={getModuleSubnav('calendar')}
                activeHref="/dashboard/business/calendar"
            />
            <ModuleStatCards stats={calendarStats} />
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-[var(--ws-text-primary)]">
                        {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors font-medium"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    <button
                        onClick={() => window.location.href = `/api/auth/google/calendar/connect?userId=${user.id}`}
                        title="Connect Google Calendar"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        <span className="text-sm font-medium">Google Calendar</span>
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors font-semibold text-slate-950"
                    >
                        <Plus className="w-4 h-4" />
                        Add Event
                    </button>
                </div>
            </div>

            {/* Filter Legend */}
            <div className="flex flex-wrap gap-2">
                {(Object.entries(SOURCE_CONFIG) as [CalendarEvent['source'], typeof SOURCE_CONFIG['event']][]).map(([source, config]) => (
                    <button
                        key={source}
                        onClick={() => toggleFilter(source)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeFilters.has(source)
                            ? `${config.bg} ${config.text} ${config.border}`
                            : 'bg-slate-900 text-slate-500 border-slate-700 opacity-50'
                            }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${activeFilters.has(source) ? config.dot : 'bg-slate-600'}`} />
                        {config.label}
                    </button>
                ))}
                <span className="flex items-center text-xs text-slate-500 ml-1">
                    {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} this month
                </span>
            </div>

            {filteredEvents.length === 0 && (
                <EmptyStatePlaceholder
                    icon={CalendarIcon}
                    title="No events scheduled"
                    description="Add a meeting, task, or booking to bring this calendar to life."
                    action={{ label: 'Add Event', onClick: () => setShowAddModal(true) }}
                    secondaryAction={{ label: 'Connect Google Calendar', onClick: () => router.push(`/api/auth/google/calendar/connect?userId=${user.id}`) }}
                />
            )}


            {/* Desktop Calendar Grid */}
            <div className="hidden md:block bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-800">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-3 text-center text-sm font-semibold text-slate-400 border-r border-slate-800 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="min-h-[100px] border-r border-b border-slate-800 bg-slate-900/30" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const day = idx + 1;
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dayEvents = getEventsForDate(date);
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={day}
                                className="min-h-[100px] border-r border-b border-slate-800 p-2 hover:bg-slate-800/30 cursor-pointer transition-colors"
                                onClick={() => {
                                    setSelectedDate(date);
                                    setShowAddModal(true);
                                }}
                            >
                                <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-teal-500 text-slate-950' : 'text-slate-300'
                                    }`}>
                                    {day}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map(event => {
                                        const cfg = SOURCE_CONFIG[event.source];
                                        return (
                                            <div
                                                key={event.id}
                                                className={`text-xs px-2 py-1 rounded truncate ${cfg.bg} ${cfg.text} cursor-pointer hover:opacity-80`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEvent(event);
                                                }}
                                            >
                                                {event.title}
                                            </div>
                                        );
                                    })}
                                    {dayEvents.length > 3 && (
                                        <div className="text-xs text-slate-500 pl-1">
                                            +{dayEvents.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Agenda View */}
            <div className="md:hidden">
                <MobileCalendarView
                    currentDate={currentDate}
                    events={filteredEvents}
                    onSelectDate={(date: Date) => {
                        setSelectedDate(date);
                        setShowAddModal(true);
                    }}
                    onSelectEvent={(event: CalendarEvent) => setSelectedEvent(event)}
                />
            </div>

            {/* Upcoming Events Sidebar (desktop) */}
            <UpcomingEvents events={filteredEvents} onSelectEvent={setSelectedEvent} />

            {/* Event Detail Modal */}
            {
                selectedEvent && (
                    <EventDetailModal
                        event={selectedEvent}
                        onClose={() => setSelectedEvent(null)}
                        onDelete={handleDeleteEvent}
                        onEdit={(event) => {
                            // Find the original business event data
                            const bizEvent = allEvents.find(e => e.id === event.id);
                            if (bizEvent) {
                                setEditingEvent({
                                    id: event.id.replace('event-', ''),
                                    title: event.title,
                                    description: event.description,
                                    startTime: event.startTime ?? event.date,
                                    endTime: event.endTime ?? event.date,
                                    eventType: (event as any).type || 'meeting',
                                    tenantId: currentTenant?.id || '',
                                    attendees: [],
                                    createdAt: new Date().toISOString()
                                });
                                setSelectedEvent(null); // Close detail modal
                            }
                        }}
                    />
                )}

            {(showAddModal || editingEvent) && (
                <AddEventModal
                    selectedDate={selectedDate}
                    initialData={editingEvent || undefined}
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingEvent(null);
                        setSelectedDate(null); // Reset selected date when modal closes
                    }}
                    onAdd={editingEvent ? (data) => handleUpdateEvent(editingEvent.id, data) : handleAddEvent}
                />
            )
            }
        </div >
    );
};

// ─── Upcoming Events Panel ─────────────────────────────────────────────────

const UpcomingEvents = ({ events, onSelectEvent }: { events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void }) => {
    const now = new Date();
    const upcoming = events
        .filter(e => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    if (upcoming.length === 0) return null;

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" />
                Upcoming
            </h3>
            <div className="space-y-2">
                {upcoming.map(event => {
                    const cfg = SOURCE_CONFIG[event.source];
                    const date = new Date(event.date);
                    return (
                        <button
                            key={event.id}
                            onClick={() => onSelectEvent(event)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                        >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 truncate">{event.title}</p>
                                <p className="text-xs text-slate-500">
                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    {event.startTime && ` · ${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} shrink-0`}>
                                {cfg.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Event Detail Modal ────────────────────────────────────────────────────

const EventDetailModal = ({ event, onClose, onDelete, onEdit }: {
    event: CalendarEvent;
    onClose: () => void;
    onDelete: (id: string) => void;
    onEdit: (event: CalendarEvent) => void;
}) => {
    const cfg = SOURCE_CONFIG[event.source];
    const date = new Date(event.date);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${cfg.bg} ${cfg.text} font-medium`}>
                            {cfg.label}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <h3 className="text-lg font-bold text-white mb-4">{event.title}</h3>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                        <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>
                            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                    </div>

                    {event.startTime && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>
                                {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {event.endTime && ` – ${new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                        </div>
                    )}

                    {event.clientName && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>{event.clientName}</span>
                        </div>
                    )}

                    {event.clientEmail && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>{event.clientEmail}</span>
                        </div>
                    )}

                    {event.value && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <TrendingUp className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>
                                {event.currency || 'USD'} {event.value.toLocaleString()} deal value
                            </span>
                        </div>
                    )}

                    {event.priority && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckSquare className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="capitalize">Priority: {event.priority}</span>
                        </div>
                    )}

                    {event.status && (
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Briefcase className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="capitalize">Status: {event.status.replace(/_/g, ' ')}</span>
                        </div>
                    )}

                    {event.description && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg text-sm text-slate-400">
                            {event.description}
                        </div>
                    )}

                    {/* Navigation Buttons for Related Entities */}
                    <div className="mt-6 flex flex-col gap-2">
                        {event.source === 'task' && (
                            <button
                                onClick={() => (window.location.href = '/dashboard/tasks')}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
                            >
                                View Task Details
                            </button>
                        )}
                        {event.source === 'project' && (
                            <button
                                onClick={() => (window.location.href = '/dashboard/business/projects')}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
                            >
                                View Project Details
                            </button>
                        )}
                        {event.source === 'deal' && (
                            <button
                                onClick={() => (window.location.href = '/dashboard/leads')}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
                            >
                                View Deal Details
                            </button>
                        )}
                        {event.source === 'event' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onEdit(event)}
                                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
                                >
                                    Edit Event
                                </button>
                                <button
                                    onClick={() => {
                                        const eventId = event.id.replace('event-', '');
                                        onDelete(eventId);
                                    }}
                                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20"
                                >
                                    Delete Event
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Mobile Calendar View ──────────────────────────────────────────────────

const MobileCalendarView = ({ currentDate, events, onSelectDate, onSelectEvent }: {
    currentDate: Date;
    events: CalendarEvent[];
    onSelectDate: (date: Date) => void;
    onSelectEvent: (event: CalendarEvent) => void;
}) => {
    const daysCount = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysCount }, (_, i) => i + 1);

    return (
        <div className="space-y-2 pb-20">
            {days.map(day => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayEvents = events.filter(e => {
                    const eventDate = new Date(e.date);
                    return eventDate.toDateString() === date.toDateString();
                });
                const isToday = date.toDateString() === new Date().toDateString();

                if (!isToday && dayEvents.length === 0) return null;

                return (
                    <div key={day} className={`bg-slate-900/40 border ${isToday ? 'border-teal-500/30' : 'border-white/5'} rounded-2xl backdrop-blur-sm`}>
                        <div className={`p-4 flex items-center justify-between ${isToday ? 'bg-teal-500/5' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl border ${isToday ? 'bg-teal-500 text-slate-950 border-teal-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    <span className="text-lg font-black leading-none">{day}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                                    </span>
                                    {isToday && <span className="text-xs font-black text-teal-400 uppercase tracking-widest">Today</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => onSelectDate(date)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/50"
                            >
                                <Plus className="w-4 h-4 text-slate-300" />
                            </button>
                        </div>

                        {dayEvents.length > 0 && (
                            <div className="px-4 pb-4 space-y-2">
                                {dayEvents.map(event => {
                                    const cfg = SOURCE_CONFIG[event.source];
                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => onSelectEvent(event)}
                                            className="w-full bg-slate-950/50 border border-white/5 p-3 rounded-lg flex items-center justify-between ml-14 text-left hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-white mb-1 truncate">{event.title}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                                    <span className="uppercase tracking-wide text-xs">{cfg.label}</span>
                                                    {event.startTime && (
                                                        <>
                                                            <div className="w-px h-3 bg-slate-700" />
                                                            <span>{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Add Event Modal ───────────────────────────────────────────────────────

const AddEventModal = ({ selectedDate, initialData, onClose, onAdd }: {
    selectedDate: Date | null;
    initialData?: BusinessEvent;
    onClose: () => void;
    onAdd: (data: Partial<BusinessEvent>) => void;
}) => {
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        description: initialData?.description || '',
        startTime: initialData?.startTime
            ? new Date(initialData.startTime).toISOString().slice(0, 16)
            : (selectedDate ? selectedDate.toISOString().slice(0, 16) : ''),
        endTime: initialData?.endTime
            ? new Date(initialData.endTime).toISOString().slice(0, 16)
            : '',
        eventType: initialData?.eventType || 'meeting',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title?.trim()) {
            toast.error('Please enter a title');
            return;
        }

        if (new Date(formData.endTime) <= new Date(formData.startTime)) {
            toast.error('End time must be after start time');
            return;
        }

        onAdd(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Add Event</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Event Title *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Start Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={formData.startTime}
                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">End Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={formData.endTime}
                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Event Type</label>
                        <select
                            value={formData.eventType}
                            onChange={e => setFormData({ ...formData, eventType: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="meeting">Meeting</option>
                            <option value="deadline">Deadline</option>
                            <option value="reminder">Reminder</option>
                            <option value="event">Event</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors font-semibold text-slate-950"
                        >
                            {initialData ? 'Update Event' : 'Add Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CalendarPage;
