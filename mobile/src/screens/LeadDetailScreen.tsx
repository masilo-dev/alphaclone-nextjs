import { colors } from '../styles/theme';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { MobileLead } from '../types';

export default function LeadDetailScreen({ route, navigation }: { route: { params?: { lead?: MobileLead } }; navigation: any }) {
  const { lead } = route.params || {};
  const currentLead: MobileLead = lead || {
    id: 'demo-lead',
    name: 'John Smith',
    email: 'john@techcorp.com',
    company: 'Tech Corp',
    status: 'hot',
    value: 5000,
    phone: '+1 (555) 123-4567',
    notes: 'Interested in website redesign. Budget approved.',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot':
        return colors.error;
      case 'warm':
        return colors.warning;
      case 'cold':
        return colors.info;
      default:
        return colors.textSecondary;
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
        colors={[colors.background, colors.surface]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color=colors.textInverse />
            </TouchableOpacity>
            <Text style={styles.title}>Lead Details</Text>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color=colors.textInverse />
            </TouchableOpacity>
          </View>

          {/* Lead Info */}
          <View style={styles.leadInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color=colors.textInverse />
            </View>
            <Text style={styles.leadName}>{currentLead.name}</Text>
            <Text style={styles.leadCompany}>{currentLead.company || 'Lead'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentLead.status) + '20' }]}>
              <Ionicons name={getStatusIcon(currentLead.status) as any} size={16} color={getStatusColor(currentLead.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(currentLead.status) }]}>
                {currentLead.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactRow}>
              <Ionicons name="mail" size={20} color=colors.textSecondary />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{currentLead.email || 'No email'}</Text>
              </View>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="call" size={20} color=colors.textSecondary />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>{currentLead.phone || 'No phone'}</Text>
              </View>
            </View>
          </View>

          {/* Deal Value */}
          <View style={styles.valueSection}>
            <Text style={styles.sectionTitle}>Deal Value</Text>
            <Text style={styles.dealValue}>${Math.round(currentLead.value || 0).toLocaleString()}</Text>
          </View>

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{currentLead.notes || 'No notes yet.'}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call" size={20} color=colors.textInverse />
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emailButton}>
              <Ionicons name="mail" size={20} color=colors.textInverse />
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
    color: colors.textInverse,
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
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  leadName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 5,
  },
  leadCompany: {
    fontSize: 16,
    color: colors.textSecondary,
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
    color: colors.textInverse,
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
    color: colors.textMuted,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: colors.textInverse,
    fontWeight: '600',
  },
  valueSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  dealValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  notesSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  notesText: {
    fontSize: 16,
    color: colors.textSecondary,
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
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
