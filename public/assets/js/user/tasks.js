// user/tasks.js - Complete User Tasks Management
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    let userId = localStorage.getItem('userId');
    let currentFilter = 'all';
    let currentSort = 'dueDate';
    let searchQuery = '';
    
    if (!token || !userId) {
        window.location.href = '/login.html';
        return;
    }

    // Load tasks
    await loadTasks();
    
    // Setup event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                loadTasks();
            });
        });
        
        // Sort dropdown
        document.getElementById('sortTasks')?.addEventListener('change', (e) => {
            currentSort = e.target.value;
            loadTasks();
        });
        
        // Search
        document.getElementById('searchTasks')?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            debounce(() => loadTasks(), 300)();
        });
        
        // Create task button
        document.getElementById('createTaskBtn')?.addEventListener('click', openCreateTaskModal);
        
        // Task modal close
        document.getElementById('closeTaskModal')?.addEventListener('click', closeTaskModal);
        
        // Save task
        document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);
    }
    
    async function loadTasks() {
        try {
            let url = `${API_URL}/users/${userId}/tasks?`;
            
            if (currentFilter !== 'all') {
                url += `filter=${currentFilter}&`;
            }
            
            if (currentSort) {
                url += `sort=${currentSort}&`;
            }
            
            if (searchQuery) {
                url += `search=${encodeURIComponent(searchQuery)}&`;
            }
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderTasks(data.tasks);
                updateTaskCount(data.tasks.length);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            showNotification('Failed to load tasks', 'error');
        }
    }
    
    function renderTasks(tasks) {
        const container = document.getElementById('tasksContainer');
        if (!container) return;
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <h3>No tasks found</h3>
                    <p>Create your first task to get started</p>
                    <button class="btn btn-primary" onclick="document.getElementById('createTaskBtn').click()">
                        <i class="fas fa-plus"></i> Create Task
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = tasks.map(task => `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="task-checkbox">
                        <input type="checkbox" 
                               id="task-${task.id}" 
                               ${task.status === 'completed' ? 'checked' : ''}
                               onchange="toggleTaskStatus(${task.id}, this.checked)">
                        <label for="task-${task.id}"></label>
                    </div>
                    <div class="task-title ${task.status === 'completed' ? 'completed' : ''}">
                        <h4>${escapeHtml(task.title)}</h4>
                        <p>${escapeHtml(task.description || '')}</p>
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon" onclick="editTask(${task.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteTask(${task.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="task-card-footer">
                    <div class="task-meta">
                        <span class="badge badge-${getPriorityClass(task.priority)}">${task.priority}</span>
                        <span class="badge badge-${getStatusClass(task.status)}">${task.status}</span>
                        ${task.room ? `<span class="badge badge-info">${escapeHtml(task.room)}</span>` : ''}
                    </div>
                    <div class="task-due ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : ''}">
                        <i class="fas fa-clock"></i> ${formatDueDate(task.dueDate)}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    window.toggleTaskStatus = async function(taskId, completed) {
        try {
            const status = completed ? 'completed' : 'pending';
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Task updated successfully', 'success');
                await loadTasks();
            }
        } catch (error) {
            console.error('Error updating task:', error);
            showNotification('Failed to update task', 'error');
        }
    };
    
    window.editTask = async function(taskId) {
        try {
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                openEditTaskModal(data.task);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showNotification('Failed to load task', 'error');
        }
    };
    
    window.deleteTask = async function(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Task deleted successfully', 'success');
                await loadTasks();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showNotification('Failed to delete task', 'error');
        }
    };
    
    function openCreateTaskModal() {
        const modal = document.getElementById('taskModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Create New Task';
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        modal.style.display = 'block';
    }
    
    function openEditTaskModal(task) {
        const modal = document.getElementById('taskModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskDueDate').value = task.dueDate ? task.dueDate.split('T')[0] : '';
        document.getElementById('taskRoom').value = task.roomId || '';
        
        modal.style.display = 'block';
    }
    
    function closeTaskModal() {
        const modal = document.getElementById('taskModal');
        if (modal) modal.style.display = 'none';
    }
    
    async function saveTask() {
        const taskId = document.getElementById('taskId').value;
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            dueDate: document.getElementById('taskDueDate').value,
            roomId: document.getElementById('taskRoom').value || null
        };
        
        if (!taskData.title) {
            showNotification('Please enter a task title', 'error');
            return;
        }
        
        try {
            const url = taskId ? `${API_URL}/tasks/${taskId}` : `${API_URL}/tasks`;
            const method = taskId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification(`Task ${taskId ? 'updated' : 'created'} successfully`, 'success');
                closeTaskModal();
                await loadTasks();
            } else {
                showNotification(data.message || 'Failed to save task', 'error');
            }
        } catch (error) {
            console.error('Error saving task:', error);
            showNotification('Failed to save task', 'error');
        }
    }
    
    function updateTaskCount(count) {
        const counter = document.getElementById('taskCount');
        if (counter) counter.textContent = count;
    }
    
    function getPriorityClass(priority) {
        const map = { high: 'danger', medium: 'warning', low: 'info' };
        return map[priority?.toLowerCase()] || 'secondary';
    }
    
    function getStatusClass(status) {
        const map = { 
            completed: 'success', 
            'in progress': 'primary', 
            pending: 'warning', 
            overdue: 'danger' 
        };
        return map[status?.toLowerCase()] || 'secondary';
    }
    
    function formatDueDate(date) {
        if (!date) return 'No due date';
        const d = new Date(date);
        const now = new Date();
        const diff = d - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return `Overdue by ${Math.abs(days)} days`;
        if (days === 0) return 'Due today';
        if (days === 1) return 'Due tomorrow';
        return `Due in ${days} days`;
    }
    
    function isOverdue(date) {
        return date && new Date(date) < new Date();
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});