import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';

interface TestDetailParams {
  testId: string;
  testName: string;
  testDate: string;
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    marksObtained: number;
    maxMarks: number;
    percentage: string;
  }>;
}

export function TestDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as TestDetailParams;
  const { testName, testDate, subjects } = params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>📊</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Test Details</Text>
            <Text style={styles.headerSubtitle}>Subject-wise breakdown</Text>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: '#3b82f6' }]} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.testInfoCard}>
          <Text style={styles.testName}>{testName}</Text>
          <Text style={styles.testDate}>
            {format(new Date(testDate), 'MMMM d, yyyy')}
          </Text>
        </View>

        <View style={styles.subjectsSection}>
          <Text style={styles.sectionTitle}>Subject-wise Results</Text>
          <View style={styles.subjectsList}>
            {subjects.map((subject, index) => (
              <View key={index} style={styles.subjectRow}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                  <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
                </View>
                <View style={styles.subjectMarks}>
                  <Text style={styles.marksText}>
                    {subject.marksObtained} / {subject.maxMarks}
                  </Text>
                  <Text style={styles.percentageText}>{subject.percentage}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
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
    fontWeight: '600',
    color: '#111827',
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
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  testInfoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  testName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  testDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  subjectsSection: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  subjectsList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subjectCode: {
    fontSize: 13,
    color: '#9ca3af',
  },
  subjectMarks: {
    alignItems: 'flex-end',
  },
  marksText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  percentageText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
});

