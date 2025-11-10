// ==========================================
// ADMIN APPROVALS MANAGEMENT
// ==========================================

let currentProfile = null;
let allUsers = [];
let currentUserToReject = null;

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
      if (!currentProfile || currentProfile.role !== 'admin') {
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
      
      // Event listeners
      DOM.on(DOM.id('searchInput'), 'input', debounce(filterUsers, 300));
      DOM.on(DOM.id('statusFilter'), 'change', filterUsers);

    } catch (error) {
      console.error('Init error:', error);
      Toast.error('Failed to initialize approvals page');
    }
  }

  async function loadUsers() {
    try {
      if (!currentProfile.room_id) return;

      const { data: users, error } = await supabase
        .from('users_info')
        .select('*')
        .eq('room_id', currentProfile.room_id)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      allUsers = users || [];
      renderUsers();

    } catch (error) {
      console.error('Load users error:', error);
      Toast.error('Failed to load users');
    }
  }

  function renderUsers() {
    const pendingUsers = allUsers.filter(u => u.status === 'pending');
    const approvedUsers = allUsers.filter(u => u.status === 'approved');

    // Update badge
    DOM.setText(DOM.id('pendingBadge'), pendingUsers.length);

    // Render pending users
    const pendingBody = DOM.id('pendingBody');
    if (pendingUsers.length === 0) {
      pendingBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No pending approvals</td></tr>';
    } else {
      pendingBody.innerHTML = pendingUsers.map(user => `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email}</td>
          <td>${new Date(user.joined_at).toLocaleString()}</td>
          <td><span class="badge badge-warning">⏳ Pending</span></td>
          <td>
            <button class="btn btn-sm btn-success" onclick="viewUser('${user.id}', 'approve')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="viewUser('${user.id}', 'reject')">Reject</button>
          </td>
        </tr>
      `).join('');
    }

    // Render approved users
    const approvedBody = DOM.id('approvedBody');
    if (approvedUsers.length === 0) {
      approvedBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No approved users yet</td></tr>';
    } else {
      approvedBody.innerHTML = approvedUsers.map(user => `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email}</td>
          <td>${new Date(user.joined_at).toLocaleString()}</td>
          <td><span class="badge badge-primary">${user.role.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewUser('${user.id}', 'view')">View</button>
            <button class="btn btn-sm btn-warning" onclick="suspendUser('${user.id}')">Suspend</button>
          </td>
        </tr>
      `).join('');
    }
  }

  function filterUsers() {
    const search = (DOM.id('searchInput')?.value || '').toLowerCase();
    const status = DOM.id('statusFilter')?.value || 'pending';

    let filtered = allUsers;

    if (status === 'pending') {
      filtered = filtered.filter(u => u.status === 'pending');
    } else if (status === 'approved') {
      filtered = filtered.filter(u => u.status === 'approved');
    } else if (status === 'rejected') {
      filtered = filtered.filter(u => u.status === 'rejected');
    }

    if (search) {
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }

    // Render filtered results
    const pendingFiltered = filtered.filter(u => u.status === 'pending');
    const approvedFiltered = filtered.filter(u => u.status === 'approved');

    const pendingBody = DOM.id('pendingBody');
    if (pendingFiltered.length === 0) {
      pendingBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No matching pending users</td></tr>';
    } else {
      pendingBody.innerHTML = pendingFiltered.map(user => `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email}</td>
          <td>${new Date(user.joined_at).toLocaleString()}</td>
          <td><span class="badge badge-warning">⏳ Pending</span></td>
          <td>
            <button class="btn btn-sm btn-success" onclick="viewUser('${user.id}', 'approve')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="viewUser('${user.id}', 'reject')">Reject</button>
          </td>
        </tr>
      `).join('');
    }

    const approvedBody = DOM.id('approvedBody');
    if (approvedFiltered.length === 0) {
      approvedBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No matching approved users</td></tr>';
    } else {
      approvedBody.innerHTML = approvedFiltered.map(user => `
        <tr>
          <td><strong>${user.username}</strong></td>
          <td>${user.email}</td>
          <td>${new Date(user.joined_at).toLocaleString()}</td>
          <td><span class="badge badge-primary">${user.role.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewUser('${user.id}', 'view')">View</button>
            <button class="btn btn-sm btn-warning" onclick="suspendUser('${user.id}')">Suspend</button>
          </td>
        </tr>
      `).join('');
    }
  }

  window.viewUser = (userId, action) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const content = `
      <div class="grid grid-2" style="gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Username</label>
          <input type="text" value="${user.username}" disabled>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" value="${user.email}" disabled>
        </div>
      </div>
      <div class="grid grid-2" style="gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Status</label>
          <input type="text" value="${user.status}" disabled>
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" value="${user.role}" disabled>
        </div>
      </div>
      <div class="form-group">
        <label>Joined Date</label>
        <input type="text" value="${new Date(user.joined_at).toLocaleString()}" disabled>
      </div>
    `;

    DOM.setText(DOM.id('approvalModal').querySelector('.modal-header h2'), 'User Details');
    DOM.setHTML(DOM.id('approvalContent'), content);

    let footerHTML = `<button onclick="closeApprovalModal()" class="btn btn-secondary">Close</button>`;

    if (user.status === 'pending') {
      if (action === 'approve') {
        footerHTML = `
          <button onclick="closeApprovalModal()" class="btn btn-secondary">Cancel</button>
          <button onclick="approveUser('${user.id}')" class="btn btn-success">Approve User</button>
        `;
      } else if (action === 'reject') {
        footerHTML = `
          <button onclick="closeApprovalModal()" class="btn btn-secondary">Cancel</button>
          <button onclick="openRejectionModal('${user.id}')" class="btn btn-danger">Reject User</button>
        `;
      }
    } else if (user.status === 'approved' && action === 'view') {
      footerHTML = `
        <button onclick="closeApprovalModal()" class="btn btn-secondary">Close</button>
        <button onclick="promoteToApprover('${user.id}')" class="btn btn-primary">Promote to Approver</button>
      `;
    }

    DOM.setHTML(DOM.id('approvalFooter'), footerHTML);
    DOM.removeClass(DOM.id('approvalModal'), 'hidden');
  };

  window.closeApprovalModal = () => {
    DOM.addClass(DOM.id('approvalModal'), 'hidden');
  };

  window.approveUser = async (userId) => {
    if (!confirm('Approve this user?')) return;

    try {
      const { error } = await supabase
        .from('users_info')
        .update({ 
          status: 'approved'
        })
        .eq('id', userId);

      if (error) throw error;

      Toast.success('User approved!');
      closeApprovalModal();
      await loadUsers();

    } catch (error) {
      console.error('Approve user error:', error);
      Toast.error('Failed to approve user');
    }
  };

  window.openRejectionModal = (userId) => {
    currentUserToReject = userId;
    closeApprovalModal();
    DOM.id('rejectionReason').value = '';
    DOM.removeClass(DOM.id('rejectionModal'), 'hidden');
  };

  window.closeRejectionModal = () => {
    DOM.addClass(DOM.id('rejectionModal'), 'hidden');
    currentUserToReject = null;
  };

  window.confirmReject = async () => {
    const reason = DOM.id('rejectionReason').value.trim();
    if (!reason) {
      Toast.error('Please provide a reason for rejection');
      return;
    }

    if (!currentUserToReject) return;

    try {
      const { error } = await supabase
        .from('users_info')
        .update({ 
          status: 'rejected'
        })
        .eq('id', currentUserToReject);

      if (error) throw error;

      Toast.success('User rejected');
      closeRejectionModal();
      await loadUsers();

    } catch (error) {
      console.error('Reject user error:', error);
      Toast.error('Failed to reject user');
    }
  };

  window.suspendUser = async (userId) => {
    if (!confirm('Suspend this user? They will not be able to login.')) return;

    try {
      const { error } = await supabase
        .from('users_info')
        .update({ 
          status: 'suspended',
          is_active: false
        })
        .eq('id', userId);

      if (error) throw error;

      Toast.success('User suspended');
      await loadUsers();

    } catch (error) {
      console.error('Suspend user error:', error);
      Toast.error('Failed to suspend user');
    }
  };

  window.promoteToApprover = async (userId) => {
    if (!confirm('Promote this user to Approver role? They will be able to approve/reject tasks.')) return;

    try {
      const { error } = await supabase
        .from('users_info')
        .update({ 
          role: 'approver',
          promoted_at: new Date().toISOString(),
          promoted_by: currentProfile.id
        })
        .eq('id', userId);

      if (error) throw error;

      Toast.success('User promoted to Approver!');
      closeApprovalModal();
      await loadUsers();

    } catch (error) {
      console.error('Promote user error:', error);
      Toast.error('Failed to promote user');
    }
  };

  document.addEventListener('DOMContentLoaded', init);

})();

console.log('✅ Admin approvals loaded');