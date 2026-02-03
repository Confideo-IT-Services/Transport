import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { notificationsApi } from "@/lib/api";

export function UnifiedHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Only fetch notifications for admin/teacher, not for parents
  useEffect(() => {
    if (user?.role === 'parent') {
      return; // Don't fetch notifications for parents
    }

    const fetchUnreadCount = async () => {
      try {
        const notifications = await notificationsApi.getInbox();
        const unread = notifications.filter(n => !n.read).length;
        setUnreadCount(unread);
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
  }, [location.pathname, user?.role]);

  const handleNotificationClick = () => {
    navigate('/dashboard/notifications');
  };

  // Don't show notification icon and role badge for parents
  if (user?.role === 'parent') {
    return (
      <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-end px-6">
        {/* Empty header for parents - just show user avatar if needed */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              {user?.name.charAt(0)}
            </span>
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
