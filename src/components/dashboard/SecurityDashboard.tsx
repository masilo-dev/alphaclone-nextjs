import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    ShieldCheck,
    Activity,
    Globe,
    AlertTriangle,
    CheckCircle,
    Clock,
    MapPin,
    Monitor,
    Smartphone,
    Tablet,
} from 'lucide-react';
import { Card, Button, Badge } from '../ui/UIComponents';
import { activityService } from '../../services/activityService';
import { User } from '../../types';

interface SecurityDashboardProps {
    user: User;
}

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ user }) => {
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [loginSessions, setLoginSessions] = useState<any[]>([]);
    const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
    const [blockedCountries, setBlockedCountries] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'logs' | 'sessions' | 'alerts' | 'blocked'>('logs');

    useEffect(() => {
        loadSecurityData();
    }, [user.id, user.role]);

    const loadSecurityData = async () => {
        setIsLoading(true);

        if (user.role === 'admin') {
            // Admin sees all data
            const [logsRes, sessionsRes, alertsRes, countriesRes, statsRes] = await Promise.all([
                activityService.getAllActivityLogs(100),
                activityService.getAllLoginSessions(50),
                activityService.getSecurityAlerts(undefined, 50),
                activityService.getBlockedCountries(),
                activityService.getActivityStats(),
            ]);

            setActivityLogs(logsRes.logs || []);
            setLoginSessions(sessionsRes.sessions || []);
            setSecurityAlerts(alertsRes.alerts || []);
            setBlockedCountries(countriesRes.countries || []);
            setStats(statsRes.stats || {});
        } else {
            // Clients see only their own data
            const [logsRes, sessionsRes, alertsRes] = await Promise.all([
                activityService.getActivityLogs(user.id, 50),
                activityService.getLoginSessions(user.id, 20),
                activityService.getSecurityAlerts(user.id, 20),
            ]);

            setActivityLogs(logsRes.logs || []);
            setLoginSessions(sessionsRes.sessions || []);
            setSecurityAlerts(alertsRes.alerts || []);
        }

        setIsLoading(false);
    };

    const handleResolveAlert = async (alertId: string) => {
        await activityService.resolveAlert(alertId);
        loadSecurityData();
    };

    const getDeviceIcon = (deviceType: string) => {
        switch (deviceType) {
            case 'mobile': return <Smartphone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-teal-400">Loading security data...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-teal-400" />
                    Security & Activity Monitor
                </h2>
            </div>

            {/* Stats Cards (Admin Only) */}
            {user.role === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-500/5 border-blue-500/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{stats.totalLogs || 0}</div>
                                <div className="text-xs text-blue-400">Total Activity Logs</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-green-500/5 border-green-500/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{stats.activeSessions || 0}</div>
                                <div className="text-xs text-green-400">Active Sessions</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-red-500/5 border-red-500/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{stats.suspiciousLogs || 0}</div>
                                <div className="text-xs text-red-400">Suspicious Activity</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-yellow-500/5 border-yellow-500/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{stats.unresolvedAlerts || 0}</div>
                                <div className="text-xs text-yellow-400">Unresolved Alerts</div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800">
                {['logs', 'sessions', 'alerts', user.role === 'admin' && 'blocked'].filter(Boolean).map((tab) => (
                    <button
                        key={String(tab)}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {tab === 'logs' && 'Activity Logs'}
                        {tab === 'sessions' && 'Login Sessions'}
                        {tab === 'alerts' && 'Security Alerts'}
                        {tab === 'blocked' && 'Blocked Countries'}
                    </button>
                ))}
            </div>

            {/* Activity Logs Tab */}
            {activeTab === 'logs' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">Recent Activity</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {activityLogs.map((log) => (
                            <div
                                key={log.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${log.is_suspicious
                                    ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                                    }`}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        {getDeviceIcon(log.device_type)}
                                        <span className="font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-medium">{log.action}</div>
                                        {user.role === 'admin' && log.profiles && (
                                            <div className="text-xs text-slate-500">{log.profiles.email}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <MapPin className="w-3 h-3" />
                                        <span>{log.city}, {log.country}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">{log.ip_address}</div>
                                </div>
                                {log.is_suspicious && (
                                    <Badge variant="error" className="ml-4">Suspicious</Badge>
                                )}
                            </div>
                        ))}
                        {activityLogs.length === 0 && (
                            <div className="text-center text-slate-500 py-8">No activity logs found</div>
                        )}
                    </div>
                </Card>
            )}

            {/* Login Sessions Tab */}
            {activeTab === 'sessions' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">Login Sessions</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {loginSessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-2 h-2 rounded-full ${session.is_active ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <div className="flex-1">
                                        {user.role === 'admin' && session.profiles && (
                                            <div className="text-white font-medium">{session.profiles.email}</div>
                                        )}
                                        <div className="text-xs text-slate-400">
                                            {getDeviceIcon(session.device_info?.deviceType)} {session.device_info?.browser}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{new Date(session.login_time).toLocaleString()}</span>
                                        </div>
                                        {session.logout_time && (
                                            <div className="text-slate-600 mt-1">
                                                Duration: {Math.floor(session.session_duration / 60)}m
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        <MapPin className="w-3 h-3 inline mr-1" />
                                        {session.city}, {session.country}
                                    </div>
                                    <div className="text-xs text-slate-600 font-mono">{session.ip_address}</div>
                                </div>
                                {session.is_active && (
                                    <Badge variant="success">Active</Badge>
                                )}
                            </div>
                        ))}
                        {loginSessions.length === 0 && (
                            <div className="text-center text-slate-500 py-8">No login sessions found</div>
                        )}
                    </div>
                </Card>
            )}

            {/* Security Alerts Tab */}
            {activeTab === 'alerts' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">Security Alerts</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {securityAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldAlert className="w-4 h-4" />
                                            <span className="font-bold text-sm uppercase">{alert.alert_type.replace('_', ' ')}</span>
                                            <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                                        </div>
                                        <p className="text-sm mb-2">{alert.description}</p>
                                        {user.role === 'admin' && alert.profiles && (
                                            <div className="text-xs opacity-75">User: {alert.profiles.email}</div>
                                        )}
                                        <div className="text-xs opacity-75 mt-1">
                                            {new Date(alert.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {!alert.is_resolved && user.role === 'admin' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleResolveAlert(alert.id)}
                                        >
                                            Resolve
                                        </Button>
                                    )}
                                    {alert.is_resolved && (
                                        <Badge variant="success">Resolved</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                        {securityAlerts.length === 0 && (
                            <div className="text-center text-slate-500 py-8">No security alerts</div>
                        )}
                    </div>
                </Card>
            )}

            {/* Blocked Countries Tab (Admin Only) */}
            {activeTab === 'blocked' && user.role === 'admin' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">Blocked Countries</h3>
                    <div className="space-y-2">
                        {blockedCountries.map((country) => (
                            <div
                                key={country.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                            >
                                <div className="flex items-center gap-4">
                                    <Globe className="w-5 h-5 text-red-500" />
                                    <div>
                                        <div className="text-white font-medium">{country.country_name}</div>
                                        <div className="text-xs text-slate-400">{country.reason}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-500">{country.country_code}</span>
                                    <Badge variant="error">Blocked</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default SecurityDashboard;
