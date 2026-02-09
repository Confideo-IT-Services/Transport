import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, Homework, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { DateRangePicker } from '../components/DateRangePicker';
import { format, isBefore, startOfDay } from 'date-fns';

export function HomeworkScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const routeParams = route.params as { childId?: string; viewMode?: string } | undefined;
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [allHomework, setAllHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const initialPendingMode = routeParams?.viewMode === 'pending';
  const [isPendingMode, setIsPendingMode] = useState(initialPendingMode);
  const [dateFilterManuallyChanged, setDateFilterManuallyChanged] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    loadChildren();
  }, []);

  // Sync child selection from route params (Dashboard navigation)
  useEffect(() => {
    if (routeParams?.childId && children.length > 0) {
      const childExists = children.some(c => c.id === routeParams.childId);
      if (childExists && selectedChildId !== routeParams.childId) {
        setSelectedChildId(routeParams.childId);
      }
    } else if (children.length > 0 && !selectedChildId) {
      // Default to first child if no childId in params
      setSelectedChildId(children[0].id);
    }
  }, [routeParams?.childId, children]);

  // Sync pending mode from route params
  useEffect(() => {
    if (routeParams?.viewMode === 'pending') {
      setIsPendingMode(true);
    } else if (routeParams?.viewMode === 'all' || !routeParams?.viewMode) {
      setIsPendingMode(false);
    }
  }, [routeParams?.viewMode]);

  useEffect(() => {
    if (selectedChildId) {
      loadHomework();
    }
  }, [selectedChildId]);

  useEffect(() => {
    filterHomework();
  }, [allHomework, startDate, endDate, isPendingMode, dateFilterManuallyChanged]);

  const loadChildren = async () => {
    try {
      const data = await parentsApi.getChildren();
      setChildren(data);
      // Don't set default child here - let the route params effect handle it
      // This prevents overriding the childId from Dashboard navigation
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHomework = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const data = await parentsApi.getChildHomework(selectedChildId);
      setAllHomework(data);
    } catch (error) {
      console.error('Failed to load homework:', error);
      setAllHomework([]);
    } finally {
      setLoading(false);
    }
  };

  const filterHomework = () => {
    const filtered = allHomework.filter((hw) => {
      // PENDING MODE: Filter by completion status
      if (isPendingMode && hw.isCompleted) {
        return false;
      }
      
      // PENDING MODE: Ignore date filters unless manually changed
      if (isPendingMode && !dateFilterManuallyChanged) {
        return true; // Show all pending homework regardless of date
      }
      
      // NORMAL MODE OR PENDING MODE WITH MANUAL DATE FILTER: Apply date range filter
      if (!isPendingMode || dateFilterManuallyChanged) {
        const hwDate = hw.dueDate || hw.createdAt;
        if (!hwDate) return true;
        const hwDateStr = new Date(hwDate).toISOString().split('T')[0];
        return hwDateStr >= startDate && hwDateStr <= endDate;
      }
      
      return true;
    });
    setHomework(filtered);
  };

  const handleShowAll = () => {
    // Switch from pending mode to normal mode
    setIsPendingMode(false);
    // Reset date filters to default
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setDateFilterManuallyChanged(false);
  };

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    if (isPendingMode) {
      setDateFilterManuallyChanged(true);
    }
  };

  const handleTodayPress = () => {
    const today = new Date().toISOString().split('T')[0];
    handleDateChange(today, today);
  };

  const isOverdue = (dueDate: string | undefined): boolean => {
    if (!dueDate) return false;
    const due = startOfDay(new Date(dueDate));
    const today = startOfDay(new Date());
    return isBefore(due, today);
  };

  const isPending = (item: Homework): boolean => {
    return !item.isCompleted;
  };

  const HomeworkStatusIndicator = ({ item }: { item: Homework }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Completed homework - show green checkmark
    if (item.isCompleted) {
      return (
        <View style={styles.completedIndicator}>
          <Text style={styles.completedCheckmark}>✓</Text>
        </View>
      );
    }

    // Pending homework - check if overdue
    if (isOverdue(item.dueDate)) {
      return (
        <View style={styles.overdueBadge}>
          <Text style={styles.overdueText}>Overdue</Text>
        </View>
      );
    }

    // Pending homework - due in future (yellow pulsing dot)
    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, []);

    return (
      <Animated.View
        style={[
          styles.pendingDot,
          {
            opacity: pulseAnim,
          },
        ]}
      />
    );
  };

  const renderItem = ({ item }: { item: Homework }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <HomeworkStatusIndicator item={item} />
            <Text style={styles.title}>{item.title}</Text>
          </View>
        </View>
      </View>

      {item.subject && (
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectText}>{item.subject}</Text>
        </View>
      )}

      {item.description && (
        <Text style={styles.description}>{item.description}</Text>
      )}

      <View style={styles.dateContainer}>
        {item.dueDate && (
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Due Date</Text>
            <Text style={styles.dateValue}>
              {format(new Date(item.dueDate), 'MMMM d, yyyy')}
            </Text>
          </View>
        )}
        {item.createdAt && (
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Assigned</Text>
            <Text style={styles.dateValue}>
              {format(new Date(item.createdAt), 'MMMM d, yyyy')}
            </Text>
          </View>
        )}
      </View>

      {item.attachmentUrl && (
        <TouchableOpacity
          onPress={() => Linking.openURL(item.attachmentUrl!)}
          style={styles.attachmentLink}
        >
          <Text style={styles.attachmentText}>📎 View Attachment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>📚</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Homework Assignments</Text>
            <Text style={styles.headerSubtitle}>
              {isPendingMode ? 'Pending tasks for selected child' : 'All assignments for selected child'}
            </Text>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: '#f59e0b' }]} />
      </View>

      {isPendingMode && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            {dateFilterManuallyChanged 
              ? 'Showing pending homework (date filtered)' 
              : 'Showing pending homework'}
          </Text>
          <TouchableOpacity onPress={handleShowAll}>
            <Text style={styles.clearFilterText}>Show all</Text>
          </TouchableOpacity>
        </View>
      )}

      {children.length > 1 && (
        <View style={styles.filterSection}>
          <ChildSelector
            children={children}
            selectedChildId={selectedChildId}
            onSelect={setSelectedChildId}
          />
        </View>
      )}

      {!isPendingMode && (
        <View style={styles.filterSection}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) => handleDateChange(date, endDate)}
            onEndDateChange={(date) => handleDateChange(startDate, date)}
            onTodayPress={handleTodayPress}
          />
        </View>
      )}
      {isPendingMode && dateFilterManuallyChanged && (
        <View style={styles.filterSection}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) => handleDateChange(date, endDate)}
            onEndDateChange={(date) => handleDateChange(startDate, date)}
            onTodayPress={handleTodayPress}
          />
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <EmptyState 
        message={
          isPendingMode 
            ? (dateFilterManuallyChanged 
                ? "No pending homework for selected date range." 
                : "No pending homework.")
            : "No homework assigned for selected date range."
        } 
      />
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
        data={homework}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={homework.length === 0 ? styles.emptyListContent : styles.listContent}
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
  headerTitle: {
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
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  filterBannerText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
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
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    lineHeight: 24,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b', // Amber - Pending/Upcoming
    marginRight: 8,
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444', // Red - Overdue/Alert
    marginRight: 8,
  },
  overdueText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  completedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
    borderWidth: 1.5,
    borderColor: '#10b981', // Green - Success/Completed
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  completedCheckmark: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },
  completedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  completedText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subjectBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    marginBottom: 12,
  },
  subjectText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 22,
  },
  dateContainer: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  attachmentLink: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  attachmentText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
});



