// ==========================================
// AUTHENTICATION HANDLER (with safe fallbacks)
// ==========================================

(function () {
  // ---- Safe fallbacks for missing global helpers ----
  // Validator fallback (simple email check)
  const Validator = window.Validator || {
    email: (v) => {
      if (!v) return false;
      // simple RFC-lite email regex
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
  };

  // Toast fallback (non-intrusive)
  const Toast = window.Toast || {
    success: (msg) => {
      // prefer console; avoid blocking alerts except for errors
      console.log('[Toast success]', msg);
    },
    error: (msg) => {
      console.error('[Toast error]', msg);
      // also show a minimal alert so user sees critical failures
      try { alert(msg); } catch (e) { /* ignore */ }
    }
  };

  // FormValidator fallback: validateForm, validatePassword, validateUsername, showErrors
  const FormValidator = window.FormValidator || {
    validatePassword: (v) => {
      if (!v || v.length < 6) return 'Password must be at least 6 characters';
      return null;
    },
    validateUsername: (v) => {
      if (!v) return 'Username is required';
      if (v.length < 3) return 'Username must be at least 3 characters';
      // optional: restrict to letters, numbers, _ and -
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
          // ignore validator exceptions and treat as no error
          console.warn('Validator threw for', key, e);
        }
      }
      return Object.keys(errors).length ? errors : null;
    },
    showErrors: (errors, formId) => {
      // Log errors; add .field-error class to inputs if present
      console.warn('Form validation errors:', errors);
      try {
        const form = document.getElementById(formId);
        if (!form) return;
        // clear previous error markers
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

  // ---- small helper to replace missing global DOM helper ----
  const getById = (id) => document.getElementById(id);

  // safe reset (some browsers throw if form is null)
  const safeReset = (form) => {
    try {
      form?.reset?.();
    } catch (e) {
      // ignore
    }
  };

  // Ensure Supabase client exists at runtime
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
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        // Get user profile
        let profile = null;
        let retries = 3;

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
            if (retries > 0) await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (!profile) throw new Error('Profile not found');

        if (!profile.approved) {
          await supabase.auth.signOut();
          Toast.error('Your account is pending approval from admin');
          return;
        }

        Toast.success('Login successful!');

        // Redirect based on role
        const role = (profile.role_flags && profile.role_flags[0]) || 'user';
        setTimeout(() => {
          if (role === 'admin' || role === 'super_admin') {
            window.location.href = '/admin/dashboard.html';
          } else {
            window.location.href = '/user/dashboard.html';
          }
        }, 1000);
      } catch (error) {
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed');
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
        Toast.error('Please fix the errors');
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
        if (!user) throw new Error('Signup failed');

        // Get room ID if user
        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id')
            .eq('current_code', roomCode)
            .single();
          if (roomErr || !room) throw new Error('Invalid room code');
          roomId = room.id;
        }

        // Create user profile
        const profileData = {
          id: user.id,
          username,
          email,
          room_id: roomId,
          role_flags: [role],
          approved: role === 'admin',
          joined_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase.from('users_info').insert([profileData]);
        if (insertErr) throw insertErr;

        const message =
          role === 'admin' ? 'Admin account created! Redirecting...' : 'Account created! Awaiting admin approval...';

        Toast.success(message);

        setTimeout(() => {
          if (role === 'admin') {
            window.location.href = '/admin/dashboard.html';
          } else {
            window.location.href = '/auth/login.html';
          }
        }, 1500);
      } catch (error) {
        console.error('Signup error:', error);
        Toast.error(error?.message || 'Signup failed');
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
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: '/auth/reset-password.html'
        });

        if (error) throw error;

        Toast.success('Reset link sent! Check your email');
        safeReset(getById('forgotForm'));
      } catch (error) {
        console.error('Forgot password error:', error);
        Toast.error(error?.message || 'Failed to send reset link');
      }
    });
  }

  // Logout button
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
      window.location.href = '/index.html';
    });
  });

  // Expose for debugging if needed
  window.__TM_AUTH_LOADED = true;
})();

console.log('? Auth handler loaded');