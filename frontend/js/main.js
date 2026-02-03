// API base URL
const API_BASE_URL = '/api';

// DOM elements
let usernameElement;
let logoutBtn;
let groupsList;
let createGroupBtn;
let joinGroupBtn;
let joinGroupId;
let currentGroupElement;
let createGroupModal;
let closeCreateModal;
let createGroupForm;
let groupSettingsBtn;
let groupSettingsModal;
let closeSettingsModal;
let inviteUsername;
let inviteMemberBtn;
let groupInfoBtn;
let groupInfoPopup;
let inviteUserBtn;
let inviteUserPopup;
let userSearchResults;
let sidebar;
let sidebarToggleBtn;

// Current selected group
let currentGroup = null;
let groups = [];

// User authentication
let token;
let user;

// Initialize app
async function init() {
    // Get token from localStorage
    token = localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize DOM elements
    usernameElement = document.getElementById('username');
    logoutBtn = document.getElementById('logout-btn');
    groupsList = document.getElementById('groups-list');
    createGroupBtn = document.getElementById('create-group-btn');
    joinGroupBtn = document.getElementById('join-group-btn');
    joinGroupId = document.getElementById('join-group-id');
    currentGroupElement = document.getElementById('current-group');
    createGroupModal = document.getElementById('create-group-modal');
    closeCreateModal = document.getElementById('close-create-modal');
    createGroupForm = document.getElementById('create-group-form');
    groupSettingsBtn = document.getElementById('group-settings-btn');
    groupSettingsModal = document.getElementById('group-settings-modal');
    closeSettingsModal = document.getElementById('close-settings-modal');
    inviteUsername = document.getElementById('invite-username');
    inviteMemberBtn = document.getElementById('invite-member-btn');
    groupInfoBtn = document.getElementById('group-info-btn');
    groupInfoPopup = document.getElementById('group-info-popup');
    inviteUserBtn = document.getElementById('invite-user-btn');
    inviteUserPopup = document.getElementById('invite-user-popup');
    userSearchResults = document.getElementById('user-search-results');
    sidebar = document.getElementById('sidebar');
    sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    
    // Debug: Check if elements are found
    console.log('DOM Elements initialized:');
    console.log('sidebar:', sidebar);
    console.log('sidebarToggleBtn:', sidebarToggleBtn);
    
    // Display username
    usernameElement.textContent = user.username;
    
    // Load groups
    await loadGroups();
    
    // Initialize chat components
    if (typeof initChat === 'function') {
        initChat();
    }
    
    // Event listeners - check if elements exist before adding listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'home.html';
        });
    }
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', openCreateGroupModal);
    }
    
    if (closeCreateModal) {
        closeCreateModal.addEventListener('click', closeCreateGroupModalFunc);
    }
    
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', createGroup);
    }
    
    if (joinGroupBtn) {
        joinGroupBtn.addEventListener('click', joinGroup);
    }
    
    if (groupSettingsBtn) {
        groupSettingsBtn.addEventListener('click', openGroupSettingsModal);
    }
    
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', closeGroupSettingsModalFunc);
    }
    
    // Function to toggle sidebar
    function toggleSidebar() {
        // Check if DOM elements exist
        if (!sidebar || !sidebarToggleBtn) {
            return;
        }
        
        try {
            // Toggle sidebar collapsed state
            const isCollapsed = sidebar.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand sidebar
                sidebar.classList.remove('collapsed');
            } else {
                // Collapse sidebar
                sidebar.classList.add('collapsed');
            }
            
            // Update chat area width
            updateChatAreaWidth();
            
            // Update toggle button icon
            updateToggleButtonIcon();
        } catch (error) {
            console.error('Error toggling sidebar:', error);
        }
    }
    
    // Update chat area width based on sidebar state
    function updateChatAreaWidth() {
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            const isCollapsed = sidebar.classList.contains('collapsed');
            if (isCollapsed) {
                chatArea.classList.add('full-width');
            } else {
                chatArea.classList.remove('full-width');
            }
        }
    }
    
    // Update toggle button icon based on sidebar state
    function updateToggleButtonIcon() {
        if (sidebar && sidebarToggleBtn) {
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarToggleBtn.textContent = isCollapsed ? '>>' : '<<';
        }
    }
    
    // Initialize sidebar state based on screen size
    function initSidebarState() {
        // Use matchMedia for more reliable screen size detection
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        
        if (sidebar) {
            if (isMobile) {
                // Default collapsed on mobile
                sidebar.classList.add('collapsed');
            } else {
                // Default expanded on desktop
                sidebar.classList.remove('collapsed');
            }
        }
        
        // Update chat area width
        updateChatAreaWidth();
        
        // Update icon after state initialization
        updateToggleButtonIcon();
    }
    
    // Register event listener directly
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    
    // Call initialization functions once
    initSidebarState();
    
    // Update sidebar state on window resize
    window.addEventListener('resize', initSidebarState);
    
    // Invite member event listener
    if (inviteMemberBtn) {
        inviteMemberBtn.addEventListener('click', inviteMember);
    }
    
    // Group info popup event listeners
    if (groupInfoBtn && groupInfoPopup) {
        groupInfoBtn.addEventListener('click', toggleGroupInfoPopup);
    }
    
    // Invite user popup event listeners
    if (inviteUserBtn && inviteUserPopup) {
        inviteUserBtn.addEventListener('click', toggleInviteUserPopup);
    }
    
    // User search event listener
    if (inviteUsername) {
        inviteUsername.addEventListener('input', debounce(searchUsers, 300));
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === createGroupModal) {
            closeCreateGroupModalFunc();
        }
        if (e.target === groupSettingsModal) {
            closeGroupSettingsModalFunc();
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Load user groups
async function loadGroups() {
    try {
        // Get token from localStorage
        const currentToken = localStorage.getItem('token');
        
        console.log('Loading groups with token:', currentToken);
        
        const response = await fetch(`${API_BASE_URL}/groups`, {
            headers: {
                'x-auth-token': currentToken
            }
        });
        
        console.log('Group response status:', response.status);
        
        if (response.ok) {
            groups = await response.json();
            console.log('Groups loaded:', groups.length);
            renderGroups();
            
            // Select first group if available
            if (groups.length > 0 && !currentGroup) {
                selectGroup(groups[0]);
            }
        } else if (response.status === 401) {
            console.error('Unauthorized: Invalid or expired token');
            // Redirect to login page if token is invalid
            window.location.href = 'login.html';
        } else {
            // Demo mode: Use sample groups if API call fails
            console.log('API call failed, using sample groups for demo');
            groups = [
                {
                    _id: 'demo-group-1',
                    name: '演示群组1',
                    owner: { _id: 'demo-admin-123' },
                    admins: [
                        { _id: 'demo-admin-123' }
                    ],
                    members: [
                        { _id: 'demo-admin-123', username: 'admin' },
                        { _id: 'demo-user-1', username: 'user1' }
                    ]
                },
                {
                    _id: 'demo-group-2',
                    name: '演示群组2',
                    owner: { _id: 'demo-admin-123' },
                    admins: [
                        { _id: 'demo-admin-123' }
                    ],
                    members: [
                        { _id: 'demo-admin-123', username: 'admin' },
                        { _id: 'demo-user-1', username: 'user1' },
                        { _id: 'demo-user-2', username: 'user2' }
                    ]
                }
            ];
            renderGroups();
            
            // Select first group if available
            if (groups.length > 0 && !currentGroup) {
                selectGroup(groups[0]);
            }
        }
    } catch (err) {
        console.error('Error loading groups:', err);
        // Demo mode: Use sample groups if fetch fails
        console.log('Fetch failed, using sample groups for demo');
        groups = [
            {
                _id: 'demo-group-1',
                name: '演示群组1',
                owner: { _id: 'demo-admin-123' },
                admins: [
                    { _id: 'demo-admin-123' }
                ],
                members: [
                    { _id: 'demo-admin-123', username: 'admin' },
                    { _id: 'demo-user-1', username: 'user1' }
                ]
            },
            {
                _id: 'demo-group-2',
                name: '演示群组2',
                owner: { _id: 'demo-admin-123' },
                admins: [
                    { _id: 'demo-admin-123' }
                ],
                members: [
                    { _id: 'demo-admin-123', username: 'admin' },
                    { _id: 'demo-user-1', username: 'user1' },
                    { _id: 'demo-user-2', username: 'user2' }
                ]
            }
        ];
        renderGroups();
        
        // Select first group if available
        if (groups.length > 0 && !currentGroup) {
            selectGroup(groups[0]);
        }
    }
}

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render groups list
function renderGroups() {
    groupsList.innerHTML = '';
    
    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = `group-item ${currentGroup && currentGroup._id === group._id ? 'active' : ''}`;
        
        // Check if current user is owner, admin, or member
        const isOwner = group.owner._id === user.id;
        const isAdmin = group.admins.some(admin => admin._id === user.id);
        
        // Create action buttons based on user role
        let actionButtons = '';
        if (isOwner) {
            // Owner only has dissolve group button
            actionButtons = `<button class="group-action-btn dissolve-group-btn" onclick="dissolveGroup('${group._id}')">解散群组</button>`;
        } else {
            // Both admin and regular member only have leave button
            actionButtons = `<button class="group-action-btn leave-group-btn" onclick="leaveGroup('${group._id}')">退出群组</button>`;
        }
        
        groupItem.innerHTML = `
            <div class="group-info">
                <div class="group-name">${escapeHtml(group.name)}</div>
                <div class="group-members">${group.members.length} 成员</div>
            </div>
            <div class="group-action-buttons">
                ${actionButtons}
            </div>
        `;
        groupItem.addEventListener('click', () => selectGroup(group));
        groupsList.appendChild(groupItem);
    });
}

