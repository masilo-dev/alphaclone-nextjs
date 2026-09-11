'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Activity, Clock, Monitor, MousePointer, 
  TrendingUp, AlertCircle, UserCheck, Briefcase,
  Calendar, BarChart3, Filter, RefreshCw, Search,
  MoreVertical, Phone, Mail, FileText, DollarSign,
  Zap, Globe, Laptop, Smartphone, Tablet
} from 'lucide-react';
import { workerTrackingService, ActiveWorker, WorkerProductivity } from '@/services/workerTrackingService';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface WorkerStats {
  total_active: number;
  active_today: number;
  avg_productivity: number;
  total_activities: number;
}

const APP_ICONS: Record<string, React.ReactNode> = {
  crm: <Briefcase className="w-4 h-4" />,
  leads: <Zap className="w-4 h-4" />,
  finance: <DollarSign className="w-4 h-4" />,
  calendar: <Calendar className="w-4 h-4" />,
  accounting: <FileText className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  calls: <Phone className="w-4 h-4" />,
  dashboard: <BarChart3 className="w-4 h-4" />,
};

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Laptop className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  tablet: <Tablet className="w-4 h-4" />,
};

export default function WorkerMonitoringDashboard() {
  const [activeWorkers, setActiveWorkers] = useState<ActiveWorker[]>([]);
  const [productivityData, setProductivityData] = useState<Record<string, WorkerProductivity[]>>({});
  const [stats, setStats] = useState<WorkerStats>({
    total_active: 0,
    active_today: 0,
    avg_productivity: 0,
    total_activities: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [filterApp, setFilterApp] = useState<string>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get active workers
      const workers = await workerTrackingService.getActiveWorkers();
      setActiveWorkers(workers);

      // Get productivity for each worker
      const productivity: Record<string, WorkerProductivity[]> = {};
      const uniqueUsers = [...new Set(workers.map(w => w.user_id))];
      
      for (const userId of uniqueUsers) {
        const days = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : 30;
        productivity[userId] = await workerTrackingService.getWorkerProductivity(userId, days);
      }
      setProductivityData(productivity);

      // Calculate stats
      const todayWorkers = new Set(workers.map(w => w.user_id)).size;
      const totalActivities = workers.reduce((sum, w) => sum + (w.clicks_count || 0), 0);
      const avgProd = Object.values(productivity)
        .flat()
        .reduce((sum, p) => sum + p.productivity_score, 0) / 
        (Object.values(productivity).flat().length || 1);

      setStats({
        total_active: workers.length,
        active_today: todayWorkers,
        avg_productivity: Math.round(avgProd),
        total_activities: totalActivities
      });
    } catch (err) {
      console.error('Failed to load worker data:', err);
      toast.error('Failed to load worker activity data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
    
    // Subscribe to real-time updates
    const unsubscribe = workerTrackingService.subscribeToWorkerActivity((workers) => {
      setActiveWorkers(workers);
    });

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadData]);

  const filteredWorkers = filterApp === 'all' 
    ? activeWorkers 
    : activeWorkers.filter(w => w.app_name === filterApp);

  const uniqueApps = [...new Set(activeWorkers.map(w => w.app_name))];

  const getActivityColor = (minutes: number) => {
    if (minutes < 5) return 'text-green-400';
    if (minutes < 30) return 'text-blue-400';
    if (minutes < 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Worker Activity Monitor
          </h1>
          <p className="text-slate-400 mt-1">Real-time tracking of team activity across all apps</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Active Now</p>
              <p className="text-2xl font-bold text-white">{stats.total_active}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">Live</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Workers Today</p>
              <p className="text-2xl font-bold text-white">{stats.active_today}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Unique users active</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Avg Productivity</p>
              <p className="text-2xl font-bold text-white">{stats.avg_productivity}%</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full mt-2">
            <div 
              className={`h-2 rounded-full ${getProductivityColor(stats.avg_productivity)}`}
              style={{ width: `${stats.avg_productivity}%` }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Activities</p>
              <p className="text-2xl font-bold text-white">{stats.total_activities.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <MousePointer className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Clicks & actions tracked</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">Filter by app:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterApp('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filterApp === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All Apps
          </button>
          {uniqueApps.map(app => (
            <button
              key={app}
              onClick={() => setFilterApp(app)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                filterApp === app 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {APP_ICONS[app] || <Monitor className="w-4 h-4" />}
              {app.charAt(0).toUpperCase() + app.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredWorkers.map((worker) => {
            const prod = productivityData[worker.user_id]?.[0];
            const isSelected = selectedWorker === worker.user_id;
            
            return (
              <motion.div
                key={`${worker.user_id}-${worker.app_name}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setSelectedWorker(isSelected ? null : worker.user_id)}
                className={`bg-slate-800 border rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-500/20' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Worker Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {worker.user_name?.charAt(0).toUpperCase() || 
                       worker.user_email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {worker.user_name || worker.user_email?.split('@')[0] || 'Unknown'}
                      </h3>
                      <p className="text-xs text-slate-400">{worker.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Current Activity */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    {APP_ICONS[worker.app_name] || <Monitor className="w-4 h-4" />}
                    <span className="text-slate-300 capitalize">{worker.app_name}</span>
                    {worker.module_name && (
                      <>
                        <span className="text-slate-500">/</span>
                        <span className="text-slate-400">{worker.module_name}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">
                      {worker.action_type === 'view' && 'Viewing'}
                      {worker.action_type === 'create' && 'Creating'}
                      {worker.action_type === 'edit' && 'Editing'}
                      {worker.action_type === 'delete' && 'Deleting'}
                      {worker.action_type === 'search' && 'Searching'}
                      {worker.action_type === 'export' && 'Exporting'}
                      {worker.entity_type && ` ${worker.entity_type}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className={`${getActivityColor(worker.session_minutes)}`}>
                      {worker.session_minutes < 1 
                        ? 'Just started' 
                        : `${Math.round(worker.session_minutes)} min active`}
                    </span>
                  </div>
                </div>

                {/* Device & Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    {DEVICE_ICONS[worker.device_type || 'desktop'] || <Monitor className="w-4 h-4 text-slate-400" />}
                    <span className="text-xs text-slate-500 capitalize">{worker.device_type || 'desktop'}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <MousePointer className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">{worker.clicks_count}</span>
                    </div>
                    
                    {prod && (
                      <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                        prod.productivity_score >= 80 ? 'bg-green-500/20 text-green-400' :
                        prod.productivity_score >= 60 ? 'bg-blue-500/20 text-blue-400' :
                        prod.productivity_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {prod.productivity_score}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isSelected && prod && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-slate-700 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-900/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Today's Activities</p>
                          <p className="text-white font-semibold">{prod.total_activities}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Active Hours</p>
                          <p className="text-white font-semibold">{prod.active_hours}h</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Apps Used</p>
                          <p className="text-white font-semibold">{prod.unique_apps}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Entities</p>
                          <p className="text-white font-semibold">{prod.entities_touched}</p>
                        </div>
                      </div>
                      
                      {worker.metadata && Object.keys(worker.metadata).length > 0 && (
                        <div className="bg-slate-900/50 rounded p-2">
                          <p className="text-slate-400 text-xs mb-1">Current Context</p>
                          <pre className="text-xs text-slate-300 overflow-x-auto">
                            {JSON.stringify(worker.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredWorkers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No active workers found</p>
          <p className="text-sm text-slate-500">Workers will appear here when they start using the apps</p>
        </div>
      )}
    </div>
  );
}
