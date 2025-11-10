// ==========================================
// ADMIN TASKS MANAGEMENT (UPDATED)
// ==========================================

let currentProfile = null;
let allTeamUsers = [];
let allTasks = [];
let editingTaskId = null;

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
      if (!currentProfile || currentProfile.role !== 'admin') {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }

      if (currentProfile.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('name')
          .eq('id', currentProfile.room_id)
          .single();
        
        if (room) DOM.setText(DOM.id('orgName'), room.name);
      }

      await loadUsers();
      await loadTasks();

      DOM.on(DOM.id('taskSearch'), 'input', debounce(filterTasks, 300));
      DOM.on(DOM.id('taskStatusFilter'), 'change', filterTasks);

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize tasks page');
    }
  }

  async function loadUsers() {
    try {
      if (!currentProfile.room_id) return;

      const { data: users, error } = await supabase
        .from('users_info')
        .select('id, username')
        .eq('room_id', currentProfile.room_id)
        .eq('status', 'approved')
        .in('role', ['user', 'approver']);

      if (error) throw error;

      allTeamUsers = users || [];
      const select = DOM.id('taskAssignTo');
      select.innerHTML = '<option value="">Select User</option>' +
        (allTeamUsers.map(u => `<option value="${u.id}">${u.username}</option>`).join('') || '');

    } catch (error) {
      console.error('Load users error:', error);
      Toast.error('Could not load users');
    }
  }

  async function loadTasks() {
    const tbody = DOM.id('tasksBody');
    try {
      if (!currentProfile.room_id) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No room found</td></tr>';
        return;
      }

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('room_id', currentProfile.room_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      allTasks = tasks || [];
      renderTasks(allTasks);

    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading tasks</td></tr>';
    }
  }

  function renderTasks(tasks) {
    const tbody = DOM.id('tasksBody');

    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No tasks found</td></tr>';
      return;
    }

    const userMap = new Map(allTeamUsers.map(u => [u.id, u.username]));
    const statusIcons = {
      'assigned': '📥',
      'in_progress': '🔄',
      'submitted': '📤',
      'approved': '✅',
      'rejected': '❌'
    };
    const priorityColors = {
      'low': '#22c55e',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'urgent': '#dc2626'
    };

    tbody.innerHTML = tasks.map(task => `
      <tr>
        <td><strong>${task.title}</strong></td>
        <td>${userMap.get(task.assigned_to) || 'N/A'}</td>
        <td><span class="badge badge-primary">${statusIcons[task.status] || ''} ${task.status}</span></td>
        <td><span style="color: ${priorityColors[task.priority]}; font-weight: 600;">${task.priority}</span></td>
        <td>${new Date(task.due_date).toLocaleDateString()}</td>
        <td>
          <div class="flex" style="gap: 0.25rem;">
            <button class="btn btn-sm btn-secondary" onclick="editTask('${task.id}')" title="Edit Task">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="viewTaskDetails('${task.id}')">View</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id}')" title="Delete Task">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function filterTasks() {
    const search = (DOM.id('taskSearch')?.value || '').toLowerCase();
    const status = DOM.id('taskStatusFilter')?.value || '';

    const filtered = allTasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(search) ||
                          (task.description && task.description.toLowerCase().includes(search));
      const matchesStatus = !status || task.status === status;
      return matchesSearch && matchesStatus && !task.is_deleted;
    });

    renderTasks(filtered);
  }

  // Modal functions
  window.openCreateTaskModal = () => {
    editingTaskId = null;
    DOM.id('createTaskForm').reset();
    DOM.id('taskTitle').focus();
    DOM.querySelector('.modal-header h2').textContent = 'Create New Task';
    DOM.removeClass(DOM.id('createTaskModal'), 'hidden');
  };

  window.closeCreateTaskModal = () => {
    DOM.addClass(DOM.id('createTaskModal'), 'hidden');
    editingTaskId = null;
  };

  window.editTask = (taskId) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    DOM.id('taskTitle').value = task.title;
    DOM.id('taskDescription').value = task.description || '';
    DOM.id('taskAssignTo').value = task.assigned_to || '';
    DOM.id('taskPriority').value = task.priority;
    DOM.id('taskDueDate').value = task.due_date;

    DOM.querySelector('.modal-header h2').textContent = 'Edit Task';
    DOM.removeClass(DOM.id('createTaskModal'), 'hidden');
  };

  window.submitCreateTask = async () => {
    const title = DOM.id('taskTitle')?.value.trim();
    const description = DOM.id('taskDescription')?.value.trim() || null;
    const assigned_to = DOM.id('taskAssignTo')?.value;
    const priority = DOM.id('taskPriority')?.value;
    const due_date = DOM.id('taskDueDate')?.value;

    if (!title || !assigned_to || !due_date) {
      Toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingTaskId) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title,
            description,
            assigned_to,
            priority,
            due_date,
            edited_at: new Date().toISOString(),
            edited_by: currentProfile.id
          })
          .eq('id', editingTaskId);

        if (error) throw error;
        Toast.success('Task updated successfully!');
      } else {
        // Create new task
        const { error } = await supabase
          .from('tasks')
          .insert([{
            title,
            description,
            assigned_to,
            priority,
            due_date,
            room_id: currentProfile.room_id,
            created_by: currentProfile.id,
            status: 'assigned'
          }]);

        if (error) throw error;
        Toast.success('Task created successfully!');
      }

      closeCreateTaskModal();
      await loadTasks();

    } catch (error) {
      console.error('Submit task error:', error);
      Toast.error(error.message || 'Failed to save task');
    }
  };

  window.viewTaskDetails = async (taskId) => {
    try {
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      const userMap = new Map(allTeamUsers.map(u => [u.id, u.username]));
      const assignedUser = userMap.get(task.assigned_to) || 'Unassigned';

      DOM.setText(DOM.id('taskDetailTitle'), task.title);

      let contentHTML = `
        <div class="form-group">
          <label>Title</label>
          <input type="text" value="${task.title}" disabled>
        </div>
        <div class="form-group">
          <label>Assigned To</label>
          <input type="text" value="${assignedUser}" disabled>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea disabled style="min-height: 100px;">${task.description || 'No description'}</textarea>
        </div>
        <div class="grid grid-2">
          <div class="form-group">
            <label>Status</label>
            <input type="text" value="${task.status}" disabled>
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
        ${task.status === 'rejected' && task.rejection_reason ? `
          <div class="form-group">
            <label>Rejection Reason</label>
            <textarea disabled style="min-height: 80px; color: var(--danger-color);">${task.rejection_reason}</textarea>
          </div>
        ` : ''}
      `;

      DOM.setHTML(DOM.id('taskDetailContent'), contentHTML);

      let footerHTML = `<button onclick="closeTaskDetailModal()" class="btn btn-secondary">Close</button>`;

      if (task.status === 'submitted') {
        footerHTML += `
          <button onclick="rejectTask('${task.id}')" class="btn btn-danger">Reject</button>
          <button onclick="approveTask('${task.id}')" class="btn btn-success">Approve</button>
        `;
      }

      DOM.setHTML(DOM.id('taskDetailFooter'), footerHTML);
      DOM.removeClass(DOM.id('taskDetailModal'), 'hidden');

    } catch (error) {
      console.error('View task error:', error);
      Toast.error('Failed to load task details');
    }
  };

  window.closeTaskDetailModal = () => {
    DOM.addClass(DOM.id('taskDetailModal'), 'hidden');
  };

  window.deleteTask = (taskId) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status !== 'assigned') {
      Toast.error('Can only delete tasks in "Assigned" status');
      return;
    }

    if (!confirm(`Delete task "${task.title}"? This action cannot be undone.`)) return;

    (async () => {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: currentProfile.id
          })
          .eq('id', taskId);

        if (error) throw error;

        Toast.success('Task deleted');
        await loadTasks();

      } catch (error) {
        console.error('Delete task error:', error);
        Toast.error('Failed to delete task');
      }
    })();
  };

  window.approveTask = async (taskId) => {
    if (!confirm('Approve this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentProfile.id
        })
        .eq('id', taskId);

      if (error) throw error;

      Toast.success('Task Approved!');
      closeTaskDetailModal();
      await loadTasks();

    } catch (error) {
      console.error('Approve task error:', error);
      Toast.error('Failed to approve task');
    }
  };

  window.rejectTask = async (taskId) => {
    const reason = prompt('Provide rejection reason:');
    if (reason === null) return;
    if (!reason.trim()) {
      Toast.error('Rejection reason is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'rejected',
          rejection_reason: reason.trim()
        })
        .eq('id', taskId);

      if (error) throw error;

      Toast.warning('Task Rejected!');
      closeTaskDetailModal();
      await loadTasks();

    } catch (error) {
      console.error('Reject task error:', error);
      Toast.error('Failed to reject task');
    }
  };

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('✅ Admin tasks loaded');