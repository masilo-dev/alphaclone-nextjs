import React from 'react';
import { Modal, Button } from '../ui/UIComponents';
import { ShieldCheck, Lock, Activity } from 'lucide-react';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    userName: string;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, userName }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Welcome to AlphaClone Systems">
            <div className="text-center space-y-6 py-4">
                <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-teal-500/50">
                    <ShieldCheck className="w-10 h-10 text-teal-400" />
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white mb-2">Secure Environment Initialized</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                        Welcome back, <span className="text-teal-400 font-medium">{userName}</span>.
                        Your session is protected by enterprise-grade encryption.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                            <p className="text-white font-bold text-sm">E2E Encrypted</p>
                            <p className="text-xs text-slate-500">All data transfers are secured</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-green-400 mt-0.5" />
                        <div>
                            <p className="text-white font-bold text-sm">System Healthy</p>
                            <p className="text-xs text-slate-500">Optimal performance active</p>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button onClick={onClose} className="w-full bg-teal-600 hover:bg-teal-500">
                        Enter Dashboard
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default WelcomeModal;
