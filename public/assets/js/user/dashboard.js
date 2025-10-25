// user/dashboard.js - User dashboard with stats
(async function () {
    const supabase = window.SUPABASE?.client?.();
    if (!supabase) return;

    let currentProfile = null;

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

            Utils.dom.setText(Utils.dom.id('userName'), currentProfile.username);
            await loadStats();
            await loadTaskStatus();
            await loadUpcomingDeadlines();

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async function loadStats() {
        try {
            const { count: totalTasks } = await supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('assigned_to', currentProfile.id);

            const { count: completedTasks } = await supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('assigned_to', currentProfile.id)
                .eq('status', 'approved');

            const { count: inProgress } = await supabase
                .from('tasks')
                .select('*', { count: 'exact' })
                .eq('assigned_to', currentProfile.id)
                .eq('status', 'in_progress');

            const { data: overdueTasks } = await supabase
                .from('tasks')
                .select('due_date')
                .eq('assigned_to', currentProfile.id)
                .neq('status', 'approved')
                .neq('status', 'rejected');

            const overdueCount = overdueTasks?.filter(t => Utils.time.isOverdue(t.due_date)).length || 0;

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
                        <div style="font-size: 2rem; font-weight: 700; color: var(--warn);">\</div>
                        <div class="text-mut">In Progress</div>
                    </div>
                    <div style="background: var(--elev); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: var(--bad);">\</div>
                        <div class="text-mut">Overdue</div>
                    </div>
                </div>
            \;

            Utils.dom.setHTML(Utils.dom.id('userStatsContainer'), html);

        } catch (error) {
            console.error('Load stats error:', error);
        }
    }

    async function loadTaskStatus() {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('status')
                .eq('assigned_to', currentProfile.id);

            const statuses = {
                'assigned': 0,
                'in_progress': 0,
                'submitted': 0,
                'approved': 0,
                'rejected': 0
            };

            tasks?.forEach(t => {
                statuses[t.status]++;
            });

            const html = \
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

            Utils.dom.setHTML(Utils.dom.id('taskStatusContainer'), html);

        } catch (error) {
            console.error('Load status error:', error);
        }
    }

    async function loadUpcomingDeadlines() {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', currentProfile.id)
                .neq('status', 'approved')
                .neq('status', 'rejected')
                .order('due_date', { ascending: true })
                .limit(5);

            if (!tasks || tasks.length === 0) {
                Utils.dom.setHTML(Utils.dom.id('upcomingDeadlinesContainer'), 
                    '<p class="text-mut">No upcoming deadlines</p>');
                return;
            }

            const html = tasks.map(task => {
                const daysLeft = Utils.time.daysUntil(task.due_date);
                const isOverdue = daysLeft < 0;
                const color = isOverdue ? 'var(--bad)' : daysLeft <= 3 ? 'var(--warn)' : 'var(--ok)';

                return \
                    <div style="padding: 1rem; background: var(--elev); border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">\</div>
                            <div class="text-mut" style="font-size: 0.85rem;">\</div>
                        </div>
                        <span style="color: \; font-weight: 600;">
                            \
                        </span>
                    </div>
                \;
            }).join('');

            Utils.dom.setHTML(Utils.dom.id('upcomingDeadlinesContainer'), html);

        } catch (error) {
            console.error('Load deadlines error:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})();

console.log('? User dashboard loaded');
