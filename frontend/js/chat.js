// DOM elements
let messagesContainer;
let messageForm;
let messageInput;
let fileInput;
let fileUploadBtn;
let fileUploadProgress;
let progressBar;
let progressText;
let replyContainer;
let replyContent;
let cancelReplyBtn;
let searchInput;
let searchBtn;
let clearSearchBtn;

// 回复相关变量
let currentReplyTo = null;

// Socket.io connection
window.socket = io();
let socket = window.socket;

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
    
    let messageContent = '';
    if (message.fileUrl) {
        // File message
        const fileSize = formatFileSize(message.fileSize);
        // 确保文件名正确显示，处理可能的编码问题
        let fileName = message.fileName;
        try {
            fileName = decodeURIComponent(fileName);
        } catch (err) {
            console.error('Error decoding filename:', err.message);
        }
        // 编码文件名，确保下载链接正确
        const encodedFileName = encodeURIComponent(fileName);
        
        // 生成文件预览
        const filePreview = generateFilePreview(message.fileUrl, message.fileType, fileName);
        
        messageContent = `
            <div class="file-message">
                <div class="file-icon">${getFileIcon(message.fileType)}</div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(fileName)}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
                ${filePreview}
                <a href="${message.fileUrl}?filename=${encodedFileName}" class="file-download-btn" target="_blank" download="${fileName}">下载</a>
            </div>
        `;
    } else {
        // Text message
        messageContent = `<div class="message-content">${escapeHtml(message.content)}</div>`;
    }
    
    // 生成被回复消息的显示
    let replyMessageHtml = '';
    if (message.replyTo) {
        const replySender = message.replyTo.sender ? message.replyTo.sender.username : '未知用户';
        let replyText = message.replyTo.content;
        if (message.replyTo.fileName) {
            replyText = `[文件] ${message.replyTo.fileName}`;
        }
        replyMessageHtml = `
            <div class="reply-message">
                <span class="reply-sender">${escapeHtml(replySender)}:</span>
                <span class="reply-content">${escapeHtml(replyText)}</span>
            </div>
        `;
    }
    
    // 检查消息是否已读
    let readStatusHtml = '';
    if (message.readStatus) {
        const userReadStatus = message.readStatus.find(status => status.userId === user.id);
        if (userReadStatus) {
            readStatusHtml = `<span class="read-status ${userReadStatus.read ? 'read' : 'unread'}">${userReadStatus.read ? '已读' : '未读'}</span>`;
        }
    }
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${escapeHtml(message.sender.username)}</span>
            <div class="message-header-right">
                <span class="message-time">${new Date(message.createdAt).toLocaleTimeString()}</span>
                ${readStatusHtml}
            </div>
        </div>
        ${replyMessageHtml}
        ${messageContent}
        <div class="message-actions">
            <button class="reply-btn" onclick="replyToMessage('${message._id}', '${escapeHtml(message.sender.username)}', '${escapeHtml(message.content)}', '${message.fileName ? escapeHtml(message.fileName) : ''}')">回复</button>
            ${canDelete ? `<button class="delete-btn" onclick="deleteMessage('${message._id}')">删除</button>` : ''}
            ${!message.sender._id === user.id && !userReadStatus?.read ? `<button class="mark-read-btn" onclick="markAsRead('${message._id}')">标记已读</button>` : ''}
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // 自动标记为已读
    if (message.sender._id !== user.id && message.readStatus) {
        const userReadStatus = message.readStatus.find(status => status.userId === user.id);
        if (userReadStatus && !userReadStatus.read) {
            markAsRead(message._id);
        }
    }
}

// 生成文件预览
function generateFilePreview(fileUrl, fileType, fileName) {
    if (!fileType) return '';
    
    // 图片预览
    if (fileType.startsWith('image/')) {
        return `
            <div class="file-preview">
                <img src="${fileUrl}" alt="${escapeHtml(fileName)}" class="image-preview">
            </div>
        `;
    }
    
    // 视频预览
    if (fileType.startsWith('video/')) {
        return `
            <div class="file-preview">
                <video controls class="video-preview">
                    <source src="${fileUrl}" type="${fileType}">
                    您的浏览器不支持视频播放。
                </video>
            </div>
        `;
    }
    
    // 音频预览
    if (fileType.startsWith('audio/')) {
        return `
            <div class="file-preview">
                <audio controls class="audio-preview">
                    <source src="${fileUrl}" type="${fileType}">
                    您的浏览器不支持音频播放。
                </audio>
            </div>
        `;
    }
    
    // 其他文件类型，不生成预览
    return '';
}

