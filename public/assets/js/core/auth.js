// ==========================================
// AUTHENTICATION HANDLER
// ==========================================

(function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error('❌ Supabase client not available for auth.');
    return;
  }

  const loginForm = DOM.id('loginForm');
  const signupForm = DOM.id('signupForm');
  const forgotForm = DOM.id('forgotForm');

  // ========== LOGIN HANDLER ==========
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      FormValidator.clearErrors('loginForm');
      
      const email = DOM.id('email')?.value.trim();
      const password = DOM.id('password')?.value.trim();

      const emailError = FormValidator.validateEmail(email);
      if (emailError) { Toast.error(emailError); return; }
      if (!password) { Toast.error('Password is required.'); return; }

      try {
        Toast.info('Logging in...');
        
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        
        if (authErr) throw authErr;
        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        // Wait for profile to be available
        let profile = null;
        let retries = 5;
        
        while (retries > 0 && !profile) {
          profile = await API.getUserProfile(user.id);
          if (!profile) {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!profile) {
          await supabase.auth.signOut();
          throw new Error('User profile not found. Please contact support.');
        }

        if (!profile.approved) {
          await supabase.auth.signOut();
          Toast.warning('Your account is awaiting admin approval.');
          return;
        }

        Toast.success('Login successful!');
        
        const role = profile.role_flags?.[0] || 'user';
        const redirectUrl = (role === 'admin') ? '/admin/dashboard.html' : '/user/dashboard.html';
        
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);

      } catch (error) {
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed. Check email/password.');
      }
    });
  }

  // ========== SIGNUP HANDLER ==========
  if (signupForm) {
    const passwordInput = DOM.id('password');
    const passwordStrengthSpan = DOM.id('passwordStrength');

    if (passwordInput && passwordStrengthSpan) {
      passwordInput.addEventListener('input', () => {
        PasswordStrength.updateIndicator('password', 'passwordStrength');
      });
    }

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      FormValidator.clearErrors('signupForm');
      
      const username = DOM.id('username')?.value.trim();
      const email = DOM.id('email')?.value.trim();
      const password = DOM.id('password')?.value.trim();
      const role = DOM.id('role')?.value;
      const roomCodeInput = DOM.id('roomCode');
      const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : null;
      const terms = DOM.id('terms')?.checked;

      // Validation
      const validationRules = {
        username: FormValidator.validateUsername,
        email: FormValidator.validateEmail,
        password: FormValidator.validatePassword,
      };
      
      if (role === 'user') {
        validationRules.roomCode = FormValidator.validateRoomCode;
      }
      
      const errors = FormValidator.validateForm({ username, email, password, roomCode }, validationRules);

      if (!role) {
        Toast.error('Please select a role.');
        return;
      }
      
      if (!terms) {
        Toast.error('You must agree to the Terms & Conditions.');
        return;
      }
      
      if (errors) {
        const firstError = Object.values(errors)[0];
        Toast.error(firstError);
        Object.keys(errors).forEach(key => {
          const field = DOM.id(key);
          if(field) field.style.borderColor = 'var(--danger-color)';
        });
        return;
      }
      
      try {
        Toast.info('Creating account...');
        
        // Step 1: Sign up the Auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        
        if (authErr) throw authErr;
        const user = authData?.user;
        if (!user) throw new Error('Signup failed during auth creation');

        // Step 2: Find Room ID if joining as user
        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id')
            .eq('current_code', roomCode)
            .single();
          
          if (roomErr || !room) {
            // Clean up auth user if room not found
            await supabase.auth.signOut();
            throw new Error('Invalid organization code');
          }
          roomId = room.id;
        }

        // Step 3: Create the user profile
        const profileData = { 
          id: user.id, 
          username, 
          email, 
          room_id: roomId, 
          role_flags: [role], 
          approved: (role === 'admin')
        };
        
        const { error: insertErr } = await supabase
          .from('users_info')
          .insert([profileData]);
        
        if (insertErr) {
          console.error("Profile insert failed:", insertErr);
          await supabase.auth.signOut();
          throw new Error('Failed to create user profile. Please try again.');
        }

        const message = role === 'admin' 
          ? 'Admin account created! Logging you in...' 
          : 'Account created! Please wait for admin approval before logging in.';
        
        Toast.success(message);
        
        setTimeout(() => {
          window.location.href = (role === 'admin') ? '/admin/dashboard.html' : '/auth/login.html';
        }, 2000);

      } catch (error) {
        console.error('Signup error:', error);
        Toast.error(error?.message || 'Signup failed. An unexpected error occurred.');
      }
    });
  }

  // ========== FORGOT PASSWORD HANDLER ==========
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      FormValidator.clearErrors('forgotForm');
      
      const email = DOM.id('email')?.value.trim();
      const emailError = FormValidator.validateEmail(email);
      if (emailError) { Toast.error(emailError); return; }

      try {
        Toast.info('Sending reset link...');
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, { 
          redirectTo: `${window.location.origin}/auth/login.html` 
        }); 
        
        if (error) throw error;
        
        Toast.success('Password reset link sent! Check your email (including spam folder).');
        forgotForm.reset();
        
      } catch (error) {
        console.error('Forgot password error:', error);
        Toast.error(error?.message || 'Failed to send reset link.');
      }
    });
  }

  // ========== LOGOUT BUTTONS ==========
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-logout]')) {
      e.preventDefault();
      try {
        await supabase.auth.signOut();
        Toast.success('Logged out successfully');
        setTimeout(() => {
          window.location.href = '/index.html';
        }, 500);
      } catch (error) {
        console.error('Logout error:', error);
        Toast.error('Logout failed');
      }
    }
  });

  // ========== ROOM CODE TOGGLE ==========
  window.toggleRoomCode = () => {
    const role = DOM.id('role')?.value;
    const roomCodeGroup = DOM.id('roomCodeGroup');
    if (roomCodeGroup) {
      roomCodeGroup.style.display = role === 'user' ? 'block' : 'none';
    }
  };

})();

console.log('✅ Auth handler loaded');
