import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { parentsApi, Notification, Child } from '../config/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ChildSelector } from '../components/ChildSelector';
import { format } from 'date-fns';

export function NotificationsScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadNotifications();
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

  const loadNotifications = async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      const data = await parentsApi.getChildNotifications(selectedChildId);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await parentsApi.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <View
      style={[
        styles.card,
        !item.isRead && styles.cardUnread,
      ]}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.badgeContainer}>
              {!item.isRead && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              )}
              {item.priority === 'urgent' && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>Urgent</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.message}>{item.message}</Text>

        <View style={styles.metaContainer}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>From:</Text>
            <Text style={styles.metaValue}>
              {item.senderName} ({item.senderRole})
            </Text>
          </View>
          <Text style={styles.metaTime}>
            {format(new Date(item.createdAt), 'MMM d, yyyy • h:mm a')}
          </Text>
        </View>

        {item.attachmentUrl && (
          <TouchableOpacity
            onPress={() => Linking.openURL(item.attachmentUrl!)}
            style={styles.attachmentLink}
          >
            <Text style={styles.attachmentText}>📎 View Attachment</Text>
          </TouchableOpacity>
        )}

        {!item.isRead && (
          <TouchableOpacity
            style={styles.markReadButton}
            onPress={() => handleMarkRead(item.id)}
          >
            <Text style={styles.markReadText}>Mark as Read</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>🔔</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>Messages and updates for selected child</Text>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: '#ef4444' }]} />
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
      <EmptyState message="No notifications." />
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
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : styles.listContent}
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
  cardUnread: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  cardContent: {
    flex: 1,
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    lineHeight: 24,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  newBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  newBadgeText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  urgentBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  urgentBadgeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 22,
  },
  metaContainer: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  metaLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 4,
  },
  metaValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  metaTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
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
  markReadButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  markReadText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});



