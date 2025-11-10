// ==========================================
// AUTHENTICATION HANDLER - UPSERT FIXED VERSION
// ==========================================

(function () {
  'use strict';

  const Validator = window.Validator || {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  };

  const Toast = window.Toast || {
    success: (msg) => showBrowserToast(msg, 'success'),
    error: (msg) => showBrowserToast(msg, 'error'),
    info: (msg) => showBrowserToast(msg, 'info'),
  };

  function showBrowserToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: sans-serif;
      font-size: 14px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  const FormValidator = {
    validatePassword: (v) => {
      if (!v || v.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(v)) return 'Password must contain uppercase letter';
      if (!/[0-9]/.test(v)) return 'Password must contain number';
      if (!/[!@#$%^&*]/.test(v)) return 'Password must contain special character';
      return null;
    },
    validateUsername: (v) => {
      if (!v) return 'Username is required';
      if (v.length < 3) return 'Username must be at least 3 characters';
      if (!/^[\w-]+$/.test(v)) return 'Username contains invalid characters';
      return null;
    },
    validateForm: (data, validators) => {
      const errors = {};
      for (const key of Object.keys(validators)) {
        const validatorFn = validators[key];
        const val = data[key];
        const err = validatorFn(val);
        if (err) errors[key] = err;
      }
      return Object.keys(errors).length ? errors : null;
    },
    showErrors: (errors, formId) => {
      const form = document.getElementById(formId);
      if (!form) return;
      form.querySelectorAll('.form-error').forEach(el => el.remove());
      for (const [name, message] of Object.entries(errors)) {
        const input = form.querySelector(`[name="${name}"], #${name}`);
        if (input) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'form-error';
          errorDiv.style.cssText = 'color: #ef4444; font-size: 0.85rem; margin-top: 0.25rem;';
          errorDiv.textContent = message;
          input.parentElement.appendChild(errorDiv);
          input.style.borderColor = '#ef4444';
        }
      }
    }
  };

  const getById = (id) => document.getElementById(id);
  const supabase = window.SUPABASE?.client?.();

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    return;
  }

  // ========== LOGIN HANDLER ==========
  const loginForm = getById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim?.() || '';
      const password = getById('password')?.value?.trim?.() || '';

      if (!email || !password) return Toast.error('Please fill in all fields');
      if (!Validator.email(email)) return Toast.error('Please enter a valid email');

      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        let profile = null;
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabase.from('users_info').select('*').eq('id', user.id).maybeSingle();
          if (!error && data) {
            profile = data;
            break;
          }
          if (i < 4) await new Promise(r => setTimeout(r, 500));
        }

        if (!profile) {
          await supabase.auth.signOut();
          throw new Error('Profile not found');
        }

        Toast.success('Login successful!');
        setTimeout(() => {
          if (profile.status === 'pending') {
            window.location.href = '/user/waiting-approval.html';
          } else if (profile.status === 'approved') {
            if (profile.role_flags?.includes('admin')) {
              window.location.href = '/admin/dashboard.html';
            } else {
              window.location.href = '/user/dashboard.html';
            }
          } else {
            alert('Account status: ' + profile.status);
            supabase.auth.signOut();
            window.location.href = '/auth/login.html';
          }
        }, 500);
      } catch (error) {
        Toast.error(error?.message || 'Login failed');
      }
    });
  }

  // ========== SIGNUP HANDLER (UPSERT FIXED) ==========
  const signupForm = getById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = getById('username')?.value?.trim?.() || '';
      const email = getById('email')?.value?.trim?.() || '';
      const password = getById('password')?.value?.trim?.() || '';
      const role = getById('role')?.value || '';
      const roomCode = getById('roomCode')?.value?.trim?.()?.toUpperCase?.() || '';
      const terms = getById('terms')?.checked;

      if (!username || !email || !password || !role) return Toast.error('Please fill in all required fields');
      if (!terms) return Toast.error('Please agree to Terms & Conditions');

      const errors = FormValidator.validateForm(
        { email, password, username },
        {
          email: (v) => (!Validator.email(v) ? 'Invalid email' : null),
          password: (v) => FormValidator.validatePassword(v),
          username: (v) => FormValidator.validateUsername(v)
        }
      );

      if (errors) {
        FormValidator.showErrors(errors, 'signupForm');
        return Toast.error('Please fix the errors in the form');
      }

      if (role === 'user' && (!roomCode || roomCode.length !== 6)) {
        Toast.error('Please enter a valid 6-character room code');
        return getById('roomCode')?.focus();
      }

      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, role } },
        });
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('No user returned from signup');

        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase.from('rooms').select('id, name').eq('current_code', roomCode).maybeSingle();
          if (roomErr || !room) throw new Error('Invalid room code. Please check and try again.');
          roomId = room.id;
        }

        const initialStatus = role === 'admin' ? 'approved' : 'pending';
        const initialApproved = role === 'admin' ? true : false;

        // ✅ UPSERT instead of INSERT
        const { error: upsertErr } = await supabase
          .from('users_info')
          .upsert(
            {
              id: user.id,
              username,
              email,
              room_id: roomId,
              role,
              role_flags: [role],
              status: initialStatus,
              approved: initialApproved,
              joined_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
          .select()
          .single();

        if (upsertErr) {
          if (upsertErr.code === '23505') throw new Error('Username or email already in use.');
          throw upsertErr;
        }

        Toast.success('Account created successfully! Logging in...');
        setTimeout(() => {
          window.location.href = role === 'admin'
            ? '/admin/dashboard.html'
            : '/user/waiting-approval.html';
        }, 800);
      } catch (error) {
        let msg = error?.message || 'Signup failed. Please try again.';
        if (msg.includes('User already registered')) msg = 'User already registered. Please login instead.';
        else if (msg.includes('Invalid room')) msg = 'Invalid room code.';
        else if (msg.includes('policy')) msg = 'Permission denied. Please contact support.';
        Toast.error(msg);
      }
    });
  }

  // ========== FORGOT PASSWORD ==========
  const forgotForm = getById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = getById('email')?.value?.trim?.() || '';
      if (!email || !Validator.email(email)) return Toast.error('Please enter a valid email');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/reset-password.html',
        });
        if (error) throw error;
        Toast.success('Reset link sent! Check your email');
        forgotForm.reset();
      } catch (error) {
        Toast.error(error?.message || 'Failed to send reset link');
      }
    });
  }

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  });

  console.log('✅ Auth handler loaded (UPSERT profile fix)');
})();
