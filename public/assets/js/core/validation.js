// ==========================================
// FORM VALIDATION
// ==========================================

const FormValidator = {
  validateEmail: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  validatePassword: (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain number';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must contain special character';
    return null;
  },

  validateUsername: (username) => {
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 50) return 'Username must be less than 50 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username can only contain letters, numbers, - and _';
    return null;
  },

  validateRoomCode: (code) => {
    if (!code || code.length !== 6) return 'Room code must be exactly 6 characters';
    if (!/^[A-Z0-9]+$/.test(code)) return 'Room code must be uppercase letters and numbers';
    return null;
  },

  validateForm: (formData, rules) => {
    const errors = {};
    
    for (const [field, value] of Object.entries(formData)) {
      if (rules[field]) {
        const error = rules[field](value);
        if (error) errors[field] = error;
      }
    }
    
    return Object.keys(errors).length === 0 ? null : errors;
  },

  showErrors: (errors, formId) => {
    const form = DOM.id(formId);
    if (!form) return;
    
    // Clear previous errors
    form.querySelectorAll('.form-error').forEach(el => el.remove());
    
    // Show new errors
    for (const [field, message] of Object.entries(errors)) {
      const input = form.querySelector(`[name="${field}"], [id="${field}"]`);
      if (input) {
        const errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.textContent = message;
        input.parentNode.appendChild(errorEl);
        input.style.borderColor = '#ef4444';
      }
    }
  },

  clearErrors: (formId) => {
    const form = DOM.id(formId);
    if (!form) return;
    
    form.querySelectorAll('.form-error').forEach(el => el.remove());
    form.querySelectorAll('input, select, textarea').forEach(input => {
      input.style.borderColor = '';
    });
  }
};

console.log('? Validation loaded');