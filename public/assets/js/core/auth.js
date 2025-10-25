// ==========================================
// AUTHENTICATION HANDLER (UNIFIED - FINAL)
// ==========================================

(function () {
  const supabase = API.supabase(); // Use API helper
  if (!supabase) {
    console.error('Supabase client not available for auth.');
    // Maybe show a persistent error on the page?
    return;
  }

  const loginForm = DOM.id('loginForm');
  const signupForm = DOM.id('signupForm');
  const forgotForm = DOM.id('forgotForm');
  const passwordInput = DOM.id('password'); // For strength indicator
  const passwordStrengthSpan = DOM.id('passwordStrength');

  // ========== LOGIN HANDLER ==========
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      FormValidator.clearErrors('loginForm'); // Clear previous errors
      const email = DOM.id('email')?.value.trim();
      const password = DOM.id('password')?.value.trim();

      const emailError = FormValidator.validateEmail(email);
      if (emailError) { Toast.error(emailError); return; }
      if (!password) { Toast.error('Password is required.'); return; }

      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;
        const user = authData?.user;
        if (!user) throw new Error('Login failed');

        const profile = await API.getUserProfile(user.id);
        if (!profile) {
          await supabase.auth.signOut(); // Log out if profile is missing
          throw new Error('User profile not found. Please sign up again or contact support.');
        }

        if (!profile.approved) {
          await supabase.auth.signOut();
          Toast.warning('Your account is awaiting admin approval.');
          return;
        }

        Toast.success('Login successful! Redirecting...');
        const role = profile.role_flags?.[0] || 'user';
        // Use full path for reliability
        const redirectUrl = (role === 'admin') ? '/admin/dashboard.html' : '/user/dashboard.html';
        window.location.href = redirectUrl;

      } catch (error) {
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed. Check email/password.');
      }
    });
  }

  // ========== SIGNUP HANDLER ==========
  if (signupForm) {
    // Password strength indicator logic
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

      // Use validation rules
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
          errors.role = 'Please select a role.'; // Add role validation
      }
      if (!terms) {
          errors.terms = 'You must agree to the Terms & Conditions.';
      }
      
      if (errors) {
        const firstError = Object.values(errors)[0];
        Toast.error(firstError);
        // Highlight error fields (optional)
        Object.keys(errors).forEach(key => {
            const field = DOM.id(key);
            if(field) field.style.borderColor = 'var(--danger-color)';
        });
        return;
      }
      
      try {
        // Step 1: Sign up the Auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
        if (authErr) throw authErr;
        const user = authData?.user;
        if (!user) throw new Error('Signup failed during auth creation');

        // Step 2: Find Room ID if joining as user
        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase.from('rooms').select('id').eq('current_code', roomCode).single();
          if (roomErr || !room) throw new Error('Invalid organization code');
          roomId = room.id;
        }

        // Step 3: Create the user profile in users_info
        const profileData = { id: user.id, username, email, room_id: roomId, role_flags: [role], approved: (role === 'admin') }; // Admins are auto-approved
        const { error: insertErr } = await supabase.from('users_info').insert([profileData]);
        if (insertErr) {
            // If profile insert fails, maybe try to delete the auth user? (complex cleanup)
            console.error("Profile insert failed:", insertErr);
            throw new Error('Failed to create user profile. Please try again.');
        }

        const message = role === 'admin' ? 'Admin account created! Logging you in...' : 'Account created! Please wait for admin approval before logging in.';
        Toast.success(message);
        
        // Redirect appropriately
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
        Toast.info('Sending reset link...'); // Give user feedback
        // Redirect URL should point to a page where the user can set a new password
        // For now, redirecting to login after reset might be simplest.
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/login.html` }); 
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
  // Ensure logout works even if auth handler runs before DOM is fully ready
  document.addEventListener('click', async (e) => {
      if (e.target.closest('[data-logout]')) {
          e.preventDefault();
          await supabase.auth.signOut();
          window.location.href = '/index.html'; // Redirect to homepage after logout
      }
  });

})();

console.log('? Auth handler loaded (Final)');