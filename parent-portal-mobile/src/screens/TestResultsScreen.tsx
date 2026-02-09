import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, TestResult, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { format } from 'date-fns';

interface GroupedTestResult {
  testId: string;
  testName: string;
  testDate: string;
  totalMarksObtained: number;
  totalMaxMarks: number;
  overallPercentage: number;
  grade: string;
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    marksObtained: number;
    maxMarks: number;
    percentage: string;
  }>;
}

export function TestResultsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
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

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    return 'D';
  };

  const getGradeConfig = (grade: string) => {
    switch (grade) {
      case 'A+':
        return { bg: '#ecfdf5', textColor: '#047857', border: '#10b981' }; // Green - Success
      case 'A':
        return { bg: '#dbeafe', textColor: '#1e40af', border: '#3b82f6' }; // Blue - Info
      case 'B':
        return { bg: '#fffbeb', textColor: '#92400e', border: '#f59e0b' }; // Amber - Pending
      case 'C':
        return { bg: '#fef3c7', textColor: '#a16207', border: '#f59e0b' }; // Amber - Pending
      default:
        return { bg: '#fef2f2', textColor: '#b91c1c', border: '#ef4444' }; // Red - Alert
    }
  };

  const groupedTestResults = useMemo(() => {
    const grouped = new Map<string, GroupedTestResult>();

    testResults.forEach((result) => {
      const existing = grouped.get(result.testId);
      
      if (existing) {
        existing.totalMarksObtained += result.marksObtained;
        existing.totalMaxMarks += result.maxMarks;
        existing.subjects.push({
          subjectName: result.subjectName,
          subjectCode: result.subjectCode,
          marksObtained: result.marksObtained,
          maxMarks: result.maxMarks,
          percentage: result.percentage,
        });
      } else {
        grouped.set(result.testId, {
          testId: result.testId,
          testName: result.testName,
          testDate: result.testDate,
          totalMarksObtained: result.marksObtained,
          totalMaxMarks: result.maxMarks,
          overallPercentage: 0, // Will be recalculated
          grade: '', // Will be recalculated
          subjects: [{
            subjectName: result.subjectName,
            subjectCode: result.subjectCode,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            percentage: result.percentage,
          }],
        });
      }
    });

    // Recalculate overall percentage and grade after aggregation
    const groupedArray = Array.from(grouped.values()).map((test) => {
      const overallPercentage = (test.totalMarksObtained / test.totalMaxMarks) * 100;
      return {
        ...test,
        overallPercentage,
        grade: calculateGrade(overallPercentage),
      };
    });

    // Sort by test date descending (newest first)
    return groupedArray.sort((a, b) => 
      new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
    );
  }, [testResults]);

  const handleCardPress = (test: GroupedTestResult) => {
    (navigation as any).navigate('TestDetail', {
      testId: test.testId,
      testName: test.testName,
      testDate: test.testDate,
      subjects: test.subjects,
    });
  };

  const renderItem = ({ item }: { item: GroupedTestResult }) => {
    const gradeConfig = getGradeConfig(item.grade);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardMain}>
            <Text style={styles.testName}>{item.testName}</Text>
            <View style={styles.marksRow}>
              <Text style={styles.marks}>
                {item.totalMarksObtained} / {item.totalMaxMarks}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.percentage}>
                {item.overallPercentage.toFixed(1)}%
              </Text>
              <View
                style={[
                  styles.gradeBadge,
                  {
                    backgroundColor: gradeConfig.bg,
                    borderColor: gradeConfig.border,
                  },
                ]}
              >
                <Text style={[styles.gradeText, { color: gradeConfig.textColor }]}>
                  Grade: {item.grade}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.testDate}>
          {format(new Date(item.testDate), 'MMM d, yyyy')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>📊</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Test Results</Text>
            <Text style={styles.headerSubtitle}>Performance overview for selected child</Text>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: '#3b82f6' }]} />
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
      <EmptyState message="No test results found." />
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
        data={groupedTestResults}
        renderItem={renderItem}
        keyExtractor={(item) => item.testId}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={groupedTestResults.length === 0 ? styles.emptyListContent : styles.listContent}
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
  },
  cardContent: {
    marginBottom: 12,
  },
  cardMain: {
    marginBottom: 8,
  },
  testName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 24,
  },
  marksRow: {
    marginBottom: 10,
  },
  marks: {
    fontSize: 26,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  percentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  testDate: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
});



