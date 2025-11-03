// admin/dashboard.js - Complete Admin Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    let userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
        window.location.href = '/login.html';
        return;
    }

    // Load all dashboard data
    await loadStats();
    await loadRecentActivity();
    await loadSystemHealth();
    await loadChartsData();
    
    // Setup refresh interval
    setInterval(loadStats, 30000); // Refresh every 30 seconds
    
    // Logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
    
    async function loadStats() {
        try {
            const res = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                updateStatsCards(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    function updateStatsCards(stats) {
        // Total Users
        const totalUsers = document.getElementById('totalUsers');
        if (totalUsers) {
            totalUsers.textContent = stats.totalUsers || 0;
            updateTrend('usersTrend', stats.usersTrend);
        }
        
        // Total Tasks
        const totalTasks = document.getElementById('totalTasks');
        if (totalTasks) {
            totalTasks.textContent = stats.totalTasks || 0;
            updateTrend('tasksTrend', stats.tasksTrend);
        }
        
        // Active Tasks
        const activeTasks = document.getElementById('activeTasks');
        if (activeTasks) {
            activeTasks.textContent = stats.activeTasks || 0;
            updateTrend('activeTasksTrend', stats.activeTasksTrend);
        }
        
        // Completion Rate
        const completionRate = document.getElementById('completionRate');
        if (completionRate) {
            const rate = stats.totalTasks ? 
                Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
            completionRate.textContent = `${rate}%`;
            updateTrend('completionTrend', stats.completionTrend);
        }
        
        // Additional stats
        if (stats.totalRooms !== undefined) {
            const totalRooms = document.getElementById('totalRooms');
            if (totalRooms) totalRooms.textContent = stats.totalRooms;
        }
        
        if (stats.overdueTasks !== undefined) {
            const overdueTasks = document.getElementById('overdueTasks');
            if (overdueTasks) overdueTasks.textContent = stats.overdueTasks;
        }
    }
    
    function updateTrend(elementId, trend) {
        const element = document.getElementById(elementId);
        if (!element || trend === undefined) return;
        
        const isPositive = trend >= 0;
        element.className = `trend ${isPositive ? 'trend-up' : 'trend-down'}`;
        element.innerHTML = `
            <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
            ${Math.abs(trend)}%
        `;
    }
    
    async function loadRecentActivity() {
        try {
            const res = await fetch(`${API_URL}/admin/activity?limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderRecentActivity(data.activities);
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }
    
    function renderRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No recent activity</p>';
            return;
        }
        
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${getActivityClass(activity.type)}">
                    <i class="fas ${getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-description">${escapeHtml(activity.description)}</p>
                    <div class="activity-meta">
                        <span class="activity-user">${escapeHtml(activity.userName)}</span>
                        <span class="activity-time">${formatTimeAgo(activity.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async function loadSystemHealth() {
        try {
            const res = await fetch(`${API_URL}/admin/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                updateSystemHealth(data.health);
            }
        } catch (error) {
            console.error('Error loading system health:', error);
        }
    }
    
    function updateSystemHealth(health) {
        // Database status
        const dbStatus = document.getElementById('databaseStatus');
        if (dbStatus) {
            dbStatus.className = `status-indicator ${health.database ? 'status-healthy' : 'status-error'}`;
            dbStatus.innerHTML = `<i class="fas fa-circle"></i> ${health.database ? 'Healthy' : 'Error'}`;
        }
        
        // API status
        const apiStatus = document.getElementById('apiStatus');
        if (apiStatus) {
            apiStatus.className = `status-indicator ${health.api ? 'status-healthy' : 'status-error'}`;
            apiStatus.innerHTML = `<i class="fas fa-circle"></i> ${health.api ? 'Healthy' : 'Error'}`;
        }
        
        // Storage usage
        const storageUsage = document.getElementById('storageUsage');
        if (storageUsage && health.storage) {
            const percentage = (health.storage.used / health.storage.total) * 100;
            storageUsage.innerHTML = `
                <div class="progress">
                    <div class="progress-bar ${percentage > 80 ? 'bg-danger' : percentage > 60 ? 'bg-warning' : 'bg-success'}" 
                         style="width: ${percentage}%"></div>
                </div>
                <span>${formatBytes(health.storage.used)} / ${formatBytes(health.storage.total)}</span>
            `;
        }
    }
    
    async function loadChartsData() {
        try {
            const res = await fetch(`${API_URL}/admin/charts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderTasksChart(data.charts.tasks);
                renderUsersChart(data.charts.users);
                renderActivityChart(data.charts.activity);
            }
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }
    
    function renderTasksChart(chartData) {
        const ctx = document.getElementById('tasksChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending', 'Overdue'],
                datasets: [{
                    data: [
                        chartData.completed || 0,
                        chartData.inProgress || 0,
                        chartData.pending || 0,
                        chartData.overdue || 0
                    ],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    function renderUsersChart(chartData) {
        const ctx = document.getElementById('usersChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels || [],
                datasets: [{
                    label: 'New Users',
                    data: chartData.data || [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    function renderActivityChart(chartData) {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels || [],
                datasets: [{
                    label: 'Tasks Created',
                    data: chartData.created || [],
                    backgroundColor: '#3b82f6'
                }, {
                    label: 'Tasks Completed',
                    data: chartData.completed || [],
                    backgroundColor: '#22c55e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    function getActivityClass(type) {
        const classes = {
            task_created: 'activity-created',
            task_completed: 'activity-completed',
            task_updated: 'activity-updated',
            user_registered: 'activity-user',
            room_created: 'activity-room'
        };
        return classes[type] || 'activity-default';
    }
    
    function getActivityIcon(type) {
        const icons = {
            task_created: 'fa-plus',
            task_completed: 'fa-check',
            task_updated: 'fa-edit',
            user_registered: 'fa-user-plus',
            room_created: 'fa-door-open'
        };
        return icons[type] || 'fa-info';
    }
    
    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});