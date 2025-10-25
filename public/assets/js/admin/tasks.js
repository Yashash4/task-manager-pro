// admin/tasks.js - Complete task management
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;
    let allTasks = [];
    let allUsers = [];

    async function init() {
        try {
            const auth = await Utils.api.checkAuth();
            if (!auth) return;

            currentProfile = auth.profile;

            if (!currentProfile.role_flags?.includes('admin')) {
                window.location.href = '/login.html';
                return;
            }

            await loadUsers();
            await loadTasks();

            Utils.dom.on(Utils.dom.id('taskSearch'), 'input', filterTasks);
            Utils.dom.on(Utils.dom.id('taskStatusFilter'), 'change', filterTasks);
            Utils.dom.on(Utils.dom.id('createTaskForm'), 'submit', submitCreateTask);

        } catch (error) {
            console.error('Init error:', error);
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

            allUsers = users || [];

            const select = Utils.dom.id('taskAssignTo');
            Utils.dom.setHTML(select, 
                '<option value="">Select User</option>' +
                allUsers.map(u => \<option value="\">\</option>\).join('')
            );

        } catch (error) {
            console.error('Load users error:', error);
        }
    }

    async function loadTasks() {
        try {
            if (!currentProfile.room_id) return;

            const { data: tasks } = await supabase
                .from('tasks')
                .select(\*, assigned_user:users_info!tasks_assigned_to_fkey(username)\)
                .eq('room_id', currentProfile.room_id)
                .order('created_at', { ascending: false });

            allTasks = tasks || [];
            renderTasks(allTasks);

        } catch (error) {
            console.error('Load tasks error:', error);
        }
    }

    function renderTasks(tasks) {
        const tbody = Utils.dom.id('tasksTableBody');

        if (!tasks || tasks.length === 0) {
            Utils.dom.setHTML(tbody, '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No tasks yet</td></tr>');
            return;
        }

        const priorityColors = {
            'low': '#22c55e',
            'medium': '#f59e0b',
            'high': '#ef4444',
            'urgent': '#dc2626'
        };

        const statusEmoji = {
            'assigned': '??',
            'in_progress': '?',
            'submitted': '??',
            'approved': '?',
            'rejected': '?'
        };

        const html = tasks.map(task => {
            let actions = '';
            if (task.status === 'submitted') {
                actions = \
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn" style="padding: 4px 8px; font-size: 0.75rem;" onclick="approveTask('\')">Approve</button>
                        <button class="btn secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="rejectTask('\')">Reject</button>
                    </div>
                \;
            } else {
                actions = '<span class="text-mut">-</span>';
            }

            return \
                <tr>
                    <td><strong>\</strong></td>
                    <td>\</td>
                    <td><span class="pill status-\">\ \</span></td>
                    <td><span style="color: \; font-weight: 600;">\</span></td>
                    <td>\</td>
                    <td>\</td>
                </tr>
            \;
        }).join('');

        Utils.dom.setHTML(tbody, html);
    }

    function filterTasks() {
        const search = Utils.dom.id('taskSearch')?.value.toLowerCase() || '';
        const status = Utils.dom.id('taskStatusFilter')?.value || '';

        const filtered = allTasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(search) ||
                                task.description?.toLowerCase().includes(search);
            const matchesStatus = !status || task.status === status;
            return matchesSearch && matchesStatus;
        });

        renderTasks(filtered);
    }

    window.openCreateTaskModal = () => {
        Utils.dom.id('createTaskForm').reset();
        Utils.dom.id('createTaskModal').style.display = 'flex';
    };

    window.closeCreateTaskModal = () => {
        Utils.dom.id('createTaskModal').style.display = 'none';
    };

    async function submitCreateTask(e) {
        e.preventDefault();

        const title = Utils.dom.id('taskTitle').value.trim();
        const desc = Utils.dom.id('taskDesc').value.trim();
        const assignTo = Utils.dom.id('taskAssignTo').value;
        const priority = Utils.dom.id('taskPriority').value;
        const dueDate = Utils.dom.id('taskDueDate').value;

        if (!title || !assignTo || !dueDate) {
            alert('Please fill all required fields');
            return;
        }

        try {
            const { error } = await supabase.from('tasks').insert([{
                room_id: currentProfile.room_id,
                title,
                description: desc || null,
                assigned_to: assignTo,
                priority,
                due_date: dueDate,
                created_by: currentProfile.id,
                status: 'assigned'
            }]);

            if (error) throw error;

            alert('Task created successfully!');
            window.closeCreateTaskModal();
            await loadTasks();

        } catch (error) {
            console.error('Create task error:', error);
            alert('Failed to create task');
        }
    }

    window.approveTask = async (taskId) => {
        if (!confirm('Approve this task?')) return;

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;
            alert('Task approved!');
            await loadTasks();

        } catch (error) {
            console.error('Approve error:', error);
            alert('Failed to approve task');
        }
    };

    window.rejectTask = async (taskId) => {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ 
                    status: 'rejected', 
                    rejection_reason: reason,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', taskId);

            if (error) throw error;
            alert('Task rejected!');
            await loadTasks();

        } catch (error) {
            console.error('Reject error:', error);
            alert('Failed to reject task');
        }
    };

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin tasks loaded');
