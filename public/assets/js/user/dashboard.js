// ==========================================
// USER DASHBOARD - COMPLETE
// ==========================================

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return;
  }

  let currentProfile = null;

  async function init() {
    try {
      const user = await API.getCurrentUser();
      if (!user) {
        window.location.href = '/auth/login.html';
        return;
      }

      currentProfile = await API.getUserProfile(user.id);
      if (!currentProfile) {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      if (!currentProfile.approved) {
        await supabase.auth.signOut();
        Toast.warning('Your account is awaiting admin approval.');
        window.location.href = '/auth/login.html';
        return;
      }

      DOM.setText(DOM.id('userName'), currentProfile.username);
      await loadStats();
      await loadTaskStatus();
      await loadUpcomingDeadlines();

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to load dashboard');
    }
  }

  async function loadStats() {
    try {
      // Total tasks
      const { count: totalTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('assigned_to', currentProfile.id);

      // Completed tasks
      const { count: completedTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('assigned_to', currentProfile.id)
        .eq('status', 'approved');

      // In progress tasks
      const { count: inProgress } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('assigned_to', currentProfile.id)
        .eq('status', 'in_progress');

      // Overdue tasks
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('due_date, status')
        .eq('assigned_to', currentProfile.id)
        .neq('status', 'approved')
        .neq('status', 'rejected');

      const overdueCount = allTasks?.filter(t => TimeHelper.isOverdue(t.due_date)).length || 0;

      // Update UI
      DOM.setText(DOM.id('statTotal'), totalTasks || 0);
      DOM.setText(DOM.id('statCompleted'), completedTasks || 0);
      DOM.setText(DOM.id('statInProgress'), inProgress || 0);
      DOM.setText(DOM.id('statOverdue'), overdueCount || 0);

    } catch (error) {
      console.error('Load stats error:', error);
      Toast.error('Failed to load statistics');
    }
  }

  async function loadTaskStatus() {
    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('assigned_to', currentProfile.id);

      const statusCounts = {
        'assigned': 0,
        'in_progress': 0,
        'submitted': 0,
        'approved': 0,
        'rejected': 0
      };

      tasks?.forEach(t => {
        if (statusCounts.hasOwnProperty(t.status)) {
          statusCounts[t.status]++;
        }
      });

      const html = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-darker); border-radius: var(--radius-md);">
            <span class="text-secondary">📋 Assigned</span>
            <strong style="font-size: 1.25rem;">${statusCounts.assigned}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-darker); border-radius: var(--radius-md);">
            <span class="text-secondary">⚙️ In Progress</span>
            <strong style="font-size: 1.25rem;">${statusCounts.in_progress}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-darker); border-radius: var(--radius-md);">
            <span class="text-secondary">📤 Submitted</span>
            <strong style="font-size: 1.25rem;">${statusCounts.submitted}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-darker); border-radius: var(--radius-md);">
            <span class="text-secondary">✅ Approved</span>
            <strong style="font-size: 1.25rem; color: var(--success-color);">${statusCounts.approved}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-darker); border-radius: var(--radius-md);">
            <span class="text-secondary">❌ Rejected</span>
            <strong style="font-size: 1.25rem; color: var(--danger-color);">${statusCounts.rejected}</strong>
          </div>
        </div>
      `;

      DOM.setHTML(DOM.id('taskStatusContainer'), html);

    } catch (error) {
      console.error('Load task status error:', error);
      Toast.error('Failed to load task status');
    }
  }

  async function loadUpcomingDeadlines() {
    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', currentProfile.id)
        .neq('status', 'approved')
        .neq('status', 'rejected')
        .order('due_date', { ascending: true })
        .limit(5);

      if (!tasks || tasks.length === 0) {
        DOM.setHTML(
          DOM.id('upcomingDeadlinesContainer'),
          '<p class="text-muted text-center" style="padding: 2rem;">No upcoming deadlines</p>'
        );
        return;
      }

      const html = tasks.map(task => {
        const daysLeft = TimeHelper.daysUntil(task.due_date);
        const isOverdue = daysLeft < 0;
        const color = isOverdue ? 'var(--danger-color)' : daysLeft <= 3 ? 'var(--warning-color)' : 'var(--success-color)';
        
        let daysText = '';
        if (isOverdue) {
          daysText = `Overdue by ${Math.abs(daysLeft)} days`;
        } else if (daysLeft === 0) {
          daysText = 'Due TODAY';
        } else if (daysLeft === 1) {
          daysText = 'Due tomorrow';
        } else {
          daysText = `Due in ${daysLeft} days`;
        }

        return `
          <div style="padding: 1rem; background: var(--bg-light); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; margin-bottom: 0.25rem;">${task.title}</div>
              <div class="text-muted" style="font-size: 0.85rem;">${TimeHelper.formatDate(task.due_date)}</div>
            </div>
            <span style="color: ${color}; font-weight: 600; white-space: nowrap; margin-left: 1rem;">
              ${daysText}
            </span>
          </div>
        `;
      }).join('');

      DOM.setHTML(DOM.id('upcomingDeadlinesContainer'), html);

    } catch (error) {
      console.error('Load deadlines error:', error);
      Toast.error('Failed to load upcoming deadlines');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('✅ User dashboard loaded');