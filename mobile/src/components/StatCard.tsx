import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <TouchableOpacity style={[styles.card, { borderColor: color }]}>
      <View style={styles.cardContent}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 16,
    margin: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '45%',
  },
  cardContent: {
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  title: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});