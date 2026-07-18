import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { format, isBefore, addMinutes } from 'date-fns'; // Added addMinutes
import { Calendar as CalendarIcon, Video, MapPin, X, Clock, Users as UsersIcon, Loader2, CheckSquare, CreditCard, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, Button, Badge, Modal, Input } from '../ui/UIComponents';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { taskService } from '../../services/taskService'; // Added taskService
import { User } from '../../types';
import toast from 'react-hot-toast';
import { PastEventPromptModal } from './PastEventPromptModal';
import { useTenant } from '@/contexts/TenantContext';
import { strategicThinkerService } from '../../services/StrategicThinkerService';

/**
 * Helper to parse Calendly Q&A JSON
 */
const parseEventQA = (description: string) => {
    if (!description) return null;
    if (!description.startsWith('[') && !description.startsWith('{')) return null;

    try {
        const parsed = JSON.parse(description);
        if (Array.isArray(parsed)) {
            return parsed.map((item: any) => ({
                question: item.question || item.name || 'Question',
                answer: item.answer || item.value || 'No answer provided'
            }));
        }
        return null;
    } catch (e) {
        return null;
    }
};

interface CalendarProps {
    user: User;
}

/**
 * IMPROVED Calendar with:
 * - Dark theme optimized for readability
 * - Better contrast and typography
 * - Cleaner event display
 * - Improved modal UX
 */
