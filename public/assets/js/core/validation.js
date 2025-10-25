// ==========================================
// FORM VALIDATION (FINAL)
// ==========================================

const FormValidator = {
  validateEmail: (email) => {
    if (!email?.trim()) return 'Email is required.';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) return 'Invalid email format.';
    return null;
  },

  validatePassword: (password) => {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    // Removed specific char requirements for simplicity, adjust if needed
    // if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    // if (!/[0-9]/.test(password)) return 'Password must contain a number.';
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain a special character.';
    return null;
  },

  validateUsername: (username) => {
    if (!username?.trim()) return 'Username is required.';
    if (username.length < 3) return 'Username must be at least 3 characters.';
    if (username.length > 50) return 'Username must be less than 50 characters.';
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username can only contain letters, numbers, hyphens, and underscores.';
    return null;
  },
  
  validateRoomCode: (code) => {
    if (!code?.trim()) return 'Organization code is required.';
    if (code.length !== 6) return 'Organization code must be exactly 6 characters.';
    if (!/^[A-Z0-9]+$/.test(code)) return 'Organization code must be uppercase letters and numbers only.';
    return null;
  },

  // Generic function to run multiple validations on form data
  validateForm: (formData, rules) => {
    const errors = {};
    for (const [field, ruleFn] of Object.entries(rules)) {
      const value = formData[field];
      const error = ruleFn(value);
      if (error) {
        errors[field] = error;
      }
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },

  // Clear visual error states from a form
  clearErrors: (formId) => {
    const form = DOM.id(formId);
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(input => {
      input.style.borderColor = ''; // Reset border color
    });
    // Remove any previously added error messages (if applicable)
  }
};

console.log('? Validation loaded');