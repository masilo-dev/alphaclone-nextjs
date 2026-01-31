import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { format, isBefore } from 'date-fns'; // Added isBefore
import { Calendar as CalendarIcon, Video, MapPin, X, Clock, Users as UsersIcon, Loader2, CheckSquare, CreditCard } from 'lucide-react';
import { Card, Button, Badge, Modal, Input } from '../ui/UIComponents';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { taskService } from '../../services/taskService'; // Added taskService
import { User } from '../../types';
import toast from 'react-hot-toast';

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
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newEvent, setNewEvent] = useState<{
        title: string;
        description: string;
        start_time: string;
        end_time: string;
        type: 'meeting' | 'call' | 'reminder' | 'deadline' | 'task';
        location: string;
        is_all_day: boolean;
        attendees: string[];
    }>({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        type: 'meeting',
        location: '',
        is_all_day: false,
        attendees: [],
    });
    const [availableUsers] = useState<any[]>([]);

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
            subscription.unsubscribe();
        };
    }, [user.id]);

    const loadEvents = async () => {
        setIsLoading(true);
        const { events: fetchedEvents, error } = await calendarService.getEvents(user.id);

        if (!error && fetchedEvents) {
            setEvents(fetchedEvents);
        } else if (error) {
            toast.error('Failed to load calendar events');
        }
        setIsLoading(false);
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

    const handleCreateEvent = async () => {
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
            if (newEvent.type === 'task') {
                const { error } = await taskService.createTask(user.id, {
                    title: newEvent.title,
                    description: newEvent.description,
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
                // Standard Calendar Event
                const { error } = await calendarService.createEvent({
                    user_id: user.id,
                    ...newEvent,
                    attendees: newEvent.attendees || [],
                    color: getEventColor(newEvent.type, {}), // Default color
                    reminder_minutes: 15,
                });

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

    const handleCreateVideoCall = async () => {
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
            const { error } = await calendarService.createVideoCallEvent(
                user.id,
                newEvent.title || 'Video Call',
                startTime,
                60
            );

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

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            const { error } = await calendarService.deleteEvent(eventId);
            if (!error) {
                toast.success('Event deleted successfully!');
                setShowEventModal(false);
                loadEvents();
            } else {
                toast.error('Failed to delete event');
            }
        } catch (err) {
            toast.error('Failed to delete event');
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
            default: return '#3b82f6';
        }
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
        return events.map(event => ({
            id: event.id,
            title: event.title,
            start: event.start_time,
            end: event.end_time,
            backgroundColor: getEventColor(event.type, event), // Pass full event for logic
            borderColor: getEventColor(event.type, event),
            allDay: event.is_all_day,
            textColor: '#ffffff',
            extendedProps: { ...event } // Pass data for click handling
        }));
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
                <Button onClick={() => setShowEventModal(true)} className="bg-teal-600 hover:bg-teal-500">
                    + New Event
                </Button>
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

                            {/* Event Description */}
                            {selectedEvent.description && (
                                <div>
                                    <div className="text-sm font-semibold text-slate-300 mb-2">Description</div>
                                    <div className="text-slate-400 leading-relaxed">{selectedEvent.description}</div>
                                </div>
                            )}

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
                            {selectedEvent.video_room_id && (
                                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                                    <Video className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    <span className="text-green-300 font-semibold">Video call enabled</span>
                                </div>
                            )}

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
                                ) : (
                                    <Button
                                        onClick={() => handleDeleteEvent(selectedEvent.id)}
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
                                        onClick={handleCreateVideoCall}
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
                                        onClick={handleCreateEvent}
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
