// admin/users.js - Complete User Management
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    let searchQuery = '';
    let currentPage = 1;
    let pageSize = 10;
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load users
    await loadUsers();
    
    // Setup event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Search
        document.getElementById('searchUsers')?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            debounce(() => loadUsers(), 300)();
        });
        
        // Create user button
        document.getElementById('createUserBtn')?.addEventListener('click', openCreateUserModal);
        
        // User modal close
        document.getElementById('closeUserModal')?.addEventListener('click', closeUserModal);
        
        // Save user
        document.getElementById('saveUserBtn')?.addEventListener('click', saveUser);
        
        // Page size selector
        document.getElementById('pageSize')?.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value);
            currentPage = 1;
            loadUsers();
        });
    }
    
    async function loadUsers() {
        try {
            let url = `${API_URL}/admin/users?page=${currentPage}&limit=${pageSize}`;
            
            if (searchQuery) {
                url += `&search=${encodeURIComponent(searchQuery)}`;
            }
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderUsers(data.users);
                renderPagination(data.pagination);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('Failed to load users', 'error');
        }
    }
    
    function renderUsers(users) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        
        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr data-user-id="${user.id}">
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${getInitials(user.name)}</div>
                        <div>
                            <div class="user-name">${escapeHtml(user.name)}</div>
                            <div class="user-email">${escapeHtml(user.email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-${getRoleBadge(user.role)}">${user.role}</span></td>
                <td>${user.taskCount || 0}</td>
                <td>${user.completedTasks || 0}</td>
                <td>
                    <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="viewUser(${user.id})" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="editUser(${user.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="toggleUserStatus(${user.id}, ${!user.isActive})" 
                                title="${user.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Delete">
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
        
        const { currentPage: page, totalPages, totalUsers } = pagination;
        
        let html = `<div class="pagination-info">Showing ${((page - 1) * pageSize) + 1} to ${Math.min(page * pageSize, totalUsers)} of ${totalUsers} users</div>`;
        html += '<div class="pagination-buttons">';
        
        // Previous button
        html += `<button class="btn btn-sm" onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>`;
        
        // Page numbers
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : ''}" onclick="changePage(${i})">${i}</button>`;
        }
        
        // Next button
        html += `<button class="btn btn-sm" onclick="changePage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>`;
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    window.changePage = function(page) {
        currentPage = page;
        loadUsers();
    };
    
    window.viewUser = async function(userId) {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                showUserDetails(data.user);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            showNotification('Failed to load user details', 'error');
        }
    };
    
    window.editUser = async function(userId) {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                openEditUserModal(data.user);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            showNotification('Failed to load user', 'error');
        }
    };
    
    window.toggleUserStatus = async function(userId, isActive) {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                await loadUsers();
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            showNotification('Failed to update user status', 'error');
        }
    };
    
    window.deleteUser = async function(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('User deleted successfully', 'success');
                await loadUsers();
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('Failed to delete user', 'error');
        }
    };
    
    function openCreateUserModal() {
        const modal = document.getElementById('userModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Create New User';
        document.getElementById('userForm').reset();
        document.getElementById('userId').value = '';
        document.getElementById('passwordGroup').style.display = 'block';
        modal.style.display = 'block';
    }
    
    function openEditUserModal(user) {
        const modal = document.getElementById('userModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Edit User';
        document.getElementById('userId').value = user.id;
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;
        document.getElementById('passwordGroup').style.display = 'none';
        
        modal.style.display = 'block';
    }
    
    function closeUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.style.display = 'none';
    }
    
    async function saveUser() {
        const userId = document.getElementById('userId').value;
        const userData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value
        };
        
        if (!userId) {
            userData.password = document.getElementById('userPassword').value;
        }
        
        if (!userData.name || !userData.email) {
            showNotification('Please fill all required fields', 'error');
            return;
        }
        
        if (!userId && !userData.password) {
            showNotification('Password is required', 'error');
            return;
        }
        
        try {
            const url = userId ? `${API_URL}/admin/users/${userId}` : `${API_URL}/admin/users`;
            const method = userId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification(`User ${userId ? 'updated' : 'created'} successfully`, 'success');
                closeUserModal();
                await loadUsers();
            } else {
                showNotification(data.message || 'Failed to save user', 'error');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            showNotification('Failed to save user', 'error');
        }
    }
    
    function showUserDetails(user) {
        // Implementation for showing user details modal
        alert(`User Details:\nName: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\nTasks: ${user.taskCount || 0}`);
    }
    
    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    
    function getRoleBadge(role) {
        const badges = { admin: 'danger', user: 'primary' };
        return badges[role] || 'secondary';
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