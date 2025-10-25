// admin/dashboard.js - Updated with better data loading
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;

    async function init() {
        try {
            const auth = await Utils.api.checkAuth();
            if (!auth) return;

            currentProfile = auth.profile;

            // Check if admin
            if (!currentProfile.role_flags?.includes('admin')) {
                await supabase.auth.signOut();
                window.location.href = '/login.html';
                return;
            }

            await loadStats();
            await loadRecentTasks();

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadStats() {
        try {
            if (!currentProfile.room_id) return;

            const { count: totalTasks } = await supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('room_id', currentProfile.room_id);

            const { count: approvedTasks } = await supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('room_id', currentProfile.room_id)
                .eq('status', 'approved');

            const { count: totalUsers } = await supabase
                .from('users_info')
                .select('*', { count: 'exact' })
                .eq('room_id', currentProfile.room_id)
                .eq('approved', true);

            const { count: pendingUsers } = await supabase
                .from('users_info')
                .select('*', { count: 'exact' })
                .eq('room_id', currentProfile.room_id)
                .eq('approved', false);

            const html = \
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: var(--elev); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: var(--brand);">\</div>
                        <div class="text-mut">Total Tasks</div>
                    </div>
                    <div style="background: var(--elev); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: var(--ok);">\</div>
                        <div class="text-mut">Completed</div>
                    </div>
                    <div style="background: var(--elev); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: var(--brand);">\</div>
                        <div class="text-mut">Team Members</div>
                    </div>
                    <div style="background: var(--elev); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: var(--warn);">\</div>
                        <div class="text-mut">Pending Approval</div>
                    </div>
                </div>
            \;

            const container = Utils.dom.id('statsContainer');
            Utils.dom.setHTML(container, html);

        } catch (error) {
            console.error('Load stats error:', error);
        }
    }

    async function loadRecentTasks() {
        try {
            if (!currentProfile.room_id) return;

            const { data: tasks } = await supabase
                .from('tasks')
                .select(\id, title, status, priority, due_date, assigned_user:users_info!tasks_assigned_to_fkey(username)\)
                .eq('room_id', currentProfile.room_id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!tasks || tasks.length === 0) {
                Utils.dom.setHTML(Utils.dom.id('recentTasksContainer'), '<p class="text-mut">No tasks yet</p>');
                return;
            }

            const statusEmoji = {
                'assigned': '??',
                'in_progress': '?',
                'submitted': '??',
                'approved': '?',
                'rejected': '?'
            };

            const html = tasks.map(t => \
                <div style="padding: 1rem; background: var(--elev); border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">\</div>
                        <div class="text-mut" style="font-size: 0.85rem;">\</div>
                    </div>
                    <span class="pill status-\">\ \</span>
                </div>
            \).join('');

            Utils.dom.setHTML(Utils.dom.id('recentTasksContainer'), html);

        } catch (error) {
            console.error('Load tasks error:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Admin dashboard loaded');
