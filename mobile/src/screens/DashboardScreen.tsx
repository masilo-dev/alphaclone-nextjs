import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import DashboardCard from '../components/DashboardCard';
import StatCard from '../components/StatCard';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats } from '../services/mobileData';
import type { MobileActivity, MobileDashboardStats } from '../types';

export default function DashboardScreen() {
  const { user, activeTenant } = useAuth();
<<<<<<< HEAD
  const navigation = useNavigation();
=======
>>>>>>> origin/main
  const [dashboard, setDashboard] = useState<MobileDashboardStats>({
    activeProjects: 0,
    totalLeads: 0,
    revenue: 0,
    tasks: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      if (!activeTenant || !user) return;
      setLoading(true);
      try {
        const stats = await getDashboardStats(activeTenant.id, user.id);
        if (mounted) setDashboard(stats);
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [activeTenant, user]);

  const stats = [
    { title: 'Active Projects', value: String(dashboard.activeProjects), icon: 'folder', color: '#00D2A0' },
    { title: 'Total Leads', value: String(dashboard.totalLeads), icon: 'people', color: '#0077FF' },
    { title: 'Revenue', value: `$${Math.round(dashboard.revenue).toLocaleString()}`, icon: 'cash', color: '#FFA500' },
    { title: 'Tasks', value: String(dashboard.tasks), icon: 'checkmark-circle', color: '#FF6B6B' },
  ];

  const recentActivities: MobileActivity[] = dashboard.recentActivity;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020D1A', '#0A1A2F']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || user?.email || 'User'}</Text>
              <Text style={styles.workspaceName}>{activeTenant?.name || 'Setting up workspace'}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </View>

          {/* Quick Actions — every visible action must navigate */}
          <BlurView intensity={80} style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Open projects"
                onPress={() => navigation.navigate('Projects' as never)}
              >
                <Ionicons name="add-circle" size={32} color="#00D2A0" />
                <Text style={styles.actionText}>Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Open CRM"
                onPress={() => navigation.navigate('CRM' as never)}
              >
                <Ionicons name="person-add" size={32} color="#0077FF" />
                <Text style={styles.actionText}>CRM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Open finance"
                onPress={() => navigation.navigate('Finance' as never)}
              >
                <Ionicons name="cash-outline" size={32} color="#FFA500" />
                <Text style={styles.actionText}>Finance</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Recent Activity */}
          <View style={styles.recentActivity}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {loading ? (
              <ActivityIndicator color="#00D2A0" />
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <DashboardCard key={activity.id} activity={activity} />
              ))
            ) : (
              <Text style={styles.emptyText}>No activity yet.</Text>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  workspaceName: {
    fontSize: 13,
    color: '#00D2A0',
    marginTop: 4,
  },
  notificationButton: {
    padding: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  quickActions: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  actionText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 5,
  },
  recentActivity: {
    marginHorizontal: 20,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});
