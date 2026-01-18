import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Settings,
    CreditCard,
    FileText,
    Bell,
    Search,
    LogOut,
    Mic,
    Menu
} from 'lucide-react';
import { User } from '../../types';

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [isVoiceActive, setIsVoiceActive] = useState(false);

    const navItems = [
        { id: 'home', label: 'Command Center', icon: LayoutDashboard },
        { id: 'crm', label: 'CRM & Sales', icon: Users },
        { id: 'projects', label: 'Projects', icon: Briefcase },
        { id: 'finance', label: 'Finance', icon: CreditCard },
        { id: 'contracts', label: 'Contracts', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-lg">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">{user.name}</h1>
                            <span className="text-xs text-teal-400 uppercase tracking-wider font-semibold">Business</span>
                        </div>
                    </div>
                    {/* GHOST MODE INDICATOR */}
                    {localStorage.getItem('alphaclone_ghost_user') && (
                        <button
                            onClick={() => {
                                localStorage.removeItem('alphaclone_ghost_user');
                                window.location.reload();
                            }}
                            className="mt-3 w-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs py-1.5 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors animate-pulse"
                        >
                            <LogOut className="w-3 h-3" />
                            Exit Ghost Mode
                        </button>
                    )}
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id
                                ? 'bg-teal-500/10 text-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.1)]'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">

                {/* Header */}
                <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-8 backdrop-blur-md bg-slate-950/50 sticky top-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        <h2 className="text-xl font-semibold text-white">
                            {navItems.find(i => i.id === activeTab)?.label}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Voice Agent Trigger */}
                        <button
                            onClick={() => setIsVoiceActive(!isVoiceActive)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${isVoiceActive
                                ? 'bg-teal-500/20 border-teal-500 text-teal-400 animate-pulse'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500/50'
                                }`}
                        >
                            <Mic className="w-4 h-4" />
                            <span className="text-sm font-medium">Assistant</span>
                        </button>

                        <div className="w-px h-6 bg-slate-800 mx-2" />

                        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full" />
                        </button>

                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="Profile" />
                        </div>
                    </div>
                </header>

                {/* Dynamic Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'home' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {/* Metrics Cards */}
                                <MetricCard label="Total Revenue" value="$45,231" trend="+12%" icon={DollarSign} color="text-teal-400" />
                                <MetricCard label="Active Deals" value="12" trend="+3" icon={Briefcase} color="text-violet-400" />
                                <MetricCard label="Pending Tasks" value="8" trend="-2" icon={FileText} color="text-orange-400" />
                                <MetricCard label="System Status" value="Healthy" icon={Users} color="text-green-400" />
                            </div>
                            <BusinessHome />
                        </>
                    )}

                    {/* Placeholder for other tabs */}
                    {activeTab !== 'home' && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                                <Briefcase className="w-8 h-8 opacity-50" />
                            </div>
                            <h3 className="text-xl font-medium text-slate-300">Section Under Construction</h3>
                            <p className="mt-2">The {navItems.find(i => i.id === activeTab)?.label} module is being initialized.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const MetricCard = ({ label, value, trend, icon: Icon, color }: any) => (
    <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'}`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="space-y-1">
            <h3 className="text-slate-400 text-sm font-medium">{label}</h3>
            <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
    </div>
);

// Helper for icon (DollarSign was missing in imports)
import { DollarSign } from 'lucide-react';

export default BusinessDashboard;
