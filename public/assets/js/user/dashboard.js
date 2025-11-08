// ==========================================
// USER DASHBOARD
// ==========================================

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) return;

  async function loadDashboard() {
    try {
      const user = await API.getCurrentUser();
      if (!user) {
        window.location.href = '/auth/login.html';
        return;
      }

      const profile = await API.getUserProfile(user.id);
      if (!profile) {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      DOM.setText(DOM.id('userName'), profile.username);
      DOM.setText(DOM.id('welcomeName'), profile.username);

      // Load all data widgets
      await Promise.all([
        loadStats(profile),
        loadUpcomingDeadlines(profile),
        loadRecentActivity(profile)
      ]);
      
      // Fallback for any sections that might still be showing loading
      if (DOM.id('tasksOverview').innerHTML === 'Loading...') DOM.setHTML(DOM.id('tasksOverview'), '<p class="text-muted">No task overview available.</p>');
      if (DOM.id('recentActivity').innerHTML === 'Loading...') DOM.setHTML(DOM.id('recentActivity'), '<p class="text-muted">No recent activity.</p>');


    } catch (error) {
      console.error('Dashboard error:', error);
      Toast.error('Failed to load dashboard');
      // Ensure all loading text is cleared on a major error
      DOM.setHTML(DOM.id('userStatsGrid'), '<p class="text-muted">Could not load stats.</p>');
      DOM.setHTML(DOM.id('tasksOverview'), '<p class="text-muted">Could not load tasks.</p>');
      DOM.setHTML(DOM.id('upcomingDeadlines'), '<p class="text-muted">Could not load deadlines.</p>');
      DOM.setHTML(DOM.id('recentActivity'), '<p class="text-muted">Could not load activity.</p>');
    }
  }

  async function loadStats(profile) {
    const statsGrid = DOM.id('userStatsGrid');
    const tasksOverview = DOM.id('tasksOverview');
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('assigned_to', profile.id);

      if (error) throw error;
      
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'approved').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const pendingTasks = tasks.filter(t => ['assigned', 'submitted', 'rejected'].includes(t.status)).length;

      const stats = [
        { label: 'Total Tasks', value: totalTasks, icon: '📋' },
        { label: 'Completed', value: completedTasks, icon: '✅' },
        { label: 'In Progress', value: inProgressTasks, icon: '🔄' },
        { label: 'Pending', value: pendingTasks, icon: '⏳' }
      ];

      statsGrid.innerHTML = stats.map(stat => `
        <div class="card">
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${stat.icon}</div>
            <div class="text-muted">${stat.label}</div>
            <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stat.value}</div>
          </div>
        </div>
      `).join('');

      // Also update the tasks overview chart
      tasksOverview.innerHTML = `
        <ul style="list-style: none; padding: 0 1rem 1rem 1rem;">
          <li style="padding: 0.5rem 0; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);"><span>Completed</span> <strong>${completedTasks}</strong></li>
          <li style="padding: 0.5rem 0; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);"><span>In Progress</span> <strong>${inProgressTasks}</strong></li>
          <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;"><span>Pending</span> <strong>${pendingTasks}</strong></li>
        </ul>`;

    } catch (error) {
      console.error('Load stats error:', error);
      statsGrid.innerHTML = '<p class="text-muted" style="padding: 1rem;">Could not load your stats.</p>';
      tasksOverview.innerHTML = '<p class="text-muted" style="padding: 1rem;">Could not load task overview.</p>';
    }
  }

  async function loadUpcomingDeadlines(profile) {
    const deadlinesContainer = DOM.id('upcomingDeadlines');
    try {
      const today = new Date().toISOString();
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('title, due_date')
        .eq('assigned_to', profile.id)
        .in('status', ['assigned', 'in_progress', 'submitted', 'rejected'])
        .gte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!tasks || tasks.length === 0) {
        deadlinesContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">No upcoming deadlines. Great job!</p>';
        return;
      }

      deadlinesContainer.innerHTML = `
        <ul style="list-style: none; padding: 0 1rem 1rem 1rem;">
          ${tasks.map(task => `
            <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <span>${task.title}</span>
              <strong style="color: var(--primary-color);">${new Date(task.due_date).toLocaleDateString()}</strong>
            </li>
          `).join('')}
        </ul>`;

    } catch (error) {
      console.error('Load deadlines error:', error);
      deadlinesContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">Could not load deadlines.</p>';
    }
  }
  
  async function loadRecentActivity(profile) {
      const activityContainer = DOM.id('recentActivity');
      // This is a placeholder as activity logging is not fully implemented yet
      activityContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">No recent activity to show.</p>';
  }

  document.addEventListener('DOMContentLoaded', loadDashboard);
})();