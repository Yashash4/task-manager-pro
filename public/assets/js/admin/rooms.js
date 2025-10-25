// admin/rooms.js - Complete Room Management
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    let searchQuery = '';
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load rooms
    await loadRooms();
    
    // Setup event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Search
        document.getElementById('searchRooms')?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            debounce(() => loadRooms(), 300)();
        });
        
        // Create room button
        document.getElementById('createRoomBtn')?.addEventListener('click', openCreateRoomModal);
        
        // Room modal close
        document.getElementById('closeRoomModal')?.addEventListener('click', closeRoomModal);
        
        // Save room
        document.getElementById('saveRoomBtn')?.addEventListener('click', saveRoom);
    }
    
    async function loadRooms() {
        try {
            let url = `${API_URL}/admin/rooms`;
            
            if (searchQuery) {
                url += `?search=${encodeURIComponent(searchQuery)}`;
            }
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderRooms(data.rooms);
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            showNotification('Failed to load rooms', 'error');
        }
    }
    
    function renderRooms(rooms) {
        const container = document.getElementById('roomsContainer');
        if (!container) return;
        
        if (!rooms || rooms.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-door-open"></i>
                    <h3>No rooms found</h3>
                    <p>Create your first room to organize tasks</p>
                    <button class="btn btn-primary" onclick="document.getElementById('createRoomBtn').click()">
                        <i class="fas fa-plus"></i> Create Room
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = rooms.map(room => `
            <div class="room-card" data-room-id="${room.id}">
                <div class="room-card-header">
                    <div class="room-icon">
                        <i class="fas fa-door-open"></i>
                    </div>
                    <div class="room-info">
                        <h3>${escapeHtml(room.name)}</h3>
                        <p>${escapeHtml(room.description || 'No description')}</p>
                    </div>
                    <div class="room-actions">
                        <button class="btn-icon" onclick="editRoom(${room.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteRoom(${room.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="room-card-body">
                    <div class="room-stats">
                        <div class="room-stat">
                            <i class="fas fa-tasks"></i>
                            <div>
                                <span class="stat-value">${room.taskCount || 0}</span>
                                <span class="stat-label">Tasks</span>
                            </div>
                        </div>
                        <div class="room-stat">
                            <i class="fas fa-users"></i>
                            <div>
                                <span class="stat-value">${room.memberCount || 0}</span>
                                <span class="stat-label">Members</span>
                            </div>
                        </div>
                        <div class="room-stat">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <span class="stat-value">${room.completedTasks || 0}</span>
                                <span class="stat-label">Completed</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="room-card-footer">
                    <button class="btn btn-sm btn-primary" onclick="viewRoomTasks(${room.id})">
                        <i class="fas fa-eye"></i> View Tasks
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="manageMembers(${room.id})">
                        <i class="fas fa-user-cog"></i> Manage Members
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    window.editRoom = async function(roomId) {
        try {
            const res = await fetch(`${API_URL}/admin/rooms/${roomId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                openEditRoomModal(data.room);
            }
        } catch (error) {
            console.error('Error loading room:', error);
            showNotification('Failed to load room', 'error');
        }
    };
    
    window.deleteRoom = async function(roomId) {
        if (!confirm('Are you sure you want to delete this room? All tasks in this room will be unassigned.')) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Room deleted successfully', 'success');
                await loadRooms();
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            showNotification('Failed to delete room', 'error');
        }
    };
    
    window.viewRoomTasks = function(roomId) {
        window.location.href = `/admin/tasks.html?room=${roomId}`;
    };
    
    window.manageMembers = async function(roomId) {
        try {
            const res = await fetch(`${API_URL}/admin/rooms/${roomId}/members`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                showMembersModal(roomId, data.members);
            }
        } catch (error) {
            console.error('Error loading members:', error);
            showNotification('Failed to load members', 'error');
        }
    };
    
    function openCreateRoomModal() {
        const modal = document.getElementById('roomModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Create New Room';
        document.getElementById('roomForm').reset();
        document.getElementById('roomId').value = '';
        modal.style.display = 'block';
    }
    
    function openEditRoomModal(room) {
        const modal = document.getElementById('roomModal');
        if (!modal) return;
        
        document.getElementById('modalTitle').textContent = 'Edit Room';
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomName').value = room.name;
        document.getElementById('roomDescription').value = room.description || '';
        
        modal.style.display = 'block';
    }
    
    function closeRoomModal() {
        const modal = document.getElementById('roomModal');
        if (modal) modal.style.display = 'none';
    }
    
    async function saveRoom() {
        const roomId = document.getElementById('roomId').value;
        const roomData = {
            name: document.getElementById('roomName').value,
            description: document.getElementById('roomDescription').value
        };
        
        if (!roomData.name) {
            showNotification('Please enter a room name', 'error');
            return;
        }
        
        try {
            const url = roomId ? `${API_URL}/admin/rooms/${roomId}` : `${API_URL}/admin/rooms`;
            const method = roomId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roomData)
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification(`Room ${roomId ? 'updated' : 'created'} successfully`, 'success');
                closeRoomModal();
                await loadRooms();
            } else {
                showNotification(data.message || 'Failed to save room', 'error');
            }
        } catch (error) {
            console.error('Error saving room:', error);
            showNotification('Failed to save room', 'error');
        }
    }
    
    function showMembersModal(roomId, members) {
        // Create members modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Room Members</h2>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="members-list">
                        ${members.length > 0 ? members.map(member => `
                            <div class="member-item">
                                <div class="member-info">
                                    <div class="user-avatar-sm">${getInitials(member.name)}</div>
                                    <div>
                                        <div class="member-name">${escapeHtml(member.name)}</div>
                                        <div class="member-email">${escapeHtml(member.email)}</div>
                                    </div>
                                </div>
                                <button class="btn-icon btn-danger" onclick="removeMember(${roomId}, ${member.id})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('') : '<p class="text-muted">No members in this room</p>'}
                    </div>
                    <button class="btn btn-primary mt-3" onclick="addMember(${roomId})">
                        <i class="fas fa-user-plus"></i> Add Member
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    window.addMember = async function(roomId) {
        const userId = prompt('Enter User ID to add:');
        if (!userId) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/rooms/${roomId}/members`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(userId) })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Member added successfully', 'success');
                document.querySelector('.modal')?.remove();
                await manageMembers(roomId);
            }
        } catch (error) {
            console.error('Error adding member:', error);
            showNotification('Failed to add member', 'error');
        }
    };
    
    window.removeMember = async function(roomId, userId) {
        if (!confirm('Remove this member from the room?')) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/rooms/${roomId}/members/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            
            if (data.success) {
                showNotification('Member removed successfully', 'success');
                document.querySelector('.modal')?.remove();
                await manageMembers(roomId);
            }
        } catch (error) {
            console.error('Error removing member:', error);
            showNotification('Failed to remove member', 'error');
        }
    };
    
    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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