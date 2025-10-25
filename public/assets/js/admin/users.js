// admin/users.js - Complete user management
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;
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

            Utils.dom.on(Utils.dom.id('userSearch'), 'input', (e) => {
                filterUsers(e.target.value);
            });

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadUsers() {
        try {
            if (!currentProfile.room_id) return;

            const { data: users } = await supabase
                .from('users_info')
                .select('*')
                .eq('room_id', currentProfile.room_id)
                .order('joined_at', { ascending: false });

            allUsers = users || [];
            renderUsers(allUsers);

        } catch (error) {
            console.error('Load users error:', error);
        }
    }

    function renderUsers(users) {
        const tbody = Utils.dom.id('usersTableBody');

        if (!users || users.length === 0) {
            Utils.dom.setHTML(tbody, '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No users found</td></tr>');
            return;
        }

        const html = users.map(user => {
            const role = user.role_flags?.[0] || 'user';
            const statusBadge = user.approved 
                ? '<span class="pill status-approved">? Active</span>'
                : '<span class="pill status-pending">? Pending</span>';

            const actions = user.approved
                ? \<button class="btn secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="suspendUser('\')">Suspend</button>\
                : \<button class="btn" style="padding: 6px 12px; font-size: 0.85rem;" onclick="approveUser('\')">Approve</button>\;

            return \
                <tr>
                    <td><strong>\</strong></td>
                    <td>\</td>
                    <td><span class="pill status-approved">\</span></td>
                    <td>\</td>
                    <td>\</td>
                    <td>\</td>
                </tr>
            \;
        }).join('');

        Utils.dom.setHTML(tbody, html);
    }

    function filterUsers(search) {
        const filtered = allUsers.filter(u =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        );
        renderUsers(filtered);
    }

    window.approveUser = async (userId) => {
        if (!confirm('Approve this user?')) return;

        try {
            const { error } = await supabase
                .from('users_info')
                .update({ approved: true })
                .eq('id', userId);

            if (error) throw error;
            alert('User approved!');
            await loadUsers();

        } catch (error) {
            console.error('Approve error:', error);
            alert('Failed to approve user');
        }
    };

    window.suspendUser = async (userId) => {
        if (!confirm('Suspend this user?')) return;

        try {
            const { error } = await supabase
                .from('users_info')
                .update({ approved: false })
                .eq('id', userId);

            if (error) throw error;
            alert('User suspended!');
            await loadUsers();

        } catch (error) {
            console.error('Suspend error:', error);
            alert('Failed to suspend user');
        }
    };

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin users loaded');
