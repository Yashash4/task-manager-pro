// user/tasks.js - Complete user task management
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;
    let allTasks = [];

    async function init() {
        try {
            const auth = await Utils.api.checkAuth();
            if (!auth) return;

            currentProfile = auth.profile;

            if (!currentProfile.approved) {
                await supabase.auth.signOut();
                window.location.href = '/login.html';
                return;
            }

            await loadTasks();

            Utils.dom.on(Utils.dom.id('taskSearch'), 'input', (e) => {
                filterTasks(e.target.value);
            });

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadTasks() {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', currentProfile.id)
                .order('due_date', { ascending: true });

            allTasks = tasks || [];
            renderTasks(allTasks);

        } catch (error) {
            console.error('Load tasks error:', error);
        }
    }

    function renderTasks(tasks) {
        const container = Utils.dom.id('tasksContainer');

        if (!tasks || tasks.length === 0) {
            Utils.dom.setHTML(container, '<p class="text-mut" style="text-align: center; padding: 2rem;">No tasks assigned</p>');
            return;
        }

        const statusEmoji = {
            'assigned': '??',
            'in_progress': '?',
            'submitted': '??',
            'approved': '?',
            'rejected': '?'
        };

        const priorityColors = {
            'low': '#22c55e',
            'medium': '#f59e0b',
            'high': '#ef4444',
            'urgent': '#dc2626'
        };

        const html = tasks.map(task => {
            const isOverdue = task.due_date && Utils.time.isOverdue(task.due_date);
            const borderColor = task.status === 'approved' ? '#22c55e' : 
                               task.status === 'rejected' ? '#ef4444' : 'var(--brand)';

            let actions = '';
            if (task.status === 'assigned') {
                actions = '<button class="btn" onclick="updateStatus(' + "'" + task.id + "'" + ', ' + "'in_progress'" + ')" style="padding: 8px 12px; font-size: 0.9rem;">Start Working</button>';
            } else if (task.status === 'in_progress') {
                actions = '<button class="btn" onclick="updateStatus(\'' + task.id + '\', \'submitted\')" style="padding: 8px 12px; font-size: 0.9rem;">Submit for Review</button>';
            } else if (task.status === 'rejected') {
                actions = '<button class="btn secondary" onclick="updateStatus(\'' + task.id + '\', \'in_progress\')" style="padding: 8px 12px; font-size: 0.9rem;">Rework</button>';
            }

            return \
                <div style="background: var(--elev); padding: 1.5rem; border-radius: 8px; border-left: 4px solid \; cursor: pointer;" onclick="viewTask('\')">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <h3 style="margin: 0; font-size: 1.1rem;">\</h3>
                        <span class="pill status-\">\ \</span>
                    </div>
                    
                    \
                    
                    <div style="display: flex; gap: 2rem; font-size: 0.9rem; color: var(--mut); margin: 1rem 0;">
                        <span>?? Priority: <span style="color: \; font-weight: 600;">\</span></span>
                        <span>?? Due: \\</span>
                    </div>
                    
                    \
                </div>
            \;
        }).join('');

        Utils.dom.setHTML(container, html);
    }

    function filterTasks(search) {
        const filtered = allTasks.filter(t =>
            t.title.toLowerCase().includes(search.toLowerCase()) ||
            t.description?.toLowerCase().includes(search.toLowerCase())
        );
        renderTasks(filtered);
    }

    window.viewTask = async (taskId) => {
        try {
            const task = allTasks.find(t => t.id === taskId);
            if (!task) return;

            Utils.dom.setText(Utils.dom.id('taskModalTitle'), task.title);

            let actions = '';
            if (task.status === 'assigned') {
                actions = '<button class="btn" onclick="updateStatus(\'' + task.id + '\', \'in_progress\')" style="width: 100%; margin-top: 1rem;">Start Working</button>';
            } else if (task.status === 'in_progress') {
                actions = '<button class="btn" onclick="updateStatus(\'' + task.id + '\', \'submitted\')" style="width: 100%; margin-top: 1rem;">Submit for Review</button>';
            } else if (task.status === 'rejected') {
                actions = '<button class="btn secondary" onclick="updateStatus(\'' + task.id + '\', \'in_progress\')" style="width: 100%; margin-top: 1rem;">Rework Task</button>';
            }

            const content = \
                <div class="toolbar vertical">
                    <div>
                        <label>Title</label>
                        <input type="text" value="\" disabled class="input">
                    </div>

                    <div>
                        <label>Description</label>
                        <textarea disabled class="input" style="min-height: 100px;">\</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label>Status</label>
                            <input type="text" value="\" disabled class="input">
                        </div>
                        <div>
                            <label>Priority</label>
                            <input type="text" value="\" disabled class="input">
                        </div>
                    </div>

                    <div>
                        <label>Due Date</label>
                        <input type="text" value="\" disabled class="input">
                    </div>

                    \

                    \
                </div>
            \;

            Utils.dom.setHTML(Utils.dom.id('taskModalContent'), content);
            Utils.dom.id('taskModal').style.display = 'flex';

        } catch (error) {
            console.error('View task error:', error);
        }
    };

    window.closeTaskModal = () => {
        Utils.dom.id('taskModal').style.display = 'none';
    };

    window.updateStatus = async (taskId, newStatus) => {
        if (!confirm('Update task status?')) return;

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;

            const messages = {
                'in_progress': '? Task marked as in progress!',
                'submitted': '? Task submitted for review!',
            };

            alert(messages[newStatus] || 'Task updated!');
            window.closeTaskModal();
            await loadTasks();

        } catch (error) {
            console.error('Update error:', error);
            alert('Failed to update task');
        }
    };

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? User tasks loaded');
