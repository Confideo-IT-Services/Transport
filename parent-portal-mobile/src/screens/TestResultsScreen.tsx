import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, TestResult, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { format } from 'date-fns';

export function TestResultsScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadTestResults();
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

  const loadTestResults = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const data = await parentsApi.getChildTestResults(selectedChildId);
      setTestResults(data);
    } catch (error) {
      console.error('Failed to load test results:', error);
      setTestResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceBadge = (percentage: string) => {
    const percent = parseFloat(percentage);
    if (percent >= 80) {
      return { text: 'Excellent', color: '#10b981' };
    } else if (percent >= 60) {
      return { text: 'Good', color: '#f59e0b' };
    } else {
      return { text: 'Needs Improvement', color: '#ef4444' };
    }
  };

  const renderItem = ({ item }: { item: TestResult }) => {
    const performance = getPerformanceBadge(item.percentage);
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.testName}>{item.testName}</Text>
          <Text style={styles.subject}>
            {item.subjectName} ({item.subjectCode})
          </Text>
          <Text style={styles.date}>
            Date: {format(new Date(item.testDate), 'MMMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.marks}>
            {item.marksObtained} / {item.maxMarks}
          </Text>
          <Text style={styles.percentage}>{item.percentage}%</Text>
          <View
            style={[
              styles.performanceBadge,
              { backgroundColor: performance.color },
            ]}
          >
            <Text style={styles.performanceText}>{performance.text}</Text>
          </View>
        </View>
      </View>
    );
  };

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
        <Text style={styles.title}>Test Results</Text>
      </View>

      <ChildSelector
        children={children}
        selectedChildId={selectedChildId}
        onSelect={setSelectedChildId}
      />

      {loading ? (
        <LoadingSpinner />
      ) : testResults.length === 0 ? (
        <EmptyState message="No test results found." />
      ) : (
        <FlatList
          data={testResults}
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
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subject: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  marks: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 8,
  },
  performanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  performanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

