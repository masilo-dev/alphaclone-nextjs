import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessEventService, BusinessEvent } from '../../../services/businessEventService';
import {
    Calendar as CalendarIcon,
    Plus,
    ChevronLeft,
    ChevronRight,
    X,
    Settings // Import Settings icon
} from 'lucide-react';
import { BookingSettings } from './BookingSettings'; // Import component

interface CalendarPageProps {
    user: User;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ user }) => {
    const { currentTenant, refreshTenants } = useTenant();
    const [events, setEvents] = useState<BusinessEvent[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBookingSettings, setShowBookingSettings] = useState(false); // New state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            loadEvents();
        }
    }, [currentTenant]);

    const loadEvents = async () => {
        if (!currentTenant) return;

        setLoading(true);
        const { events: data } = await businessEventService.getEvents(currentTenant.id);
        setEvents(data);
        setLoading(false);
    };

    const handleAddEvent = async (eventData: Partial<BusinessEvent>) => {
        if (!currentTenant) return;

        const { event, error } = await businessEventService.createEvent(currentTenant.id, {
            ...eventData,
            createdBy: user.id
        });

        if (!error && event) {
            setEvents([...events, event]);
            setShowAddModal(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek };
    };

    const getEventsForDate = (date: Date) => {
        return events.filter(event => {
            const eventDate = new Date(event.startTime);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading calendar...</div></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">
                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={previousMonth}
                            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowBookingSettings(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Event
                    </button>
                </div>
            </div>

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
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="aspect-square border-r border-b border-slate-800 bg-slate-900/30" />
                    ))}

                    {/* Days of the month */}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const day = idx + 1;
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dayEvents = getEventsForDate(date);
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={day}
                                className="aspect-square border-r border-b border-slate-800 p-2 hover:bg-slate-800/50 cursor-pointer transition-colors"
                                onClick={() => {
                                    setSelectedDate(date);
                                    setShowAddModal(true);
                                }}
                            >
                                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-teal-400' : 'text-slate-300'}`}>
                                    {day}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map(event => (
                                        <div
                                            key={event.id}
                                            className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded truncate"
                                        >
                                            {event.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-xs text-slate-500">
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
                    events={events}
                    onSelectDate={(date: Date) => {
                        setSelectedDate(date);
                        setShowAddModal(true);
                    }}
                />
            </div>

            {/* Add Event Modal */}
            {showAddModal && (
                <AddEventModal
                    selectedDate={selectedDate}
                    onClose={() => {
                        setShowAddModal(false);
                        setSelectedDate(null);
                    }}
                    onAdd={handleAddEvent}
                />
            )}

            {/* Booking Settings Modal */}
            {showBookingSettings && currentTenant && (
                <BookingSettings
                    tenant={currentTenant}
                    onUpdate={() => {
                        refreshTenants();
                        // Also reload events if needed, but not strictly required for settings
                    }}
                    onClose={() => setShowBookingSettings(false)}
                />
            )}
        </div>
    );
};

const MobileCalendarView = ({ currentDate, events, onSelectDate }: any) => {
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return daysInMonth;
    };

    const daysCount = getDaysInMonth(currentDate);
    const days = Array.from({ length: daysCount }, (_, i) => i + 1);

    return (
        <div className="space-y-4 pb-20">
            {days.map(day => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayEvents = events.filter((e: any) => {
                    const eventDate = new Date(e.startTime);
                    return eventDate.toDateString() === date.toDateString();
                });
                const isToday = date.toDateString() === new Date().toDateString();

                return (
                    <div key={day} className={`bg-slate-900/40 border ${isToday ? 'border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.1)]' : 'border-white/5'} rounded-2xl overflow-hidden backdrop-blur-sm`}>
                        <div className={`p-4 flex items-center justify-between ${isToday ? 'bg-teal-500/10' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl border ${isToday ? 'bg-teal-500 text-slate-950 border-teal-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    <span className="text-lg font-black leading-none">{day}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                    {isToday && <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Today</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => onSelectDate(date)}
                                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                            >
                                <Plus className="w-4 h-4 text-white" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {dayEvents.length > 0 ? (
                                dayEvents.map((event: any) => (
                                    <div key={event.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-1.5">{event.title}</h4>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${event.eventType === 'meeting' ? 'bg-blue-500' :
                                                        event.eventType === 'deadline' ? 'bg-red-500' :
                                                            event.eventType === 'reminder' ? 'bg-orange-500' : 'bg-teal-500'
                                                        }`} />
                                                    <span className="uppercase tracking-wide text-[10px]">{event.eventType}</span>
                                                </div>
                                                <div className="w-px h-3 bg-slate-700"></div>
                                                <span>{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-700">No events scheduled</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AddEventModal = ({ selectedDate, onClose, onAdd }: any) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startTime: selectedDate ? selectedDate.toISOString().slice(0, 16) : '',
        endTime: '',
        eventType: 'meeting'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">End Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Event Type</label>
                        <select
                            value={formData.eventType}
                            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
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
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                        >
                            Add Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CalendarPage;
