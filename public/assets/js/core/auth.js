// ==========================================
// SIMPLE AUTH.JS - NO COMPLEX LOGIC
// ==========================================

(function () {
  'use strict';

  const Toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
  };

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'error' ? '#ef4444' : '#22c55e'};
      color: white;
      border-radius: 8px;
      z-index: 9999;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  const getById = (id) => document.getElementById(id);
  const supabase = window.SUPABASE?.client?.();

  if (!supabase) {
    console.error('Supabase not initialized');
    return;
  }

  // ========== LOGIN ==========
  const loginForm = getById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = getById('email')?.value?.trim() || '';
      const password = getById('password')?.value?.trim() || '';

      if (!email || !password) {
        Toast.error('Please fill in all fields');
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

        let profile = null;
        for (let i = 0; i < 3; i++) {
          const { data } = await supabase
            .from('users_info')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (data) {
            profile = data;
            break;
          }
          if (i < 2) await new Promise(r => setTimeout(r, 500));
        }

        if (!profile) throw new Error('Profile not found');

        Toast.success('Login successful!');

        setTimeout(() => {
          if (profile.role === 'admin') {
            window.location.href = '/admin/dashboard.html';
          } else if (profile.status === 'approved') {
            window.location.href = '/user/dashboard.html';
          } else {
            window.location.href = '/user/waiting-approval.html';
          }
        }, 500);

      } catch (error) {
        console.error('Login error:', error);
        Toast.error(error?.message || 'Login failed');
      }
    });
  }

  // ========== SIGNUP ==========
  const signupForm = getById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = getById('username')?.value?.trim() || '';
      const email = getById('email')?.value?.trim() || '';
      const password = getById('password')?.value?.trim() || '';
      const role = getById('role')?.value || '';
      const roomCode = getById('roomCode')?.value?.trim()?.toUpperCase() || '';
      const terms = getById('terms')?.checked;

      if (!username || !email || !password || !role) {
        Toast.error('Please fill in required fields');
        return;
      }

      if (!terms) {
        Toast.error('Please agree to Terms & Conditions');
        return;
      }

      try {
        console.log('Creating auth user...');

        // Step 1: Create auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, role } }
        });

        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) throw new Error('No user returned');

        console.log('Auth user created:', user.id);

        // Step 2: Lookup room if user provided code
        let roomId = null;
        if (role === 'user' && roomCode) {
          console.log('Looking up room code:', roomCode);
          const { data: room } = await supabase
            .from('rooms')
            .select('id')
            .eq('current_code', roomCode)
            .maybeSingle();

          if (room) {
            roomId = room.id;
            console.log('Found room:', roomId);
          }
        }

        // Step 3: Insert user profile
        console.log('Inserting user profile...');

        const { error: insertErr } = await supabase
          .from('users_info')
          .insert([{
            id: user.id,
            username,
            email,
            role,
            status: role === 'admin' ? 'approved' : 'pending',
            room_id: roomId,
            created_at: new Date().toISOString()
          }]);

        if (insertErr) {
          console.error('Insert error:', insertErr);
          throw insertErr;
        }

        console.log('Profile inserted successfully');
        Toast.success('Account created! Logging in...');

        setTimeout(() => {
          if (role === 'admin') {
            window.location.href = '/admin/dashboard.html';
          } else {
            window.location.href = '/user/waiting-approval.html';
          }
        }, 800);

      } catch (error) {
        console.error('Signup error:', error);
        Toast.error(error?.message || 'Signup failed');
      }
    });
  }

  // ========== LOGOUT ==========
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  });

  console.log('✅ Auth handler loaded');
})();