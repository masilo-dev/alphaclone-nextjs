import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { pwaService } from '../../services/pwaService';
import { Button } from '../ui/UIComponents';

const InstallPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (pwaService.isRunningAsPWA()) {
            return;
        }

        // Check if installable
        if (!pwaService.isInstallable()) {
            return;
        }

        // Check if user has dismissed before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = new Date(dismissed).getTime();
            const daysSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
            if (daysSinceDismiss < 7) {
                return; // Don't show again for 7 days
            }
        }

        // Get install prompt
        pwaService.getInstallPrompt().then(({ prompt }) => {
            if (prompt) {
                setShowPrompt(true);
            }
        });
    }, []);

    const handleInstall = async () => {
        setIsInstalling(true);
        const { success, error } = await pwaService.promptInstall();
        setIsInstalling(false);

        if (success) {
            setShowPrompt(false);
        } else {
            console.error('Install failed:', error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 max-w-sm z-50 animate-slide-up">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center">
                        <Download className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold">Install AlphaClone</h3>
                        <p className="text-sm text-slate-400">Add to your home screen for quick access</p>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-slate-400 hover:text-white transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="flex-1 bg-teal-600 hover:bg-teal-500"
                >
                    {isInstalling ? 'Installing...' : 'Install'}
                </Button>
                <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="px-4"
                >
                    Later
                </Button>
            </div>
        </div>
    );
};

export default InstallPrompt;

