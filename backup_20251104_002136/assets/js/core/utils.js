// ==========================================
// UTILITY FUNCTIONS (UNIFIED - FINAL)
// ==========================================

// DOM Helpers
const DOM = {
  id: (id) => document.getElementById(id),
  query: (selector) => document.querySelector(selector),
  queryAll: (selector) => document.querySelectorAll(selector),
  hide: (el) => el?.classList.add('hidden'),
  show: (el) => el?.classList.remove('hidden'),
  addClass: (el, className) => el?.classList.add(className),
  removeClass: (el, className) => el?.classList.remove(className),
  setText: (el, text) => { if (el) el.textContent = text; },
  setHTML: (el, html) => { if (el) el.innerHTML = html; },
  on: (el, event, handler) => el?.addEventListener(event, handler),
};

// Toast Notifications
const Toast = {
  show: (message, type = 'info', duration = 3500) => {
    document.querySelectorAll('.toast').forEach(t => t.remove()); // Clear previous toasts
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duration);
  },
  success: (message) => Toast.show(message, 'success'),
  error: (message) => Toast.show(message, 'error'),
  warning: (message) => Toast.show(message, 'warning'),
  info: (message) => Toast.show(message, 'info'),
};

// API Helper
const API = {
  supabase: () => window.SUPABASE?.client?.(), // Use optional chaining
  
  getCurrentUser: async () => {
    const supabase = API.supabase();
    if (!supabase) return null; // Check if supabase client exists
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      // Don't redirect here, let pages handle unauthorized access
      return null;
    }
  },
  
  getUserProfile: async (userId) => {
    const supabase = API.supabase();
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('users_info')
        .select('*')
        .eq('id', userId)
        .single(); // Use single() for one expected row
      
      if (error && error.code !== 'PGRST116') { // Ignore "No rows found" error code
          throw error;
      }
      return data; // Returns null if no profile found, handled by callers
    } catch (error) {
      console.error('Get profile error:', error);
      Toast.error('Could not fetch user profile.');
      return null;
    }
  },
};

// Time Helpers
const TimeHelper = {
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { // Use en-GB for dd/mm/yyyy
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) { return 'Invalid Date'; }
  },
  formatDateTime: (dateString) => {
      if (!dateString) return 'N/A';
      try {
          return new Date(dateString).toLocaleString('en-GB'); // Locale-sensitive date and time
      } catch(e) { return 'Invalid Date'; }
  },
  isOverdue: (dueDate) => dueDate && new Date(dueDate) < new Date().setHours(0,0,0,0), // Compare dates only
};

// Password Strength Calculator
const PasswordStrength = {
    calculate: (password) => {
        let strength = 0;
        if (!password) return { level: 'Required', color: '#ef4444' };
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++; // Broader special chars
        
        const levels = [
            { level: 'Very Weak', color: '#ef4444' }, // 0 points
            { level: 'Weak', color: '#f97316' },      // 1 point
            { level: 'Medium', color: '#f59e0b' },    // 2 points
            { level: 'Strong', color: '#84cc16' },    // 3 points
            { level: 'Very Strong', color: '#22c55e'} // 4 points
        ];
        return levels[strength];
    },
    updateIndicator: (inputId, displayId) => {
        const input = DOM.id(inputId);
        const display = DOM.id(displayId);
        if (input && display) {
            const strength = PasswordStrength.calculate(input.value);
            display.textContent = strength.level;
            display.style.color = strength.color;
        }
    }
};

// Debounce Helper
const debounce = (func, delay) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

// Copy to Clipboard
const copyToClipboard = async (text) => {
  if (!navigator.clipboard) {
      Toast.error('Clipboard API not available.'); // Fallback for older browsers might be needed
      return;
  }
  try {
    await navigator.clipboard.writeText(text);
    Toast.success('Copied to clipboard!');
  } catch (error) {
    console.error('Copy error:', error);
    Toast.error('Failed to copy text.');
  }
};

console.log('? Utilities loaded');

// Add CSS for toast animation (if not already included)
(function addToastStyles() {
    if (document.getElementById('toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      .toast {
        position: fixed; bottom: 20px; right: 20px; padding: 1rem 1.5rem;
        border-radius: 8px; color: var(--text-primary); font-weight: 600;
        z-index: 2000; border-left: 4px solid var(--primary-color);
        background: var(--bg-light); box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: toastSlideIn 0.3s ease-out;
      }
      .toast.success { border-left-color: var(--success-color); }
      .toast.error { border-left-color: var(--danger-color); }
      .toast.warning { border-left-color: var(--warning-color); }
      @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
})();