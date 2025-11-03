// ==========================================
// USER TASKS MANAGEMENT - COMPLETE
// ==========================================

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return;
  }

  let currentProfile = null;
  let allTasks = [];
  let searchQuery = '';
  let statusFilter = '';

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

      setupEventListeners();
      await loadTasks();

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize tasks');
    }
  }

  function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('taskSearch');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value.toLowerCase();
        filterAndRenderTasks();
      }, 300));
    }

    // Status filter
    const statusSelect = document.getElementById('taskStatusFilter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        filterAndRenderTasks();
      });
    }
  }

  async function loadTasks() {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', currentProfile.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      allTasks = tasks || [];
      filterAndRenderTasks();

    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
    }
  }

  function filterAndRenderTasks() {
    let filtered = allTasks;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery) ||
        (task.description && task.description.toLowerCase().includes(searchQuery))
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    renderTasks(filtered);
  }

  function renderTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    
    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tasks"></i>
          <h3>No tasks found</h3>
          <p>${searchQuery || statusFilter ? 'Try adjusting your filters' : 'You have no assigned tasks yet'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isOverdue = TimeHelper.isOverdue(task.due_date) && task.status !== 'approved' && task.status !== 'rejected';
      const statusBadge = getStatusBadge(task.status);
      const priorityBadge = getPriorityBadge(task.priority);

      return `
        <div class="task-card ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}" onclick="viewTaskDetails('${task.id}')">
          <div class="task-card-header">
            <div class="task-title">
              <h4>${escapeHtml(task.title)}</h4>
              ${task.description ? `<p>${escapeHtml(task.description.substring(0, 100))}${task.description.length > 100 ? '...' : ''}</p>` : ''}
            </div>
            <div class="task-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); viewTaskDetails('${task.id}')" title="View Details">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="task-card-footer">
            <div class="task-meta">
              ${priorityBadge}
              ${statusBadge}
            </div>
            <div class="task-due ${isOverdue ? 'overdue' : ''}">
              <i class="fas fa-calendar"></i> ${TimeHelper.formatDate(task.due_date)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.viewTaskDetails = function(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('taskDetailModal');
    const isOverdue = TimeHelper.isOverdue(task.due_date);
    const daysLeft = TimeHelper.daysUntil(task.due_date);

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

    document.getElementById('taskDetailTitle').textContent = task.title;

    const contentHTML = `
      <div class="form-group">
        <label>Title</label>
        <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
          ${escapeHtml(task.title)}
        </div>
      </div>

      ${task.description ? `
        <div class="form-group">
          <label>Description</label>
          <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md); max-height: 200px; overflow-y: auto;">
            ${escapeHtml(task.description)}
          </div>
        </div>
      ` : ''}

      <div class="grid cols-2">
        <div class="form-group">
          <label>Status</label>
          <span class="pill status-${task.status}">${formatStatus(task.status)}</span>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <span class="badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
        </div>
      </div>

      <div class="form-group">
        <label>Due Date</label>
        <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
          ${TimeHelper.formatDate(task.due_date)} <span style="color: ${isOverdue ? 'var(--danger-color)' : 'var(--text-muted)'};">(${daysText})</span>
        </div>
      </div>

      ${task.rejection_reason ? `
        <div class="alert alert-error">
          <i class="fas fa-exclamation-circle"></i>
          <div class="alert-content">
            <div class="alert-title">Rejection Reason</div>
            <div class="alert-message">${escapeHtml(task.rejection_reason)}</div>
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('taskDetailContent').innerHTML = contentHTML;

    // Action buttons
    let actionsHTML = '';
    if (task.status === 'assigned') {
      actionsHTML = `
        <button class="btn btn-primary" onclick="startTask('${task.id}')">
          <i class="fas fa-play"></i> Start Working
        </button>
      `;
    } else if (task.status === 'in_progress') {
      actionsHTML = `
        <button class="btn btn-success" onclick="submitTask('${task.id}')">
          <i class="fas fa-check"></i> Submit for Review
        </button>
        <button class="btn btn-secondary" onclick="closeTaskModal()">
          Cancel
        </button>
      `;
    } else if (task.status === 'rejected') {
      actionsHTML = `
        <button class="btn btn-warning" onclick="reworkTask('${task.id}')">
          <i class="fas fa-redo"></i> Rework Task
        </button>
      `;
    }

    actionsHTML += `<button class="btn btn-secondary" onclick="closeTaskModal()">Close</button>`;
    document.getElementById('taskDetailActions').innerHTML = actionsHTML;

    modal.style.display = 'flex';
  };

  window.startTask = async function(taskId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      if (error) throw error;

      Toast.success('Task started! Good luck!');
      closeTaskModal();
      await loadTasks();
    } catch (error) {
      console.error('Start task error:', error);
      Toast.error('Failed to start task');
    }
  };

  window.submitTask = async function(taskId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      Toast.success('Task submitted for review!');
      closeTaskModal();
      await loadTasks();
    } catch (error) {
      console.error('Submit task error:', error);
      Toast.error('Failed to submit task');
    }
  };

  window.reworkTask = async function(taskId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          rejection_reason: null
        })
        .eq('id', taskId);

      if (error) throw error;

      Toast.success('Task rework started!');
      closeTaskModal();
      await loadTasks();
    } catch (error) {
      console.error('Rework task error:', error);
      Toast.error('Failed to start rework');
    }
  };

  window.closeTaskModal = function() {
    const modal = document.getElementById('taskDetailModal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  function getStatusBadge(status) {
    return `<span class="pill status-${status}">${formatStatus(status)}</span>`;
  }

  function getPriorityBadge(priority) {
    return `<span class="badge priority-${priority}">${priority}</span>`;
  }

  function formatStatus(status) {
    return status.replace('_', ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('✅ User tasks loaded');