// 获取文件类型图标
function getFileIcon(fileType) {
    if (!fileType) return '📁';
    
    // 图片文件
    if (fileType.startsWith('image/')) {
        return '🖼️';
    }
    
    // 视频文件
    if (fileType.startsWith('video/')) {
        return '🎥';
    }
    
    // 音频文件
    if (fileType.startsWith('audio/')) {
        return '🎵';
    }
    
    // 文档文件
    if (fileType.includes('document') || fileType.includes('word') || fileType.includes('excel') || fileType.includes('powerpoint')) {
        return '📄';
    }
    
    // PDF文件
    if (fileType.includes('pdf')) {
        return '📕';
    }
    
    // 代码文件
    if (fileType.includes('javascript') || fileType.includes('css') || fileType.includes('html') || fileType.includes('json')) {
        return '💻';
    }
    
    // 压缩文件
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) {
        return '📦';
    }
    
    // 其他文件
    return '📁';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize chat components
function initChat() {
    // Initialize DOM elements
    messagesContainer = document.getElementById('messages-container');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    fileInput = document.getElementById('file-input');
    fileUploadBtn = document.getElementById('file-upload-btn');
    fileUploadProgress = document.getElementById('file-upload-progress');
    progressBar = document.getElementById('progress-bar');
    progressText = document.getElementById('progress-text');
    replyContainer = document.getElementById('reply-container');
    replyContent = document.getElementById('reply-content');
    cancelReplyBtn = document.getElementById('cancel-reply-btn');
    searchInput = document.getElementById('search-input');
    searchBtn = document.getElementById('search-btn');
    clearSearchBtn = document.getElementById('clear-search-btn');
    
    // Add event listeners
    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage);
    }
    
    if (fileUploadBtn) {
        fileUploadBtn.addEventListener('click', () => fileInput.click());
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }
    
    // Search event listeners
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
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
            // Get user from localStorage
            const user = JSON.parse(localStorage.getItem('user'));
            addMessageToDOM(message, user);
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
    
    // Initialize additional features
    initAdditionalFeatures();
}

// Handle file selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        if (files.length === 1) {
            // 单个文件上传
            uploadFile(files[0]);
        } else {
            // 多个文件上传
            uploadFiles(files);
        }
        // Reset file input
        e.target.value = '';
    }
}

// Upload multiple files
async function uploadFiles(files) {
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        // Show progress bar
        fileUploadProgress.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = `上传中: ${files.length}个文件`;
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        
        // 使用XMLHttpRequest获取上传进度
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = `${percentComplete}%`;
                progressText.textContent = `上传中: ${Math.round(percentComplete)}%`;
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                // Hide progress bar
                fileUploadProgress.style.display = 'none';
            } else {
                // Hide progress bar
                fileUploadProgress.style.display = 'none';
                try {
                    const data = JSON.parse(xhr.responseText);
                    alert('文件上传失败 ERR*: ' + (data.msg || '未知错误'));
                } catch (err) {
                    alert('文件上传失败 ERR1');
                }
            }
        });
        
        xhr.addEventListener('error', function() {
            // Hide progress bar
            fileUploadProgress.style.display = 'none';
            alert('文件上传失败 ERR2');
        });
        
        xhr.open('POST', `${API_BASE_URL}/messages/${currentGroup._id}/uploads`);
        xhr.setRequestHeader('x-auth-token', token);
        xhr.send(formData);
    } catch (err) {
        console.error(err);
        // Hide progress bar
        fileUploadProgress.style.display = 'none';
        alert('文件上传失败 ERR3');
    }
}

