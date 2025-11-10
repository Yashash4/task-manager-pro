// ==========================================
// FIXED AUTH.JS - ROOM CODE OPTIONAL FOR USERS
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

      if (!email || !password) {
        Toast.error('Please fill in all fields');
        return;
      }

      if (!Validator.email(email)) {
        Toast.error('Please enter a valid email');
        return;
      }

      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        // Get user profile
        let profile = null;
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabase
            .from('users_info')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

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
            if (profile.role === 'admin') {
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
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed');
      }
    });
  }

  // ========== SIGNUP HANDLER - FIXED ==========
  // Room code is now OPTIONAL for users
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

      console.log('📝 Signup attempt:', { username, email, role });

      // Basic validation
      if (!username || !email || !password || !role) {
        Toast.error('Please fill in all required fields');
        return;
      }

      if (!terms) {
        Toast.error('Please agree to Terms & Conditions');
        return;
      }

      // Validate fields
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
        Toast.error('Please fix the errors in the form');
        return;
      }

      try {
        console.log('✅ Validation passed, creating auth user...');

        // Step 1: Create auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              role: role
            }
          }
        });

        if (authErr) {
          console.error('❌ Auth signup error:', authErr);
          throw authErr;
        }

        const user = authData?.user;
        if (!user) throw new Error('No user returned from signup');

        console.log('✅ Auth user created:', user.id);

        // Step 2: Lookup room ONLY if user provided a code
        let roomId = null;
        if (role === 'user' && roomCode) {
          console.log('🔍 Looking up room with code:', roomCode);

          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id, name')
            .eq('current_code', roomCode)
            .maybeSingle();

          if (roomErr || !room) {
            console.error('❌ Room lookup error:', roomErr);
            throw new Error('Invalid room code. Please check and try again.');
          }

          roomId = room.id;
          console.log('✅ Found room:', room.name);
        } else if (role === 'user' && !roomCode) {
          // User didn't provide room code - that's OK!
          console.log('ℹ️  User signup without room code (can join later)');
          roomId = null;
        }

        // Step 3: Determine initial status
        const initialStatus = role === 'admin' ? 'approved' : 'pending';

        console.log('💾 INSERT user profile with status:', initialStatus);

        // ============================================
        // INSERT: Allow user to create their profile
        // ============================================
        const payload = {
          id: user.id,
          username: username,
          email: email,
          room_id: roomId,  // Can be NULL
          role: role,
          status: initialStatus,
          joined_at: new Date().toISOString()
        };

        const { data: profileData, error: insertErr } = await supabase
          .from('users_info')
          .insert([payload])
          .select()
          .single();

        if (insertErr) {
          console.error('❌ Profile insert error:', insertErr);
          
          // If insert failed, try to delete the auth user
          try {
            await supabase.auth.admin.deleteUser(user.id);
          } catch (deleteErr) {
            console.warn('Could not delete auth user:', deleteErr);
          }
          
          if (insertErr.code === '23505') {
            throw new Error('Username or email already in use.');
          }
          throw insertErr;
        }

        console.log('✅ Profile inserted successfully');

        Toast.success('Account created successfully! Logging in...');

        setTimeout(() => {
          if (role === 'admin') {
            console.log('➡️ Redirecting admin to dashboard');
            window.location.href = '/admin/dashboard.html';
          } else {
            console.log('➡️ Redirecting user to waiting page');
            window.location.href = '/user/waiting-approval.html';
          }
        }, 800);

      } catch (error) {
        console.error('❌ Signup error:', error);

        let errorMessage = error?.message || 'Signup failed. Please try again.';

        if (error?.message?.includes('User already registered')) {
          errorMessage = 'User already registered. Please login instead.';
        } else if (error?.message?.includes('Invalid room')) {
          errorMessage = 'Invalid room code. Please check and try again.';
        } else if (error?.message?.includes('policy')) {
          errorMessage = 'Permission denied. Please check your input and try again.';
        } else if (error?.message?.includes('duplicate')) {
          errorMessage = 'Username or email already exists.';
        }

        Toast.error(errorMessage);
      }
    });
  }

  // ========== FORGOT PASSWORD ==========
  const forgotForm = getById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim?.() || '';

      if (!email || !Validator.email(email)) {
        Toast.error('Please enter a valid email');
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/reset-password.html'
        });

        if (error) throw error;

        Toast.success('Reset link sent! Check your email');
        forgotForm.reset();
      } catch (error) {
        Toast.error(error?.message || 'Failed to send reset link');
      }
    });
  }

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  });

  console.log('✅ Auth handler loaded - Room code OPTIONAL for users');
})();