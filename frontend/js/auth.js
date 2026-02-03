// API base URL
const API_BASE_URL = '/api';

// Register form
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const realName = document.getElementById('realName').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, realName, phone, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(data.msg || '注册成功！请等待管理员验证。');
                window.location.href = 'login.html';
            } else {
                alert(data.msg || '注册失败');
            }
        } catch (err) {
            console.error(err);
            alert('注册失败，请重试');
        }
    });
}

// Login form
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Save token and user info to localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                // Redirect to home page
                window.location.href = 'home.html';
            } else {
                alert(data.msg || '登录失败');
            }
        } catch (err) {
            console.error(err);
            alert('登录失败，请重试');
        }
    });
}

// Check if user is authenticated
function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

// Redirect to login if not authenticated (only for chat page)
if (window.location.pathname.endsWith('index.html') && !isAuthenticated()) {
    // Allow access to index.html even if not authenticated for demo purposes
    // window.location.href = 'login.html';
}
