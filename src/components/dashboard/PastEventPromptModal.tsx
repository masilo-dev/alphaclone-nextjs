import React, { useState } from 'react';
import { Modal, Button } from '../ui/UIComponents';
import { CalendarEvent, calendarService } from '../../services/calendarService';
import { CheckCircle2, XCircle, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
    events: CalendarEvent[];
    onComplete: () => void;
}

export const PastEventPromptModal: React.FC<Props> = ({ events, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);

    // Filter out events that actually have an ID (not generated shadow events without real IDs)
    // and make sure we don't try to update federated events (like tasks or invoices) here.
    // calendarService updateEvent only updates 'calendar_events' table.
    const actualCalendarEvents = events.filter(e =>
        !e.id.startsWith('task_') &&
        !e.id.startsWith('inv_') &&
        !e.id.startsWith('contract_') &&
        !e.id.startsWith('project_') &&
        !e.id.startsWith('milestone_')
    );

    if (actualCalendarEvents.length === 0 || currentIndex >= actualCalendarEvents.length) {
        return null;
    }

    const currentEvent = actualCalendarEvents[currentIndex];

    const handleAction = async (status: 'completed' | 'cancelled' | 'postponed') => {
        setIsUpdating(true);
        try {
            const newMetadata = { ...currentEvent.metadata, status };
            const { error } = await calendarService.updateEvent(currentEvent.id, { metadata: newMetadata }, true);
            if (error) throw error;

            toast.success(`Event marked as ${status}`);

            if (currentIndex + 1 >= actualCalendarEvents.length) {
                onComplete();
            } else {
                setCurrentIndex(prev => prev + 1);
            }
        } catch (e: any) {
            toast.error("Failed to update event status: " + e.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDismiss = () => {
        if (currentIndex + 1 >= actualCalendarEvents.length) {
            onComplete();
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };

    return (
        <Modal isOpen={true} onClose={handleDismiss} title="Follow up on past event">
            <div className="space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{currentEvent.title}</h3>
                    <p className="text-slate-400">This event was scheduled for {format(new Date(currentEvent.start_time), 'PPp')}.</p>
                    <p className="text-slate-300 mt-2">What happened with this event?</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                    <Button
                        onClick={() => handleAction('completed')}
                        disabled={isUpdating}
                        className="bg-green-600 hover:bg-green-500 flex items-center justify-center gap-2 h-12 px-2"
                    >
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs sm:text-sm">It Happened</span>
                    </Button>
                    <Button
                        onClick={() => handleAction('postponed')}
                        disabled={isUpdating}
                        className="bg-amber-600 hover:bg-amber-500 flex items-center justify-center gap-2 h-12 px-2"
                    >
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs sm:text-sm">Postponed</span>
                    </Button>
                    <Button
                        onClick={() => handleAction('cancelled')}
                        disabled={isUpdating}
                        className="bg-red-600 hover:bg-red-500 flex items-center justify-center gap-2 h-12 px-2"
                    >
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs sm:text-sm">Cancelled</span>
                    </Button>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <span className="text-xs text-slate-500">
                        {currentIndex + 1} of {actualCalendarEvents.length} past events
                    </span>
                    <Button variant="ghost" onClick={handleDismiss} disabled={isUpdating} className="text-slate-400 hover:text-white hover:bg-slate-800">
                        Dismiss
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
