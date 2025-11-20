// ============================================
// 都市传说档案馆 - 前端应用
// Mac OS 3 暗色系风格
// ============================================

const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('token');
let allStories = [];
let currentCategory = 'all';
let lastStoryCount = 0;
let lastNotificationCheck = 0;
let currentPage = 1;
let totalPages = 1;
let pagination = null;

// 分类名称映射
const categoryNames = {
    'subway_ghost': '地铁灵异',
    'abandoned_building': '废弃建筑',
    'campus_horror': '校园惊悚',
    'rental_mystery': '出租屋诡事',
    'night_taxi': '深夜出租',
    'hospital_ward': '医院病房',
    'elevator_incident': '电梯事件',
    'mirror_realm': '镜中世界'
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ 都市传说档案馆已加载');
    if (token) verifyToken();
    loadStories();
    bindEvents();
    updateClock();
    setInterval(updateClock, 1000);
    
    // 新菜单栏事件
    bindHeaderEvents();
    
    // 每30秒检查新故事和通知
    setInterval(() => {
        loadStories(true);  // 静默刷新
        if (currentUser) checkNotifications();
    }, 30000);
    
    // 初始通知检查
    if (currentUser) checkNotifications();
});

function bindEvents() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const toggleAuthBtn = document.getElementById('toggle-auth');
    const authForm = document.getElementById('auth-form');
    
    // 旧的登录/注册按钮已移除（在新菜单栏中处理）
    if (loginBtn) loginBtn.addEventListener('click', showLoginForm);
    if (registerBtn) registerBtn.addEventListener('click', showRegisterForm);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (toggleAuthBtn) toggleAuthBtn.addEventListener('click', toggleAuthForm);
    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
    
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            
            // 追踪用户点击分类
            if (token && currentCategory !== 'all') {
                trackCategoryClick(currentCategory);
            }
            
            renderStories();
        });
    });
    
    const authModal = document.getElementById('auth-modal');
    const storyModal = document.getElementById('story-modal');
    const userCenterModal = document.getElementById('user-center-modal');
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });
    }
    
    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) closeStoryModal();
        });
    }

    if (userCenterModal) {
        userCenterModal.addEventListener('click', (e) => {
            if (e.target === userCenterModal) {
                stopRetroCamera();
                userCenterModal.style.display = 'none';
            }
        });
    }
}

// 头部菜单栏事件处理
function bindHeaderEvents() {
    // 搜索功能
    const searchInput = document.getElementById('search-posts');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const keyword = searchInput.value.trim();
                if (keyword) {
                    searchStories(keyword);
                }
            }
        });
    }
    
    // 用户中心
    const userMenu = document.getElementById('menu-user');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenu && userDropdown) {
        // 切换下拉菜单显示
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userDropdown.style.display === 'none' || userDropdown.style.display === '') {
                userDropdown.style.display = 'block';
            } else {
                userDropdown.style.display = 'none';
            }
        });

        // 个人中心选项
        const uc = document.getElementById('user-center-option');
        if (uc) uc.addEventListener('click', (ev) => { ev.stopPropagation(); userDropdown.style.display = 'none'; if (currentUser) showUserCenter(); else showLoginForm(); });

        // 登出选项
        const ulog = document.getElementById('user-logout-option');
        if (ulog) ulog.addEventListener('click', (ev) => { ev.stopPropagation(); userDropdown.style.display = 'none'; logout(); });

        // 点击页面任意处隐藏下拉
        document.addEventListener('click', () => { userDropdown.style.display = 'none'; });
    } else if (userMenu) {
        // 回退：若没有下拉，原行为
        userMenu.addEventListener('click', () => {
            if (currentUser) showUserCenter(); else showLoginForm();
        });
    }
    
    // 通知中心
    const notificationsMenu = document.getElementById('menu-notifications');
    if (notificationsMenu) {
        notificationsMenu.addEventListener('click', () => {
            showNotificationCenter();
        });
    }
}

// 搜索故事
function searchStories(keyword) {
    if (!keyword) {
        renderStories();
        return;
    }
    
    const filtered = allStories.filter(story => 
        story.title.toLowerCase().includes(keyword.toLowerCase()) ||
        story.content.toLowerCase().includes(keyword.toLowerCase())
    );
    
    console.log(`🔍 搜索结果: 找到 ${filtered.length} 个故事`);
    renderStoriesFromList(filtered);
    showToast(`🔍 找到 ${filtered.length} 个相关故事`, 'info');
}

