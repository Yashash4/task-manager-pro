// ==========================================
// ADMIN TASKS MANAGEMENT
// ==========================================

let currentProfile = null;
let allTeamUsers = []; // Cache for user data to avoid complex joins

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
      if (!currentProfile || !currentProfile.role_flags?.includes('admin')) {
        await supabase.auth.signOut();
        window.location.href = '/auth/login.html';
        return;
      }
      if (currentProfile.room_id) {
        const { data: room } = await supabase.from('rooms').select('name').eq('id', currentProfile.room_id).single();
        if (room) DOM.setText(DOM.id('orgName'), room.name);
      }
      await loadUsers();
      await loadTasks();
      DOM.on(DOM.id('taskSearch'), 'input', debounce(filterTasks, 300));
      DOM.on(DOM.id('taskStatusFilter'), 'change', filterTasks);
    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize the tasks page');
    }
  }

  async function loadUsers() {
    try {
      if (!currentProfile.room_id) return;
      const { data: users, error } = await supabase.from('users_info').select('id, username').eq('room_id', currentProfile.room_id).eq('approved', true).contains('role_flags', '["user"]');
      if (error) throw error;
      allTeamUsers = users || [];
      const select = DOM.id('taskAssignTo');
      select.innerHTML = '<option value="">Select User</option>' + (allTeamUsers.map(u => `<option value="${u.id}">${u.username}</option>`).join('') || '');
    } catch (error) {
      console.error('Load users for dropdown error:', error);
      Toast.error('Could not load users for assignment.');
    }
  }

  async function loadTasks() {
    const tbody = DOM.id('tasksBody');
    try {
      if (!currentProfile.room_id) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No room found. Please create one first.</td></tr>';
        return;
      }
      const { data: tasks, error } = await supabase.from('tasks').select(`id, title, description, status, priority, due_date, created_at, assigned_to, rejection_reason`).eq('room_id', currentProfile.room_id).order('created_at', { ascending: false });
      if (error) throw error;
      window.allTasks = tasks || [];
      renderTasks(window.allTasks);
    } catch (error) {
      console.error('Load tasks error:', error);
      Toast.error('Failed to load tasks');
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading tasks.</td></tr>';
    }
  }

  function renderTasks(tasks) {
    const tbody = DOM.id('tasksBody');
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No tasks found</td></tr>';
      return;
    }
    const userMap = new Map(allTeamUsers.map(user => [user.id, user.username]));
    const statusIcons = { 'assigned': '📥', 'in_progress': '🔄', 'submitted': '📤', 'approved': '✅', 'rejected': '❌' };
    const priorityColors = { 'low': '#22c55e', 'medium': '#f59e0b', 'high': '#ef4444', 'urgent': '#dc2626' };
    tbody.innerHTML = tasks.map(task => `
      <tr>
        <td><code style="color: var(--text-muted);">${task.id.slice(0,8)}...</code></td>
        <td><strong>${task.title}</strong></td>
        <td>${userMap.get(task.assigned_to) || 'N/A'}</td>
        <td><span class="badge badge-primary">${statusIcons[task.status] || ''} ${task.status}</span></td>
        <td><span style="color: ${priorityColors[task.priority]}; font-weight: 600;">${task.priority}</span></td>
        <td>${new Date(task.due_date).toLocaleDateString()}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="viewTask('${task.id}')">View</button></td>
      </tr>`).join('');
  }

  function filterTasks() {
    const search = DOM.id('taskSearch')?.value.toLowerCase() || '';
    const status = DOM.id('taskStatusFilter')?.value || '';
    const filtered = window.allTasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(search) || (task.description && task.description.toLowerCase().includes(search));
      const matchesStatus = !status || task.status === status;
      return matchesSearch && matchesStatus;
    });
    renderTasks(filtered);
  }

  // MODAL FUNCTIONS
  window.openCreateTaskModal = () => { DOM.id('createTaskForm').reset(); DOM.removeClass(DOM.id('createTaskModal'), 'hidden'); };
  window.closeCreateTaskModal = () => { DOM.addClass(DOM.id('createTaskModal'), 'hidden'); };
  window.closeTaskDetailModal = () => { DOM.addClass(DOM.id('taskDetailModal'), 'hidden'); };

  window.submitCreateTask = async () => {
    const taskData = {
      title: DOM.id('taskTitle')?.value.trim(),
      description: DOM.id('taskDescription')?.value.trim() || null,
      assigned_to: DOM.id('taskAssignTo')?.value,
      priority: DOM.id('taskPriority')?.value,
      due_date: DOM.id('taskDueDate')?.value,
      room_id: currentProfile.room_id,
      created_by: currentProfile.id,
      status: 'assigned'
    };
    if (!taskData.title || !taskData.assigned_to || !taskData.due_date) { Toast.error('Please fill in all required fields'); return; }
    try {
      const { error } = await supabase.from('tasks').insert([taskData]);
      if (error) throw error;
      Toast.success('Task created successfully!');
      closeCreateTaskModal();
      await loadTasks();
    } catch (error) {
      console.error('Create task error:', error);
      Toast.error(error.message || 'Failed to create task');
    }
  };

  // ✅ FULLY IMPLEMENTED viewTask FUNCTION
  window.viewTask = (taskId) => {
    const task = window.allTasks.find(t => t.id === taskId);
    if (!task) { Toast.error('Task not found'); return; }

    const userMap = new Map(allTeamUsers.map(user => [user.id, user.username]));
    const assignedUser = userMap.get(task.assigned_to) || 'Unassigned';

    DOM.setText(DOM.id('taskDetailTitle'), task.title);

    const contentHTML = `
      <div class="form-group"><label>Assigned To</label><input type="text" value="${assignedUser}" disabled></div>
      <div class="form-group"><label>Status</label><input type="text" value="${task.status}" disabled></div>
      <div class="form-group"><label>Description</label><textarea disabled style="min-height: 80px;">${task.description || 'No description'}</textarea></div>
      ${task.status === 'rejected' && task.rejection_reason ? `<div class="form-group"><label>Rejection Reason</label><textarea disabled style="min-height: 60px; color: var(--danger-color);">${task.rejection_reason}</textarea></div>` : ''}
    `;
    DOM.setHTML(DOM.id('taskDetailContent'), contentHTML);

    let footerHTML = `<button onclick="closeTaskDetailModal()" class="btn btn-secondary">Close</button>`;
    if (task.status === 'submitted') {
      footerHTML += `
        <button onclick="rejectTask('${taskId}')" class="btn btn-danger">Reject</button>
        <button onclick="approveTask('${taskId}')" class="btn btn-success">Approve</button>
      `;
    }
    DOM.setHTML(DOM.id('taskDetailFooter'), footerHTML);
    DOM.removeClass(DOM.id('taskDetailModal'), 'hidden');
  };

  // ✅ NEW approveTask FUNCTION
  window.approveTask = async (taskId) => {
    if (!confirm('Are you sure you want to approve this task?')) return;
    try {
      const { error } = await supabase.from('tasks').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: currentProfile.id }).eq('id', taskId);
      if (error) throw error;
      Toast.success('Task Approved!');
      closeTaskDetailModal();
      await loadTasks();
    } catch (error) {
      console.error('Approve task error:', error);
      Toast.error('Failed to approve task.');
    }
  };
  
  // ✅ NEW rejectTask FUNCTION
  window.rejectTask = async (taskId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) return; // User cancelled the prompt
    if (!reason.trim()) { Toast.error('Rejection reason is required.'); return; }
    try {
      const { error } = await supabase.from('tasks').update({ status: 'rejected', rejection_reason: reason.trim() }).eq('id', taskId);
      if (error) throw error;
      Toast.warning('Task Rejected!');
      closeTaskDetailModal();
      await loadTasks();
    } catch (error) {
      console.error('Reject task error:', error);
      Toast.error('Failed to reject task.');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();

console.log('? Admin tasks loaded');