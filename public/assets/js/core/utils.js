// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// DOM Helpers
const DOM = {
  id: (id) => document.getElementById(id),
  class: (className) => document.querySelectorAll('.' + className),
  query: (selector) => document.querySelector(selector),
  queryAll: (selector) => document.querySelectorAll(selector),
  create: (tag, classes = '') => {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    return el;
  },
  remove: (el) => el?.remove(),
  hide: (el) => el?.classList.add('hidden'),
  show: (el) => el?.classList.remove('hidden'),
  toggle: (el, className) => el?.classList.toggle(className),
  addClass: (el, className) => el?.classList.add(className),
  removeClass: (el, className) => el?.classList.remove(className),
  hasClass: (el, className) => el?.classList.contains(className),
  setText: (el, text) => { if (el) el.textContent = text; },
  setHTML: (el, html) => { if (el) el.innerHTML = html; },
  on: (el, event, handler) => el?.addEventListener(event, handler),
  off: (el, event, handler) => el?.removeEventListener(event, handler),
  attr: (el, name, value) => {
    if (value === undefined) return el?.getAttribute(name);
    el?.setAttribute(name, value);
  },
};

// Toast Notifications
const Toast = {
  show: (message, type = 'info', duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  success: (message) => Toast.show(message, 'success'),
  error: (message) => Toast.show(message, 'error'),
  warning: (message) => Toast.show(message, 'warning'),
  info: (message) => Toast.show(message, 'info'),
};

// Validation
const Validator = {
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  
  password: (password) => {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[0-9]/.test(password) &&
           /[!@#$%^&*]/.test(password);
  },
  
  roomCode: (code) => /^[A-Z0-9]{6}$/.test(code),
  
  username: (username) => username.length >= 3 && username.length <= 50,
  
  required: (value) => value?.toString().trim().length > 0,
};

// API Helper
const API = {
  supabase: () => window.SUPABASE.client(),
  
  getCurrentUser: async () => {
    try {
      const { data: { user } } = await API.supabase().auth.getUser();
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  },
  
  getUserProfile: async (userId) => {
    try {
      const { data, error } = await API.supabase()
        .from('users_info')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  },
  
  logout: async () => {
    try {
      await API.supabase().auth.signOut();
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
};

// Storage
const Storage = {
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  
  get: (key) => {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  remove: (key) => sessionStorage.removeItem(key),
  
  clear: () => sessionStorage.clear(),
};

// Password Strength Indicator
const PasswordStrength = {
  calculate: (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    
    return {
      score: strength,
      level: strength <= 2 ? 'Weak' : strength <= 4 ? 'Medium' : 'Strong',
      color: strength <= 2 ? '#ef4444' : strength <= 4 ? '#f59e0b' : '#22c55e'
    };
  },
  
  update: (inputId, displayId) => {
    const input = DOM.id(inputId);
    const display = DOM.id(displayId);
    
    if (input && display) {
      const strength = PasswordStrength.calculate(input.value);
      DOM.setText(display, strength.level);
      display.style.color = strength.color;
    }
  }
};

// Time Helpers
const TimeHelper = {
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },
  
  formatTime: (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  formatDateTime: (date) => {
    return `${TimeHelper.formatDate(date)} ${TimeHelper.formatTime(date)}`;
  },
  
  isOverdue: (dueDate) => new Date(dueDate) < new Date(),
  
  daysUntil: (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
  try {
    await navigator.clipboard.writeText(text);
    Toast.success('Copied to clipboard!');
  } catch (error) {
    Toast.error('Failed to copy');
  }
};

console.log('? Utilities loaded');