// 从指定列表渲染故事
function renderStoriesFromList(stories) {
    const container = document.getElementById('stories-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (stories.length === 0) {
        container.innerHTML = '<div class="loading-text">🔍 没有找到相关故事</div>';
        return;
    }
    
    container.innerHTML = stories.map(story => {
        return '<div class="story-item" onclick="showStoryDetail(' + story.id + ')">' +
            '<div class="story-title">👻 ' + escapeHtml(story.title) + '</div>' +
            '<div class="story-meta">' +
            '<span>👁️ ' + story.views + '</span>' +
            '<span>💬 ' + story.comments_count + '</span>' +
            '<span>📸 ' + story.evidence_count + '</span>' +
            '</div>' +
            '<div class="story-preview">' + escapeHtml(story.content.substring(0, 80)) + '</div>' +
            '<div class="story-footer">' +
            '<span>' + (story.ai_persona || '🤖 AI') + '</span>' +
            '<span>' + formatDate(story.created_at) + '</span>' +
            '</div>' +
            '</div>';
    }).join('');
}

// 显示用户中心
// Retro Camera 控制
let retroCameraStream = null;
let retroCameraAnimationId = null;

function showUserCenter() {
    // 渲染并显示个人中心模态框
    const modal = document.getElementById('user-center-modal');
    const avatar = document.getElementById('uc-avatar');
    const username = document.getElementById('uc-username');
    const followList = document.getElementById('uc-follow-list');
    const categoriesEl = document.getElementById('uc-categories');

    const subjectId = document.getElementById('uc-subject-id');
    const incept = document.getElementById('uc-incept');
    const functionEl = document.getElementById('uc-function');
    const rankEl = document.getElementById('uc-rank');

    if (currentUser) {
        if (avatar) {
            if (currentUser.avatar && currentUser.avatar.startsWith('http')) {
                avatar.src = currentUser.avatar;
            } else {
                avatar.src = '/static/avatar.png';
            }
        }
        if (username) username.textContent = currentUser.username.toUpperCase().replace(/\s/g, '.');
        if (subjectId) subjectId.textContent = 'A-' + (currentUser.id ? String(currentUser.id).padStart(2, '0') : '00');
        if (incept) {
            const date = new Date(currentUser.created_at || Date.now());
            incept.textContent = date.toLocaleDateString('en-GB').replace(/\//g, '/');
        }
        if (functionEl) functionEl.textContent = currentUser.rank || 'OBSERVER';
        if (rankEl) rankEl.textContent = 'STABLE';
        
        // 获取用户最感兴趣的分类
        if (categoriesEl && token) {
            categoriesEl.innerHTML = '<span class="retro-interest-tag retro-loading-tag">LOADING...</span>';
            
            fetch(API_BASE + '/user-top-categories', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(res => res.ok ? res.json() : { categories: [] })
            .then(data => {
                if (data.categories && data.categories.length > 0) {
                    categoriesEl.innerHTML = data.categories.map(cat => 
                        '<span class="retro-interest-tag">' + (categoryNames[cat.category] || cat.category.toUpperCase()) + '</span>'
                    ).join('');
                    
                    // 更新用户档案类型
                    updateProfileType(data.categories);
                } else {
                    categoriesEl.innerHTML = '<span class="retro-interest-tag retro-no-data-tag">NO DATA</span>';
                    updateProfileType([]);
                }
            })
            .catch(() => {
                categoriesEl.innerHTML = '<span class="retro-interest-tag retro-no-data-tag">ERROR</span>';
                updateProfileType([]);
            });
        }
    } else {
        if (avatar) avatar.src = '/static/avatar.png';
        if (username) username.textContent = 'GUEST.USER';
        if (subjectId) subjectId.textContent = 'A-00';
        if (incept) incept.textContent = '--/--/----';
        if (functionEl) functionEl.textContent = 'VISITOR';
        if (rankEl) rankEl.textContent = 'UNKNOWN';
        
        // 访客状态
        if (categoriesEl) {
            categoriesEl.innerHTML = '<span class="retro-interest-tag retro-no-data-tag">GUEST MODE</span>';
        }
        updateProfileType([]);
    }

    // 简单请求关注列表（如果需要，可扩展 API）
    if (followList) {
        followList.innerHTML = '<p style="color:#999;">正在加载...</p>';
        if (token) {
            fetch(API_BASE + '/notifications', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    // 这里后端尚未提供关注列表接口，显示示例通知或空提示
                    followList.innerHTML = '';
                    if (Array.isArray(data) && data.length > 0) {
                        data.slice(0,10).forEach(n => {
                            const el = document.createElement('div');
                            el.style.padding = '6px';
                            el.style.borderBottom = '1px dashed #ddd';
                            el.textContent = n.content || '通知项';
                            followList.appendChild(el);
                        });
                    } else {
                        followList.innerHTML = '<p style="color:#999;">暂无关注或示例内容</p>';
                    }
                }).catch(() => { followList.innerHTML = '<p style="color:#999;">暂无关注</p>'; });
        } else {
            followList.innerHTML = '<p style="color:#999;">请先登录以查看关注列表</p>';
        }
    }

    if (modal) {
        modal.style.display = 'flex';
        // 初始化摄像头按钮
        initRetroCameraButton();
    }
}

// 初始化 Retro 摄像头按钮
function initRetroCameraButton() {
    const btn = document.getElementById('retro-camera-btn');
    if (btn) {
        // 移除旧的事件监听器
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            if (retroCameraStream) {
                stopRetroCamera();
            } else {
                startRetroCamera();
            }
        });
    }
}

