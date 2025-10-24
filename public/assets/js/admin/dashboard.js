// ==========================================
// ADMIN DASHBOARD
// ==========================================

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) return;

  // Get current user and profile
  async function loadDashboard() {
    try {
      const user = await API.getCurrentUser();
      if (!user) {
        window.location.href = '/auth/login.html';
        return;
      }

      const profile = await API.getUserProfile(user.id);
      if (!profile || !profile.role_flags?.includes('admin')) {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      // Set org name
      if (profile.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('name')
          .eq('id', profile.room_id)
          .single();
        
        if (room) DOM.setText(DOM.id('orgName'), room.name);
      }

      // Load stats
      await loadStats(profile);
      await loadRecentTasks(profile);
      await loadTeamMembers(profile);

    } catch (error) {
      console.error('Dashboard error:', error);
      Toast.error('Failed to load dashboard');
    }
  }

  async function loadStats(profile) {
    try {
      if (!profile.room_id) return;

      // Total Tasks
      const { count: totalTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('room_id', profile.room_id);

      // Approved Tasks
      const { count: approvedTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('room_id', profile.room_id)
        .eq('status', 'approved');

      // Total Users
      const { count: totalUsers } = await supabase
        .from('users_info')
        .select('*', { count: 'exact' })
        .eq('room_id', profile.room_id)
        .eq('approved', true);

      // Pending Approvals
      const { count: pendingApprovals } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('room_id', profile.room_id)
        .eq('status', 'submitted');

      const stats = [
        { label: 'Total Tasks', value: totalTasks || 0, icon: '📋' },
        { label: 'Completed', value: approvedTasks || 0, icon: '✅' },
        { label: 'Team Members', value: totalUsers || 0, icon: '👥' },
        { label: 'Pending Approval', value: pendingApprovals || 0, icon: '⏳' }
      ];

      const statsGrid = DOM.id('statsGrid');
      statsGrid.innerHTML = stats.map(stat => `
        <div class="card">
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${stat.icon}</div>
            <div class="text-muted">${stat.label}</div>
            <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stat.value}</div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Load stats error:', error);
    }
  }

  async function loadRecentTasks(profile) {
    try {
      if (!profile.room_id) return;

      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id, title, status, priority, due_date,
          assigned_user:users_info!tasks_assigned_to_fkey(username)
        `)
        .eq('room_id', profile.room_id)
        .order('created_at', { ascending: false })
        .limit(5);

      const container = DOM.id('recentTasks');
      if (!tasks || tasks.length === 0) {
        DOM.setHTML(container, '<p class="text-muted">No tasks yet</p>');
        return;
      }

      const priorityColors = {
        'low': '#22c55e',
        'medium': '#f59e0b',
        'high': '#ef4444',
        'urgent': '#dc2626'
      };

      DOM.setHTML(container, `
        <ul style="list-style: none;">
          ${tasks.map(task => `
            <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">${task.title}</div>
                <div class="text-muted" style="font-size: 0.85rem;">${task.assigned_user?.username || 'Unassigned'}</div>
              </div>
              <span class="badge badge-primary">${task.status}</span>
            </li>
          `).join('')}
        </ul>
      `);

    } catch (error) {
      console.error('Load recent tasks error:', error);
    }
  }

  async function loadTeamMembers(profile) {
    try {
      if (!profile.room_id) return;

      const { data: users } = await supabase
        .from('users_info')
        .select('id, username, email, joined_at')
        .eq('room_id', profile.room_id)
        .eq('approved', true)
        .order('joined_at', { ascending: false })
        .limit(5);

      const container = DOM.id('teamMembers');
      if (!users || users.length === 0) {
        DOM.setHTML(container, '<p class="text-muted">No team members yet</p>');
        return;
      }

      DOM.setHTML(container, `
        <ul style="list-style: none;">
          ${users.map(user => `
            <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">${user.username}</div>
                <div class="text-muted" style="font-size: 0.85rem;">${user.email}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      `);

    } catch (error) {
      console.error('Load team members error:', error);
    }
  }

  // Load on page load
  document.addEventListener('DOMContentLoaded', loadDashboard);

})();