const CalendarComponent: React.FC<CalendarProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [suggestedBlocks, setSuggestedBlocks] = useState<any[]>([]);
    const [newEvent, setNewEvent] = useState<{
        title: string;
        description: string;
        start_time: string;
        end_time: string;
        type: 'meeting' | 'call' | 'reminder' | 'deadline' | 'task';
        location: string;
        is_all_day: boolean;
        attendees: string[];
        questions: { id: string; text: string }[];
    }>({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        type: 'meeting',
        location: '',
        is_all_day: false,
        attendees: [],
        questions: [{ id: '1', text: '' }] // Added questions support
    });
    const [availableUsers] = useState<any[]>([]);
    const [pastEventsPrompt, setPastEventsPrompt] = useState<CalendarEvent[]>([]);
    const [conflictWarning, setConflictWarning] = useState<CalendarEvent | null>(null);
    const [conflictAction, setConflictAction] = useState<'event' | 'video' | null>(null);

    // UseRef to control FullCalendar API
    const calendarRef = useRef<FullCalendar>(null);

    // Responsive View Logic
    useEffect(() => {
        const handleResize = () => {
            const api = calendarRef.current?.getApi();
            if (api) {
                const isMobile = window.innerWidth < 768;
                const currentView = api.view.type;
                const desiredView = isMobile ? 'timeGridDay' : 'dayGridMonth';

                if (currentView !== desiredView) {
                    api.changeView(desiredView);
                }
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isLoading]); // Re-run when loading finishes to ensure calendar is mounted

    useEffect(() => {
        loadEvents();

        // Subscribe to real-time updates
        const subscription = calendarService.subscribeToEvents(user.id, () => {
            loadEvents();
        });

        return () => {
            calendarService.unsubscribe(subscription);
        };
    }, [user.id]);

    const loadEvents = async () => {
        setIsLoading(true);
        const { events: fetchedEvents, error } = await calendarService.getEvents(user.id);

        if (!error && fetchedEvents) {
            setEvents(fetchedEvents);

            // Check for past uncompleted real calendar events
            const now = new Date();
            const unhandledPast = fetchedEvents.filter(e => {
                // Only prompt for real calendar events, not tasks, invoices, etc.
                if (e.id.startsWith('task_') || e.id.startsWith('inv_') || e.id.startsWith('contract_') || e.id.startsWith('project_') || e.id.startsWith('milestone_')) {
                    return false;
                }
                const endTime = new Date(e.end_time);
                // Assume past if end time is more than 30 minutes ago
                const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000);
                return isBefore(endTime, thirtyMinutesAgo) && e.metadata?.status !== 'completed' && e.metadata?.status !== 'cancelled' && e.metadata?.status !== 'postponed';
            });

            if (unhandledPast.length > 0) {
                setPastEventsPrompt(unhandledPast);
            }
        } else {
            setEvents([]);
        }
        setIsLoading(false);

        // Fetch AI suggestions
        const { tasks } = await taskService.getTasks({ assignedTo: user.id });
        const suggestions = strategicThinkerService.suggestTimeBlocks(tasks || [], fetchedEvents || []);
        setSuggestedBlocks(suggestions);
    };

    // Check for overlapping events
    const checkForConflicts = (startTime: Date, endTime: Date): CalendarEvent | null => {
        for (const event of events) {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            
            // Skip events that are completed or cancelled
            if (event.metadata?.status === 'completed' || event.metadata?.status === 'cancelled') {
                continue;
            }

            // Check for overlap
            if ((startTime < eventEnd && endTime > eventStart)) {
                return event;
            }
        }
        return null;
    };

    const handleDateClick = (arg: DateClickArg) => {
        const dateStr = (arg as any).dateStr || new Date().toISOString();
        setNewEvent({
            ...newEvent,
            start_time: dateStr,
            end_time: dateStr,
        });
        setSelectedEvent(null);
        setShowEventModal(true);
    };

    const handleEventClick = (info: any) => {
        const event = events.find(e => e.id === info.event.id);
        if (event) {
            setSelectedEvent(event);
            setShowEventModal(true);
        }
    };

    const handleCreateEvent = async (skipConflictCheck = false) => {
        if (!newEvent.title.trim()) {
            toast.error('Title is required');
            return;
        }

        if (!newEvent.start_time || !newEvent.end_time) {
            toast.error('Start and end times are required');
            return;
        }

        setIsSaving(true);

        try {
            // -- INDEPENDENT TASK CREATION LOGIC --
            // Format questions into description if any
            const questions = (newEvent as any).questions?.filter((q: any) => q.text.trim());
            let description = newEvent.description || '';
            if (questions && questions.length > 0) {
                const qaFormat = questions.map((q: any) => ({
                    question: q.text,
                    answer: 'Pending...'
                }));
                description = JSON.stringify(qaFormat);
            }

            if (newEvent.type === 'task') {
                const { error } = await taskService.createTask(user.id, {
                    title: newEvent.title,
                    description,
                    assignedTo: user.id, // Assign to self
                    // No project/client needed (Independent)
                    startDate: new Date(newEvent.start_time).toISOString(),
                    dueDate: new Date(newEvent.end_time).toISOString(),
                    priority: 'medium',
                });

                if (!error) {
                    toast.success('Task created successfully!');
                    setShowEventModal(false);
                    resetForm();
                    loadEvents(); // Reload to fetch the new task event
                } else {
                    toast.error('Failed to create task');
                }
            } else {
                // Standard Calendar Event - Check for conflicts first
                const startTime = new Date(newEvent.start_time);
                const endTime = new Date(newEvent.end_time);
                const conflict = skipConflictCheck ? null : checkForConflicts(startTime, endTime);
                
                if (conflict) {
                    setConflictWarning(conflict);
                    setConflictAction('event');
                    return; // Don't create the event, show warning instead
                }

                const { error } = await calendarService.createEvent({
                    user_id: user.id,
                    ...newEvent,
                    description,
                    attendees: newEvent.attendees || [],
                    color: getEventColor(newEvent.type, {}), // Default color
                    reminder_minutes: 15,
                } as any);

                if (!error) {
                    toast.success('Event created successfully!');
                    setShowEventModal(false);
                    resetForm();
                    loadEvents();
                } else {
                    toast.error('Failed to create event');
                }
            }
        } catch (err) {
            toast.error('Failed to create item');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateVideoCall = async (skipConflictCheck = false) => {
        if (!newEvent.title.trim()) {
            toast.error('Video call title is required');
            return;
        }

        if (!newEvent.start_time) {
            toast.error('Start time is required');
            return;
        }

        setIsSaving(true);

        try {
            const startTime = new Date(newEvent.start_time);

            // Format questions into description if any
            const questions = (newEvent as any).questions?.filter((q: any) => q.text.trim());
            let description = 'Video call meeting';
            if (questions && questions.length > 0) {
                const qaFormat = questions.map((q: any) => ({
                    question: q.text,
                    answer: 'Pending...'
                }));
                description = JSON.stringify(qaFormat);
            }

            const endTime = addMinutes(startTime, 60);
            const videoRoomId = `room_${crypto.randomUUID()}`;

            // Check for conflicts
            const conflict = skipConflictCheck ? null : checkForConflicts(startTime, endTime);
            if (conflict) {
                setConflictWarning(conflict);
                setConflictAction('video');
                setIsSaving(false);
                return;
            }

            const { error } = await calendarService.createEvent({
                user_id: user.id,
                title: newEvent.title,
                description,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                type: 'call',
                video_room_id: videoRoomId,
                attendees: newEvent.attendees || [],
                is_all_day: false,
                reminder_minutes: 15,
            } as any);

            if (!error) {
                toast.success('Video call created successfully!');
                setShowEventModal(false);
                resetForm();
                loadEvents();
            } else {
                toast.error('Failed to create video call');
            }
        } catch (err) {
            toast.error('Failed to create video call');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId: string, isCalendly: boolean = false) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            if (isCalendly) {
                // If it's a Calendly event, we use the specific cancellation route
                const reason = prompt('Please provide a reason for cancellation (sent to the invitee):', 'Canceled via CRM Dashboard');
                if (reason === null) return; // User canceled the prompt

                if (!currentTenant?.id) {
                    toast.error('No active organization. Select a workspace and try again.');
                    return;
                }

                setIsSaving(true);
                const res = await fetch('/api/calendly/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: currentTenant.id, eventId, reason })
                });

                if (res.ok) {
                    toast.success('Calendly meeting canceled successfully!');
                    setShowEventModal(false);
                    loadEvents();
                } else {
                    const data = await res.json();
                    toast.error(data.error || 'Failed to cancel Calendly meeting');
                }
                setIsSaving(false);
            } else {
                // Standard calendar event deletion
                const { error } = await calendarService.deleteEvent(eventId);
                if (!error) {
                    toast.success('Event deleted successfully!');
                    setShowEventModal(false);
                    loadEvents();
                } else {
                    toast.error('Failed to delete event');
                }
            }
        } catch (err) {
            toast.error('Failed to delete event');
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setNewEvent({
            title: '',
            description: '',
            start_time: '',
            end_time: '',
            type: 'meeting',
            location: '',
            is_all_day: false,
            attendees: [],
            questions: [{ id: '1', text: '' }]
        });
    };

    // Updated to handle Overdue Tasks
    const getEventColor = (type: string, event: Partial<CalendarEvent>) => {
        // Warning for undone/overdue tasks
        if (type === 'task') {
            const isCompleted = event.metadata?.status === 'completed';
            const isOverdue = event.end_time && isBefore(new Date(event.end_time), new Date()) && !isCompleted;

            if (isCompleted) return '#10b981'; // Green (Completed)
            if (isOverdue) return '#ef4444';   // Red (Overdue)
            return '#f59e0b';                  // Amber (Pending)
        }

        switch (type) {
            case 'call': return '#10b981'; // Green
            case 'meeting': return '#3b82f6'; // Blue
            case 'reminder': return '#f59e0b'; // Orange
            case 'deadline': return '#ef4444'; // Red
            case 'invoice': return '#ef4444'; // Red (Money Owed)
            case 'suggestion': return '#6366f1'; // Indigo (AI Suggestion)
            default: return '#3b82f6';
        }
    };

    const extractMeetingUrl = (event: CalendarEvent) => {
        // 1. Check video_room_id (Daily.co)
        if (event.video_room_id) {
            return `/meet/${event.video_room_id}`;
        }

        // 2. Check location for URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const locationUrl = event.location?.match(urlRegex)?.[0];
        if (locationUrl) return locationUrl;

        // 3. Check description for URLs
        const descriptionUrl = event.description?.match(urlRegex)?.[0];
        if (descriptionUrl) return descriptionUrl;

        // 4. Check metadata
        if (event.metadata?.meeting_url) return event.metadata.meeting_url;
        if (event.metadata?.calendly_event_uri) {
            // If it's a calendly event, the full payload might have the link
            // or we just trust the location field if it's there.
        }

        return null;
    };

    const getEventTypeIcon = (type: string) => {
        switch (type) {
            case 'call': return <Video className="w-4 h-4" />;
            case 'meeting': return <UsersIcon className="w-4 h-4" />;
            case 'reminder': return <Clock className="w-4 h-4" />;
            case 'deadline': return <Clock className="w-4 h-4" />;
            case 'task': return <CheckSquare className="w-4 h-4" />;
            case 'invoice': return <CreditCard className="w-4 h-4" />;
            default: return <CalendarIcon className="w-4 h-4" />;
        }
    };

    const formatEventsForCalendar = () => {
        const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            start: event.start_time,
            end: event.end_time,
            backgroundColor: getEventColor(event.type, event),
            borderColor: getEventColor(event.type, event),
            allDay: event.is_all_day,
            textColor: '#ffffff',
            extendedProps: { ...event }
        }));

        const suggestions = suggestedBlocks.map(s => ({
            id: `sug_${s.title}`,
            title: `[AI Suggestion] ${s.title}`,
            start: s.start,
            end: s.end,
            backgroundColor: 'transparent',
            borderColor: '#6366f1',
            borderStyle: 'dashed',
            textColor: '#818cf8',
            className: 'ai-suggestion-event',
            extendedProps: { ...s, isSuggestion: true }
        }));

        return [...formattedEvents, ...suggestions];
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
                <div className="text-slate-400">Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-teal-400" />
                        Calendar
                    </h2>
                    <p className="text-slate-400 mt-1">Manage your schedule and meetings</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        onClick={async () => {
                            toast.loading('Nexus: Optimizing schedule...', { id: 'nexus-calendar' });
                            const res = await fetch('/api/social/command-center', { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tenantId: currentTenant?.id, mode: 'nexus_system_action', systemKey: 'calendar_nexus' })
                            });
                            const data = await res.json();
                            toast.success(data.result.message, { id: 'nexus-calendar' });
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-violet-400 border-white/5"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Nexus Schedule
                    </Button>
                    <Button onClick={() => setShowEventModal(true)} className="bg-teal-600 hover:bg-teal-500">
                        + New Event
                    </Button>
                </div>
            </div>

            {/* Calendar with Dark Theme */}
            <Card className="p-6 calendar-dark-theme">
                <style>{`
                    /* Dark theme for FullCalendar */
                    .calendar-dark-theme .fc {
                        color: #e2e8f0;
                    }

                    .calendar-dark-theme .fc-theme-standard td,
                    .calendar-dark-theme .fc-theme-standard th {
                        border-color: #334155;
                    }

                    .calendar-dark-theme .fc-theme-standard .fc-scrollgrid {
                        border-color: #334155;
                    }

                    .calendar-dark-theme .fc-col-header-cell {
                        background: #1e293b;
                        color: #94a3b8;
                        font-weight: 600;
                        padding: 12px 8px;
                        border-color: #334155;
                    }

                    .calendar-dark-theme .fc-daygrid-day {
                        background: #0f172a;
                    }

                    .calendar-dark-theme .fc-daygrid-day:hover {
                        background: #1e293b;
                    }

                    .calendar-dark-theme .fc-daygrid-day-number {
                        color: #e2e8f0;
                        padding: 8px;
                        font-weight: 500;
                    }

                    .calendar-dark-theme .fc-day-today {
                        background: #0d9488 !important;
                        background-color: rgba(13, 148, 136, 0.1) !important;
                    }

                    .calendar-dark-theme .fc-day-today .fc-daygrid-day-number {
                        color: #14b8a6;
                        font-weight: 700;
                    }

                    .calendar-dark-theme .fc-button {
                        background: #1e293b;
                        border-color: #334155;
                        color: #e2e8f0;
                        text-transform: capitalize;
                        font-weight: 500;
                        padding: 8px 16px;
                    }

                    .calendar-dark-theme .fc-button:hover {
                        background: #334155;
                        border-color: #475569;
                    }

                    .calendar-dark-theme .fc-button:focus {
                        box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.3);
                    }

                    .calendar-dark-theme .fc-button-active {
                        background: #0d9488 !important;
                        border-color: #0d9488 !important;
                        color: white !important;
                    }

                    .calendar-dark-theme .fc-toolbar-title {
                        color: #f1f5f9;
                        font-size: 1.15rem; /* ~18px Max */
                        font-weight: 700;
                    }

                    /* STRICT TYPOGRAPHY OVERRIDES */
                    .calendar-dark-theme .fc-event-title,
                    .calendar-dark-theme .fc-event-time {
                        font-size: 12px !important;
                        font-weight: 500;
                    }
                    
                    .calendar-dark-theme .fc-col-header-cell-cushion {
                        font-size: 13px !important; 
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .calendar-dark-theme .fc-timegrid-slot-label-cushion {
                        font-size: 12px !important;
                    }

                    /* Hide specific views on mobile via CSS as backup */
                    @media (max-width: 768px) {
                        .fc-dayGridMonth-button, .fc-timeGridWeek-button {
                            display: none !important;
                        }
                        .fc-toolbar-title {
                            font-size: 1rem !important;
                        }
                    }

                    .calendar-dark-theme .fc-event {
                        border: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.875rem;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .calendar-dark-theme .fc-event:hover {
                        opacity: 0.9;
                        transform: scale(1.02);
                    }

                    .calendar-dark-theme .fc-daygrid-event-dot {
                        border-color: currentColor;
                    }

                    .calendar-dark-theme .fc-timegrid-slot {
                        height: 3em;
                        border-color: #334155;
                    }

                    .calendar-dark-theme .fc-timegrid-slot-label {
                        color: #94a3b8;
                        font-size: 0.875rem;
                    }

                    .calendar-dark-theme .fc-day-other .fc-daygrid-day-number {
                        color: #475569;
                    }

                    .calendar-dark-theme .fc-h-event {
                        border: none;
                    }

                    .calendar-dark-theme .fc-more-link {
                        color: #14b8a6;
                        font-weight: 600;
                    }
                `}</style>
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView={typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeGridDay' : 'dayGridMonth'}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={formatEventsForCalendar()}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    dayMaxEvents={3}
                    weekends={true}
                    height="auto"
                    themeSystem="standard"
                />
            </Card>

            {/* Past Events Follow-up Modal */}
            {pastEventsPrompt.length > 0 && (
                <PastEventPromptModal
                    events={pastEventsPrompt}
                    onComplete={() => {
                        setPastEventsPrompt([]);
                        loadEvents();
                    }}
                />
            )}

            {/* Conflict Warning Modal */}
            {conflictWarning && (
                <Modal
                    isOpen={!!conflictWarning}
                    onClose={() => {
                        setConflictWarning(null);
                        setConflictAction(null);
                    }}
                    title="Schedule Conflict Detected"
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-300 font-semibold mb-1">Overlapping Event</p>
                                <p className="text-slate-400 text-sm">
                                    Your new event conflicts with an existing event:
                                </p>
                                <div className="mt-2 p-2 bg-slate-900/50 rounded">
                                    <p className="text-white font-medium">{conflictWarning.title}</p>
                                    <p className="text-slate-400 text-xs">
                                        {format(new Date(conflictWarning.start_time), 'MMM d, h:mm a')} - {format(new Date(conflictWarning.end_time), 'h:mm a')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setConflictWarning(null);
                                    setConflictAction(null);
                                }}
                            >
                                Reschedule
                            </Button>
                            <Button
                                onClick={() => {
                                    const pendingAction = conflictAction;
                                    setConflictWarning(null);
                                    setConflictAction(null);
                                    if (pendingAction === 'video') {
                                        void handleCreateVideoCall(true);
                                    } else if (pendingAction === 'event') {
                                        void handleCreateEvent(true);
                                    }
                                }}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Create Anyway
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Event Modal */}
            {showEventModal && (
                <Modal
                    isOpen={showEventModal}
                    onClose={() => {
                        setShowEventModal(false);
                        setSelectedEvent(null);
                        resetForm();
                    }}
                    title={selectedEvent ? 'Event Details' : 'Create New Event'}
                >
                    {selectedEvent ? (
                        /* View Event */
                        <div className="space-y-6">
                            {/* Event Header */}
                            <div>
                                <h4 className="text-2xl font-bold text-white mb-3">{selectedEvent.title}</h4>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2"
                                        style={{
                                            backgroundColor: `${getEventColor(selectedEvent.type, selectedEvent)}20`,
                                            color: getEventColor(selectedEvent.type, selectedEvent)
                                        }}
                                    >
                                        {getEventTypeIcon(selectedEvent.type)}
                                        {selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)}
                                    </div>
                                    {(selectedEvent.type === 'task' || selectedEvent.type === 'invoice') && (
                                        <Badge variant={
                                            selectedEvent.color === '#10b981' ? 'success' : // Completed
                                                selectedEvent.color === '#ef4444' ? 'error' : // Overdue
                                                    'warning' // Pending
                                        }>
                                            {selectedEvent.type === 'task'
                                                ? (selectedEvent.metadata?.status === 'completed' ? 'Completed' : (isBefore(new Date(selectedEvent.end_time), new Date()) ? 'Overdue' : 'Pending'))
                                                : selectedEvent.metadata?.status
                                            }
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Event Description & Q&A */}
                            {selectedEvent.description && (() => {
                                const qa = parseEventQA(selectedEvent.description);
                                if (qa) {
                                    return (
                                        <div className="space-y-4">
                                            <div className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Questions & Answers</div>
                                            <div className="grid gap-3">
                                                {qa.map((item, idx) => (
                                                    <div key={idx} className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                                        <div className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-1">{item.question}</div>
                                                        <div className="text-slate-300 text-sm whitespace-pre-wrap">{item.answer}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div>
                                        <div className="text-sm font-semibold text-slate-300 mb-2">Description</div>
                                        <div className="text-slate-400 leading-relaxed">{selectedEvent.description}</div>
                                    </div>
                                );
                            })()}

                            {/* Time Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                    <div className="text-xs font-semibold text-slate-400 mb-1">Start Time</div>
                                    <div className="text-white font-semibold">
                                        {format(new Date(selectedEvent.start_time), 'PPp')}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                    <div className="text-xs font-semibold text-slate-400 mb-1">End Time</div>
                                    <div className="text-white font-semibold">
                                        {format(new Date(selectedEvent.end_time), 'PPp')}
                                    </div>
                                </div>
                            </div>

                            {/* Location */}
                            {selectedEvent.location && (
                                <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <MapPin className="w-5 h-5 text-teal-400 flex-shrink-0" />
                                    <span className="text-slate-300">{selectedEvent.location}</span>
                                </div>
                            )}

                            {/* Video Call */}
                            {(() => {
                                const meetingUrl = extractMeetingUrl(selectedEvent);
                                if (!meetingUrl) return null;

                                return (
                                    <div className="flex flex-col gap-3 p-4 bg-teal-500/10 rounded-lg border border-teal-500/30">
                                        <div className="flex items-center gap-3">
                                            <Video className="w-5 h-5 text-teal-400 flex-shrink-0" />
                                            <span className="text-teal-300 font-semibold">Join the meeting</span>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                if (meetingUrl.startsWith('/')) {
                                                    window.location.href = meetingUrl;
                                                } else {
                                                    window.open(meetingUrl, '_blank');
                                                }
                                            }}
                                            className="bg-teal-600 hover:bg-teal-500 mt-2"
                                        >
                                            Join Meeting Now
                                        </Button>
                                    </div>
                                );
                            })()}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowEventModal(false)}
                                    className="flex-1"
                                >
                                    Close
                                </Button>
                                {(selectedEvent.type === 'task' || selectedEvent.type === 'invoice') ? (
                                    <Button
                                        onClick={() => {
                                            if (selectedEvent.type === 'task') window.location.href = '/dashboard/tasks';
                                            if (selectedEvent.type === 'invoice') window.location.href = '/dashboard/business/billing';
                                        }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600"
                                    >
                                        View {selectedEvent.type === 'task' ? 'Task' : 'Invoice'}
                                    </Button>
                                ) : selectedEvent.metadata?.calendly_event_uri ? (
                                    <Button
                                        onClick={() => handleDeleteEvent(selectedEvent.id, true)}
                                        disabled={isSaving}
                                        className="flex-1 bg-red-600 hover:bg-red-500"
                                    >
                                        {isSaving ? 'Canceling...' : 'Cancel Calendly Meeting'}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => handleDeleteEvent(selectedEvent.id, false)}
                                        disabled={isSaving}
                                        className="flex-1 bg-red-600 hover:bg-red-500"
                                    >
                                        Delete Event
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Create Event */
                        <div className="space-y-4">
                            <Input
                                label="Event Title *"
                                value={newEvent.title}
                                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                placeholder="e.g., Team Meeting"
                                required
                            />

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                                    rows={3}
                                    placeholder="Add event description..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Start Time *"
                                    type="datetime-local"
                                    value={newEvent.start_time}
                                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                    required
                                />
                                <Input
                                    label="End Time *"
                                    type="datetime-local"
                                    value={newEvent.end_time}
                                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                                <select
                                    value={newEvent.type}
                                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                                >
                                    <option value="meeting">Meeting</option>
                                    <option value="call">Video Call</option>
                                    <option value="reminder">Reminder</option>
                                    <option value="deadline">Deadline</option>
                                    <option value="task">Task</option>
                                </select>
                            </div>

                            <Input
                                label="Location (Optional)"
                                value={newEvent.location}
                                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                                placeholder="Meeting location or URL"
                            />

                            {/* Custom Questions Section */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-300">Intake Questions (Q&A)</label>
                                    <button
                                        type="button"
                                        onClick={() => setNewEvent({
                                            ...newEvent,
                                            questions: [...(newEvent as any).questions, { id: Date.now().toString(), text: '' }]
                                        })}
                                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                                    >
                                        + Add Question
                                    </button>
                                </div>
                                {(newEvent as any).questions?.map((q: any, idx: number) => (
                                    <div key={q.id} className="flex gap-2">
                                        <input
                                            value={q.text}
                                            onChange={(e) => {
                                                const newQs = [...(newEvent as any).questions];
                                                newQs[idx].text = e.target.value;
                                                setNewEvent({ ...newEvent, questions: newQs } as any);
                                            }}
                                            placeholder={`Question ${idx + 1}`}
                                            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                                        />
                                        {(newEvent as any).questions.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newQs = (newEvent as any).questions.filter((_: any, i: number) => i !== idx);
                                                    setNewEvent({ ...newEvent, questions: newQs } as any);
                                                }}
                                                className="p-2 text-red-400 hover:text-red-300"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowEventModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1"
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                {newEvent.type === 'call' ? (
                                    <Button
                                        onClick={() => void handleCreateVideoCall()}
                                        className="flex-1 bg-teal-600 hover:bg-teal-500"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Video className="w-4 h-4 mr-2" />
                                                Create Video Call
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => void handleCreateEvent()}
                                        className="flex-1 bg-teal-600 hover:bg-teal-500"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Event'
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default CalendarComponent;
