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
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.badgeContainer}>
            {!item.isRead && (
              <View style={styles.newBadge}>
                <Text style={styles.badgeText}>New</Text>
              </View>
            )}
            {item.priority === 'urgent' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.badgeText}>Urgent</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.message}>{item.message}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            From: {item.senderName} ({item.senderRole})
          </Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>
            {format(new Date(item.createdAt), 'MMM d, yyyy, h:mm a')}
          </Text>
        </View>
        {item.attachmentUrl && (
          <TouchableOpacity
            onPress={() => Linking.openURL(item.attachmentUrl!)}
            style={styles.attachmentLink}
          >
            <Text style={styles.attachmentText}>View Attachment →</Text>
          </TouchableOpacity>
        )}
      </View>
      {!item.isRead && (
        <TouchableOpacity
          style={styles.markReadButton}
          onPress={() => handleMarkRead(item.id)}
        >
          <Text style={styles.markReadText}>Mark Read</Text>
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
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ChildSelector
        children={children}
        selectedChildId={selectedChildId}
        onSelect={setSelectedChildId}
      />

      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <EmptyState message="No notifications." />
      ) : (
        <FlatList
          data={notifications}
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
  headerTitle: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  newBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  attachmentLink: {
    marginTop: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  markReadButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  markReadText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});

