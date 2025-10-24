// ==========================================
// ADMIN TASKS MANAGEMENT
// ==========================================

let currentProfile = null;

(async function () {
  const supabase = window.SUPABASE?.client?.();
  if (!supabase) return;

  // Initialize
  async function init() {
    try {
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

      // Set org name
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

      // Event listeners
      DOM.on(DOM.id('taskSearch'), 'input', debounce(filterTasks, 300));
      DOM.on(DOM.id('taskStatusFilter'), 'change', filterTasks);

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize');
    }
  }

  async function loadUsers() {
    try {
      if (!currentProfile.room_id) return;

      const { data: users } = await supabase
        .from('users_info')
        .select('id, username')
        .eq('room_id', currentProfile.room_id)
        .eq('approved', true)
        .contains('role_flags', ['user']);

      const select = DOM.id('taskAssignTo');
      select.innerHTML = '<option value="">Select User</option>' + 
        (users?.map(u => `<option value="${u.id}">${u.username}</option>`).join('') || '');

    } catch (error) {
      console.error('Load users error:', error);
    }
  }

  async function loadTasks() {
    try {
      if (!currentProfile.room_id) return;

      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, due_date, created_at,
          assigned_user:users_info!tasks_assigned_to_fkey(username)
        `)
        .eq('room_id', currentProfile.room_id)
        .order('created_at', { ascending: false });

      window.allTasks = tasks || [];
      renderTasks(window.allTasks);

    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
    }
  }

  function renderTasks(tasks) {
    const tbody = DOM.id('tasksBody');
    
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No tasks found</td></tr>';
      return;
    }

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
        <td><code style="color: var(--text-muted);">${task.id.slice(0,8)}...</code></td>
        <td><strong>${task.title}</strong></td>
        <td>${task.assigned_user?.username || 'N/A'}</td>
        <td><span class="badge badge-primary">${statusIcons[task.status] || ''} ${task.status}</span></td>
        <td><span style="color: ${priorityColors[task.priority]}; font-weight: 600;">${task.priority}</span></td>
        <td>${new Date(task.due_date).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewTask('${task.id}')">View</button>
        </td>
      </tr>
    `).join('');
  }

  function filterTasks() {
    const search = DOM.id('taskSearch')?.value.toLowerCase() || '';
    const status = DOM.id('taskStatusFilter')?.value || '';

    const filtered = window.allTasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(search) ||
                           task.description?.toLowerCase().includes(search);
      const matchesStatus = !status || task.status === status;
      return matchesSearch && matchesStatus;
    });

    renderTasks(filtered);
  }

  // Modal functions
  window.openCreateTaskModal = () => {
    FormValidator.clearErrors('createTaskForm');
    DOM.id('createTaskForm').reset();
    DOM.removeClass(DOM.id('createTaskModal'), 'hidden');
  };

  window.closeCreateTaskModal = () => {
    DOM.addClass(DOM.id('createTaskModal'), 'hidden');
  };

  window.submitCreateTask = async () => {
    const title = DOM.id('taskTitle')?.value.trim();
    const description = DOM.id('taskDescription')?.value.trim();
    const assignTo = DOM.id('taskAssignTo')?.value;
    const priority = DOM.id('taskPriority')?.value;
    const dueDate = DOM.id('taskDueDate')?.value;

    if (!title || !assignTo || !dueDate) {
      Toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .insert([{
          room_id: currentProfile.room_id,
          title,
          description: description || null,
          assigned_to: assignTo,
          priority,
          due_date: dueDate,
          created_by: currentProfile.id,
          status: 'assigned'
        }]);

      if (error) throw error;

      Toast.success('Task created successfully!');
      window.closeCreateTaskModal();
      await loadTasks();

    } catch (error) {
      console.error('Create task error:', error);
      Toast.error(error.message || 'Failed to create task');
    }
  };

  window.viewTask = (taskId) => {
    Toast.info('Task details coming soon');
  };

  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin tasks loaded');