// Select a group
function selectGroup(group) {
    currentGroup = group;
    currentGroupElement.textContent = group.name;
    renderGroups();
    
    // Load messages for this group
    if (typeof loadMessages === 'function') {
        loadMessages(group._id);
    }
    
    // Join socket room
    if (socket) {
        socket.emit('joinGroup', { groupId: group._id });
    }
}

// Open create group modal
function openCreateGroupModal() {
    createGroupModal.classList.add('show');
}

// Close create group modal
function closeCreateGroupModalFunc() {
    createGroupModal.classList.remove('show');
    createGroupForm.reset();
}

// Create a new group
async function createGroup(e) {
    e.preventDefault();
    
    const groupName = document.getElementById('group-name').value;
    
    try {
        // Get token from localStorage
        const currentToken = localStorage.getItem('token');
        
        console.log('Creating group with token:', currentToken);
        
        const response = await fetch(`${API_BASE_URL}/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': currentToken
            },
            body: JSON.stringify({ name: groupName })
        });
        
        console.log('Create group response status:', response.status);
        
        if (response.ok) {
            const newGroup = await response.json();
            console.log('Group created:', newGroup);
            groups.push(newGroup);
            renderGroups();
            selectGroup(newGroup);
            closeCreateGroupModalFunc();
        } else if (response.status === 401) {
            console.error('Unauthorized: Invalid or expired token');
            // Redirect to login page if token is invalid
            window.location.href = 'login.html';
        } else {
            const data = await response.json();
            alert(data.msg || '创建群组失败');
        }
    } catch (err) {
        console.error('Error creating group:', err);
        alert('创建群组失败');
    }
}

// Join a group
async function joinGroup() {
    const groupId = joinGroupId.value.trim();
    if (!groupId) {
        alert('请输入群组ID');
        return;
    }
    
    try {
        // Get token from localStorage
        const currentToken = localStorage.getItem('token');
        
        console.log('Joining group with token:', currentToken);
        
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': currentToken
            }
        });
        
        console.log('Join group response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Join request sent:', data);
            alert(data.msg || '加入群组申请已发送，请等待管理员批准');
            joinGroupId.value = '';
        } else if (response.status === 401) {
            console.error('Unauthorized: Invalid or expired token');
            // Redirect to login page if token is invalid
            window.location.href = 'login.html';
        } else {
            const data = await response.json();
            alert(data.msg || '加入群组失败');
        }
    } catch (err) {
        console.error('Error joining group:', err);
        alert('加入群组失败');
    }
}

// Open group settings modal
function openGroupSettingsModal() {
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    groupSettingsModal.classList.add('show');
    loadGroupSettings();
}

// Close group settings modal
function closeGroupSettingsModalFunc() {
    groupSettingsModal.classList.remove('show');
    // Close popups when closing modal
    if (groupInfoPopup) {
        groupInfoPopup.classList.remove('show');
    }
    if (inviteUserPopup) {
        inviteUserPopup.classList.remove('show');
    }
}

// Toggle group info popup
function toggleGroupInfoPopup() {
    groupInfoPopup.classList.toggle('show');
    // Close invite popup if open
    if (inviteUserPopup.classList.contains('show')) {
        inviteUserPopup.classList.remove('show');
    }
}

// Toggle invite user popup
function toggleInviteUserPopup() {
    inviteUserPopup.classList.toggle('show');
    // Close group info popup if open
    if (groupInfoPopup.classList.contains('show')) {
        groupInfoPopup.classList.remove('show');
    }
}

// Debounce function for search
function debounce(func, delay) {
    let timeoutId;
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, arguments), delay);
    };
}

// Search users
async function searchUsers() {
    const query = inviteUsername.value.trim();
    if (!query) {
        userSearchResults.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            renderUserSearchResults(users);
        }
    } catch (err) {
        console.error('Error searching users:', err);
    }
}

// Render user search results
function renderUserSearchResults(users) {
    userSearchResults.innerHTML = '';
    
    if (users.length === 0) {
        userSearchResults.innerHTML = '<p>未找到匹配的用户</p>';
        return;
    }
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-search-result';
        userElement.innerHTML = `
            <span>${escapeHtml(user.username)}</span>
            <span>${escapeHtml(user.realName || '')}</span>
        `;
        userElement.addEventListener('click', () => selectUser(user));
        userSearchResults.appendChild(userElement);
    });
}

// Select a user for invitation
function selectUser(user) {
    inviteUsername.value = user.username;
    userSearchResults.innerHTML = '';
}

// Load group settings
async function loadGroupSettings() {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const group = await response.json();
            renderGroupSettings(group);
        }
    } catch (err) {
        console.error(err);
    }
    
    // Load join requests
    await loadJoinRequests();
}

// Load join requests
async function loadJoinRequests() {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/requests`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const requests = await response.json();
            renderJoinRequests(requests);
        }
    } catch (err) {
        console.error(err);
    }
}

