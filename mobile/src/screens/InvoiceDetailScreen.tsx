import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { MobileInvoice } from '../types';

export default function InvoiceDetailScreen({ route, navigation }: { route: { params?: { invoice?: MobileInvoice } }; navigation: any }) {
  const { invoice } = route.params || {};
  const currentInvoice: MobileInvoice = invoice || {
    id: 'demo-invoice',
    number: 'INV-001',
    client: 'Tech Corp',
    amount: 5000,
    status: 'paid',
    dueDate: '2024-01-15',
    issueDate: '2024-01-01',
    items: [
      { id: '1', description: 'Website Design', quantity: 1, price: 2000, total: 2000 },
      { id: '2', description: 'Development', quantity: 1, price: 2500, total: 2500 },
      { id: '3', description: 'Testing & QA', quantity: 1, price: 500, total: 500 },
    ],
  };
  const subtotal = currentInvoice.items.reduce((sum, item) => sum + item.total, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#00D2A0';
      case 'pending':
        return '#FFA500';
      case 'overdue':
        return '#FF6B6B';
      default:
        return '#94A3B8';
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
        colors={['#020D1A', '#0A1A2F']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Invoice Details</Text>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Invoice Header */}
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>{currentInvoice.number}</Text>
              <Text style={styles.invoiceClient}>{currentInvoice.client || 'Client'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentInvoice.status) + '20' }]}>
              <Ionicons name={getStatusIcon(currentInvoice.status) as any} size={16} color={getStatusColor(currentInvoice.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(currentInvoice.status) }]}>
                {currentInvoice.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Invoice Dates */}
          <View style={styles.datesSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Issue Date:</Text>
              <Text style={styles.dateValue}>{currentInvoice.issueDate || 'Not issued'}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Due Date:</Text>
              <Text style={styles.dateValue}>{currentInvoice.dueDate || 'No due date'}</Text>
            </View>
          </View>

          {/* Invoice Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Invoice Items</Text>
            {currentInvoice.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemDescription}>
                  <Text style={styles.itemDescriptionText}>{item.description}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                <View style={styles.itemPrices}>
                  <Text style={styles.itemPrice}>${Math.round(item.price).toLocaleString()}</Text>
                  <Text style={styles.itemTotal}>${Math.round(item.total).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Invoice Total */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${Math.round(subtotal).toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (10%):</Text>
              <Text style={styles.totalValue}>${Math.round(Math.max(currentInvoice.amount - subtotal, 0)).toLocaleString()}</Text>
            </View>
            <View style={[styles.totalRow, styles.finalTotalRow]}>
              <Text style={styles.finalTotalLabel}>Total:</Text>
              <Text style={styles.finalTotalValue}>${Math.round(currentInvoice.amount).toLocaleString()}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            {currentInvoice.status === 'pending' && (
              <TouchableOpacity style={styles.payButton}>
                <Ionicons name="card" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Pay Now</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.downloadButton}>
              <Ionicons name="download" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Download PDF</Text>
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
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  invoiceClient: {
    fontSize: 16,
    color: '#94A3B8',
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
  datesSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dateValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemsSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  itemDescription: {
    flex: 1,
  },
  itemDescriptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#64748B',
  },
  itemPrices: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  totalValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  finalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 15,
    marginTop: 10,
  },
  finalTotalLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  finalTotalValue: {
    fontSize: 18,
    color: '#00D2A0',
    fontWeight: 'bold',
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D2A0',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  downloadButton: {
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
