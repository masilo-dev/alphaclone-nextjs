import React from 'react';
import {
    TrendingUp,
    Users,
    Briefcase,
    AlertCircle,
    MoreVertical,
    Activity,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';

const BusinessHome: React.FC = () => {
    // Mock Data for "Command Center"
    const liveFeed = [
        { id: 1, text: "New lead 'TechCorp Inc' assigned to Sales Team", time: "2m ago", type: "success" },
        { id: 2, text: "Invoice #1023 viewed by client", time: "15m ago", type: "info" },
        { id: 3, text: "Server usage spike detected (85%)", time: "1h ago", type: "warning" },
        { id: 4, text: "John Doe completed task 'Update Homepage'", time: "2h ago", type: "info" },
    ];

    const activeDeals = [
        { id: 1, name: "Project Alpha", value: "$12,400", stage: "Discovery", progress: 20 },
        { id: 2, name: "Website Redesign", value: "$5,200", stage: "Design", progress: 45 },
        { id: 3, name: "Mobile App Scope", value: "$8,800", stage: "Proposal", progress: 10 },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Column: Live Feed & Pipeline */}
                <div className="flex-1 space-y-6">
                    {/* Live Operations Feed */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-400" />
                                Live Operations
                            </h3>
                            <button className="text-slate-500 hover:text-white text-xs">View All</button>
                        </div>
                        <div className="space-y-4">
                            {liveFeed.map(item => (
                                <div key={item.id} className="flex gap-3 items-start border-l-2 border-slate-800 pl-4 py-1 hover:border-teal-500/50 transition-colors">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full ${item.type === 'success' ? 'bg-green-500' :
                                            item.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                                        }`} />
                                    <div>
                                        <p className="text-slate-300 text-sm">{item.text}</p>
                                        <span className="text-slate-500 text-xs">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Active Deals Board (Mini) */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-violet-400" />
                                Active Opportunities
                            </h3>
                            <button className="p-1 hover:bg-slate-800 rounded"><MoreVertical className="w-4 h-4 text-slate-500" /></button>
                        </div>
                        <div className="space-y-3">
                            {activeDeals.map(deal => (
                                <div key={deal.id} className="group p-3 bg-slate-950/50 border border-slate-800 hover:border-violet-500/30 rounded-lg transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-medium text-slate-200">{deal.name}</div>
                                            <div className="text-xs text-slate-500">{deal.stage}</div>
                                        </div>
                                        <div className="font-mono text-teal-400 font-medium">{deal.value}</div>
                                    </div>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${deal.progress}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Insights & Quick Actions */}
                <div className="w-full md:w-80 space-y-6">
                    {/* AI Insight Card */}
                    <div className="bg-gradient-to-br from-violet-900/20 to-slate-900 border border-violet-500/20 rounded-xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-violet-500/20 text-violet-300 rounded-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-white font-semibold text-sm">Revenue Forecast</h4>
                                <p className="text-violet-200/70 text-xs">AI Confidence: 94%</p>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">$58,200</div>
                        <p className="text-xs text-slate-400 mb-4">Projected for end of month based on current pipeline velocity.</p>
                        <button className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors">
                            View Analysis
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <QuickAction label="New Deal" icon={AlertCircle} />
                            <QuickAction label="Add Task" icon={Briefcase} />
                            <QuickAction label="Invite Team" icon={Users} />
                            <QuickAction label="Send Invoice" icon={AlertCircle} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuickAction = ({ label, icon: Icon }: any) => (
    <button className="flex flex-col items-center justify-center p-3 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg text-slate-400 hover:text-white transition-all">
        <Icon className="w-5 h-5 mb-2 opacity-70" />
        <span className="text-xs font-medium">{label}</span>
    </button>
);

export default BusinessHome;