// Render join requests
function renderJoinRequests(requests) {
    const requestsList = document.getElementById('requests-list');
    requestsList.innerHTML = '';
    
    if (requests.length === 0) {
        requestsList.innerHTML = '<p>暂无加入申请</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
            <div class="request-info">
                <span>${escapeHtml(request.user.username)}</span>
                <span>${escapeHtml(request.user.realName)}</span>
                <span>${escapeHtml(request.user.phone)}</span>
                <span>${new Date(request.createdAt).toLocaleString()}</span>
            </div>
            <div class="request-actions">
                <button class="action-btn approve-btn" onclick="approveJoinRequest('${request._id}')">批准</button>
                <button class="action-btn reject-btn" onclick="rejectJoinRequest('${request._id}')">拒绝</button>
            </div>
        `;
        requestsList.appendChild(requestItem);
    });
}

// Approve join request
async function approveJoinRequest(requestId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/requests/${requestId}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.msg || '申请批准成功');
            // Reload join requests and group settings
            await loadJoinRequests();
            await loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '申请批准失败');
        }
    } catch (err) {
        console.error(err);
        alert('申请批准失败');
    }
}

// Reject join request
async function rejectJoinRequest(requestId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/requests/${requestId}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.msg || '申请拒绝成功');
            // Reload join requests
            await loadJoinRequests();
        } else {
            const data = await response.json();
            alert(data.msg || '申请拒绝失败');
        }
    } catch (err) {
        console.error(err);
        alert('申请拒绝失败');
    }
}

// Invite member function
async function inviteMember() {
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    const username = inviteUsername.value.trim();
    if (!username) {
        alert('请输入要邀请的用户名');
        return;
    }
    
    try {
        // First, get the user ID by username
        const response = await fetch(`${API_BASE_URL}/auth/user/${username}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (!response.ok) {
            throw new Error('获取用户信息失败');
        }
        
        const recipient = await response.json();
        
        // Create invitation
        const inviteResponse = await fetch(`${API_BASE_URL}/announcements/invitations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({
                groupId: currentGroup._id,
                recipientId: recipient._id
            })
        });
        
        if (inviteResponse.ok) {
            const data = await inviteResponse.json();
            alert('邀请已发送');
            inviteUsername.value = '';
        } else {
            const data = await inviteResponse.json();
            alert('邀请失败：' + (data.msg || '未知错误'));
        }
    } catch (err) {
        console.error('Error inviting member:', err);
        alert('邀请失败：' + err.message);
    }
}

// Render group settings
function renderGroupSettings(group) {
    // Render group info
    document.getElementById('group-info-name').textContent = group.name;
    document.getElementById('group-info-id').textContent = group._id;
    document.getElementById('group-info-owner').textContent = escapeHtml(group.owner.username);
    document.getElementById('group-info-created').textContent = new Date(group.createdAt).toLocaleString();
    
    // Render members
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '';
    
    group.members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        
        // Check if member is admin or owner
        const isAdmin = group.admins.some(admin => admin._id === member._id);
        const isOwner = group.owner._id === member._id;
        
        // Check if current user is owner or admin
        const isCurrentUserOwner = group.owner._id === user.id;
        const isCurrentUserAdmin = group.admins.some(admin => admin._id === user.id);
        
        // Only owner can add admin, and member is not admin and not owner
        const canAddAdmin = isCurrentUserOwner && member._id !== user.id && !isAdmin;
        
        // Owner can kick anyone except themselves, admin can kick non-admin and non-owner
        const canKick = (isCurrentUserOwner && member._id !== user.id) || 
                      (isCurrentUserAdmin && !isAdmin && !isOwner && member._id !== user.id);
        
        // Owner can blacklist anyone except themselves, admin can blacklist non-admin and non-owner
        const canBlacklist = (isCurrentUserOwner && member._id !== user.id) || 
                           (isCurrentUserAdmin && !isAdmin && !isOwner && member._id !== user.id);
        
        memberItem.innerHTML = `
            <span>${escapeHtml(member.username)}</span>
            <div class="user-actions">
                ${canAddAdmin ? `<button class="action-btn add-admin-btn" onclick="addAdmin('${member._id}')">设为管理员</button>` : ''}
                ${canKick ? `<button class="action-btn kick-btn" onclick="kickUser('${member._id}')">踢出</button>` : ''}
                ${canBlacklist ? `<button class="action-btn blacklist-btn" onclick="blacklistUser('${member._id}')">加入黑名单</button>` : ''}
            </div>
        `;
        membersList.appendChild(memberItem);
    });
    
    // Render admins
    const adminsList = document.getElementById('admins-list');
    adminsList.innerHTML = '';
    
    group.admins.forEach(admin => {
        const adminItem = document.createElement('div');
        adminItem.className = 'admin-item';
        adminItem.innerHTML = `
            <span>${escapeHtml(admin.username)}</span>
            <div class="user-actions">
                ${group.owner._id === user.id && admin._id !== user.id ? 
                    `<button class="action-btn remove-admin-btn" onclick="removeAdmin('${admin._id}')">移除管理员</button>` : ''}
            </div>
        `;
        adminsList.appendChild(adminItem);
    });
    
    // Render blacklist
    const blacklistList = document.getElementById('blacklist-list');
    blacklistList.innerHTML = '';
    
    // Load blacklist separately
    loadBlacklist(group._id);
}

// Load blacklist
async function loadBlacklist(groupId) {
    try {
        const response = await fetch(`${API_BASE_URL}/blacklist/${groupId}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const blacklist = await response.json();
            const blacklistList = document.getElementById('blacklist-list');
            blacklistList.innerHTML = '';
            
            blacklist.forEach(item => {
                const blacklistItem = document.createElement('div');
                blacklistItem.className = 'blacklist-item';
                blacklistItem.innerHTML = `
                    <span>${escapeHtml(item.user.username)}</span>
                    <div class="user-actions">
                        <button class="action-btn remove-blacklist-btn" onclick="removeFromBlacklist('${item.user._id}')">移除</button>
                    </div>
                `;
                blacklistList.appendChild(blacklistItem);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// Add admin
async function addAdmin(userId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/admins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '操作失败');
        }
    } catch (err) {
        console.error(err);
        alert('操作失败');
    }
}

// Remove admin
async function removeAdmin(userId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/admins/${userId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '操作失败');
        }
    } catch (err) {
        console.error(err);
        alert('操作失败');
    }
}

