// admin/reports.js - Analytics and reporting
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;

    async function init() {
        try {
            const auth = await Utils.api.checkAuth();
            if (!auth) return;

            currentProfile = auth.profile;

            if (!currentProfile.role_flags?.includes('admin')) {
                window.location.href = '/login.html';
                return;
            }

            if (currentProfile.room_id) {
                await loadReports();
            }

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadReports() {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('room_id', currentProfile.room_id);

            if (!tasks) return;

            // Calculate stats
            const completed = tasks.filter(t => t.status === 'approved').length;
            const total = tasks.length;
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Update completion rate
            Utils.dom.setHTML(Utils.dom.id('completionRateContainer'), \
                <div style="font-size: 3rem; font-weight: 700; color: var(--brand);">\%</div>
                <div class="text-mut">\ of \ tasks completed</div>
            \);

            // Status distribution
            const statuses = {
                'assigned': 0,
                'in_progress': 0,
                'submitted': 0,
                'approved': 0,
                'rejected': 0
            };

            tasks.forEach(t => {
                statuses[t.status]++;
            });

            const statusHtml = \
                <ul style="list-style: none;">
                    <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;">
                        <span>?? Assigned</span>
                        <strong>\</strong>
                    </li>
                    <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;">
                        <span>? In Progress</span>
                        <strong>\</strong>
                    </li>
                    <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;">
                        <span>?? Submitted</span>
                        <strong>\</strong>
                    </li>
                    <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;">
                        <span>? Approved</span>
                        <strong>\</strong>
                    </li>
                    <li style="padding: 0.5rem 0; display: flex; justify-content: space-between;">
                        <span>? Rejected</span>
                        <strong>\</strong>
                    </li>
                </ul>
            \;

            Utils.dom.setHTML(Utils.dom.id('statusDistContainer'), statusHtml);

            // Team performance
            const { data: users } = await supabase
                .from('users_info')
                .select('id, username')
                .eq('room_id', currentProfile.room_id)
                .eq('approved', true)
                .contains('role_flags', ['user']);

            if (users) {
                const performanceHtml = users.map(user => {
                    const userTasks = tasks.filter(t => t.assigned_to === user.id);
                    const userCompleted = userTasks.filter(t => t.status === 'approved').length;
                    const userInProgress = userTasks.filter(t => t.status === 'in_progress').length;
                    const rate = userTasks.length > 0 ? Math.round((userCompleted / userTasks.length) * 100) : 0;

                    return \
                        <tr>
                            <td><strong>\</strong></td>
                            <td>\</td>
                            <td>\</td>
                            <td>\</td>
                            <td><span style="color: var(--brand); font-weight: 600;">\%</span></td>
                        </tr>
                    \;
                }).join('');

                Utils.dom.setHTML(Utils.dom.id('performanceBody'), performanceHtml);
            }

        } catch (error) {
            console.error('Load reports error:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? Reports loaded');
