import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function CRMScreen() {
  const leads = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john@techcorp.com',
      company: 'Tech Corp',
      status: 'hot',
      value: '$5,000',
      lastContact: '2 hours ago',
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@startupxyz.com',
      company: 'StartupXYZ',
      status: 'warm',
      value: '$12,000',
      lastContact: '1 day ago',
    },
    {
      id: 3,
      name: 'Mike Davis',
      email: 'mike@enterprise.com',
      company: 'Enterprise Solutions',
      status: 'cold',
      value: '$25,000',
      lastContact: '3 days ago',
    },
  ];

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
            <Text style={styles.title}>CRM</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>48</Text>
              <Text style={styles.statLabel}>Total Leads</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Active Deals</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>$42K</Text>
              <Text style={styles.statLabel}>Pipeline Value</Text>
            </View>
          </View>

          {/* Leads List */}
          <View style={styles.leadsSection}>
            <Text style={styles.sectionTitle}>Recent Leads</Text>
            {leads.map((lead) => (
              <TouchableOpacity key={lead.id} style={styles.leadCard}>
                <View style={styles.leadHeader}>
                  <View style={styles.leadInfo}>
                    <Text style={styles.leadName}>{lead.name}</Text>
                    <Text style={styles.leadEmail}>{lead.email}</Text>
                    <Text style={styles.leadCompany}>{lead.company}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(lead.status) as any} size={16} color={getStatusColor(lead.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(lead.status) }]}>
                      {lead.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.leadFooter}>
                  <View style={styles.valueContainer}>
                    <Ionicons name="cash" size={16} color="#94A3B8" />
                    <Text style={styles.valueText}>{lead.value}</Text>
                  </View>
                  <Text style={styles.lastContactText}>{lead.lastContact}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    flex: 1,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00D2A0',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  leadsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  leadCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  leadEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 2,
  },
  leadCompany: {
    fontSize: 14,
    color: '#64748B',
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
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '600',
  },
  lastContactText: {
    fontSize: 12,
    color: '#64748B',
  },
});