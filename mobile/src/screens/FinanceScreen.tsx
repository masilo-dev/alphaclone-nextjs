import { colors } from '../styles/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getInvoices } from '../services/mobileData';
import type { MobileInvoice } from '../types';

export default function FinanceScreen({ navigation }: { navigation: any }) {
  const { activeTenant } = useAuth();
  const [invoices, setInvoices] = useState<MobileInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadInvoices = async () => {
      if (!activeTenant) return;
      setLoading(true);
      try {
        const rows = await getInvoices(activeTenant.id);
        if (mounted) setInvoices(rows);
      } catch (error) {
        console.error('Invoices load error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInvoices();
    return () => {
      mounted = false;
    };
  }, [activeTenant]);

  const paidRevenue = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const monthRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return colors.primary;
      case 'pending':
        return colors.warning;
      case 'overdue':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'overdue':
        return 'alert-circle';
      default:
        return 'information-circle';
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
            <Text style={styles.title}>Finance</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={24} color=colors.textInverse />
            </TouchableOpacity>
          </View>

          {/* Financial Overview */}
          <View style={styles.overviewContainer}>
            <View style={styles.overviewCard}>
              <Ionicons name="cash" size={32} color=colors.primary />
              <Text style={styles.overviewLabel}>Total Revenue</Text>
              <Text style={styles.overviewValue}>${Math.round(paidRevenue).toLocaleString()}</Text>
            </View>
            <View style={styles.overviewCard}>
              <Ionicons name="trending-up" size={32} color=colors.info />
              <Text style={styles.overviewLabel}>This Month</Text>
              <Text style={styles.overviewValue}>${Math.round(monthRevenue).toLocaleString()}</Text>
            </View>
          </View>

          {/* Recent Invoices */}
          <View style={styles.invoicesSection}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            {invoices.map((invoice) => (
              <TouchableOpacity key={invoice.id} style={styles.invoiceCard} onPress={() => navigation.navigate('InvoiceDetail', { invoice })}>
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                    <Text style={styles.invoiceClient}>{invoice.client}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(invoice.status) as any} size={16} color={getStatusColor(invoice.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                      {invoice.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceDetails}>
                  <Text style={styles.invoiceAmount}>${Math.round(invoice.amount).toLocaleString()}</Text>
                  <Text style={styles.invoiceDueDate}>Due: {invoice.dueDate}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {loading && <ActivityIndicator color=colors.primary />}
            {!loading && invoices.length === 0 && <Text style={styles.emptyText}>No invoices yet.</Text>}
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
    color: colors.textInverse,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  overviewCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.card,
    flex: 1,
    marginHorizontal: 5,
  },
  overviewLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginTop: 4,
  },
  invoicesSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textInverse,
    marginBottom: 15,
  },
  invoiceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.card,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
    marginBottom: 4,
  },
  invoiceClient: {
    fontSize: 14,
    color: colors.textSecondary,
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
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textInverse,
  },
  invoiceDueDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
