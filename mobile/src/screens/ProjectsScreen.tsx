import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getProjects } from '../services/mobileData';
import type { MobileProject } from '../types';

export default function ProjectsScreen({ navigation }: { navigation: any }) {
  const { activeTenant } = useAuth();
  const [projects, setProjects] = useState<MobileProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadProjects = async () => {
      if (!activeTenant) return;
      setLoading(true);
      try {
        const rows = await getProjects(activeTenant.id);
        if (mounted) setProjects(rows);
      } catch (error) {
        console.error('Projects load error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProjects();
    return () => {
      mounted = false;
    };
  }, [activeTenant]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#00D2A0';
      case 'in-progress':
        return '#0077FF';
      case 'planning':
        return '#FFA500';
      default:
        return '#94A3B8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'in-progress':
        return 'time';
      case 'planning':
        return 'calendar';
      default:
        return 'information-circle';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020D1A', '#0A1A2F']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Projects</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Projects List */}
          <View style={styles.projectsList}>
            {projects.map((project) => (
              <TouchableOpacity key={project.id} style={styles.projectCard} onPress={() => navigation.navigate('ProjectDetail', { project })}>
                <View style={styles.projectHeader}>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <Text style={styles.projectClient}>{project.client}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(project.status) as any} size={16} color={getStatusColor(project.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                      {project.status.replace('-', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.projectDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar" size={16} color="#94A3B8" />
                    <Text style={styles.detailText}>{project.deadline}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash" size={16} color="#94A3B8" />
                    <Text style={styles.detailText}>${Math.round(project.budget || 0).toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${project.progress}%`, 
                          backgroundColor: getStatusColor(project.status) 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{project.progress}%</Text>
                </View>
              </TouchableOpacity>
            ))}
            {loading && <ActivityIndicator color="#00D2A0" />}
            {!loading && projects.length === 0 && <Text style={styles.emptyText}>No projects yet.</Text>}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#00D2A0',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectsList: {
    paddingHorizontal: 20,
  },
  projectCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  projectClient: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  projectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});
