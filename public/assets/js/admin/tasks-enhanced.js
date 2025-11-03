// ==========================================
// ADMIN TASKS MANAGEMENT - ENHANCED
// Path: /public/assets/js/admin/tasks-enhanced.js
// ==========================================

(async function() {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) {
    Toast.error('Database connection not available');
    return;
  }

  let currentProfile = null;
  let allTasks = [];
  let filteredTasks = [];
  let searchQuery = '';
  let statusFilter = '';

  // Initialize
  async function init() {
    const user = await API.getCurrentUser();
    if (!user) {
      window.location.href = '/auth/login.html';
      return;
    }

    currentProfile = await API.getUserProfile(user.id);
    if (!currentProfile || !currentProfile.role_flags?.includes('admin')) {
      await supabase.auth.signOut();
      window.location.href = '/auth/login.html';
      return;
    }

    await loadTasks();
    await loadUsers();
    setupEventListeners();
  }

  // Setup event listeners
  function setupEventListeners() {
    // Search
    const searchInput = DOM.id('taskSearch');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value.toLowerCase();
        filterTasks();
      }, 300));
    }

    // Status filter
    const statusFilterSelect = DOM.id('taskStatusFilter');
    if (statusFilterSelect) {
      statusFilterSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        filterTasks();
      });
    }

    // Create task modal
    const createTaskBtn = DOM.id('createTaskBtn');
    if (createTaskBtn) {
      createTaskBtn.addEventListener('click', openCreateTaskModal);
    }

    // Close modals
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeAllModals();
      }
    });
  }

  // Load tasks from database
  async function loadTasks() {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users_info!tasks_assigned_to_fkey(username),
          created_by_user:users_info!tasks_created_by_fkey(username),
          room:rooms(name)
        `)
        .eq('room_id', currentProfile.room_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      allTasks = tasks || [];
      filterTasks();
      updateStats();
    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
    }
  }

  // Filter tasks based on search and status
  function filterTasks() {
    filteredTasks = allTasks.filter(task => {
      const matchesSearch = !searchQuery || 
        task.title.toLowerCase().includes(searchQuery) ||
        task.description?.toLowerCase().includes(searchQuery) ||
        task.assigned_user?.username.toLowerCase().includes(searchQuery);

      const matchesStatus = !statusFilter || task.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    renderTasks();
  }

  // Render tasks in table
  function renderTasks() {
    const tbody = DOM.id('tasksTableBody');
    if (!tbody) return;

    if (filteredTasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem;">
            <div class="empty-state">
              <i class="fas fa-tasks"></i>
              <h3>No tasks found</h3>
              <p>Create your first task to get started</p>
              <button class="btn btn-primary mt-2" onclick="window.openCreateTaskModal()">
                <i class="fas fa-plus"></i> Create Task
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredTasks.map(task => {
      const isOverdue = TimeHelper.isOverdue(task.due_date) && 
                       task.status !== 'approved' && 
                       task.status !== 'rejected';
      
      return `
        <tr class="${isOverdue ? 'task-overdue' : ''}" data-task-id="${task.id}">
          <td>
            <div class="task-title-cell">
              <h5 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${task.title}</h5>
              ${task.description ? `<p class="text-muted" style="margin: 0; font-size: 0.85rem;">${task.description.substring(0, 80)}${task.description.length > 80 ? '...' : ''}</p>` : ''}
            </div>
          </td>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">${getInitials(task.assigned_user?.username || 'NA')}</div>
              <span>${task.assigned_user?.username || 'Unassigned'}</span>
            </div>
          </td>
          <td><span class="pill status-${task.status}">${formatStatus(task.status)}</span></td>
          <td><span class="badge priority-${task.priority}">${task.priority}</span></td>
          <td class="${isOverdue ? 'text-danger' : ''}">${TimeHelper.formatDate(task.due_date)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" onclick="window.viewTask('${task.id}')" title="View Details">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon" onclick="window.editTask('${task.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon btn-danger" onclick="window.deleteTask('${task.id}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update statistics
  function updateStats() {
    const stats = {
      total: allTasks.length,
      assigned: allTasks.filter(t => t.status === 'assigned').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      submitted: allTasks.filter(t => t.status === 'submitted').length,
      approved: allTasks.filter(t => t.status === 'approved').length,
      rejected: allTasks.filter(t => t.status === 'rejected').length
    };

    // Update stats display if elements exist
    ['total', 'assigned', 'inProgress', 'submitted', 'approved', 'rejected'].forEach(key => {
      const el = DOM.id(`stat-${key}`);
      if (el) DOM.setText(el, stats[key]);
    });
  }

  // Load users for assignment dropdown
  async function loadUsers() {
    try {
      const { data: users, error } = await supabase
        .from('users_info')
        .select('id, username, email')
        .eq('room_id', currentProfile.room_id)
        .eq('approved', true)
        .order('username');

      if (error) throw error;

      const select = DOM.id('taskAssignTo');
      if (select) {
        select.innerHTML = `
          <option value="">Select User</option>
          ${(users || []).map(user => `
            <option value="${user.id}">${user.username}</option>
          `).join('')}
        `;
      }
    } catch (error) {
      console.error('Load users error:', error);
    }
  }

  // Open create task modal
  window.openCreateTaskModal = function() {
    const modal = DOM.id('createTaskModal');
    if (!modal) return;

    DOM.id('modalTitle').textContent = 'Create New Task';
    DOM.id('taskId').value = '';
    DOM.id('createTaskForm').reset();
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    DOM.id('taskDueDate').value = tomorrow.toISOString().split('T')[0];
    
    modal.style.display = 'flex';
  };

  // Close all modals
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  window.closeCreateTaskModal = closeAllModals;

  // Submit create task
  window.submitCreateTask = async function() {
    const taskId = DOM.id('taskId').value;
    const title = DOM.id('taskTitle').value.trim();
    const description = DOM.id('taskDesc').value.trim();
    const assignedTo = DOM.id('taskAssignTo').value;
    const priority = DOM.id('taskPriority').value;
    const dueDate = DOM.id('taskDueDate').value;

    if (!title) {
      Toast.error('Task title is required');
      return;
    }

    if (!assignedTo) {
      Toast.error('Please assign the task to a user');
      return;
    }

    if (!dueDate) {
      Toast.error('Due date is required');
      return;
    }

    try {
      const taskData = {
        title,
        description,
        assigned_to: assignedTo,
        priority,
        due_date: dueDate,
        room_id: currentProfile.room_id,
        created_by: currentProfile.id,
        status: 'assigned'
      };

      let result;
      if (taskId) {
        // Update existing task
        result = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', taskId);
      } else {
        // Create new task
        result = await supabase
          .from('tasks')
          .insert([taskData]);
      }

      if (result.error) throw result.error;

      Toast.success(taskId ? 'Task updated successfully' : 'Task created successfully');
      
      // Create notification for assigned user
      if (!taskId) {
        await NotificationSystem.createNotification(
          assignedTo,
          null,
          'task_assigned',
          `New task assigned: ${title}`
        );
      }

      closeAllModals();
      await loadTasks();
    } catch (error) {
      console.error('Create/update task error:', error);
      Toast.error('Failed to save task');
    }
  };

  // View task details
  window.viewTask = async function(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Task Details</h2>
          <button class="btn-icon" onclick="this.closest('.modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Title</label>
            <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
              ${task.title}
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
              ${task.description || 'No description'}
            </div>
          </div>
          <div class="grid cols-2">
            <div class="form-group">
              <label>Assigned To</label>
              <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
                ${task.assigned_user?.username || 'Unassigned'}
              </div>
            </div>
            <div class="form-group">
              <label>Status</label>
              <span class="pill status-${task.status}">${formatStatus(task.status)}</span>
            </div>
          </div>
          <div class="grid cols-2">
            <div class="form-group">
              <label>Priority</label>
              <span class="badge priority-${task.priority}">${task.priority}</span>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <div style="padding: 10px; background: var(--bg-darker); border-radius: var(--radius-md);">
                ${TimeHelper.formatDate(task.due_date)}
              </div>
            </div>
          </div>
          ${task.rejection_reason ? `
            <div class="alert alert-error">
              <i class="fas fa-exclamation-circle"></i>
              <div class="alert-content">
                <div class="alert-title">Rejection Reason</div>
                <div class="alert-message">${task.rejection_reason}</div>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          ${task.status === 'submitted' ? `
            <button class="btn btn-success" onclick="window.approveTask('${task.id}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-danger" onclick="window.rejectTask('${task.id}')">
              <i class="fas fa-times"></i> Reject
            </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  // Edit task
  window.editTask = async function(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    DOM.id('taskId').value = task.id;
    DOM.id('taskTitle').value = task.title;
    DOM.id('taskDesc').value = task.description || '';
    DOM.id('taskAssignTo').value = task.assigned_to;
    DOM.id('taskPriority').value = task.priority;
    DOM.id('taskDueDate').value = task.due_date;

    DOM.id('modalTitle').textContent = 'Edit Task';
    DOM.id('createTaskModal').style.display = 'flex';
  };

  // Delete task
  window.deleteTask = async function(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    // Show confirmation dialog
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal-overlay';
    confirmModal.innerHTML = `
      <div class="modal confirm-dialog">
        <div class="modal-body">
          <div class="confirm-icon danger">
            <i class="fas fa-trash"></i>
          </div>
          <h2 class="confirm-title">Delete Task?</h2>
          <p class="confirm-message">
            Are you sure you want to delete "${task.title}"? This action cannot be undone.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-danger" onclick="window.confirmDeleteTask('${taskId}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModal);
  };

  // Confirm delete task
  window.confirmDeleteTask = async function(taskId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      Toast.success('Task deleted successfully');
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      await loadTasks();
    } catch (error) {
      console.error('Delete task error:', error);
      Toast.error('Failed to delete task');
    }
  };

  // Approve task
  window.approveTask = async function(taskId) {
    try {
      const task = allTasks.find(t => t.id === taskId);
      
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentProfile.id
        })
        .eq('id', taskId);

      if (error) throw error;

      // Create notification
      await NotificationSystem.createNotification(
        task.assigned_to,
        taskId,
        'task_approved',
        `Task approved: ${task.title}`
      );

      Toast.success('Task approved');
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      await loadTasks();
    } catch (error) {
      console.error('Approve task error:', error);
      Toast.error('Failed to approve task');
    }
  };

  // Reject task
  window.rejectTask = async function(taskId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const task = allTasks.find(t => t.id === taskId);
      
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', taskId);

      if (error) throw error;

      // Create notification
      await NotificationSystem.createNotification(
        task.assigned_to,
        taskId,
        'task_rejected',
        `Task rejected: ${task.title}. Reason: ${reason}`
      );

      Toast.success('Task rejected');
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      await loadTasks();
    } catch (error) {
      console.error('Reject task error:', error);
      Toast.error('Failed to reject task');
    }
  };

  // Helper functions
  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function formatStatus(status) {
    return status.replace('_', ' ').toUpperCase();
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();

console.log('✅ Admin tasks (enhanced) loaded');