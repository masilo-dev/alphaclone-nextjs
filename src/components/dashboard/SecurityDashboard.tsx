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
    const [activeTab, setActiveTab] = useState<'logs' | 'sessions' | 'alerts' | 'blocked' | 'failed_logins' | 'errors'>('logs');
    const [failedLogins, setFailedLogins] = useState<any[]>([]);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
        // Load initial tab data
        fetchTabContent(activeTab);
    }, [user.id, user.role]);

    useEffect(() => {
        fetchTabContent(activeTab);
    }, [activeTab]);

    const fetchStats = async () => {
        if (user.role === 'admin') {
            const { stats } = await activityService.getActivityStats();
            setStats(stats || {});
        }
    };

    const fetchTabContent = async (tab: string) => {
        setIsLoading(true);
        try {
            if (user.role === 'admin') {
                if (tab === 'logs' && activityLogs.length === 0) {
                    const { logs } = await activityService.getAllActivityLogs(100);
                    setActivityLogs(logs || []);
                } else if (tab === 'sessions' && loginSessions.length === 0) {
                    const { sessions } = await activityService.getAllLoginSessions(50);
                    setLoginSessions(sessions || []);
                } else if (tab === 'alerts' && securityAlerts.length === 0) {
                    const { alerts } = await activityService.getSecurityAlerts(undefined, 50);
                    setSecurityAlerts(alerts || []);
                } else if (tab === 'blocked' && blockedCountries.length === 0) {
                    const { countries } = await activityService.getBlockedCountries();
                    setBlockedCountries(countries || []);
                } else if (tab === 'failed_logins' && failedLogins.length === 0) {
                    const { failedLogins } = await activityService.getFailedLogins(50);
                    setFailedLogins(failedLogins || []);
                } else if (tab === 'errors' && errorLogs.length === 0) {
                    const { errorLogs } = await activityService.getErrorLogs(50);
                    setErrorLogs(errorLogs || []);
                }
            } else {
                // Client Logic
                if (tab === 'logs' && activityLogs.length === 0) {
                    const { logs } = await activityService.getActivityLogs(user.id, 50);
                    setActivityLogs(logs || []);
                } else if (tab === 'sessions' && loginSessions.length === 0) {
                    const { sessions } = await activityService.getLoginSessions(user.id, 20);
                    setLoginSessions(sessions || []);
                } else if (tab === 'alerts' && securityAlerts.length === 0) {
                    const { alerts } = await activityService.getSecurityAlerts(user.id, 20);
                    setSecurityAlerts(alerts || []);
                }
            }
        } catch (error) {
            console.error('Error fetching tab content:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSecurityData = () => {
        // Force refresh all
        setActivityLogs([]);
        setLoginSessions([]);
        setSecurityAlerts([]);
        setBlockedCountries([]);
        setFailedLogins([]);
        setErrorLogs([]);
        fetchStats();
        fetchTabContent(activeTab);
    };

    const handleResolveAlert = async (alertId: string) => {
        await activityService.resolveAlert(alertId);
        loadSecurityData();
    };

    const parseUserAgent = (ua: string) => {
        if (/Chrome/i.test(ua)) return { browser: 'Chrome' };
        if (/Firefox/i.test(ua)) return { browser: 'Firefox' };
        if (/Safari/i.test(ua)) return { browser: 'Safari' };
        if (/Edg/i.test(ua)) return { browser: 'Edge' };
        return { browser: 'Unknown' };
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
            <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
                {['logs', 'sessions', 'alerts', 'failed_logins', 'errors', user.role === 'admin' && 'blocked'].filter(Boolean).map((tab) => (
                    <button
                        key={String(tab)}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {tab === 'logs' && 'Activity Logs'}
                        {tab === 'sessions' && 'Login Sessions'}
                        {tab === 'alerts' && 'Security Alerts'}
                        {tab === 'failed_logins' && 'Failed Logins'}
                        {tab === 'errors' && 'System Errors'}
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

            {/* Failed Logins Tab */}
            {activeTab === 'failed_logins' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">Failed Login Attempts</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {failedLogins.map((login) => (
                            <div
                                key={login.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-medium">{login.email}</span>
                                        <Badge variant="error" className="text-[10px]">{login.failure_reason}</Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <span className="font-mono">{login.ip_address}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            <span>{login.location}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Monitor className="w-3 h-3" />
                                            <span>{login.user_agent ? parseUserAgent(login.user_agent).browser : 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 text-right">
                                    {new Date(login.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))}
                        {failedLogins.length === 0 && (
                            <div className="text-center text-slate-500 py-8">No failed login attempts</div>
                        )}
                    </div>
                </Card>
            )}

            {/* System Errors Tab */}
            {activeTab === 'errors' && (
                <Card>
                    <h3 className="font-bold text-white mb-4">System Errors</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {errorLogs.map((error) => (
                            <div
                                key={error.id}
                                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-slate-700 text-slate-300">{error.error_type}</Badge>
                                        <Badge variant="error">{error.severity}</Badge>
                                    </div>
                                    <span className="text-xs text-slate-500">{new Date(error.created_at).toLocaleString()}</span>
                                </div>

                                <p className="text-red-400 text-sm font-mono break-all mb-2">{error.error_message}</p>

                                <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                                    {error.endpoint && (
                                        <div>Endpoint: <span className="text-slate-400">{error.endpoint}</span></div>
                                    )}
                                    {error.status_code && (
                                        <div>Status: <span className="text-slate-400">{error.status_code}</span></div>
                                    )}
                                    {error.user_id && (
                                        <div className="col-span-2">User ID: {error.user_id}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {errorLogs.length === 0 && (
                            <div className="text-center text-slate-500 py-8">No errors logged</div>
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
