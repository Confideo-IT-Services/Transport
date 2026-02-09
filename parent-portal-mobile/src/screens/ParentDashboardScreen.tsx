import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, Child, AttendanceRecord, Homework, Notification, Fee, TestResult } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { format } from 'date-fns';

export function ParentDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Summary data
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [homeworkCount, setHomeworkCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingFee, setPendingFee] = useState<number>(0);
  const [latestTest, setLatestTest] = useState<TestResult | null>(null);

  // Loading states
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingHomework, setLoadingHomework] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loadingTestResults, setLoadingTestResults] = useState(false);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadAllSummaries();
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

  const loadAllSummaries = async () => {
    if (!selectedChildId) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Load all summaries in parallel
    Promise.all([
      loadTodayAttendance(today),
      loadHomeworkSummary(),
      loadNotificationsSummary(),
      loadFeesSummary(),
      loadTestResultsSummary(),
    ]);
  };

  const loadTodayAttendance = async (today: string) => {
    if (!selectedChildId) return;
    try {
      setLoadingAttendance(true);
      const data = await parentsApi.getChildAttendance(selectedChildId, today, today);
      setTodayAttendance(data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setTodayAttendance(null);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const loadHomeworkSummary = async () => {
    if (!selectedChildId) return;
    try {
      setLoadingHomework(true);
      const data = await parentsApi.getChildHomework(selectedChildId);
      const pending = data.filter(hw => !hw.isCompleted).length;
      setHomeworkCount(pending);
    } catch (error) {
      console.error('Failed to load homework:', error);
      setHomeworkCount(0);
    } finally {
      setLoadingHomework(false);
    }
  };

  const loadNotificationsSummary = async () => {
    if (!selectedChildId) return;
    try {
      setLoadingNotifications(true);
      const data = await parentsApi.getChildNotifications(selectedChildId);
      const unread = data.filter(n => !n.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setUnreadCount(0);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const loadFeesSummary = async () => {
    if (!selectedChildId) return;
    try {
      setLoadingFees(true);
      const data = await parentsApi.getChildFees(selectedChildId);
      const totalPending = data.reduce((sum, fee) => sum + fee.pendingAmount, 0);
      setPendingFee(totalPending);
    } catch (error) {
      console.error('Failed to load fees:', error);
      setPendingFee(0);
    } finally {
      setLoadingFees(false);
    }
  };

  const loadTestResultsSummary = async () => {
    if (!selectedChildId) return;
    try {
      setLoadingTestResults(true);
      const data = await parentsApi.getChildTestResults(selectedChildId);
      if (data.length > 0) {
        // Sort by test date descending and get latest
        const sorted = [...data].sort((a, b) => 
          new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
        );
        setLatestTest(sorted[0]);
      } else {
        setLatestTest(null);
      }
    } catch (error) {
      console.error('Failed to load test results:', error);
      setLatestTest(null);
    } finally {
      setLoadingTestResults(false);
    }
  };

  const getAttendanceConfig = (status: string | null) => {
    if (!status) {
      return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af', label: 'Not marked yet' }; // Gray - Info
    }
    switch (status) {
      case 'present':
        return { bg: '#d1fae5', text: '#065f46', border: '#10b981', label: 'Present' }; // Green - Success
      case 'absent':
        return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444', label: 'Absent' }; // Red - Alert
      case 'leave':
        return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b', label: 'Leave' }; // Amber - Pending
      default:
        return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af', label: 'Not marked yet' }; // Gray - Info
    }
  };

  const getPerformanceConfig = (percentage: string) => {
    const percent = parseFloat(percentage);
    if (percent >= 80) {
      return { text: 'Excellent', bg: '#d1fae5', textColor: '#065f46', border: '#10b981' }; // Green - Success
    } else if (percent >= 60) {
      return { text: 'Good', bg: '#fef3c7', textColor: '#92400e', border: '#f59e0b' }; // Amber - Pending
    } else {
      return { text: 'Needs Improvement', bg: '#fee2e2', textColor: '#991b1b', border: '#ef4444' }; // Red - Alert
    }
  };

  const renderAttendanceCard = () => {
    const status = todayAttendance?.status || null;
    const config = getAttendanceConfig(status);
    
    return (
      <TouchableOpacity
        style={[styles.card, styles.attendanceCard]}
        onPress={() => navigation.navigate('Attendance' as never)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>📅 Attendance</Text>
          {loadingAttendance ? (
            <ActivityIndicator size="small" color="#6b7280" style={styles.cardLoader} />
          ) : (
            <View style={styles.cardValue}>
              <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
                <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtext}>Today's status</Text>
      </TouchableOpacity>
    );
  };

  const renderHomeworkCard = () => {
    return (
      <TouchableOpacity
        style={[styles.card, styles.homeworkCard]}
        onPress={() => {
          if (selectedChildId) {
            (navigation as any).navigate('Homework', {
              childId: selectedChildId,
              viewMode: 'pending',
            });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>📚 Homework</Text>
          {loadingHomework ? (
            <ActivityIndicator size="small" color="#6b7280" style={styles.cardLoader} />
          ) : (
            <View style={styles.cardValue}>
              <Text style={styles.countText}>
                {homeworkCount === 0 ? '0' : homeworkCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtext}>
          {homeworkCount === 0 ? 'No pending homework' : `${homeworkCount} pending`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderNotificationsCard = () => {
    return (
      <TouchableOpacity
        style={[styles.card, styles.notificationsCard]}
        onPress={() => navigation.navigate('Notifications' as never)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>🔔 Notifications</Text>
          {loadingNotifications ? (
            <ActivityIndicator size="small" color="#6b7280" style={styles.cardLoader} />
          ) : (
            <View style={styles.cardValue}>
              <View style={[styles.badge, unreadCount > 0 && styles.badgeActive]}>
                <Text style={[styles.badgeText, unreadCount > 0 && styles.badgeTextActive]}>
                  {unreadCount}
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtext}>
          {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFeesCard = () => {
    return (
      <TouchableOpacity
        style={[styles.card, styles.feesCard]}
        onPress={() => navigation.navigate('Fees' as never)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>💰 Fees</Text>
          {loadingFees ? (
            <ActivityIndicator size="small" color="#6b7280" style={styles.cardLoader} />
          ) : (
            <View style={styles.cardValue}>
              <Text style={[styles.amountText, pendingFee === 0 && styles.amountTextSuccess]}>
                {pendingFee === 0 ? 'All paid' : `₹${pendingFee.toLocaleString('en-IN')}`}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtext}>
          {pendingFee === 0 ? 'No dues' : 'Pending amount'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTestResultsCard = () => {
    if (loadingTestResults) {
      return (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Test Results</Text>
            <ActivityIndicator size="small" color="#6b7280" style={styles.cardLoader} />
          </View>
          <Text style={styles.cardSubtext}>Loading...</Text>
        </View>
      );
    }

    if (!latestTest) {
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Results' as never)}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Test Results</Text>
          </View>
          <Text style={styles.cardSubtext}>No test results yet</Text>
        </TouchableOpacity>
      );
    }

    const performance = getPerformanceConfig(latestTest.percentage);

    return (
      <TouchableOpacity
        style={[styles.card, styles.testResultsCard]}
        onPress={() => navigation.navigate('Results' as never)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>📊 Test Results</Text>
          <View style={styles.cardValue}>
            <View style={[styles.performanceBadge, { backgroundColor: performance.bg, borderColor: performance.border }]}>
              <Text style={[styles.performanceText, { color: performance.textColor }]}>
                {performance.text}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.testInfo}>
          <Text style={styles.testName}>{latestTest.testName}</Text>
          <Text style={styles.testSubject}>{latestTest.subjectName}</Text>
          <View style={styles.testMarks}>
            <Text style={styles.testPercentage}>{latestTest.percentage}%</Text>
            <Text style={styles.testMarksText}>
              {latestTest.marksObtained} / {latestTest.maxMarks}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerIcon}>🏠</Text>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Parent Dashboard</Text>
              <Text style={styles.headerSubtitle}>Overview for selected child</Text>
            </View>
          </View>
          <View style={styles.headerAccent} />
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderAttendanceCard()}
        {renderHomeworkCard()}
        {renderNotificationsCard()}
        {renderFeesCard()}
        {renderTestResultsCard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  headerSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: -0.3,
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
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 18,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f5f5f5',
    borderLeftWidth: 4,
  },
  attendanceCard: {
    borderLeftColor: '#10b981',
  },
  homeworkCard: {
    borderLeftColor: '#f59e0b',
  },
  notificationsCard: {
    borderLeftColor: '#ef4444',
  },
  feesCard: {
    borderLeftColor: '#8b5cf6',
  },
  testResultsCard: {
    borderLeftColor: '#3b82f6',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  cardValue: {
    alignItems: 'flex-end',
  },
  cardLoader: {
    marginRight: 4,
  },
  cardSubtext: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  countText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  badgeTextActive: {
    color: '#dc2626',
  },
  amountText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#111827',
  },
  amountTextSuccess: {
    color: '#059669',
  },
  testInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  testName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 20,
  },
  testSubject: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  testMarks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6', // Blue - Tests/Results module color
  },
  testMarksText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  performanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  performanceText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

