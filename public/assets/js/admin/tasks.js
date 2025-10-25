// admin/tasks.js - Complete Admin Task Management
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    let searchQuery = '';
    let currentFilter = 'all';
    let currentSort = 'dueDate';
    let currentPage = 1;
    let pageSize = 10;
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load initial data
    await loadTasks();
    await loadUsers();
    await loadRooms();
    
    // Setup event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Search
        document.getElementById('searchTasks')?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            debounce(() => loadTasks(), 300)();
        });
        
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
        
        // Create task button
        document.getElementById('createTaskBtn')?.addEventListener('click', openCreateTaskModal);
        
        // Task modal close
        document.getElementById('closeTaskModal')?.addEventListener('click', closeTaskModal);
        
        // Save task
        document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);
        
        // Page size
        document.getElementById('pageSize')?.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value);
            currentPage = 1;
            loadTasks();
        });
    }
    
    async function loadTasks() {
        try {
            let url = `${API_URL}/admin/tasks?page=${currentPage}&limit=${pageSize}`;
            
            if (currentFilter !== 'all') {
                url += `&filter=${currentFilter}`;
            }
            
            if (currentSort) {
                url += `&sort=${currentSort}`;
            }
            
            if (searchQuery) {
                url += `&search=${encodeURIComponent(searchQuery)}`;
            }
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderTasks(data.tasks);
                renderPagination(data.pagination);
                updateStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            showNotification('Failed to load tasks', 'error');
        }
    }
    
    async function loadUsers() {
        try {
            const res = await fetch(`${API_URL}/admin/users?limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                populateUserDropdown(data.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    async function loadRooms() {
        try {
            const res = await fetch(`${API_URL}/admin/rooms?limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                populateRoomDropdown(data.rooms);
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
        }
    }
    
    function renderTasks(tasks) {
        const tbody = document.querySelector('#tasksTable tbody');
        if (!tbody) return;
        
        if (!tasks || tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-tasks"></i>
                            <p>No tasks found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = tasks.map(task => `
            <tr data-task-id="${task.id}" class="${isOverdue(task.dueDate, task.status) ? 'task-overdue' : ''}">
                <td>
                    <div class="task-title-cell">
                        <h5>${escapeHtml(task.title)}</h5>
                        <p class="task-desc">${escapeHtml(task.description || '').substring(0, 100)}${task.description?.length > 100 ? '...' : ''}</p>
                    </div>
                </td>
                <td><span class="badge badge-${getPriorityClass(task.priority)}">${task.priority}</span></td>
                <td><span class="badge badge-${getStatusClass(task.status)}">${task.status}</span></td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">${getInitials(task.assignedTo || 'NA')}</div>
                        <span>${escapeHtml(task.assignedTo || 'Unassigned')}</span>
                    </div>
                </td>
                <td>${task.room ? `<span class="badge badge-info">${escapeHtml(task.room)}</span>` : '-'}</td>
                <td class="${isOverdue(task.dueDate, task.status) ? 'text-danger' : ''}">${formatDate(task.dueDate)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="viewTask(${task.id})" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="editTask(${task.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="reassignTask(${task.id})" title="Reassign">
                            <i class="fas fa-user-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteTask(${task.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    function renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container || !pagination) return;
        
        const { currentPage: page, totalPages, totalTasks } = pagination;
        
        let html = `<div class="pagination-info">Showing ${((page - 1) * pageSize) + 1} to ${Math.min(page * pageSize, totalTasks)} of ${totalTasks} tasks</div>`;
        html += '<div class="pagination-buttons">';
        
        html += `<button class="btn btn-sm" onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>`;
        
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : ''}" onclick="changePage(${i})">${i}</button>`;
        }
        
        html += `<button class="btn btn-sm" onclick="changePage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>`;
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    function updateStats(stats) {
        if (!stats) return;
        
        document.getElementById('totalTasks').textContent = stats.total || 0;
        document.getElementById('activeTasks').textContent = stats.active || 0;
        document.getElementById('completedTasks').textContent = stats.completed || 0;
        document.getElementById('overdueTasks').textContent = stats.overdue || 0;
    }
    
    function populateUserDropdown(users) {
        const select = document.getElementById('taskAssignedTo');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select User</option>' + 
            users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('');
    }
    
    function populateRoomDropdown(rooms) {
        const select = document.getElementById('taskRoom');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Room (Optional)</option>' + 
            rooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('');
    }
    
    window.changePage = function(page) {
        currentPage = page;
        loadTasks();
    };
    
    window.viewTask = async function(taskId) {
        try {
            const res = await fetch(`${API_URL}/admin/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                showTaskDetails(data.task);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showNotification('Failed to load task details', 'error');
        }
    };
    
    window.editTask = async function(taskId) {
        try {
            const res = await fetch(`${API_URL}/admin/tasks/${taskId}`, {
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
    
    window.reassignTask = async function(taskId) {
        const userId = prompt('Enter User ID to reassign task:');
        if (!userId) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/tasks/${taskId}/reassign`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(userId) })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Task reassigned successfully', 'success');
                await loadTasks();
            }
        } catch (error) {
            console.error('Error reassigning task:', error);
            showNotification('Failed to reassign task', 'error');
        }
    };
    
    window.deleteTask = async function(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/tasks/${taskId}`, {
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
        document.getElementById('taskAssignedTo').value = task.assignedToId || '';
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
            assignedToId: document.getElementById('taskAssignedTo').value || null,
            roomId: document.getElementById('taskRoom').value || null
        };
        
        if (!taskData.title) {
            showNotification('Please enter a task title', 'error');
            return;
        }
        
        try {
            const url = taskId ? `${API_URL}/admin/tasks/${taskId}` : `${API_URL}/admin/tasks`;
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
    
    function showTaskDetails(task) {
        alert(`Task Details:\nTitle: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\nAssigned To: ${task.assignedTo || 'Unassigned'}\nDue Date: ${formatDate(task.dueDate)}`);
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
    
    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    
    function formatDate(date) {
        return date ? new Date(date).toLocaleDateString() : 'No due date';
    }
    
    function isOverdue(date, status) {
        return date && status !== 'completed' && new Date(date) < new Date();
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
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
});