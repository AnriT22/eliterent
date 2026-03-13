(function() {
    'use strict';

    var token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    var earningsChart = null;
    var statusChart = null;
    var currentPeriod = 30;

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        loadPartnerProfile();
        loadFinancialData();
        
        document.getElementById('financialPeriod').addEventListener('change', function(e) {
            currentPeriod = e.target.value;
            loadFinancialData();
        });
    });

    function loadPartnerProfile() {
        fetch('/api/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.user && data.profile) {
                document.getElementById('dbCompanyName').textContent = data.profile.company_name || 'My Company';
            }
        })
        .catch(function(err) {
            console.error('Profile load error:', err);
        });
    }

    function loadFinancialData() {
        var periodParam = currentPeriod === 'all' ? '' : '?period=' + currentPeriod;
        
        fetch('/api/financials/overview' + periodParam, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            updateStats(data.stats);
            updateEarningsChart(data.earningsData);
            updateStatusChart(data.statusData);
            updateBookingsTable(data.recentBookings);
        })
        .catch(function(err) {
            console.error('Financial data load error:', err);
            showError('Failed to load financial data');
        });
    }

    function updateStats(stats) {
        document.getElementById('totalEarnings').textContent = '$' + (stats.totalEarnings || 0).toFixed(2);
        document.getElementById('activeVehicles').textContent = stats.activeVehicles || 0;
        document.getElementById('completedBookings').textContent = stats.completedBookings || 0;
        document.getElementById('upcomingBookings').textContent = stats.upcomingBookings || 0;
        
        var changeEl = document.getElementById('earningsChange');
        var changePercent = stats.earningsChange || 0;
        var changeSpan = changeEl.querySelector('span');
        
        if (changePercent > 0) {
            changeEl.className = 'fin-stat-change positive';
            changeSpan.textContent = '+' + changePercent.toFixed(1) + '%';
        } else if (changePercent < 0) {
            changeEl.className = 'fin-stat-change negative';
            changeSpan.textContent = changePercent.toFixed(1) + '%';
            changeEl.querySelector('svg polyline').setAttribute('points', '6 9 12 15 18 9');
        } else {
            changeEl.className = 'fin-stat-change';
            changeSpan.textContent = '0%';
        }
        
        if (stats.completedDays) {
            document.getElementById('completedSubtitle').textContent = 
                (stats.completedBookings || 0) + ' Bookings / ' + stats.completedDays + ' Days';
        }
    }

    function updateEarningsChart(earningsData) {
        var ctx = document.getElementById('earningsChart').getContext('2d');
        
        if (earningsChart) {
            earningsChart.destroy();
        }

        var labels = earningsData.map(function(d) { return d.date; });
        var values = earningsData.map(function(d) { return d.earnings; });

        earningsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Earnings ($)',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return '$' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            },
                            color: '#64748b'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    function updateStatusChart(statusData) {
        var ctx = document.getElementById('statusChart').getContext('2d');
        
        if (statusChart) {
            statusChart.destroy();
        }

        var labels = statusData.map(function(d) { return d.status; });
        var values = statusData.map(function(d) { return d.count; });
        var colors = statusData.map(function(d) {
            switch(d.status.toLowerCase()) {
                case 'completed': return '#22c55e';
                case 'active': return '#3b82f6';
                case 'pending': return '#f59e0b';
                case 'cancelled': return '#ef4444';
                case 'rejected': return '#f97316';
                default: return '#94a3b8';
            }
        });

        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            color: '#1e293b',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var percentage = ((context.parsed / total) * 100).toFixed(1);
                                return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    function updateBookingsTable(bookings) {
        var tbody = document.getElementById('recentBookingsTable');
        
        if (!bookings || bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">No bookings found</td></tr>';
            return;
        }

        var html = '';
        bookings.forEach(function(booking) {
            var rawStatus = (booking.status || '').toLowerCase();
            var statusMap = { accepted: 'active', cancel_requested: 'pending' };
            var cssStatus = statusMap[rawStatus] || rawStatus;
            var statusClass = 'fin-status-' + cssStatus;
            var displayMap = { accepted: 'Active', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected', cancel_requested: 'Cancel Req.' };
            var statusText = displayMap[rawStatus] || (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
            var idStr = String(booking.id);
            
            html += '<tr>';
            html += '<td><span style="font-family:monospace;color:#64748b;">#' + idStr + '</span></td>';
            html += '<td>' + escapeHtml(booking.customer_name) + '</td>';
            html += '<td>' + escapeHtml(booking.vehicle_name) + '</td>';
            html += '<td style="font-size:13px;color:#64748b;">' + formatDate(booking.pickup_date) + ' → ' + formatDate(booking.dropoff_date) + '</td>';
            html += '<td><span class="fin-status-badge ' + statusClass + '">' + statusText + '</span></td>';
            html += '<td style="font-weight:700;color:#22c55e;">$' + (booking.partner_earnings || 0).toFixed(2) + '</td>';
            html += '</tr>';
        });
        
        tbody.innerHTML = html;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length === 3) {
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
        }
        return dateStr;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        alert(message);
    }

})();