// 启动 Retro 摄像头
async function startRetroCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 320 } 
        });
        
        retroCameraStream = stream;
        const video = document.getElementById('retro-video');
        const canvas = document.getElementById('retro-canvas');
        const placeholder = document.getElementById('retro-camera-placeholder');
        const btn = document.getElementById('retro-camera-btn');
        
        if (video) {
            video.srcObject = stream;
            video.style.display = 'block';
        }
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        if (canvas) {
            canvas.style.display = 'block';
        }
        
        if (btn) {
            btn.textContent = 'TERMINATE';
            btn.style.background = '#ff6b6b';
        }
        
        // 开始渲染循环
        renderRetroCamera();
        
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("无法访问摄像头，请检查权限设置。");
    }
}

// 停止 Retro 摄像头
function stopRetroCamera() {
    if (retroCameraStream) {
        retroCameraStream.getTracks().forEach(track => track.stop());
        retroCameraStream = null;
    }
    
    if (retroCameraAnimationId) {
        cancelAnimationFrame(retroCameraAnimationId);
        retroCameraAnimationId = null;
    }
    
    const video = document.getElementById('retro-video');
    const canvas = document.getElementById('retro-canvas');
    const placeholder = document.getElementById('retro-camera-placeholder');
    const btn = document.getElementById('retro-camera-btn');
    
    if (video) {
        video.srcObject = null;
        video.style.display = 'none';
    }
    
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    
    if (btn) {
        btn.textContent = 'INITIALIZE';
        btn.style.background = '#dfff00';
    }
}

// 渲染 Retro 摄像头画面
function renderRetroCamera() {
    const video = document.getElementById('retro-video');
    const canvas = document.getElementById('retro-canvas');
    
    if (retroCameraStream && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    
    retroCameraAnimationId = requestAnimationFrame(renderRetroCamera);
}

// 更新用户档案类型（根据兴趣分类）
function updateProfileType(categories) {
    const profileTypeEl = document.getElementById('uc-profile-type');
    if (!profileTypeEl) return;
    
    if (!categories || categories.length === 0) {
        profileTypeEl.textContent = 'UNKNOWN';
        return;
    }
    
    // 根据最感兴趣的分类定义用户类型
    const profileTypes = {
        'subway_ghost': 'URBAN EXPLORER',
        'abandoned_building': 'RUIN HUNTER',
        'cursed_object': 'ARTIFACT SEEKER',
        'missing_person': 'INVESTIGATOR',
        'time_anomaly': 'REALITY BENDER',
        'campus_horror': 'STUDENT WITNESS',
        'rental_mystery': 'TENANT SURVIVOR',
        'night_taxi': 'NIGHT WANDERER',
        'hospital_ward': 'MEDICAL ANOMALY',
        'elevator_incident': 'VERTICAL TRAVELER',
        'mirror_realm': 'REFLECTION WALKER'
    };
    
    const topCategory = categories[0].category;
    const profileType = profileTypes[topCategory] || 'UNKNOWN ENTITY';
    
    profileTypeEl.textContent = profileType;
}

// 追踪用户点击的分类
async function trackCategoryClick(category) {
    if (!token || !category) return;
    
    try {
        await fetch(API_BASE + '/track-category-click', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ category: category })
        });
    } catch (error) {
        console.error('Failed to track category click:', error);
    }
}

