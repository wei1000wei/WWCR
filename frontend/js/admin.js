// API base URL
const API_BASE_URL = '/api';

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// DOM elements
const usernameElement = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');
const usersTableBody = document.getElementById('users-table-body');

// Initialize app
async function init() {
    // Get token and user from localStorage
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Check if user is admin or owner
    if (user.role !== 'admin' && user.role !== 'owner') {
        alert('您没有权限访问管理界面');
        window.location.href = 'index.html';
        return;
    }
    
    // Display username
    usernameElement.textContent = user.username;
    
    // Load users
    await loadUsers();
    
    // Event listeners
    logoutBtn.addEventListener('click', logout);
}

// Load users
async function loadUsers() {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    console.log('Loading users with token:', token);
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const users = await response.json();
            console.log('Users loaded:', users.length);
            renderUsers(users);
        } else {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error('Failed to load users: ' + (errorData.msg || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error loading users:', err);
        alert('加载用户失败: ' + err.message);
    }
}

// Render users
function renderUsers(users) {
    usersTableBody.innerHTML = '';
    
    // Get current user role
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.dataset.userId = user._id;
        
        const roleClass = `role ${user.role}`;
        const statusClass = `status ${user.isVerified ? 'verified' : 'unverified'}`;
        const statusText = user.isVerified ? '已验证' : '未验证';
        
        // Only show verify button for unverified users
        const showVerifyBtn = !user.isVerified;
        
        // Only show "设为管理员" button for non-admin, non-owner users
        const showAdminBtn = user.role === 'user' && user.role !== 'owner';
        
        // Only show "设为用户" button for admin users
        const showUserBtn = user.role === 'admin' && user.role !== 'owner';
        
        // Only show delete button for users that can be deleted
        let showDeleteBtn = false;
        if (currentUser.role === 'owner' && user.role !== 'owner') {
            // Owner can delete any non-owner user
            showDeleteBtn = true;
        } else if (currentUser.role === 'admin' && user.role === 'user') {
            // Admin can only delete regular users
            showDeleteBtn = true;
        }
        
        row.innerHTML = `
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.realName)}</td>
            <td>${escapeHtml(user.phone)}</td>
            <td><span class="${roleClass}">${user.role}</span></td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${new Date(user.createdAt).toLocaleString()}</td>
            <td>
                ${showVerifyBtn ? `<button class="action-btn verify-btn" onclick="verifyUser('${user._id}')">验证</button>` : ''}
                ${showAdminBtn ? `<button class="action-btn admin-btn" onclick="changeRole('${user._id}', 'admin')">设为管理员</button>` : ''}
                ${showUserBtn ? `<button class="action-btn user-btn" onclick="changeRole('${user._id}', 'user')">设为用户</button>` : ''}
                ${showDeleteBtn ? `<button class="action-btn delete-btn" onclick="deleteUser('${user._id}')">删除</button>` : ''}
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });
}

// Verify user
async function verifyUser(userId) {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            await loadUsers();
            alert('用户验证成功');
        } else {
            throw new Error('Failed to verify user');
        }
    } catch (err) {
        console.error(err);
        alert('验证用户失败');
    }
}

// Change user role
async function changeRole(userId, role) {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ role })
        });
        
        if (response.ok) {
            await loadUsers();
            alert(`用户角色已更改为${role}`);
        } else {
            throw new Error('Failed to change role');
        }
    } catch (err) {
        console.error(err);
        alert('更改用户角色失败');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('确定要删除这个用户吗？')) {
        return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            await loadUsers();
            alert('用户已删除');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.msg || '删除用户失败');
        }
    } catch (err) {
        console.error(err);
        alert('删除用户失败: ' + err.message);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);