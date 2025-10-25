// utility.js - Helper functions and utilities
const Utils = {
  // DOM helpers
  dom: {
    id: (id) => document.getElementById(id),
    query: (sel) => document.querySelector(sel),
    queryAll: (sel) => document.querySelectorAll(sel),
    on: (el, evt, fn) => el?.addEventListener(evt, fn),
    off: (el, evt, fn) => el?.removeEventListener(evt, fn),
    hide: (el) => el?.classList.add('hidden'),
    show: (el) => el?.classList.remove('hidden'),
    setText: (el, txt) => { if (el) el.textContent = txt; },
    setHTML: (el, html) => { if (el) el.innerHTML = html; }
  },

  // API helpers
  api: {
    getCurrentUser: async () => {
      const supabase = window.SUPABASE?.client?.();
      if (!supabase) return null;
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },

    getUserProfile: async (userId) => {
      const supabase = window.SUPABASE?.client?.();
      if (!supabase) return null;
      const { data } = await supabase
        .from('users_info')
        .select('*')
        .eq('id', userId)
        .single();
      return data;
    },

    checkAuth: async () => {
      const user = await Utils.api.getCurrentUser();
      if (!user) {
        window.location.href = '/login.html';
        return null;
      }
      const profile = await Utils.api.getUserProfile(user.id);
      if (!profile) {
        await window.SUPABASE?.client?.().auth.signOut();
        window.location.href = '/login.html';
        return null;
      }
      return { user, profile };
    }
  },

  // Time helpers
  time: {
    formatDate: (date) => new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    formatDateTime: (date) => new Date(date).toLocaleString('en-US'),
    isOverdue: (dueDate) => new Date(dueDate) < new Date(),
    daysUntil: (dueDate) => {
      const diff = new Date(dueDate) - new Date();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
  },

  // Storage helpers
  storage: {
    set: (key, val) => sessionStorage.setItem(key, JSON.stringify(val)),
    get: (key) => {
      const val = sessionStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    },
    remove: (key) => sessionStorage.removeItem(key),
    clear: () => sessionStorage.clear()
  }
};

console.log('? Utilities loaded');
