import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { notificationsApi, parentsApi } from "@/lib/api";
import { toast } from "sonner";

export function UnifiedHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCountRef = useRef(0);
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fetch notifications for admin/teacher
  useEffect(() => {
    if (user?.role === 'parent') {
      return; // Parents handled separately
    }

    const fetchUnreadCount = async () => {
      try {
        const notifications = await notificationsApi.getInbox();
        const unread = notifications.filter(n => !n.read);
        const newCount = unread.length;
        
        // Check if there are new notifications (count increased)
        if (newCount > previousUnreadCountRef.current && !isInitialLoadRef.current) {
          // Find the newest notification
          const newestNotification = unread.sort((a, b) => 
            new Date(b.time).getTime() - new Date(a.time).getTime()
          )[0];
          
          // Only show toast if it's a different notification than last time
          if (newestNotification && newestNotification.id !== lastNotificationIdRef.current) {
            toast.info("New Notification", {
              description: `${newestNotification.title}${newestNotification.sender ? ` - From: ${newestNotification.sender}` : ''}`,
              action: {
                label: "View",
                onClick: () => navigate('/dashboard/notifications')
              },
              duration: 5000,
            });
            lastNotificationIdRef.current = newestNotification.id;
          }
        }
        
        previousUnreadCountRef.current = newCount;
        setUnreadCount(newCount);
        isInitialLoadRef.current = false;
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    
    // Listen for notification read events
    const handleNotificationRead = () => {
      fetchUnreadCount();
    };
    
    window.addEventListener('notification-read', handleNotificationRead);
    
    // Refresh count when navigating to/from notifications page
    const interval = setInterval(fetchUnreadCount, 5000); // Refresh every 5 seconds
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-read', handleNotificationRead);
    };
  }, [location.pathname, user?.role, navigate]);

  // Fetch notifications for parents
  useEffect(() => {
    if (user?.role !== 'parent') {
      return;
    }

    const fetchParentNotifications = async () => {
      try {
        // Get all children
        const children = await parentsApi.getChildren();
        
        // Get notifications for all children
        let totalUnread = 0;
        let newestNotification: any = null;
        
        for (const child of children) {
          try {
            const notifications = await parentsApi.getChildNotifications(child.id);
            const unread = notifications.filter(n => !n.isRead);
            totalUnread += unread.length;
            
            // Track newest notification
            if (unread.length > 0) {
              const childNewest = unread.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0];
              
              if (!newestNotification || 
                  new Date(childNewest.createdAt) > new Date(newestNotification.createdAt)) {
                newestNotification = childNewest;
              }
            }
          } catch (error) {
            console.error(`Error fetching notifications for child ${child.id}:`, error);
          }
        }
        
        // Show toast if new notification found
        if (newestNotification && 
            newestNotification.id !== lastNotificationIdRef.current && 
            !isInitialLoadRef.current) {
          toast.info("New Notification", {
            description: `${newestNotification.title}${newestNotification.senderName ? ` - From: ${newestNotification.senderName}` : ''}`,
            action: {
              label: "View",
              onClick: () => navigate('/parent/dashboard/notifications')
            },
            duration: 5000,
          });
          lastNotificationIdRef.current = newestNotification.id;
        }
        
        setUnreadCount(totalUnread);
        isInitialLoadRef.current = false;
      } catch (error) {
        console.error('Error fetching parent notifications:', error);
      }
    };

    fetchParentNotifications();
    const interval = setInterval(fetchParentNotifications, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [user?.role, navigate]);

  const handleNotificationClick = () => {
    navigate('/dashboard/notifications');
  };

  // Parent header with notifications
  if (user?.role === 'parent') {
    return (
      <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-end px-6">
        <div className="flex items-center gap-4">
          {/* Notifications for parents */}
          <button 
            onClick={() => navigate('/parent/dashboard/notifications')}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-medium text-primary-foreground">
                {user?.name.charAt(0)}
              </span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-end px-6">
      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button 
          onClick={handleNotificationClick}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>

        {/* Role Badge */}
        <Badge variant="outline" className="font-medium">
          {user?.role === "admin" ? "School Admin" : "Class Teacher"}
        </Badge>

        {/* User Avatar */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              {user?.name.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