// 显示通知中心
function showNotificationCenter() {
    showToast('📬 通知中心功能开发中...', 'info');
    // TODO: 实现通知中心窗口
}

async function loadStories(silent = false, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/stories?page=${page}&per_page=8`);
        const data = await response.json();
        
        allStories = data.stories;
        pagination = data.pagination;
        currentPage = pagination.page;
        totalPages = pagination.pages;
        
        // 检测新故事
        if (!silent && lastStoryCount > 0 && pagination.total > lastStoryCount) {
            const diff = pagination.total - lastStoryCount;
            showToast(`🎃 有 ${diff} 个新故事发布了！`, 'info');
        }
        
        lastStoryCount = pagination.total;
        
        // 更新统计信息
        const countEl = document.getElementById('story-count');
        if (countEl) countEl.textContent = pagination.total;
        
        // 更新最后更新时间
        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) lastUpdateEl.textContent = '刚刚';
        
        renderStories();
        renderPagination();
    } catch (error) {
        console.error('加载故事失败:', error);
        if (!silent) showToast('加载故事失败', 'error');
    }
}

async function checkNotifications() {
    if (!token || !currentUser) return;
    
    try {
        const res = await fetch(API_BASE + '/notifications', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
            const notifications = await res.json();
            const unread = notifications.filter(n => !n.is_read);
            
            if (unread.length > lastNotificationCheck) {
                // 有新通知
                const newCount = unread.length - lastNotificationCheck;
                unread.slice(0, newCount).forEach(n => {
                    showToast(`💬 ${n.content}`, 'info');
                });
            }
            
            lastNotificationCheck = unread.length;
        }
    } catch (error) {
        console.error('检查通知失败:', error);
    }
}

function renderStories() {
    const container = document.getElementById('stories-container');
    if (!container) return;
    
    const filtered = currentCategory === 'all' ? allStories : allStories.filter(s => s.category === currentCategory);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="loading-text">暂无档案</div>';
        return;
    }
    
    container.innerHTML = filtered.map(story => {
        return '<div class="story-item" onclick="showStoryDetail(' + story.id + ')">' +
            '<div class="story-title">👻 ' + escapeHtml(story.title) + '</div>' +
            '<div class="story-meta">' +
            '<span>👁️ ' + story.views + '</span>' +
            '<span>💬 ' + story.comments_count + '</span>' +
            '<span>📸 ' + story.evidence_count + '</span>' +
            '</div>' +
            '<div class="story-preview">' + escapeHtml(story.content.substring(0, 80)) + '</div>' +
            '<div class="story-footer">' +
            '<span>' + (story.ai_persona || '🤖 AI') + '</span>' +
            '<span>' + formatDate(story.created_at) + '</span>' +
            '</div>' +
            '</div>';
    }).join('');
}

function renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container || !pagination) return;
    
    if (pagination.pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination">';
    
    // 上一页按钮
    if (pagination.has_prev) {
        html += `<button class="macos3-button" onclick="changePage(${pagination.prev_page})">◀ 上一页</button>`;
    } else {
        html += `<button class="macos3-button" disabled style="opacity: 0.5;">◀ 上一页</button>`;
    }
    
    // 页码信息
    html += `<span style="margin: 0 15px; color: #6b0080; font-weight: bold;">第 ${pagination.page} / ${pagination.pages} 页</span>`;
    
    // 下一页按钮
    if (pagination.has_next) {
        html += `<button class="macos3-button" onclick="changePage(${pagination.next_page})">下一页 ▶</button>`;
    } else {
        html += `<button class="macos3-button" disabled style="opacity: 0.5;">下一页 ▶</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadStories(false, page);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function showStoryDetail(storyId) {
    try {
        const response = await fetch(API_BASE + '/stories/' + storyId);
        const story = await response.json();
        
        // 追踪用户点击的分类
        if (currentUser && story.category) {
            trackCategoryClick(story.category);
        }
        
        const titleEl = document.getElementById('story-title');
        if (titleEl) titleEl.textContent = story.title;
        
        let html = '<div style="border-bottom: 2px dashed #6b0080; padding-bottom: 10px; margin-bottom: 10px;">' +
            '<div style="font-weight: bold; color: #6b0080;">作者: ' + (story.ai_persona || 'AI楼主') + ' 👻</div>' +
            '<div style="font-size: 10px; color: #666; margin: 5px 0;">' + formatDate(story.created_at) + ' | 浏览: ' + story.views + '</div>' +
            '<div style="white-space: pre-wrap; line-height: 1.6; word-break: break-all; font-size: 11px;">' + escapeHtml(story.content) + '</div>' +
            '</div>';
        
        if (story.evidence && story.evidence.length > 0) {
            html += '<div class="evidence-section"><div class="evidence-title">📸 证据</div><div class="evidence-grid">';
            story.evidence.forEach(e => {
                html += '<div class="evidence-item">';
                if (e.type === 'image') {
                    html += '<img src="' + e.file_path + '" style="width:100%; aspect-ratio: 1/1; object-fit: contain; background-color: #000; border: 1px solid #666;">';
                } else {
                    html += '<audio controls style="width:100%; height:30px;"><source src="' + e.file_path + '"></audio>';
                }
                html += '<div class="evidence-desc">' + escapeHtml(e.description) + '</div></div>';
            });
            html += '</div></div>';
        }
        
        html += '<div class="comment-section"><h3 style="color: #6b0080; border-bottom: 2px dashed #6b0080; padding-bottom: 8px;">💬 评论</h3>';
        
        if (story.comments && story.comments.length > 0) {
            story.comments.forEach(c => {
                html += '<div class="comment-item">' +
                    '<div class="comment-author">' + escapeHtml(c.author.username) + ' ' + c.author.avatar + '</div>' +
                    '<div class="comment-text">' + escapeHtml(c.content) + '</div>' +
                    '<div class="comment-time">' + formatDate(c.created_at) + '</div>' +
                    '</div>';
            });
        }
        
        if (currentUser) {
            html += '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dotted #999;">' +
                '<form onsubmit="submitComment(event, ' + storyId + ')">' +
                '<textarea id="comment-text" placeholder="你的看法..." style="width:100%; height:60px; padding:8px; border:2px inset #999; font-size:11px; resize:none; font-family: MS Sans Serif, Arial;"></textarea>' +
                '<button type="submit" class="macos3-button" style="margin-top:8px; width:100%;">发 表</button>' +
                '</form></div>';
        } else {
            html += '<p style="text-align:center; color:#666; margin-top:12px;"><a href="#" onclick="showLoginForm(); return false;" style="color:#6b0080;">登录</a> 后发表评论</p>';
        }
        
        html += '</div>';
        const contentEl = document.getElementById('story-content');
        if (contentEl) contentEl.innerHTML = html;
        
        const storyModal = document.getElementById('story-modal');
        if (storyModal) storyModal.style.display = 'flex';
    } catch (error) {
        console.error('加载故事详情失败:', error);
        showToast('加载失败', 'error');
    }
}

async function submitComment(event, storyId) {
    event.preventDefault();
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }
    
    const commentText = document.getElementById('comment-text');
    const content = commentText ? commentText.value.trim() : '';
    
    if (!content) {
        showToast('不能为空', 'warning');
        return;
    }
    
    try {
        const res = await fetch(API_BASE + '/stories/' + storyId + '/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ content: content })
        });
        
        if (res.ok) {
            showToast('已发表', 'success');
            setTimeout(() => showStoryDetail(storyId), 1500);
        } else {
            const err = await res.json();
            showToast(err.error || '发表失败', 'error');
        }
    } catch (error) {
        console.error('发表评论失败:', error);
        showToast('错误', 'error');
    }
}

