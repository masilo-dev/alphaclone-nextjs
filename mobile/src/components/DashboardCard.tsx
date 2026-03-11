import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DashboardCardProps {
  activity: {
    id: number;
    title: string;
    time: string;
    type: 'lead' | 'project' | 'finance' | 'calendar';
  };
}

export default function DashboardCard({ activity }: DashboardCardProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'lead':
        return 'person-add';
      case 'project':
        return 'folder';
      case 'finance':
        return 'cash';
      case 'calendar':
        return 'calendar';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'lead':
        return '#0077FF';
      case 'project':
        return '#00D2A0';
      case 'finance':
        return '#FFA500';
      case 'calendar':
        return '#FF6B6B';
      default:
        return '#94A3B8';
    }
  };

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        <Ionicons 
          name={getIcon(activity.type) as any} 
          size={20} 
          color={getIconColor(activity.type)} 
          style={styles.icon}
        />
        <View style={styles.textContent}>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.time}>{activity.time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: '#64748B',
  },
});