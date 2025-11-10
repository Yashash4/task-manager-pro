// ==========================================
// ADMIN USERS MANAGEMENT
// ==========================================

let currentProfile = null;
let currentUserToEdit = null; // Variable to store user ID for role change

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
      DOM.on(DOM.id('userSearch'), 'input', debounce(filterUsers, 300));
      DOM.on(DOM.id('userStatusFilter'), 'change', filterUsers);
    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize');
    }
  }

  async function loadUsers() {
    const tbody = DOM.id('usersBody');
    try {
      if (!currentProfile.room_id) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Please create a room to see users.</td></tr>';
        return;
      }
      // **FIX**: Select 'role' as well for consistency
      const { data: users, error } = await supabase.from('users_info').select('id, username, email, role, role_flags, approved, joined_at, status').eq('room_id', currentProfile.room_id).order('joined_at', { ascending: false });
      if (error) throw error;
      window.allUsers = users || [];
      renderUsers(window.allUsers);
    } catch (error) {
      console.error('Load users error:', error);
      Toast.error('Failed to load users');
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">An error occurred while loading users.</td></tr>';
    }
  }

  function renderUsers(users) {
    const tbody = DOM.id('usersBody');
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(user => {
      // Use role_flags as the source of truth, fallback to role
      const role = user.role_flags?.[0] || user.role || 'user';
      const status = user.status || (user.approved ? 'approved' : 'pending');
      
      let statusBadge = '';
      switch (status) {
        case 'approved': statusBadge = 'badge-success'; break;
        case 'pending': statusBadge = 'badge-warning'; break;
        case 'suspended': statusBadge = 'badge-danger'; break;
        default: statusBadge = 'badge-secondary';
      }

      return `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email}</td>
          <td><span class="badge badge-primary">${role}</span></td>
          <td>${new Date(user.joined_at).toLocaleDateString()}</td>
          <td><span class="badge ${statusBadge}">${status}</span></td>
          <td><button class="btn btn-sm btn-secondary" onclick="viewUser('${user.id}')">Manage</button></td>
        </tr>`;
    }).join('');
  }

  function filterUsers() {
    const search = DOM.id('userSearch')?.value.toLowerCase() || '';
    const status = DOM.id('userStatusFilter')?.value || '';
    const filtered = window.allUsers.filter(user => {
      const userStatus = user.status || (user.approved ? 'approved' : 'pending');
      const matchesSearch = user.username.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
      let matchesStatus = true;
      if (status) matchesStatus = (userStatus === status);
      return matchesSearch && matchesStatus;
    });
    renderUsers(filtered);
  }

  window.viewUser = async (userId) => {
    const user = window.allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const role = user.role_flags?.[0] || user.role || 'user';
    const status = user.status || (user.approved ? 'approved' : 'pending');

    let actionButtons = '';
    
    if (status === 'pending') {
      actionButtons = `
        <div class="flex mt-3" style="gap: 0.5rem;">
          <button class="btn btn-success btn-sm" onclick="approveUser('${user.id}')">Approve User</button>
          <button class="btn btn-danger btn-sm" onclick="rejectUser('${user.id}')">Reject User</button>
        </div>`;
    } else if (status === 'approved') {
      actionButtons = `
        <div class="flex mt-3" style="gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="openChangeRoleModal('${user.id}')">Change Role</button>
          <button class="btn btn-danger btn-sm" onclick="suspendUser('${user.id}')">Suspend User</button>
        </div>`;
    } else if (status === 'suspended') {
      actionButtons = `
        <div class="flex mt-3" style="gap: 0.5rem;">
          <button class="btn btn-success btn-sm" onclick="approveUser('${user.id}')">Re-activate User</button>
        </div>`;
    }

    const content = `
      <div class="form-group"><label>Username</label><input type="text" value="${user.username}" disabled></div>
      <div class="form-group"><label>Email</label><input type="email" value="${user.email}" disabled></div>
      <div class="form-group"><label>Role</label><input type="text" value="${role}" disabled></div>
      <div class="form-group"><label>Joined</label><input type="text" value="${new Date(user.joined_at).toLocaleString()}" disabled></div>
      <div class="form-group"><label>Status</label><input type="text" value="${status}" disabled></div>
      ${actionButtons}`;
    DOM.setHTML(DOM.id('userModalContent'), content);
    DOM.removeClass(DOM.id('userModal'), 'hidden');
  };

  window.closeUserModal = () => DOM.addClass(DOM.id('userModal'), 'hidden');

  window.approveUser = async (userId) => {
    if (!confirm('Approve this user?')) return;
    try {
      const { error } = await supabase.from('users_info').update({ approved: true, status: 'approved', is_active: true }).eq('id', userId);
      if (error) throw error;
      Toast.success('User approved!');
      closeUserModal();
      await loadUsers();
    } catch (error) { Toast.error('Failed to approve user'); }
  };

  window.rejectUser = async (userId) => {
    if (!confirm('Reject and delete this user? This cannot be undone.')) return;
    try {
      // Rejection should probably set status to 'rejected', not delete
      // But following original code's (admin/approvals.js) logic
      const { error } = await supabase.from('users_info').update({ status: 'rejected', approved: false, is_active: false }).eq('id', userId);
      
      // If you want to delete the user from users_info:
      // const { error } = await supabase.from('users_info').delete().eq('id', userId);
      
      if (error) throw error;
      Toast.success('User rejected!');
      closeUserModal();
      await loadUsers();
    } catch (error) { Toast.error('Failed to reject user'); }
  };

  window.suspendUser = async (userId) => {
    if (!confirm('Suspend this user? They will not be able to log in.')) return;
    try {
      const { error } = await supabase.from('users_info').update({ approved: false, is_active: false, status: 'suspended' }).eq('id', userId);
      if (error) throw error;
      Toast.success('User suspended!');
      closeUserModal();
      await loadUsers();
    } catch (error) { Toast.error('Failed to suspend user'); }
  };

  // ✅ NEW FUNCTIONS FOR ROLE CHANGE
  window.openChangeRoleModal = (userId) => {
    const user = window.allUsers.find(u => u.id === userId);
    if (!user) { Toast.error('User not found'); return; }
    currentUserToEdit = userId;
    const currentRole = user.role_flags?.[0] || user.role || 'user';
    DOM.setText(DOM.id('changeRoleUsername'), user.username);
    DOM.id('newRoleSelect').value = currentRole;
    closeUserModal(); // Close the details modal first
    DOM.removeClass(DOM.id('changeRoleModal'), 'hidden');
  };

  window.closeChangeRoleModal = () => {
    currentUserToEdit = null;
    DOM.addClass(DOM.id('changeRoleModal'), 'hidden');
  };

  window.confirmRoleChange = async () => {
    if (!currentUserToEdit) return;
    const newRole = DOM.id('newRoleSelect').value;
    if (!newRole) { Toast.error('Please select a role.'); return; }
    
    try {
      const { error } = await supabase
        .from('users_info')
        .update({ 
          role: newRole, // Update both role
          role_flags: [newRole] // And role_flags
        }) 
        .eq('id', currentUserToEdit);
      
      if (error) throw error;
      
      Toast.success('User role updated successfully!');
      closeChangeRoleModal();
      await loadUsers(); // Refresh the user list to show the new role
    } catch (error) {
      console.error('Role change error:', error);
      Toast.error('Failed to update user role.');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();

console.log('? Admin users loaded');