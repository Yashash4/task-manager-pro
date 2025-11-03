// ==========================================
// UTILITY FUNCTIONS
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
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
      <i class="${icons[type] || icons.info}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => { 
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (message) => Toast.show(message, 'success'),
  error: (message) => Toast.show(message, 'error'),
  warning: (message) => Toast.show(message, 'warning'),
  info: (message) => Toast.show(message, 'info'),
};

// API Helper
const API = {
  supabase: () => window.SUPABASE?.client?.(),
  
  getCurrentUser: async () => {
    const supabase = API.supabase();
    if (!supabase) return null;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  },
  
  getUserProfile: async (userId) => {
    const supabase = API.supabase();
    if (!supabase || !userId) return null;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from('users_info')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        return data;
      } catch (error) {
        console.error('Get profile error:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    return null;
  },
};

// Time Helpers
const TimeHelper = {
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) { return 'Invalid Date'; }
  },
  formatDateTime: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-GB');
    } catch(e) { return 'Invalid Date'; }
  },
  isOverdue: (dueDate) => dueDate && new Date(dueDate) < new Date().setHours(0,0,0,0),
  daysUntil: (dueDate) => {
    const diff = new Date(dueDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
};

// Password Strength Calculator
const PasswordStrength = {
  calculate: (password) => {
    let strength = 0;
    if (!password) return { level: 'Required', color: '#ef4444' };
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    const levels = [
      { level: 'Very Weak', color: '#ef4444' },
      { level: 'Weak', color: '#f97316' },
      { level: 'Medium', color: '#f59e0b' },
      { level: 'Strong', color: '#84cc16' },
      { level: 'Very Strong', color: '#22c55e'}
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
    Toast.error('Clipboard API not available.');
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

console.log('✅ Utilities loaded');

// Add CSS for toast animation
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
      display: flex; align-items: center; gap: 0.75rem;
    }
    .toast i { font-size: 1.25rem; }
    .toast.success { border-left-color: var(--success-color); }
    .toast.success i { color: var(--success-color); }
    .toast.error { border-left-color: var(--danger-color); }
    .toast.error i { color: var(--danger-color); }
    .toast.warning { border-left-color: var(--warning-color); }
    .toast.warning i { color: var(--warning-color); }
    .toast.info { border-left-color: var(--info-color); }
    .toast.info i { color: var(--info-color); }
    @keyframes toastSlideIn { 
      from { transform: translateX(100%); opacity: 0; } 
      to { transform: translateX(0); opacity: 1; } 
    }
  `;
  document.head.appendChild(style);
})();
