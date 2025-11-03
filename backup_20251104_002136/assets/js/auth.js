// auth.js - IMPROVED VERSION with better validation
(function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error("? Supabase not initialized");
    return;
  }

  const $ = (id) => document.getElementById(id);

  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = isError ? 'toast error' : 'toast';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Validation functions
  const validate = {
    email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+\$/.test(email),
    password: (pwd) => pwd.length >= 8,
    username: (name) => name.length >= 3 && name.length <= 30,
    roomCode: (code) => /^[A-Z0-9]{6}\$/.test(code)
  };

  // ========== SIGNUP HANDLER ==========
  const signupForm = signupForm;
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = (username?.value || '').trim();
      const email = (email?.value || '').trim();
      const password = (password?.value || '').trim();
      const role = (role?.value || 'user').trim();
      const roomCode = (roomCode?.value || '').trim();
      const terms = terms?.checked;

      // Validate inputs
      if (!username || !email || !password || !role) {
        showToast('All fields are required', true);
        return;
      }

      if (!terms) {
        showToast('You must agree to Terms & Conditions', true);
        return;
      }

      if (!validate.email(email)) {
        showToast('Invalid email address', true);
        return;
      }

      if (!validate.username(username)) {
        showToast('Username must be 3-30 characters', true);
        return;
      }

      if (!validate.password(password)) {
        showToast('Password must be at least 8 characters', true);
        return;
      }

      if (role === 'user' && !validate.roomCode(roomCode)) {
        showToast('Room code must be 6 characters (uppercase letters/numbers)', true);
        return;
      }

      try {
        // Create auth account
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password
        });

        if (authErr) throw authErr;
        if (!authData.user) throw new Error('Signup failed');

        // Get room ID if user
        let roomId = null;
        if (role === 'user') {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id')
            .eq('current_code', roomCode)
            .single();
          
          if (roomErr || !room) {
            throw new Error('Invalid room code');
          }
          roomId = room.id;
        }

        // Create user profile
        const profileData = {
          id: authData.user.id,
          username,
          email,
          room_id: roomId,
          role_flags: [role],
          approved: role === 'admin',
          joined_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase
          .from('users_info')
          .insert([profileData]);

        if (insertErr) throw insertErr;

        const message = role === 'admin'
          ? 'Admin account created! Redirecting...'
          : 'Account created! Please wait for admin approval.';
        
        showToast(message);
        
        setTimeout(() => {
          window.location.href = role === 'admin' ? 'admin/dashboard.html' : 'login.html';
        }, 1500);

      } catch (err) {
        console.error('Signup error:', err);
        showToast(err.message || 'Signup failed', true);
      }
    });
  }

  // ========== LOGIN HANDLER ==========
  const loginForm = loginForm;
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = (email?.value || '').trim();
      const password = (password?.value || '').trim();

      if (!email || !password) {
        showToast('Email and password required', true);
        return;
      }

      if (!validate.email(email)) {
        showToast('Invalid email address', true);
        return;
      }

      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;
        if (!authData.user) throw new Error('Login failed');

        // Get user profile with retry logic
        let profile = null;
        let retries = 3;

        while (retries > 0 && !profile) {
          const { data, error } = await supabase
            .from('users_info')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (!error && data) {
            profile = data;
          } else {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!profile) {
          await supabase.auth.signOut();
          throw new Error('Profile not found');
        }

        if (!profile.approved) {
          await supabase.auth.signOut();
          showToast('Account pending admin approval', true);
          return;
        }

        showToast('Login successful!');
        
        setTimeout(() => {
          const role = profile.role_flags?.[0] || 'user';
          if (['admin', 'super_admin'].includes(role)) {
            window.location.href = 'admin/dashboard.html';
          } else {
            window.location.href = 'user/dashboard.html';
          }
        }, 500);

      } catch (err) {
        console.error('Login error:', err);
        showToast(err.message || 'Login failed', true);
      }
    });
  }

  // ========== LOGOUT HANDLER ==========
  document.querySelectorAll('[data-logout], #logoutBtn').forEach(btn => {
    btn?.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  });

  // Toggle room code field visibility
  window.toggleRoomCode = () => {
    const role = role?.value;
    const roomCodeGroup = roomCodeGroup;
    if (roomCodeGroup) {
      roomCodeGroup.style.display = role === 'user' ? 'block' : 'none';
    }
  };

})();

console.log('? Auth handler loaded');
