import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LeadDetailScreen({ route, navigation }) {
  const { lead } = route.params || {
    name: 'John Smith',
    email: 'john@techcorp.com',
    company: 'Tech Corp',
    status: 'hot',
    value: '$5,000',
    phone: '+1 (555) 123-4567',
    notes: 'Interested in website redesign. Budget approved.',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot':
        return '#FF6B6B';
      case 'warm':
        return '#FFA500';
      case 'cold':
        return '#0077FF';
      default:
        return '#94A3B8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hot':
        return 'flame';
      case 'warm':
        return 'thermometer';
      case 'cold':
        return 'snow';
      default:
        return 'person';
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
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Lead Details</Text>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Lead Info */}
          <View style={styles.leadInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.leadName}>{lead.name}</Text>
            <Text style={styles.leadCompany}>{lead.company}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) + '20' }]}>
              <Ionicons name={getStatusIcon(lead.status) as any} size={16} color={getStatusColor(lead.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(lead.status) }]}>
                {lead.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactRow}>
              <Ionicons name="mail" size={20} color="#94A3B8" />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{lead.email}</Text>
              </View>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="call" size={20} color="#94A3B8" />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>{lead.phone}</Text>
              </View>
            </View>
          </View>

          {/* Deal Value */}
          <View style={styles.valueSection}>
            <Text style={styles.sectionTitle}>Deal Value</Text>
            <Text style={styles.dealValue}>{lead.value}</Text>
          </View>

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{lead.notes}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emailButton}>
              <Ionicons name="mail" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Email</Text>
            </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leadInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  leadName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  leadCompany: {
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
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  contactSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  contactText: {
    marginLeft: 15,
  },
  contactLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  valueSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  dealValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00D2A0',
  },
  notesSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  notesText: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D2A0',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0077FF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});