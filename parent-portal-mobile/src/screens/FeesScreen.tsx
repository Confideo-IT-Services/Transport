import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, Fee, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export function FeesScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadFees();
      const child = children.find((c) => c.id === selectedChildId);
      setSelectedChild(child || null);
    }
  }, [selectedChildId]);

  const loadChildren = async () => {
    try {
      const data = await parentsApi.getChildren();
      setChildren(data);
      if (data.length > 0) {
        setSelectedChildId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFees = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const data = await parentsApi.getChildFees(selectedChildId);
      setFees(data);
    } catch (error) {
      console.error('Failed to load fees:', error);
      setFees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (fee: Fee) => {
    if (!selectedChild) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fee Receipt - ${selectedChild.name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 2rem auto;
      padding: 1rem;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      border-bottom: 2px solid #333;
      padding-bottom: 1rem;
    }
    h1 { font-size: 1.5rem; margin: 0; color: #333; }
    .subtitle { font-size: 0.875rem; color: #666; margin-top: 0.5rem; }
    .student-info {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      font-weight: 600;
      background: #f9f9f9;
      color: #333;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid { background: #d4edda; color: #155724; }
    .status-partial { background: #fff3cd; color: #856404; }
    .status-unpaid { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Fee Receipt / Invoice</h1>
    <div class="subtitle">${selectedChild.schoolName || 'School'}</div>
  </div>
  <div class="student-info">
    <p><strong>Student Name:</strong> ${selectedChild.name || "-"}</p>
    <p><strong>Roll No:</strong> ${selectedChild.rollNo || "-"}</p>
    <p><strong>Class:</strong> ${selectedChild.className || "-"}</p>
    ${selectedChild.admissionNumber ? `<p><strong>Admission No:</strong> ${selectedChild.admissionNumber}</p>` : ''}
  </div>
  <table>
    <tr>
      <th>Total Fee</th>
      <td>₹${fee.totalFee.toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Paid Amount</th>
      <td>₹${fee.paidAmount.toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Pending Amount</th>
      <td>₹${fee.pendingAmount.toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Status</th>
      <td>
        <span class="status-badge status-${fee.status}">
          ${fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
        </span>
      </td>
    </tr>
    ${fee.dueDate ? `
    <tr>
      <th>Due Date</th>
      <td>${format(new Date(fee.dueDate), 'MMMM d, yyyy')}</td>
    </tr>
    ` : ''}
  </table>
  ${fee.componentBreakdown ? `
  <h3 style="margin-top: 1.5rem; font-size: 1rem;">Component Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th>Component</th>
        <th>Total</th>
        <th>Paid</th>
        <th>Pending</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(fee.componentBreakdown).map(([key, value]: [string, any]) => `
        <tr>
          <td>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
          <td>₹${(value.total || 0).toLocaleString('en-IN')}</td>
          <td>₹${(value.paid || 0).toLocaleString('en-IN')}</td>
          <td>₹${(value.pending || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.75rem; color: #666; text-align: center;">
    Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')} · ConventPulse
  </div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', 'Receipt generated. Please use a file manager to access it.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate receipt');
      console.error(error);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#d1fae5', text: '#065f46', border: '#10b981' }; // Green - Success/Completed
      case 'partial':
        return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' }; // Amber - Pending
      case 'unpaid':
        return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }; // Red - Alert/Overdue
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#6b7280' }; // Gray - Info
    }
  };

  const renderItem = ({ item }: { item: Fee }) => {
    const statusConfig = getStatusConfig(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Fee Record</Text>
          <View style={styles.headerRight}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusConfig.bg,
                  borderColor: statusConfig.border,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: statusConfig.text }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownloadReceipt(item)}
            >
              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Fee</Text>
            <Text style={styles.summaryValue}>
              ₹{item.totalFee.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, styles.paidAmount]}>
              ₹{item.paidAmount.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, styles.pendingAmount]}>
              ₹{item.pendingAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {item.dueDate && (
          <View style={styles.dueDateContainer}>
            <Text style={styles.dueDateLabel}>Due Date</Text>
            <Text style={styles.dueDate}>
              {format(new Date(item.dueDate), 'MMMM d, yyyy')}
            </Text>
          </View>
        )}

        {item.componentBreakdown && (
          <View style={styles.breakdown}>
            <Text style={styles.breakdownTitle}>Component Breakdown</Text>
            {Object.entries(item.componentBreakdown).map(([key, value]: [string, any]) => (
              <View key={key} style={styles.breakdownRow}>
                <Text style={styles.breakdownKey}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownTotal}>
                    ₹{(value.total || 0).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.breakdownPending}>
                    ₹{(value.pending || 0).toLocaleString('en-IN')} pending
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>💰</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Fee Records</Text>
            <Text style={styles.headerSubtitle}>Payment status for selected child</Text>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: '#8b5cf6' }]} />
      </View>

      {children.length > 1 && (
        <View style={styles.filterSection}>
          <ChildSelector
            children={children}
            selectedChildId={selectedChildId}
            onSelect={setSelectedChildId}
          />
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <EmptyState message="No fee records found." />
    </View>
  );

  if (loading && children.length === 0) {
    return <LoadingSpinner />;
  }

  if (children.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState message="No children found. Please contact the school if you believe this is an error." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={fees}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={fees.length === 0 ? styles.emptyListContent : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    position: 'relative',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerAccent: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    borderRadius: 2,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 400,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  downloadButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  downloadText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  paidAmount: {
    color: '#059669',
  },
  pendingAmount: {
    color: '#dc2626',
  },
  dueDateContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dueDateLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  dueDate: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  breakdown: {
    marginTop: 4,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  breakdownKey: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
    textTransform: 'capitalize',
  },
  breakdownValues: {
    alignItems: 'flex-end',
  },
  breakdownTotal: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  breakdownPending: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
});

