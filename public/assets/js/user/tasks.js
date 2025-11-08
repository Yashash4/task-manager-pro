// ==========================================
// USER TASKS MANAGEMENT
// ==========================================

let currentProfile = null;
let allUserTasks = [];

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) return;

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
        // Redirect if the user's account is not yet approved
        alert('Your account is awaiting admin approval. You will be logged out.');
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      DOM.setText(DOM.id('userName'), currentProfile.username);
      await loadTasks();

      // Event listeners
      DOM.on(DOM.id('taskSearch'), 'input', debounce(filterMyTasks, 300));
      DOM.on(DOM.id('taskFilter'), 'change', filterMyTasks);

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize the tasks page.');
    }
  }

  async function loadTasks() {
    const tbody = DOM.id('tasksBody');
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', currentProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      allUserTasks = tasks || [];
      renderListView(allUserTasks);
      renderKanbanView(allUserTasks);

    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading tasks.</td></tr>';
    }
  }

  function renderListView(tasks) {
    const tbody = DOM.id('tasksBody');
    
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No tasks assigned to you yet.</td></tr>';
      return;
    }

    const priorityColors = {
      'low': '#22c55e', 'medium': '#f59e0b', 'high': '#ef4444', 'urgent': '#dc2626'
    };
    const statusIcons = {
      'assigned': '📥', 'in_progress': '🔄', 'submitted': '📤', 'approved': '✅', 'rejected': '❌'
    };

    tbody.innerHTML = tasks.map(task => `
      <tr onclick="viewTask('${task.id}')" style="cursor: pointer;">
        <td><strong>${task.title}</strong></td>
        <td><span class="badge badge-primary">${statusIcons[task.status] || ''} ${task.status}</span></td>
        <td><span style="color: ${priorityColors[task.priority]}; font-weight: 600;">${task.priority}</span></td>
        <td>${new Date(task.due_date).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewTask('${task.id}'); event.stopPropagation();">View</button>
        </td>
      </tr>
    `).join('');
  }

  function renderKanbanView(tasks) {
    const statuses = ['assigned', 'in_progress', 'submitted', 'approved', 'rejected'];
    
    statuses.forEach(status => {
      const column = DOM.id(`kanban-${status}`);
      const tasksForStatus = tasks.filter(t => t.status === status);

      if (!tasksForStatus || tasksForStatus.length === 0) {
        column.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No tasks</p>';
        return;
      }

      const priorityColors = {
        'low': '#22c55e', 'medium': '#f59e0b', 'high': '#ef4444', 'urgent': '#dc2626'
      };

      column.innerHTML = tasksForStatus.map(task => `
        <div class="kanban-card" onclick="viewTask('${task.id}')">
          <div class="kanban-card-title">${task.title}</div>
          <div class="text-muted" style="font-size: 0.8rem;">Due: ${new Date(task.due_date).toLocaleDateString()}</div>
          <span class="kanban-card-priority" style="background-color: ${priorityColors[task.priority]}33; color: ${priorityColors[task.priority]};">
            ${task.priority}
          </span>
        </div>
      `).join('');
    });
  }

  function filterMyTasks() {
    const search = DOM.id('taskSearch')?.value.toLowerCase() || '';
    const filter = DOM.id('taskFilter')?.value || '';

    const filtered = allUserTasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(search) ||
                           (task.description && task.description.toLowerCase().includes(search));
      const matchesFilter = !filter || task.status === filter;
      return matchesSearch && matchesFilter;
    });

    const viewMode = DOM.id('taskViewMode')?.value || 'list';
    if (viewMode === 'list') {
      renderListView(filtered);
    } else {
      renderKanbanView(filtered);
    }
  }

  window.changeViewMode = () => {
    const mode = DOM.id('taskViewMode')?.value;
    const listView = DOM.id('listView');
    const kanbanView = DOM.id('kanbanView');

    if (mode === 'kanban') {
      DOM.hide(listView);
      DOM.show(kanbanView);
      renderKanbanView(allUserTasks);
    } else {
      DOM.show(listView);
      DOM.hide(kanbanView);
      renderListView(allUserTasks);
    }
  };

  window.viewTask = async (taskId) => {
    try {
      const task = allUserTasks.find(t => t.id === taskId);
      if (!task) return;

      let actionButtons = '';
      
      if (task.status === 'assigned') {
        actionButtons = `<button class="btn btn-primary btn-block mt-2" onclick="updateTaskStatus('${task.id}', 'in_progress')">Start Working</button>`;
      } else if (task.status === 'in_progress') {
        actionButtons = `<button class="btn btn-primary btn-block mt-2" onclick="updateTaskStatus('${task.id}', 'submitted')">Submit for Review</button>`;
      } else if (task.status === 'rejected') {
        actionButtons = `<button class="btn btn-secondary btn-block mt-2" onclick="updateTaskStatus('${task.id}', 'in_progress')">Rework Task</button>`;
      }

      const statusEmoji = {
        'assigned': '📥', 'in_progress': '🔄', 'submitted': '📤', 'approved': '✅', 'rejected': '❌'
      };

      const content = `
        <div class="form-group">
          <label>Task Title</label>
          <input type="text" value="${task.title}" disabled>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea disabled style="min-height: 100px;">${task.description || 'No description provided.'}</textarea>
        </div>
        <div class="grid grid-2">
          <div class="form-group">
            <label>Status</label>
            <input type="text" value="${statusEmoji[task.status] || ''} ${task.status}" disabled>
          </div>
          <div class="form-group">
            <label>Priority</label>
            <input type="text" value="${task.priority}" disabled>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="form-group">
            <label>Due Date</label>
            <input type="text" value="${new Date(task.due_date).toLocaleDateString()}" disabled>
          </div>
          <div class="form-group">
            <label>Created</label>
            <input type="text" value="${new Date(task.created_at).toLocaleString()}" disabled>
          </div>
        </div>
        ${actionButtons}
      `;

      DOM.setText(DOM.id('taskModalTitle'), task.title);
      DOM.setHTML(DOM.id('taskModalContent'), content);
      DOM.removeClass(DOM.id('taskModal'), 'hidden');

    } catch (error) {
      console.error('View task error:', error);
      Toast.error('Failed to load task details');
    }
  };

  window.closeTaskModal = () => {
    DOM.addClass(DOM.id('taskModal'), 'hidden');
  };

  window.updateTaskStatus = async (taskId, newStatus) => {
    if (!confirm(`Are you sure you want to update the task status to "${newStatus}"?`)) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      const messages = {
        'in_progress': 'Task marked as in progress!',
        'submitted': 'Task submitted for review!',
      };

      Toast.success(messages[newStatus] || 'Task updated!');
      window.closeTaskModal();
      await loadTasks();

    } catch (error) {
      console.error('Update task error:', error);
      Toast.error(error.message || 'Failed to update task');
    }
  };

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('? User tasks loaded');