// Upload file
async function uploadFile(file) {
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        // Show progress bar
        fileUploadProgress.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = `上传中: ${file.name}`;
        
        const formData = new FormData();
        formData.append('file', file);
        
        // 使用XMLHttpRequest获取上传进度
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = `${percentComplete}%`;
                progressText.textContent = `上传中: ${file.name} (${Math.round(percentComplete)}%)`;
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                // Hide progress bar
                fileUploadProgress.style.display = 'none';
            } else {
                // Hide progress bar
                fileUploadProgress.style.display = 'none';
                try {
                    const data = JSON.parse(xhr.responseText);
                    alert('文件上传失败 ERR*: ' + (data.msg || '未知错误'));
                } catch (err) {
                    alert('文件上传失败 ERR1');
                }
            }
        });
        
        xhr.addEventListener('error', function() {
            // Hide progress bar
            fileUploadProgress.style.display = 'none';
            alert('文件上传失败 ERR2');
        });
        
        xhr.open('POST', `${API_BASE_URL}/messages/${currentGroup._id}/upload`);
        xhr.setRequestHeader('x-auth-token', token);
        xhr.send(formData);
    } catch (err) {
        console.error(err);
        // Hide progress bar
        fileUploadProgress.style.display = 'none';
        alert('文件上传失败 ERR3');
    }
}

// 回复消息
function replyToMessage(messageId, senderName, content, fileName) {
    // 设置当前回复的消息
    currentReplyTo = messageId;
    
    // 生成回复内容
    let replyText = content;
    if (fileName) {
        replyText = `[文件] ${fileName}`;
    }
    
    // 显示回复容器
    replyContainer.style.display = 'flex';
    replyContent.innerHTML = `
        <span class="reply-sender">${senderName}:</span>
        <span class="reply-text">${replyText}</span>
    `;
    
    // 聚焦到消息输入框
    messageInput.focus();
}

// 取消回复
function cancelReply() {
    // 清除当前回复
    currentReplyTo = null;
    replyContainer.style.display = 'none';
    replyContent.innerHTML = '';
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
            body: JSON.stringify({ 
                content, 
                replyTo: currentReplyTo 
            })
        });
        
        if (response.ok) {
            // Clear input
            messageInput.value = '';
            // 取消回复状态
            cancelReply();
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

// Mark message as read
async function markAsRead(messageId) {
    if (!currentGroup) return;
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${messageId}/read`, {
            method: 'PUT',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            // Update UI
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const readStatusElement = messageElement.querySelector('.read-status');
                if (readStatusElement) {
                    readStatusElement.classList.remove('unread');
                    readStatusElement.classList.add('read');
                    readStatusElement.textContent = '已读';
                }
                
                const markReadBtn = messageElement.querySelector('.mark-read-btn');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// Scroll to bottom of messages container
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initialize additional features
function initAdditionalFeatures() {
    // Add event listener for group selection to mark messages as read
    document.addEventListener('groupSelected', function(e) {
        const groupId = e.detail.groupId;
        if (groupId) {
            // Mark all messages in the group as read
            markAllAsRead(groupId);
        }
    });
}

// Mark all messages in a group as read
async function markAllAsRead(groupId) {
    if (!groupId) return;
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${groupId}/read-all`, {
            method: 'PUT',
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            // Update UI for all messages
            const messageElements = document.querySelectorAll('.message');
            messageElements.forEach(element => {
                const readStatusElement = element.querySelector('.read-status');
                if (readStatusElement) {
                    readStatusElement.classList.remove('unread');
                    readStatusElement.classList.add('read');
                    readStatusElement.textContent = '已读';
                }
                
                const markReadBtn = element.querySelector('.mark-read-btn');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// Perform message search
async function performSearch() {
    if (!currentGroup) {
        alert('请先选择一个群组');
        return;
    }
    
    const keyword = searchInput.value.trim();
    if (!keyword) {
        alert('请输入搜索关键词');
        return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${currentGroup._id}/search?keyword=${encodeURIComponent(keyword)}`, {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            // Display search results
            displaySearchResults(messages);
            // Show clear search button
            clearSearchBtn.style.display = 'inline-block';
        }
    } catch (err) {
        console.error(err);
        alert('搜索失败');
    }
}

// Display search results
function displaySearchResults(messages) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">没有找到匹配的消息</div>';
        return;
    }
    
    // Get user from localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    
    messages.forEach(message => {
        addMessageToDOM(message, user);
    });
    
    // Scroll to top
    messagesContainer.scrollTop = 0;
}

// Clear search results
function clearSearch() {
    if (!currentGroup) return;
    
    // Clear search input
    searchInput.value = '';
    // Hide clear search button
    clearSearchBtn.style.display = 'none';
    // Reload all messages
    loadMessages(currentGroup._id);
}