function showLoginForm() {
    const titleEl = document.getElementById('modal-title');
    const emailGroup = document.getElementById('email-group');
    const toggleBtn = document.getElementById('toggle-auth');
    const authForm = document.getElementById('auth-form');
    
    if (titleEl) titleEl.textContent = '登 录';
    if (emailGroup) emailGroup.style.display = 'none';
    if (toggleBtn) toggleBtn.dataset.mode = 'register';
    if (authForm) authForm.reset();
    
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function showRegisterForm() {
    const titleEl = document.getElementById('modal-title');
    const emailGroup = document.getElementById('email-group');
    const toggleBtn = document.getElementById('toggle-auth');
    const authForm = document.getElementById('auth-form');
    
    if (titleEl) titleEl.textContent = '注 册';
    if (emailGroup) emailGroup.style.display = 'block';
    if (toggleBtn) toggleBtn.dataset.mode = 'login';
    if (authForm) authForm.reset();
    
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function toggleAuthForm() {
    const toggleBtn = document.getElementById('toggle-auth');
    if (!toggleBtn) return;
    
    if (toggleBtn.dataset.mode === 'register') {
        showRegisterForm();
    } else {
        showLoginForm();
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    const emailEl = document.getElementById('email');
    const emailGroup = document.getElementById('email-group');
    
    const username = usernameEl ? usernameEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value.trim() : '';
    const isReg = emailGroup && emailGroup.style.display !== 'none';
    
    if (!username || !password) {
        showToast('用户名和密码必填', 'warning');
        return;
    }
    
    const data = { username: username, password: password };
    if (isReg) {
        const email = emailEl ? emailEl.value.trim() : '';
        if (!email) {
            showToast('邮箱必填', 'warning');
            return;
        }
        data.email = email;
    }
    
    try {
        const endpoint = isReg ? 'register' : 'login';
        const res = await fetch(API_BASE + '/' + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            const result = await res.json();
            token = result.token;
            currentUser = result.user;
            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateAuthUI();
            closeAuthModal();
            showToast((isReg ? '注册' : '登录') + '成功', 'success');
            
            // 登录成功后立即检查通知
            checkNotifications();
        } else {
            const err = await res.json();
            showToast(err.error || '错误', 'error');
        }
    } catch (error) {
        console.error('认证失败:', error);
        showToast('错误', 'error');
    }
}

function updateAuthUI() {
    const guestView = document.getElementById('guest-view');
    const userView = document.getElementById('user-view');
    
    if (currentUser) {
        if (guestView) guestView.style.display = 'none';
        if (userView) userView.style.display = 'block';
        
        const avatarEl = document.getElementById('user-avatar');
        const nameEl = document.getElementById('user-name');
        
        if (avatarEl) avatarEl.textContent = currentUser.avatar || '👻';
        if (nameEl) nameEl.textContent = currentUser.username;
    } else {
        if (guestView) guestView.style.display = 'block';
        if (userView) userView.style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    updateAuthUI();
    showToast('已登出', 'success');
}

async function verifyToken() {
    if (!token) return;
    
    try {
        const res = await fetch(API_BASE + '/notifications', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                currentUser = JSON.parse(userStr);
                updateAuthUI();
            }
        } else {
            localStorage.removeItem('token');
            token = null;
        }
    } catch (error) {
        console.error('验证失败:', error);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

function closeStoryModal() {
    const modal = document.getElementById('story-modal');
    if (modal) modal.style.display = 'none';
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(t) {
    const div = document.createElement('div');
    div.textContent = t;
    return div.innerHTML;
}

function showToast(msg, type) {
    type = type || 'info';
    const id = 'toast-' + Date.now();
    
    const bgMap = {
        'success': 'linear-gradient(180deg, #66cc66, #44aa44)',
        'error': 'linear-gradient(180deg, #ff6666, #cc3333)',
        'warning': 'linear-gradient(180deg, #ffcc66, #ff9933)',
        'info': 'linear-gradient(180deg, #6699ff, #3366ff)'
    };
    
    const bg = bgMap[type] || bgMap['info'];
    
    document.body.insertAdjacentHTML('beforeend',
        '<div id="' + id + '" style="position: fixed; top: 20px; right: 20px; background: ' + bg + '; color: white; padding: 10px 14px; border: 2px outset #999; font-size: 11px; z-index: 2000; box-shadow: 2px 2px 6px rgba(0,0,0,0.3); border-radius: 2px;">' +
        escapeHtml(msg) +
        '</div>'
    );
    
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.remove();
    }, 3000);
}

function updateClock() {
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const items = document.querySelectorAll('.menu-item');
    if (items.length > 0) items[0].textContent = now;
}
