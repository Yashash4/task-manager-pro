// admin/reports.js - Complete Reports Management
document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:5000/api';
    let token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Initialize charts
    let tasksChart, usersChart, performanceChart;
    
    // Load initial data
    await loadDashboardStats();
    await loadTasksReport();
    await loadUsersReport();
    await loadPerformanceReport();
    
    // Date range filters
    document.getElementById('tasksDateRange')?.addEventListener('change', loadTasksReport);
    document.getElementById('usersDateRange')?.addEventListener('change', loadUsersReport);
    document.getElementById('performanceDateRange')?.addEventListener('change', loadPerformanceReport);
    
    // Export buttons
    document.getElementById('exportTasksPdf')?.addEventListener('click', () => exportReport('tasks', 'pdf'));
    document.getElementById('exportTasksCsv')?.addEventListener('click', () => exportReport('tasks', 'csv'));
    document.getElementById('exportUsersPdf')?.addEventListener('click', () => exportReport('users', 'pdf'));
    document.getElementById('exportUsersCsv')?.addEventListener('click', () => exportReport('users', 'csv'));
    
    async function loadDashboardStats() {
        try {
            const res = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                document.getElementById('totalTasks').textContent = data.stats.totalTasks || 0;
                document.getElementById('activeTasks').textContent = data.stats.activeTasks || 0;
                document.getElementById('completedTasks').textContent = data.stats.completedTasks || 0;
                document.getElementById('totalUsers').textContent = data.stats.totalUsers || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async function loadTasksReport() {
        const dateRange = document.getElementById('tasksDateRange')?.value || '7';
        
        try {
            const res = await fetch(`${API_URL}/admin/reports/tasks?days=${dateRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderTasksChart(data.report);
                renderTasksTable(data.report.tasks);
            }
        } catch (error) {
            console.error('Error loading tasks report:', error);
        }
    }
    
    async function loadUsersReport() {
        const dateRange = document.getElementById('usersDateRange')?.value || '30';
        
        try {
            const res = await fetch(`${API_URL}/admin/reports/users?days=${dateRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderUsersChart(data.report);
                renderUsersTable(data.report.users);
            }
        } catch (error) {
            console.error('Error loading users report:', error);
        }
    }
    
    async function loadPerformanceReport() {
        const dateRange = document.getElementById('performanceDateRange')?.value || '30';
        
        try {
            const res = await fetch(`${API_URL}/admin/reports/performance?days=${dateRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                renderPerformanceChart(data.report);
            }
        } catch (error) {
            console.error('Error loading performance report:', error);
        }
    }
    
    function renderTasksChart(report) {
        const ctx = document.getElementById('tasksChart');
        if (!ctx) return;
        
        if (tasksChart) tasksChart.destroy();
        
        tasksChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending', 'Overdue'],
                datasets: [{
                    data: [
                        report.completed || 0,
                        report.inProgress || 0,
                        report.pending || 0,
                        report.overdue || 0
                    ],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    function renderUsersChart(report) {
        const ctx = document.getElementById('usersChart');
        if (!ctx) return;
        
        if (usersChart) usersChart.destroy();
        
        usersChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: report.users?.map(u => u.name) || [],
                datasets: [{
                    label: 'Completed Tasks',
                    data: report.users?.map(u => u.completedTasks) || [],
                    backgroundColor: '#22c55e'
                }, {
                    label: 'Pending Tasks',
                    data: report.users?.map(u => u.pendingTasks) || [],
                    backgroundColor: '#f59e0b'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    function renderPerformanceChart(report) {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
        
        if (performanceChart) performanceChart.destroy();
        
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: report.dates || [],
                datasets: [{
                    label: 'Tasks Completed',
                    data: report.completions || [],
                    borderColor: '#22c55e',
                    tension: 0.4
                }, {
                    label: 'Tasks Created',
                    data: report.creations || [],
                    borderColor: '#3b82f6',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    function renderTasksTable(tasks) {
        const tbody = document.querySelector('#tasksTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = tasks?.map(task => `
            <tr>
                <td>${escapeHtml(task.title)}</td>
                <td><span class="badge badge-${getPriorityClass(task.priority)}">${task.priority}</span></td>
                <td><span class="badge badge-${getStatusClass(task.status)}">${task.status}</span></td>
                <td>${escapeHtml(task.assignedTo)}</td>
                <td>${formatDate(task.dueDate)}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">No tasks found</td></tr>';
    }
    
    function renderUsersTable(users) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = users?.map(user => `
            <tr>
                <td>${escapeHtml(user.name)}</td>
                <td>${user.totalTasks || 0}</td>
                <td>${user.completedTasks || 0}</td>
                <td>${user.pendingTasks || 0}</td>
                <td>${user.completionRate || 0}%</td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">No users found</td></tr>';
    }
    
    async function exportReport(type, format) {
        try {
            const dateRange = document.getElementById(`${type}DateRange`)?.value || '30';
            const res = await fetch(`${API_URL}/admin/reports/${type}/export?format=${format}&days=${dateRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (format === 'pdf') {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.pdf`;
                a.click();
            } else {
                const text = await res.text();
                const blob = new Blob([text], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export report');
        }
    }
    
    function getPriorityClass(priority) {
        const map = { high: 'danger', medium: 'warning', low: 'info' };
        return map[priority?.toLowerCase()] || 'secondary';
    }
    
    function getStatusClass(status) {
        const map = { completed: 'success', 'in progress': 'primary', pending: 'warning', overdue: 'danger' };
        return map[status?.toLowerCase()] || 'secondary';
    }
    
    function formatDate(date) {
        return date ? new Date(date).toLocaleDateString() : 'N/A';
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});