// DOM elements
let messagesContainer;
let messageForm;
let messageInput;

// Socket.io connection
let socket;

// Load messages for a group
async function loadMessages(groupId) {
    if (!groupId) return;
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${groupId}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            renderMessages(messages);
        }
    } catch (err) {
        console.error(err);
        alert('加载消息失败');
    }
}

// Render messages
function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    // Get user from localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    
    messages.forEach(message => {
        addMessageToDOM(message, user);
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add a single message to DOM
function addMessageToDOM(message, user) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender._id === user.id ? 'own' : ''}`;
    messageElement.dataset.messageId = message._id;
    
    const isOwnerOrAdmin = currentGroup && (currentGroup.owner._id === user.id || currentGroup.admins.some(admin => admin._id === user.id));
    const canDelete = isOwnerOrAdmin || message.sender._id === user.id;
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${escapeHtml(message.sender.username)}</span>
            <span class="message-time">${new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        ${canDelete ? `<div class="message-actions"><button class="delete-btn" onclick="deleteMessage('${message._id}')">删除</button></div>` : ''}
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Initialize chat components
function initChat() {
    // Initialize DOM elements
    messagesContainer = document.getElementById('messages-container');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    
    // Socket.io connection
    socket = io();
    
    // Add event listeners
    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage);
    }
    
    // Socket event listeners
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
    
    socket.on('message', (message) => {
        if (currentGroup && currentGroup._id === message.group) {
            addMessageToDOM(message);
            scrollToBottom();
        }
    });
    
    socket.on('messageDeleted', (messageId) => {
        if (currentGroup) {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
        }
    });
}

// Send a message
async function sendMessage(e) {
    e.preventDefault();
    
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    const content = messageInput.value.trim();
    if (!content) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${currentGroup._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            const message = await response.json();
            // Add message to DOM
            addMessageToDOM(message, user);
            // Emit message to socket
            socket.emit('sendMessage', { groupId: currentGroup._id, message });
            // Clear input
            messageInput.value = '';
            // Scroll to bottom
            scrollToBottom();
        }
    } catch (err) {
        console.error(err);
        alert('发送消息失败');
    }
}

// Delete a message
async function deleteMessage(messageId) {
    if (!currentGroup) return;
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            // Remove message from DOM
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            // Emit delete event to socket
            socket.emit('deleteMessage', { groupId: currentGroup._id, messageId });
        }
    } catch (err) {
        console.error(err);
        alert('删除消息失败');
    }
}

// Scroll to bottom of messages container
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}