// Kick user
async function kickUser(userId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${currentGroup._id}/kick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            // Update groups list
            await loadGroups();
            loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '操作失败');
        }
    } catch (err) {
        console.error(err);
        alert('操作失败');
    }
}

// Blacklist user
async function blacklistUser(userId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/blacklist/${currentGroup._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            // Update groups list
            await loadGroups();
            loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '操作失败');
        }
    } catch (err) {
        console.error(err);
        alert('操作失败');
    }
}

// Remove from blacklist
async function removeFromBlacklist(userId) {
    if (!currentGroup) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/blacklist/${currentGroup._id}/${userId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            loadGroupSettings();
        } else {
            const data = await response.json();
            alert(data.msg || '操作失败');
        }
    } catch (err) {
        console.error(err);
        alert('操作失败');
    }
}

// Dissolve group
async function dissolveGroup(groupId) {
    // Find the group by ID
    const group = groups.find(g => g._id === groupId);
    if (!group) return;
    
    // Confirm dissolve intention
    if (!confirm('确定要解散这个群组吗？此操作不可恢复，所有聊天记录和群组数据都将被删除。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.msg || '群组解散成功');
            
            // Update groups list
            await loadGroups();
            
            // Clear current group if it was the dissolved one
            if (currentGroup && currentGroup._id === groupId) {
                currentGroup = null;
                currentGroupElement.textContent = '';
            }
        } else {
            const data = await response.json();
            alert(data.msg || '解散群组失败');
        }
    } catch (err) {
        console.error(err);
        alert('解散群组失败');
    }
}

