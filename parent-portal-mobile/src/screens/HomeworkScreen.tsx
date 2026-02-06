import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, Homework, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { DateRangePicker } from '../components/DateRangePicker';
import { format } from 'date-fns';

export function HomeworkScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [allHomework, setAllHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadHomework();
    }
  }, [selectedChildId]);

  useEffect(() => {
    filterHomework();
  }, [allHomework, startDate, endDate]);

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
      const hwDate = hw.dueDate || hw.createdAt;
      if (!hwDate) return true;
      const hwDateStr = new Date(hwDate).toISOString().split('T')[0];
      return hwDateStr >= startDate && hwDateStr <= endDate;
    });
    setHomework(filtered);
  };

  const handleTodayPress = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const renderItem = ({ item }: { item: Homework }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        {item.isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
      </View>
      {item.subject && (
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectText}>{item.subject}</Text>
        </View>
      )}
      {item.description && (
        <Text style={styles.description}>{item.description}</Text>
      )}
      {item.dueDate && (
        <Text style={styles.date}>
          Due: {format(new Date(item.dueDate), 'EEEE, MMMM d, yyyy')}
        </Text>
      )}
      {item.createdAt && (
        <Text style={styles.date}>
          Assigned: {format(new Date(item.createdAt), 'EEEE, MMMM d, yyyy')}
        </Text>
      )}
      {item.attachmentUrl && (
        <TouchableOpacity
          onPress={() => Linking.openURL(item.attachmentUrl!)}
          style={styles.attachmentLink}
        >
          <Text style={styles.attachmentText}>View Attachment →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && children.length === 0) {
    return <LoadingSpinner />;
  }

  if (children.length === 0) {
    return (
      <EmptyState message="No children found. Please contact the school if you believe this is an error." />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Homework Assignments</Text>
      </View>

      <ChildSelector
        children={children}
        selectedChildId={selectedChildId}
        onSelect={setSelectedChildId}
      />

      <View style={styles.section}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onTodayPress={handleTodayPress}
        />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : homework.length === 0 ? (
        <EmptyState message="No homework assigned for selected date range." />
      ) : (
        <FlatList
          data={homework}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  subjectBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 12,
    color: '#374151',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  attachmentLink: {
    marginTop: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
});

