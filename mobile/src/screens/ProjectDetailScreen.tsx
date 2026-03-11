import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function ProjectDetailScreen({ route, navigation }) {
  const { project } = route.params || {
    title: 'Website Redesign',
    client: 'Tech Corp',
    status: 'in-progress',
    progress: 75,
    deadline: '2024-02-15',
    budget: '$5,000',
    description: 'Complete redesign of the company website with modern UI/UX principles.',
  };

  const tasks = [
    { id: 1, title: 'Design Mockups', completed: true },
    { id: 2, title: 'Frontend Development', completed: true },
    { id: 3, title: 'Backend Integration', completed: false },
    { id: 4, title: 'Testing & QA', completed: false },
    { id: 5, title: 'Deployment', completed: false },
  ];

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020D1A', '#0A1A2F']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Project Details</Text>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Project Info */}
          <View style={styles.projectInfo}>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <Text style={styles.projectClient}>{project.client}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) + '20' }]}>
              <Ionicons name="time" size={16} color={getStatusColor(project.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                {project.status.replace('-', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Progress</Text>
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
            <Text style={styles.progressText}>{project.progress}% Complete</Text>
          </View>

          {/* Project Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={20} color="#94A3B8" />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Deadline</Text>
                <Text style={styles.detailValue}>{project.deadline}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={20} color="#94A3B8" />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Budget</Text>
                <Text style={styles.detailValue}>{project.budget}</Text>
              </View>
            </View>
          </View>

          {/* Tasks */}
          <View style={styles.tasksSection}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            {tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <Ionicons 
                  name={task.completed ? "checkmark-circle" : "radio-button-off"} 
                  size={20} 
                  color={task.completed ? '#00D2A0' : '#64748B'} 
                />
                <Text style={[styles.taskText, task.completed && styles.taskCompleted]}>
                  {task.title}
                </Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{project.description}</Text>
          </View>
        </View>
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
  content: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  projectInfo: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  projectTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  projectClient: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailText: {
    marginLeft: 15,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tasksSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  descriptionSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  descriptionText: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
  },
});