// ==========================================
// AUTHENTICATION HANDLER (FIXED & COMPLETE)
// Version: 2.0
// ==========================================

(function () {
  // ---- Safe fallbacks for missing global helpers ----
  const Validator = window.Validator || {
    email: (v) => {
      if (!v) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
  };

  const Toast = window.Toast || {
    success: (msg) => console.log('[Toast success]', msg),
    error: (msg) => {
      console.error('[Toast error]', msg);
      try { alert(msg); } catch (e) { /* ignore */ }
    },
    info: (msg) => console.log('[Toast info]', msg)
  };

  const FormValidator = window.FormValidator || {
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
        try {
          const validatorFn = validators[key];
          const val = data[key];
          const err = validatorFn(val);
          if (err) errors[key] = err;
        } catch (e) {
          console.warn('Validator threw for', key, e);
        }
      }
      return Object.keys(errors).length ? errors : null;
    },
    showErrors: (errors, formId) => {
      console.warn('Form validation errors:', errors);
      try {
        const form = document.getElementById(formId);
        if (!form) return;
        form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'));
        for (const name of Object.keys(errors)) {
          const input = form.querySelector(`[name="${name}"], #${name}`);
          if (input) input.classList.add('field-error');
        }
      } catch (e) {
        // ignore DOM issues
      }
    }
  };

  const getById = (id) => document.getElementById(id);
  const safeReset = (form) => { try { form?.reset?.(); } catch (e) { /* ignore */ } };

  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error('Supabase not initialized');
    return;
  }

  const loginForm = getById('loginForm');
  const signupForm = getById('signupForm');
  const forgotForm = getById('forgotForm');

  // ========== LOGIN HANDLER ==========
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim?.();
      const password = getById('password')?.value?.trim?.();

      if (!email || !password) {
        Toast.error('Please fill in all fields');
        return;
      }

      if (!Validator.email(email)) {
        Toast.error('Please enter a valid email');
        return;
      }

      try {
        // Sign in with Supabase
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        // Get user profile with retries
        let profile = null;
        let retries = 5;

        while (retries > 0 && !profile) {
          const { data, error } = await supabase
            .from('users_info')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (!error && data) {
            profile = data;
          } else {
            retries--;
            if (retries > 0) await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        if (!profile) throw new Error('Profile not found. Please contact support.');

        Toast.success('Login successful!');

        // Redirect based on role and status
        setTimeout(() => {
          if (profile.status === 'pending') {
            // User waiting for approval
            window.location.href = '/user/waiting-approval.html';
          } else if (profile.status === 'rejected') {
            // User was rejected
            alert('Your account registration was rejected. Please contact the admin.');
            supabase.auth.signOut();
            window.location.href = '/auth/login.html';
          } else if (profile.status === 'suspended') {
            // User is suspended
            alert('Your account has been suspended. Please contact the admin.');
            supabase.auth.signOut();
            window.location.href = '/auth/login.html';
          } else if (profile.status === 'approved') {
            // User is approved, redirect by role
            if (profile.role === 'admin') {
              window.location.href = '/admin/dashboard.html';
            } else if (profile.role === 'approver') {
              window.location.href = '/admin/dashboard.html'; // Approvers use admin dashboard
            } else {
              window.location.href = '/user/dashboard.html';
            }
          }
        }, 1000);

      } catch (error) {
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  // ========== SIGNUP HANDLER ==========
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = getById('username')?.value?.trim?.();
      const email = getById('email')?.value?.trim?.();
      const password = getById('password')?.value?.trim?.();
      const role = getById('role')?.value;
      const roomCode = getById('roomCode')?.value?.trim?.();
      const terms = getById('terms')?.checked;

      // Validation
      if (!username || !email || !password || !role) {
        Toast.error('Please fill in all required fields');
        return;
      }

      if (!terms) {
        Toast.error('Please agree to Terms & Conditions');
        return;
      }

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

      if (role === 'user' && (!roomCode || roomCode.length !== 6)) {
        Toast.error('Please enter a valid 6-character room code');
        return;
      }

      try {
        // Create auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password
        });

        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('Signup failed. Please try again.');

        // Get room ID if user
        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id')
            .eq('current_code', roomCode.toUpperCase())
            .single();
          
          if (roomErr || !room) {
            // Delete the auth user if room code is invalid
            await supabase.auth.admin.deleteUser(user.id);
            throw new Error('Invalid room code. Please check and try again.');
          }
          roomId = room.id;
        }

        // Determine initial status
        const initialStatus = role === 'admin' ? 'approved' : 'pending';

        // Create user profile
        const profileData = {
          id: user.id,
          username,
          email,
          room_id: roomId,
          role: role,
          status: initialStatus,
          joined_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase
          .from('users_info')
          .insert([profileData]);

        if (insertErr) {
          // Delete the auth user if profile creation fails
          await supabase.auth.admin.deleteUser(user.id);
          throw insertErr;
        }

        Toast.success('Account created successfully!');

        setTimeout(() => {
          if (role === 'admin') {
            // Admins are auto-approved
            window.location.href = '/admin/dashboard.html';
          } else {
            // Regular users go to waiting room
            window.location.href = '/user/waiting-approval.html';
          }
        }, 1500);

      } catch (error) {
        console.error('Signup error:', error);
        Toast.error(error?.message || 'Signup failed. Please try again.');
      }
    });
  }

  // ========== FORGOT PASSWORD HANDLER ==========
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim?.();

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
        safeReset(forgotForm);
      } catch (error) {
        console.error('Forgot password error:', error);
        Toast.error(error?.message || 'Failed to send reset link');
      }
    });
  }

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
      } catch (err) {
        console.error('Sign out error:', err);
        window.location.href = '/index.html';
      }
    });
  });

  window.__TM_AUTH_LOADED = true;
  console.log('✅ Auth handler loaded (v2.0 - FIXED)');
})();