// Leave group
async function leaveGroup(groupId) {
    // Find the group by ID
    const group = groups.find(g => g._id === groupId);
    if (!group) return;
    
    // Confirm leave intention
    if (!confirm('确定要退出这个群组吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/leave`, {
            method: 'POST',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.msg || '退出群组成功');
            
            // Update groups list
            await loadGroups();
            
            // Clear current group if it was the left one
            if (currentGroup && currentGroup._id === groupId) {
                currentGroup = null;
                currentGroupElement.textContent = '';
            }
        } else {
            const data = await response.json();
            alert(data.msg || '退出群组失败');
        }
    } catch (err) {
        console.error(err);
        alert('退出群组失败');
    }
}

// 深色模式切换功能
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    // 切换深色主题类
    body.classList.toggle('dark-theme');
    
    // 保存主题偏好到localStorage
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // 更新按钮文本
    if (isDark) {
        themeToggle.textContent = '☀️';
    } else {
        themeToggle.textContent = '🌙';
    }
}

// 加载保存的主题偏好
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.textContent = '☀️';
        }
    } else {
        body.classList.remove('dark-theme');
        if (themeToggle) {
            themeToggle.textContent = '🌙';
        }
    }
}

// 在原有的init函数末尾添加加载主题的调用
// 注意：此代码会在原有的init函数执行完成后自动调用
function enhancedInit() {
    // 调用原有的init函数
    init();
    // 加载主题
    loadTheme();
}

// 移除原有的DOMContentLoaded事件监听器
// 注意：由于事件监听器是在脚本加载时添加的，这里直接替换为enhancedInit
// 移除可能存在的监听器（虽然可能不会成功，因为我们不知道具体的监听器引用）
try {
    document.removeEventListener('DOMContentLoaded', init);
} catch (e) {
    console.log('No existing init event listener found, which is expected');
}

// 添加新的DOMContentLoaded事件监听器，使用enhancedInit
document.addEventListener('DOMContentLoaded', enhancedInit);
