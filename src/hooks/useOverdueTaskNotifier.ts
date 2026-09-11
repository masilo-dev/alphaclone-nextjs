import { useEffect, useRef } from 'react';
import { taskService } from '../services/taskService';
import { User } from '../types';
import toast from 'react-hot-toast';
import { useTenant } from '../contexts/TenantContext';

export function useOverdueTaskNotifier(user: User | null) {
    const { currentTenant } = useTenant();
    const isEnabled = !!user && !!currentTenant?.id;
    // Use a ref to track if we already started the interval to prevent multiple instances
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isEnabled || !user) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const checkOverdueTasks = async () => {
            try {
                const { tasks, error } = await taskService.getOverdueTasks(user.id);

                if (error) {
                    console.error('Failed to check overdue tasks:', error);
                    return;
                }

                if (tasks && tasks.length > 0) {
                    // Play a notification sound
                    playNotificationSound();

                    // Show a toast notification
                    toast(`You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''}! Please review them.`, {
                        icon: '⚠️',
                        duration: 6000,
                        style: {
                            background: '#ef4444', // Red for overdue
                            color: '#fff',
                        }
                    });
                }
            } catch (err) {
                console.error('Error checking overdue tasks:', err);
            }
        };

        // Notification sound function
        const playNotificationSound = () => {
            try {
                // Create a simple double beep sound using Web Audio API
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                const playBeep = (startTime: number) => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.value = 800; // Same as message beep
                    oscillator.type = 'sine';

                    gainNode.gain.setValueAtTime(0.3, startTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

                    oscillator.start(startTime);
                    oscillator.stop(startTime + 0.3);
                };

                // Play two beeps for tasks
                playBeep(audioContext.currentTime);
                playBeep(audioContext.currentTime + 0.4);

            } catch (err) {
                console.log('Could not play notification sound:', err);
            }
        };

        // Run immediately on mount/login
        checkOverdueTasks();

        // Set up recurring check every 30 minutes
        const THIRTY_MINUTES = 30 * 60 * 1000;
        intervalRef.current = setInterval(checkOverdueTasks, THIRTY_MINUTES);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [user?.id, isEnabled, currentTenant?.id]);
}
