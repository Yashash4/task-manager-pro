// ==========================================
// AUTHENTICATION HANDLER (FIXED v2.2)
// Fixes: Signup form validation, user profile creation, and RLS issues
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
    success: (msg) => {
      console.log('[Toast success]', msg);
      showBrowserToast(msg, 'success');
    },
    error: (msg) => {
      console.error('[Toast error]', msg);
      showBrowserToast(msg, 'error');
    },
    info: (msg) => {
      console.log('[Toast info]', msg);
      showBrowserToast(msg, 'info');
    }
  };

  // Simple browser toast implementation
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
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

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
        
        // Clear previous errors
        form.querySelectorAll('.field-error, .form-error').forEach((el) => {
          el.classList.remove('field-error');
          if (el.classList.contains('form-error')) el.remove();
        });
        
        // Show new errors
        for (const name of Object.keys(errors)) {
          const input = form.querySelector(`[name="${name}"], #${name}`);
          if (input) {
            input.classList.add('field-error');
            input.style.borderColor = '#ef4444';
            
            // Add error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'form-error';
            errorDiv.style.cssText = 'color: #ef4444; font-size: 0.85rem; margin-top: 0.25rem;';
            errorDiv.textContent = errors[name];
            input.parentElement.appendChild(errorDiv);
          }
        }
      } catch (e) {
        console.error('Error showing form errors:', e);
      }
    }
  };

  const getById = (id) => document.getElementById(id);
  const safeReset = (form) => { 
    try { 
      if (form && typeof form.reset === 'function') {
        form.reset(); 
      }
    } catch (e) { 
      console.warn('Form reset error:', e);
    } 
  };

  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    return;
  }

  const loginForm = getById('loginForm');
  const signupForm = getById('signupForm');
  const forgotForm = getById('forgotForm');

  // ========== LOGIN HANDLER ==========
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim?.() || '';
      const password = getById('password')?.value?.trim?.() || '';

      console.log('🔐 Login attempt:', email);

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

        if (authErr) {
          console.error('Auth error:', authErr);
          throw authErr;
        }

        const user = authData?.user;
        if (!user) throw new Error('Login failed - no user returned');

        console.log('✅ Auth successful, fetching profile...');

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
            console.log('✅ Profile loaded:', profile.username, '- Role:', profile.role, '- Status:', profile.status);
          } else {
            retries--;
            console.log(`⏳ Profile not found, retrying... (${5 - retries}/5)`);
            if (retries > 0) await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        if (!profile) {
          console.error('❌ Profile not found after retries');
          throw new Error('Profile not found. Please contact support.');
        }

        Toast.success('Login successful!');

        // Redirect based on role and status
        setTimeout(() => {
          if (profile.status === 'pending') {
            console.log('➡️ Redirecting to waiting approval page');
            window.location.href = '/user/waiting-approval.html';
          } else if (profile.status === 'rejected') {
            alert('Your account registration was rejected. Please contact the admin.');
            supabase.auth.signOut();
            window.location.href = '/auth/login.html';
          } else if (profile.status === 'suspended') {
            alert('Your account has been suspended. Please contact the admin.');
            supabase.auth.signOut();
            window.location.href = '/auth/login.html';
          } else if (profile.status === 'approved') {
            if (profile.role === 'admin') {
              console.log('➡️ Redirecting to admin dashboard');
              window.location.href = '/admin/dashboard.html';
            } else {
              console.log('➡️ Redirecting to user dashboard');
              window.location.href = '/user/dashboard.html';
            }
          } else {
            console.error('❌ Unknown status:', profile.status);
            throw new Error('Unknown account status');
          }
        }, 1000);

      } catch (error) {
        console.error('❌ Login error:', error);
        Toast.error(error?.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  // ========== SIGNUP HANDLER (FIXED v2.2) ==========
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = getById('username')?.value?.trim?.() || '';
      const email = getById('email')?.value?.trim?.() || '';
      const password = getById('password')?.value?.trim?.() || '';
      const role = getById('role')?.value || '';
      const roomCode = getById('roomCode')?.value?.trim?.()?.toUpperCase?.() || '';
      const terms = getById('terms')?.checked;

      console.log('📝 Signup attempt:', { username, email, role, hasRoomCode: !!roomCode });

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
        console.error('❌ Validation errors:', errors);
        FormValidator.showErrors(errors, 'signupForm');
        Toast.error('Please fix the errors in the form');
        return;
      }

      // Room code validation (only for users, not admins)
      if (role === 'user') {
        if (!roomCode || roomCode.length !== 6) {
          Toast.error('Please enter a valid 6-character room code');
          getById('roomCode')?.focus();
          return;
        }
      }

      console.log('✅ Validation passed, creating account...');

      try {
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
        if (!user) {
          console.error('❌ No user returned from signup');
          throw new Error('Signup failed. Please try again.');
        }

        console.log('✅ Auth user created:', user.id);

        // Step 2: Get room ID if user (not admin)
        let roomId = null;
        if (role === 'user') {
          console.log('🔍 Looking up room with code:', roomCode);
          
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id, name')
            .eq('current_code', roomCode)
            .maybeSingle();
          
          if (roomErr) {
            console.error('❌ Room query error:', roomErr);
            throw new Error('Invalid room code. Please check and try again.');
          }
          
          if (!room) {
            console.error('❌ Room not found for code:', roomCode);
            throw new Error('Invalid room code. Please check and try again.');
          }
          
          roomId = room.id;
          console.log('✅ Found room:', room.name, '(', room.id, ')');
        }

        // Step 3: Determine initial status
        const initialStatus = role === 'admin' ? 'approved' : 'pending';

        console.log('💾 Creating user profile...');

        // Step 4: Create user profile with retry logic
        let profileCreated = false;
        let profileRetries = 3;

        while (profileRetries > 0 && !profileCreated) {
          try {
            const { data: insertedProfile, error: insertErr } = await supabase
              .from('users_info')
              .insert([{
                id: user.id,
                username: username,
                email: email,
                room_id: roomId,
                role: role,
                status: initialStatus,
                joined_at: new Date().toISOString()
              }])
              .select();

            if (insertErr) {
              console.error('❌ Profile insert error:', insertErr);
              console.error('Error details:', insertErr.details, insertErr.hint);
              
              profileRetries--;
              
              if (profileRetries > 0) {
                console.log(`⏳ Retrying profile creation... (${3 - profileRetries}/3)`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              } else {
                throw insertErr;
              }
            } else {
              profileCreated = true;
              console.log('✅ Profile created successfully:', insertedProfile);
            }
          } catch (err) {
            profileRetries--;
            if (profileRetries === 0) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (!profileCreated) {
          throw new Error('Failed to create user profile. Please try again.');
        }

        Toast.success('Account created successfully!');

        setTimeout(() => {
          if (role === 'admin') {
            console.log('➡️ Admin signup complete, redirecting to dashboard');
            window.location.href = '/admin/dashboard.html';
          } else {
            console.log('➡️ User signup complete, redirecting to waiting page');
            window.location.href = '/user/waiting-approval.html';
          }
        }, 1500);

      } catch (error) {
        console.error('❌ Signup error:', error);
        
        // Provide specific error messages
        let errorMessage = error?.message || 'Signup failed. Please try again.';
        
        if (error?.message?.includes('duplicate')) {
          errorMessage = 'Email already registered. Please login or use another email.';
        } else if (error?.message?.includes('Invalid room')) {
          errorMessage = 'Invalid room code. Please check and try again.';
        } else if (error?.message?.includes('profile')) {
          errorMessage = 'Account created but profile setup failed. Please contact support.';
        } else if (error?.message?.includes('new row violates row level security')) {
          errorMessage = 'Permission denied. Please contact the administrator.';
        }
        
        Toast.error(errorMessage);
      }
    });
  }

  // ========== FORGOT PASSWORD HANDLER ==========
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
  console.log('✅ Auth handler loaded (v2.2 - FIXED SIGNUP)');
})();