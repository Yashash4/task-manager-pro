// ==========================================
// ENHANCED NOTIFICATION SYSTEM
// Path: /public/assets/js/core/notifications.js
// ==========================================

const NotificationSystem = {
  container: null,
  notificationPanel: null,
  notificationBadge: null,
  unreadCount: 0,
  notifications: [],

  // Initialize notification system
  init() {
    this.createContainer();
    this.createNotificationPanel();
    this.setupEventListeners();
    this.loadNotifications();
    
    console.log('✅ Notification system initialized');
  },

  // Create toast container
  createContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
      this.container = container;
    } else {
      this.container = document.getElementById('toast-container');
    }
  },

  // Create notification panel
  createNotificationPanel() {
    const panel = document.createElement('div');
    panel.id = 'notification-panel';
    panel.className = 'notification-panel hidden';
    panel.innerHTML = `
      <div class="notification-panel-header">
        <h3>Notifications</h3>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-icon btn-sm" onclick="NotificationSystem.markAllAsRead()" title="Mark all as read">
            <i class="fas fa-check-double"></i>
          </button>
          <button class="btn-icon btn-sm" onclick="NotificationSystem.closePanel()" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="notification-panel-body" id="notification-panel-body">
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      </div>
      <div class="notification-panel-footer">
        <a href="#" onclick="NotificationSystem.viewAll(); return false;" class="text-primary">View All Notifications</a>
      </div>
    `;
    document.body.appendChild(panel);
    this.notificationPanel = panel;
  },

  // Setup event listeners
  setupEventListeners() {
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.notificationPanel && 
          !this.notificationPanel.contains(e.target) && 
          !e.target.closest('.notification-badge')) {
        this.closePanel();
      }
    });

    // Setup notification badge click
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      this.notificationBadge = badge;
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });
    }
  },

  // Toggle notification panel
  togglePanel() {
    if (this.notificationPanel) {
      this.notificationPanel.classList.toggle('hidden');
      if (!this.notificationPanel.classList.contains('hidden')) {
        this.loadNotifications();
      }
    }
  },

  // Close notification panel
  closePanel() {
    if (this.notificationPanel) {
      this.notificationPanel.classList.add('hidden');
    }
  },

  // Load notifications from database
  async loadNotifications() {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    try {
      const user = await API.getCurrentUser();
      if (!user) return;

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      this.notifications = notifications || [];
      this.updateUnreadCount();
      this.renderNotifications();
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  },

  // Update unread count
  updateUnreadCount() {
    this.unreadCount = this.notifications.filter(n => !n.is_read).length;
    if (this.notificationBadge) {
      this.notificationBadge.setAttribute('data-count', this.unreadCount);
    }
  },

  // Render notifications in panel
  renderNotifications() {
    const body = document.getElementById('notification-panel-body');
    if (!body) return;

    if (this.notifications.length === 0) {
      body.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    body.innerHTML = this.notifications.map(notif => {
      const iconClass = this.getNotificationIcon(notif.type);
      const timeAgo = this.getTimeAgo(notif.created_at);
      
      return `
        <div class="notification-item ${!notif.is_read ? 'unread' : ''}" 
             onclick="NotificationSystem.handleNotificationClick('${notif.id}')"
             data-notif-id="${notif.id}">
          <div class="notification-icon ${iconClass.type}">
            <i class="${iconClass.icon}"></i>
          </div>
          <div class="notification-content">
            <div class="notification-title">${this.getNotificationTitle(notif.type)}</div>
            <div class="notification-message">${notif.message}</div>
            <div class="notification-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Get notification icon based on type
  getNotificationIcon(type) {
    const icons = {
      task_assigned: { icon: 'fas fa-tasks', type: 'info' },
      task_approved: { icon: 'fas fa-check-circle', type: 'success' },
      task_rejected: { icon: 'fas fa-times-circle', type: 'error' },
      task_updated: { icon: 'fas fa-edit', type: 'warning' },
      user_approved: { icon: 'fas fa-user-check', type: 'success' },
      user_rejected: { icon: 'fas fa-user-times', type: 'error' },
      approval_request: { icon: 'fas fa-user-clock', type: 'warning' }
    };
    return icons[type] || { icon: 'fas fa-bell', type: 'info' };
  },

  // Get notification title
  getNotificationTitle(type) {
    const titles = {
      task_assigned: 'New Task Assigned',
      task_approved: 'Task Approved',
      task_rejected: 'Task Rejected',
      task_updated: 'Task Updated',
      user_approved: 'Account Approved',
      user_rejected: 'Account Rejected',
      approval_request: 'Approval Request'
    };
    return titles[type] || 'Notification';
  },

  // Handle notification click
  async handleNotificationClick(notifId) {
    await this.markAsRead(notifId);
    
    // Find notification and handle action
    const notif = this.notifications.find(n => n.id === notifId);
    if (notif && notif.task_id) {
      // Navigate to task details
      window.location.href = `/tasks.html?id=${notif.task_id}`;
    }
  },

  // Mark notification as read
  async markAsRead(notifId) {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) throw error;

      // Update local state
      const notif = this.notifications.find(n => n.id === notifId);
      if (notif) {
        notif.is_read = true;
        this.updateUnreadCount();
        this.renderNotifications();
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  // Mark all notifications as read
  async markAllAsRead() {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    try {
      const user = await API.getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      this.notifications.forEach(n => n.is_read = true);
      this.updateUnreadCount();
      this.renderNotifications();

      Toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Mark all as read error:', error);
      Toast.error('Failed to mark all as read');
    }
  },

  // View all notifications page
  viewAll() {
    window.location.href = '/user/notifications.html';
  },

  // Show toast notification
  showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type} fade-in`;
    
    const iconMap = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
      <i class="${iconMap[type]}"></i>
      <span>${message}</span>
    `;
    
    this.container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Create notification in database
  async createNotification(userId, taskId, type, message) {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          task_id: taskId,
          type: type,
          message: message,
          is_read: false
        }]);

      if (error) throw error;

      // Reload notifications if panel is open
      if (this.notificationPanel && !this.notificationPanel.classList.contains('hidden')) {
        await this.loadNotifications();
      }
    } catch (error) {
      console.error('Create notification error:', error);
    }
  },

  // Get time ago format
  getTimeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return new Date(dateString).toLocaleDateString();
  },

  // Setup real-time notifications (polling)
  startPolling(interval = 30000) {
    setInterval(() => {
      this.loadNotifications();
    }, interval);
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  NotificationSystem.init();
  NotificationSystem.startPolling();
});

console.log('✅ Notification system loaded');