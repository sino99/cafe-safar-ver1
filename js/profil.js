document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const elements = {
        userAvatar: document.getElementById('mobileAvatar'),
        dropdownMenu: document.querySelector('.dropdown-menu'),
        tabButtons: document.querySelectorAll('.tab-btn'),
        contentSections: document.querySelectorAll('.content-section'),
        logoutBtn: document.getElementById('logoutBtn'),
        mobileLogout: document.getElementById('mobileLogout'),
        refreshBtn: document.getElementById('refreshBtn'),
        changePasswordForm: document.getElementById('changePasswordForm'),
        ordersList: document.getElementById('ordersList'),
        trackingList: document.getElementById('trackingList'),
        modalOverlay: document.getElementById('orderModal'),
        modalBody: document.getElementById('modalBody'),
        modalClose: document.querySelector('.modal-close'),
        bottomNavItems: document.querySelectorAll('.bottom-nav .nav-item'),
        dropdownItems: document.querySelectorAll('.dropdown-item[data-section]')
    };

    // Данные
    let currentUser = null;
    let userOrders = [];
    let isDropdownOpen = false;
    let webSocket = null;
    let lastUpdateTime = new Date().toISOString();
    let pollingInterval = null;
    let orderTimers = new Map(); // Map для хранения таймеров обратного отсчета
    let activeCountdowns = new Map(); // Map для активных отсчетов
    let accountCheckInterval = null; // Интервал для проверки статуса аккаунта
    let isForceLogoutInProgress = false; // Флаг для предотвращения повторных принудительных выходов

    // Инициализация
    initProfile();

    // Инициализация профиля
    async function initProfile() {
        await checkAuth();
        await loadUserData();
        setupEventListeners();
        updateUI();
        setupWebSocketConnection();
        startOrderPolling();
        startAccountStatusCheck();
    }

    // Проверка авторизации
    async function checkAuth() {
        try {
            const response = await fetch('/api/me');
            const data = await response.json();
            
            if (!data.loggedIn) {
                // Проверяем, был ли аккаунт удален или заблокирован
                if (data.reason === 'account_deleted') {
                    showForceLogoutNotification({
                        reason: 'account_deleted',
                        message: 'Ваш аккаунт был удален администратором системы.'
                    });
                    return;
                } else if (data.reason === 'account_blocked') {
                    showForceLogoutNotification({
                        reason: 'account_blocked',
                        message: 'Ваш аккаунт был заблокирован администратором.'
                    });
                    return;
                }
                
                window.location.href = '/login.html';
                return;
            }
            
            currentUser = data.user;
            updateUserAvatar();
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            window.location.href = '/login.html';
        }
    }

    // Загрузка данных пользователя
    async function loadUserData() {
        await loadUserOrders();
        await loadUserStats();
        updateUserInfo();
    }

    // Загрузка заказов пользователя
    async function loadUserOrders() {
        try {
            showLoading(elements.ordersList, 'Загружаем заказы...');
            
            const response = await fetch('/api/my-orders');
            
            // Проверяем, не удален ли аккаунт
            if (response.status === 401) {
                const errorData = await response.json();
                if (errorData.code === 'ACCOUNT_DELETED' || errorData.code === 'ACCOUNT_BLOCKED') {
                    showForceLogoutNotification({
                        reason: errorData.code === 'ACCOUNT_DELETED' ? 'account_deleted' : 'account_blocked',
                        message: errorData.error || 'Ваш аккаунт был удален или заблокирован.'
                    });
                    return;
                }
            }
            
            const data = await response.json();
            
            if (data.orders && data.orders.length > 0) {
                userOrders = data.orders;
                
                // Сортируем заказы: сначала активные, потом по дате
                userOrders.sort((a, b) => {
                    const aIsActive = isOrderActive(a.status, a.order_type);
                    const bIsActive = isOrderActive(b.status, b.order_type);
                    
                    if (aIsActive && !bIsActive) return -1;
                    if (!aIsActive && bIsActive) return 1;
                    
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                
                renderOrders();
                renderTracking();
            } else {
                showEmptyState(elements.ordersList, 'Нет заказов', 'Сделайте свой первый заказ!');
            }
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            
            // Если ошибка 401, возможно аккаунт удален
            if (error.message.includes('401') || error.message.includes('Account deleted')) {
                showForceLogoutNotification({
                    reason: 'account_deleted',
                    message: 'Ваш аккаунт был удален. Пожалуйста, войдите снова.'
                });
                return;
            }
            
            showError(elements.ordersList, 'Ошибка загрузки');
            showToast('Ошибка загрузки заказов', 'error');
        }
    }

    // Загрузка статистики пользователя
    async function loadUserStats() {
        try {
            const response = await fetch('/api/user-stats');
            
            // Проверяем, не удален ли аккаунт
            if (response.status === 401) {
                const errorData = await response.json();
                if (errorData.code === 'ACCOUNT_DELETED' || errorData.code === 'ACCOUNT_BLOCKED') {
                    return;
                }
            }
            
            const data = await response.json();
            updateStats(data);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    // Обновление информации пользователя
    function updateUserInfo() {
        if (!currentUser) return;

        // Основная информация
        document.getElementById('userName').textContent = currentUser.login;
        document.getElementById('userPhone').textContent = currentUser.phone;
        document.getElementById('displayLogin').textContent = currentUser.login;
        document.getElementById('displayPhone').textContent = currentUser.phone;
    }

    // Обновление статистики
    function updateStats(stats) {
        const totalOrders = stats.total_orders || 0;
        const totalSpent = stats.total_spent || 0;
        const activeOrders = stats.active_orders || 0;
        const memberSince = stats.member_since || new Date().getFullYear();

        // Обновляем значения
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalSpent').textContent = Math.round(totalSpent);
        document.getElementById('memberSince').textContent = memberSince;
        document.getElementById('trackBadge').textContent = activeOrders;
        document.getElementById('mobileBadge').textContent = activeOrders;

        // Обновляем аватар с числом активных заказов
        updateAvatarBadge(activeOrders);
    }

    // Обновление бейджа на аватаре
    function updateAvatarBadge(count) {
        const avatar = elements.userAvatar;
        if (count > 0) {
            avatar.innerHTML = `<i class="fas fa-user"></i><span class="avatar-badge">${count}</span>`;
        } else {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }

    // Обновление аватара пользователя
    function updateUserAvatar() {
        const avatar = elements.userAvatar;
        if (avatar) {
            avatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
    }

    // Функция получения времени Таджикистана (UTC+5)
    function getTajikistanTime(date = new Date()) {
        const tajikOffset = 5 * 60 * 60 * 1000; // 5 часов в миллисекундах
        return new Date(date.getTime() + tajikOffset);
    }

    // Функция для парсинга времени готовки из строки формата "HH:MM (через 30 мин)"
    function parseEstimatedTime(estimatedTimeStr) {
        if (!estimatedTimeStr) return null;
        
        const match = estimatedTimeStr.match(/(\d{2}):(\d{2}) \(через (\d+) мин\)/);
        if (!match) return null;
        
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        
        return { hours, minutes, totalMinutes: hours * 60 + minutes };
    }

    // Функция для расчета оставшегося времени
    function calculateRemainingTime(estimatedTimeStr) {
        const parsed = parseEstimatedTime(estimatedTimeStr);
        if (!parsed) return { remaining: null, formatted: null, isOverdue: false };
        
        const nowTajik = getTajikistanTime();
        const nowMinutes = nowTajik.getHours() * 60 + nowTajik.getMinutes();
        
        let remaining = parsed.totalMinutes - nowMinutes;
        
        // Если время прошло (например, на следующий день), добавляем 24 часа
        if (remaining < -720) { // Если разница больше 12 часов в минусах
            remaining += 1440; // Добавляем 24 часа в минутах
        }
        
        const isOverdue = remaining <= 0;
        
        // Форматируем оставшееся время
        let formatted = '';
        if (isOverdue) {
            formatted = 'Готов';
        } else if (remaining < 60) {
            formatted = `${remaining} мин`;
        } else {
            const hours = Math.floor(remaining / 60);
            const mins = remaining % 60;
            formatted = mins > 0 ? `${hours}ч ${mins}мин` : `${hours}ч`;
        }
        
        return {
            remaining: Math.max(0, remaining),
            formatted,
            isOverdue,
            targetTime: `${parsed.hours.toString().padStart(2, '0')}:${parsed.minutes.toString().padStart(2, '0')}`
        };
    }

    // Запуск таймера обратного отсчета
    function startCountdownTimer(orderId, estimatedTimeStr, elementId, updateCallback = null) {
        // Останавливаем предыдущий таймер, если он есть
        if (orderTimers.has(orderId)) {
            clearInterval(orderTimers.get(orderId));
        }
        
        const timerFunction = () => {
            const remainingData = calculateRemainingTime(estimatedTimeStr);
            const element = document.getElementById(elementId);
            
            if (element) {
                if (remainingData.isOverdue) {
                    element.innerHTML = `<i class="fas fa-check-circle"></i> Готов`;
                    element.style.color = '#27ae60';
                    
                    // Если время истекло, останавливаем таймер
                    clearInterval(orderTimers.get(orderId));
                    orderTimers.delete(orderId);
                } else {
                    element.textContent = `⏳ ${remainingData.formatted}`;
                    
                    // Меняем цвет в зависимости от оставшегося времени
                    if (remainingData.remaining < 10) {
                        element.style.color = '#e74c3c'; // Красный
                    } else if (remainingData.remaining < 20) {
                        element.style.color = '#f39c12'; // Желтый
                    } else {
                        element.style.color = '#3498db'; // Синий
                    }
                }
            }
            
            // Если есть callback для обновления, вызываем его
            if (updateCallback) {
                updateCallback(remainingData);
            }
        };
        
        // Запускаем немедленно и затем каждую минуту
        timerFunction();
        const timerId = setInterval(timerFunction, 60000); // Обновляем каждую минуту
        
        // Сохраняем ID таймера
        orderTimers.set(orderId, timerId);
        
        // Возвращаем функцию для остановки таймера
        return () => {
            clearInterval(timerId);
            orderTimers.delete(orderId);
        };
    }

    // ========== ФУНКЦИИ ДЛЯ РАБОТЫ СО СТАТУСАМИ (С УЧЕТОМ ТИПА ЗАКАЗА) ==========

    // Функция для получения правильного текста статуса с учетом типа заказа
    function getStatusText(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        if (orderType === 'pickup') {
            const pickupMap = {
                'новый': 'Новый',
                'new': 'Новый',
                'в обработке': 'В обработке',
                'processing': 'В обработке',
                'готовится': 'Готовится',
                'preparing': 'Готовится',
                'в пути': 'Готов к выдаче',
                'on the way': 'Готов к выдаче',
                'готов к выдаче': 'Готов к выдаче',
                'ready for pickup': 'Готов к выдаче',
                'доставлен': 'Выдан',
                'delivered': 'Выдан',
                'выдан': 'Выдан',
                'picked up': 'Выдан',
                'отменен': 'Отменен',
                'cancelled': 'Отменен'
            };
            return pickupMap[statusLower] || status;
        } else {
            const deliveryMap = {
                'новый': 'Новый',
                'new': 'Новый',
                'в обработке': 'В обработке',
                'processing': 'В обработке',
                'готовится': 'Готовится',
                'preparing': 'Готовится',
                'в пути': 'В пути',
                'on the way': 'В пути',
                'доставлен': 'Доставлен',
                'delivered': 'Доставлен',
                'отменен': 'Отменен',
                'cancelled': 'Отменен'
            };
            return deliveryMap[statusLower] || status;
        }
    }

    // Функция для получения иконки статуса с учетом типа заказа
    function getStatusIcon(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        if (orderType === 'pickup') {
            const pickupIcons = {
                'новый': 'bell',
                'new': 'bell',
                'в обработке': 'cog',
                'processing': 'cog',
                'готовится': 'utensils',
                'preparing': 'utensils',
                'в пути': 'store',
                'on the way': 'store',
                'готов к выдаче': 'store',
                'ready for pickup': 'store',
                'доставлен': 'check-circle',
                'delivered': 'check-circle',
                'выдан': 'check-circle',
                'picked up': 'check-circle',
                'отменен': 'times-circle',
                'cancelled': 'times-circle'
            };
            return pickupIcons[statusLower] || 'question-circle';
        } else {
            const deliveryIcons = {
                'новый': 'bell',
                'new': 'bell',
                'в обработке': 'cog',
                'processing': 'cog',
                'готовится': 'utensils',
                'preparing': 'utensils',
                'в пути': 'truck',
                'on the way': 'truck',
                'доставлен': 'check-circle',
                'delivered': 'check-circle',
                'отменен': 'times-circle',
                'cancelled': 'times-circle'
            };
            return deliveryIcons[statusLower] || 'question-circle';
        }
    }

    // Функция для получения цвета статуса
    function getStatusColor(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        if (orderType === 'pickup') {
            const pickupColors = {
                'новый': '#FF9800',
                'new': '#FF9800',
                'в обработке': '#2196F3',
                'processing': '#2196F3',
                'готовится': '#9C27B0',
                'preparing': '#9C27B0',
                'в пути': '#00BCD4',
                'on the way': '#00BCD4',
                'готов к выдаче': '#00BCD4',
                'ready for pickup': '#00BCD4',
                'доставлен': '#4CAF50',
                'delivered': '#4CAF50',
                'выдан': '#4CAF50',
                'picked up': '#4CAF50',
                'отменен': '#F44336',
                'cancelled': '#F44336'
            };
            return pickupColors[statusLower] || '#95a5a6';
        } else {
            const deliveryColors = {
                'новый': '#FF9800',
                'new': '#FF9800',
                'в обработке': '#2196F3',
                'processing': '#2196F3',
                'готовится': '#9C27B0',
                'preparing': '#9C27B0',
                'в пути': '#00BCD4',
                'on the way': '#00BCD4',
                'доставлен': '#4CAF50',
                'delivered': '#4CAF50',
                'отменен': '#F44336',
                'cancelled': '#F44336'
            };
            return deliveryColors[statusLower] || '#95a5a6';
        }
    }

    // Функция для получения класса статуса (для стилей)
    function getStatusClass(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        // Если это самовывоз и статус преобразован
        if (orderType === 'pickup') {
            if (statusLower === 'в пути' || statusLower === 'готов к выдаче' || statusLower === 'ready for pickup') {
                return 'ready-for-pickup';
            }
            if (statusLower === 'доставлен' || statusLower === 'выдан' || statusLower === 'picked up') {
                return 'delivered';
            }
        }
        
        // Базовые классы
        if (statusLower === 'новый' || statusLower === 'new') return 'new';
        if (statusLower === 'в обработке' || statusLower === 'processing') return 'processing';
        if (statusLower === 'готовится' || statusLower === 'preparing') return 'processing';
        if (statusLower === 'в пути' || statusLower === 'on the way') return 'processing';
        if (statusLower === 'доставлен' || statusLower === 'delivered') return 'delivered';
        if (statusLower === 'отменен' || statusLower === 'cancelled') return 'cancelled';
        
        return 'new';
    }

    // Функция для определения, активен ли заказ
    function isOrderActive(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        if (orderType === 'pickup') {
            return ['новый', 'в обработке', 'готовится', 'в пути', 'готов к выдаче'].includes(statusLower);
        } else {
            return ['новый', 'в обработке', 'готовится', 'в пути'].includes(statusLower);
        }
    }

    // Функция для получения ширины прогресса (для прогресс-бара)
    function getProgressWidth(status, orderType = 'delivery') {
        const statusLower = status.toLowerCase();
        
        if (orderType === 'pickup') {
            const pickupProgress = {
                'новый': 25,
                'new': 25,
                'в обработке': 50,
                'processing': 50,
                'готовится': 75,
                'preparing': 75,
                'в пути': 90,
                'on the way': 90,
                'готов к выдаче': 90,
                'ready for pickup': 90,
                'доставлен': 100,
                'delivered': 100,
                'выдан': 100,
                'picked up': 100,
                'отменен': 0,
                'cancelled': 0
            };
            return pickupProgress[statusLower] || 0;
        } else {
            const deliveryProgress = {
                'новый': 25,
                'new': 25,
                'в обработке': 50,
                'processing': 50,
                'готовится': 75,
                'preparing': 75,
                'в пути': 90,
                'on the way': 90,
                'доставлен': 100,
                'delivered': 100,
                'отменен': 0,
                'cancelled': 0
            };
            return deliveryProgress[statusLower] || 0;
        }
    }

    // Функция для получения класса шага прогресса
    function getProgressStep(step, status, orderType = 'delivery') {
        const currentStep = Math.floor(getProgressWidth(status, orderType) / 25);
        return step <= currentStep ? 'active' : '';
    }

    // Рендер заказов с отображением кода самовывоза и правильными статусами
    function renderOrders() {
        if (userOrders.length === 0) {
            showEmptyState(elements.ordersList, 'Нет заказов', 'Сделайте свой первый заказ!');
            return;
        }

        elements.ordersList.innerHTML = userOrders.map(order => {
            // Проверяем, есть ли время готовки
            let countdownHtml = '';
            if (order.estimated_time && isOrderActive(order.status, order.order_type)) {
                const remainingData = calculateRemainingTime(order.estimated_time);
                countdownHtml = `
                    <div class="order-countdown" id="order-countdown-${order.id}">
                        ${remainingData.isOverdue ? 
                            '<i class="fas fa-check-circle"></i> Готов' : 
                            `⏳ ${remainingData.formatted}`
                        }
                    </div>
                `;
            }
            
            // Добавляем бейдж самовывоза с кодом
            let pickupBadgeHtml = '';
            if (order.order_type === 'pickup' && order.pickup_code) {
                pickupBadgeHtml = `
                    <div class="order-pickup-badge" style="
                        display: inline-block;
                        background: ${getStatusColor(order.status, order.order_type)};
                        color: white;
                        padding: 3px 8px;
                        border-radius: 10px;
                        font-size: 0.8rem;
                        margin-left: 10px;
                        font-weight: bold;
                        font-family: 'Courier New', monospace;
                    ">
                        <i class="fas fa-store-alt"></i> Код: ${order.pickup_code}
                    </div>
                `;
            }
            
            return `
                <div class="order-card status-${getStatusClass(order.status, order.order_type)}">
                    <div class="order-header">
                        <div class="order-id">Заказ #${order.id}</div>
                        <div class="order-date">${formatDate(order.created_at)}</div>
                    </div>
                    <div class="order-info">
                        <div class="order-items">${getItemsPreview(order.items)}</div>
                        <div class="order-total">${order.total_price} TJS</div>
                    </div>
                    <div class="order-footer">
                        <div>
                            <span class="order-status ${getStatusClass(order.status, order.order_type)}" style="
                                background: ${getStatusColor(order.status, order.order_type)}20;
                                color: ${getStatusColor(order.status, order.order_type)};
                                border: 1px solid ${getStatusColor(order.status, order.order_type)};
                            ">
                                ${getStatusText(order.status, order.order_type)}
                            </span>
                            ${pickupBadgeHtml}
                            ${countdownHtml}
                        </div>
                        <button class="view-btn" onclick="showOrderDetails(${order.id})">
                            <i class="fas fa-eye"></i>
                            Подробнее
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Запускаем таймеры для активных заказов с временем готовки
        userOrders.forEach(order => {
            if (order.estimated_time && isOrderActive(order.status, order.order_type)) {
                const elementId = `order-countdown-${order.id}`;
                startCountdownTimer(order.id, order.estimated_time, elementId);
            }
        });
        
        // Добавляем стили для таймера
        addCountdownStyles();
    }

    // Рендер отслеживания с кодом самовывоза и правильным прогресс-баром
    function renderTracking() {
        const activeOrders = userOrders.filter(order => isOrderActive(order.status, order.order_type));

        if (activeOrders.length === 0) {
            elements.trackingList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-truck-loading"></i>
                    </div>
                    <h3>Нет активных заказов</h3>
                    <p>Здесь будут отображаться ваши текущие заказы</p>
                </div>
            `;
            return;
        }

        elements.trackingList.innerHTML = activeOrders.map(order => {
            // Проверяем время готовки для отслеживания
            let timeHtml = '';
            if (order.estimated_time) {
                const remainingData = calculateRemainingTime(order.estimated_time);
                timeHtml = `
                    <div class="tracking-time-info">
                        <i class="fas fa-clock"></i>
                        <span id="track-countdown-${order.id}">
                            ${remainingData.isOverdue ? 
                                'Готов' : 
                                `Готовность: ${remainingData.formatted}`
                            }
                        </span>
                    </div>
                `;
                
                // Запускаем таймер для отслеживания
                setTimeout(() => {
                    startCountdownTimer(order.id, order.estimated_time, `track-countdown-${order.id}`);
                }, 100);
            }
            
            // Добавляем код самовывоза
            let pickupCodeHtml = '';
            if (order.order_type === 'pickup' && order.pickup_code) {
                pickupCodeHtml = `
                    <div class="pickup-code-tracking" style="
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 8px;
                        margin: 10px 0;
                        text-align: center;
                        border-left: 4px solid ${getStatusColor('готов к выдаче', 'pickup')};
                    ">
                        <div style="
                            font-size: 1.2rem;
                            font-weight: bold;
                            color: #e74c3c;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 3px;
                            margin-bottom: 5px;
                        ">
                            <i class="fas fa-qrcode"></i> ${order.pickup_code}
                        </div>
                        <div style="font-size: 0.8rem; color: #666;">
                            Код для получения заказа
                        </div>
                    </div>
                `;
            }
            
            // Определяем шаги для прогресс-бара в зависимости от типа заказа
            const steps = order.order_type === 'pickup' ? [
                { icon: 'fa-clipboard-check', label: 'Принят' },
                { icon: 'fa-user-check', label: 'Обработка' },
                { icon: 'fa-utensils', label: 'Готовится' },
                { icon: 'fa-store', label: 'Готов к выдаче' },
                { icon: 'fa-check-circle', label: 'Выдан' }
            ] : [
                { icon: 'fa-clipboard-check', label: 'Принят' },
                { icon: 'fa-user-check', label: 'Обработка' },
                { icon: 'fa-utensils', label: 'Готовится' },
                { icon: 'fa-truck', label: 'В пути' },
                { icon: 'fa-home', label: 'Доставлен' }
            ];
            
            return `
                <div class="tracking-card">
                    <div class="tracking-header">
                        <div class="tracking-order-id">Заказ #${order.id}</div>
                        <div class="tracking-time">${formatTime(order.created_at)}</div>
                    </div>
                    <div class="tracking-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${getProgressWidth(order.status, order.order_type)}%"></div>
                        </div>
                        <div class="progress-steps">
                            ${steps.map((step, index) => `
                                <div class="progress-step">
                                    <div class="step-icon ${getProgressStep(index + 1, order.status, order.order_type)}">
                                        <i class="fas ${step.icon}"></i>
                                    </div>
                                    <div class="step-label ${getProgressStep(index + 1, order.status, order.order_type)}">
                                        ${step.label}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ${pickupCodeHtml}
                    ${timeHtml}
                    <div class="order-footer">
                        <div class="order-total">${order.total_price} TJS</div>
                        <button class="view-btn" onclick="showOrderDetails(${order.id})">
                            <i class="fas fa-eye"></i>
                            Подробнее
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Показать детали заказа
    window.showOrderDetails = async function(orderId) {
        try {
            // Останавливаем все активные таймеры
            activeCountdowns.forEach(stop => stop());
            activeCountdowns.clear();
            
            // Показываем анимацию загрузки
            elements.modalBody.innerHTML = `
                <div class="modal-loading">
                    <div class="modal-spinner"></div>
                    <p>Загружаем детали заказа...</p>
                </div>
            `;
            
            elements.modalOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            const response = await fetch(`/api/my-order/${orderId}`);
            
            // Проверяем, не удален ли аккаунт
            if (response.status === 401) {
                const errorData = await response.json();
                if (errorData.code === 'ACCOUNT_DELETED' || errorData.code === 'ACCOUNT_BLOCKED') {
                    showForceLogoutNotification({
                        reason: errorData.code === 'ACCOUNT_DELETED' ? 'account_deleted' : 'account_blocked',
                        message: errorData.error || 'Ваш аккаунт был удален или заблокирован.'
                    });
                    return;
                }
            }
            
            const data = await response.json();
            
            if (data.order) {
                showOrderModal(data.order);
                setTimeout(enhanceModalForMobile, 100);
            } else {
                throw new Error('Заказ не найден');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            
            // Если ошибка 401, возможно аккаунт удален
            if (error.message.includes('401') || error.message.includes('Account deleted')) {
                showForceLogoutNotification({
                    reason: 'account_deleted',
                    message: 'Ваш аккаунт был удален. Пожалуйста, войдите снова.'
                });
                return;
            }
            
            elements.modalBody.innerHTML = `
                <div class="modal-loading">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #e74c3c; margin-bottom: 15px;"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить детали заказа</p>
                    <button class="modal-btn modal-btn-secondary" onclick="closeOrderModal()" style="margin-top: 15px;">
                        <i class="fas fa-times"></i>
                        Закрыть
                    </button>
                </div>
            `;
        }
    };

    // Показать модальное окно с деталями заказа (с учетом типа заказа)
    function showOrderModal(order) {
        const deliveryCost = order.order_type === 'delivery' ? 10 : 0;
        const itemsTotal = order.total_price - deliveryCost;
        
        // Используем таджикистанское время
        const orderDate = new Date(order.created_at);
        const tajikOrderDate = getTajikistanTime(orderDate);
        const orderTime = formatFullDate(order.created_at);
        
        // Форматируем время готовки
        let estimatedTimeDisplay = '';
        let countdownData = null;
        
        if (order.estimated_time) {
            countdownData = calculateRemainingTime(order.estimated_time);
            
            const match = order.estimated_time.match(/(\d{2}):(\d{2}) \(через (\d+) мин\)/);
            if (match) {
                estimatedTimeDisplay = countdownData.isOverdue ? 
                    'Готов' : 
                    `Осталось ${countdownData.formatted}`;
            }
        }
        
        // Определяем шаги прогресса для трекера в зависимости от типа заказа
        const statusSteps = order.order_type === 'pickup' ? 
            [
                { id: 1, status: 'новый', icon: 'fa-clipboard-check', label: 'Принят' },
                { id: 2, status: 'в обработке', icon: 'fa-user-check', label: 'Обработка' },
                { id: 3, status: 'готовится', icon: 'fa-utensils', label: 'Готовится' },
                { id: 4, status: 'готов к выдаче', icon: 'fa-store', label: 'Готов к выдаче' },
                { id: 5, status: 'выдан', icon: 'fa-check-circle', label: 'Выдан' }
            ] :
            [
                { id: 1, status: 'новый', icon: 'fa-clipboard-check', label: 'Принят' },
                { id: 2, status: 'в обработке', icon: 'fa-user-check', label: 'Обработка' },
                { id: 3, status: 'готовится', icon: 'fa-utensils', label: 'Готовится' },
                { id: 4, status: 'в пути', icon: 'fa-truck', label: 'В пути' },
                { id: 5, status: 'доставлен', icon: 'fa-home', label: 'Доставлен' }
            ];
        
        // Находим текущий шаг
        let currentStepIndex = 0;
        const displayStatus = getStatusText(order.status, order.order_type);
        statusSteps.forEach((step, index) => {
            if (step.status === displayStatus.toLowerCase() || 
                step.label.toLowerCase() === displayStatus.toLowerCase()) {
                currentStepIndex = index;
            }
        });
        const currentStep = Math.max(0, currentStepIndex);
        
        // Получаем время обновления в таджикистанском времени
        const updatedDate = new Date(order.updated_at || order.created_at);
        const tajikUpdatedDate = getTajikistanTime(updatedDate);
        
        const modalId = `order-modal-${order.id}`;
        
        // Создаем HTML для кода самовывоза
        let pickupCodeHTML = '';
        if (order.order_type === 'pickup' && order.pickup_code) {
            pickupCodeHTML = `
                <div class="info-card" style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); border: 2px solid #2196f3;">
                    <div class="info-card-header">
                        <i class="fas fa-qrcode" style="color: #0d47a1;"></i>
                        <span style="color: #0d47a1; font-weight: 600;">Код самовывоза</span>
                    </div>
                    
                    <div style="text-align: center; padding: 20px 10px;">
                        <div class="pickup-code-display-large" id="pickup-code-${order.id}" style="
                            font-size: 2.5rem;
                            font-weight: bold;
                            color: #e74c3c;
                            background: white;
                            padding: 15px 25px;
                            border-radius: 10px;
                            display: inline-block;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 8px;
                            margin: 15px 0;
                            border: 3px dashed #e74c3c;
                            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2);
                            animation: pulse 2s infinite;
                        ">
                            ${order.pickup_code}
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <button class="copy-pickup-code-btn" onclick="copyPickupCode('${order.pickup_code}', ${order.id})" style="
                                background: #2196f3;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                font-size: 1rem;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                gap: 8px;
                                margin-right: 10px;
                            ">
                                <i class="fas fa-copy"></i> Копировать код
                            </button>
                            
                            <button class="show-qr-btn" onclick="showQRCode('${order.pickup_code}')" style="
                                background: #4caf50;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                font-size: 1rem;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <i class="fas fa-qrcode"></i> Показать QR
                            </button>
                        </div>
                        
                        <p style="color: #555; font-size: 0.9rem; margin-top: 15px;">
                            <i class="fas fa-info-circle" style="color: #2196f3;"></i> 
                            Покажите этот код при получении заказа
                        </p>
                    </div>
                </div>
            `;
        }
        
        elements.modalBody.innerHTML = `
            <div class="modal-order-compact">
                <!-- Заголовок с номером заказа -->
                <div class="info-card">
                    <div class="info-card-header">
                        <i class="fas fa-hashtag"></i>
                        <span>Информация о заказе</span>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-barcode"></i>
                            <span>Номер:</span>
                        </div>
                        <div class="info-value">
                            <strong style="color: #e74c3c;">#${order.id}</strong>
                        </div>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-calendar-alt"></i>
                            <span>Дата и время:</span>
                        </div>
                        <div class="info-value">
                            <span style="font-family: 'Courier New', monospace;">${orderTime}</span>
                        </div>
                    </div>
                    
                    ${order.estimated_time ? `
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-clock"></i>
                            <span>Время готовки:</span>
                        </div>
                        <div class="info-value">
                            <span class="status-mini-card status-processing" id="modal-countdown-${order.id}" style="
                                background: ${getStatusColor(order.status, order.order_type)}20;
                                color: ${getStatusColor(order.status, order.order_type)};
                                border: 1px solid ${getStatusColor(order.status, order.order_type)};
                            ">
                                <i class="fas fa-hourglass-half"></i>
                                ${estimatedTimeDisplay}
                            </span>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                ${pickupCodeHTML}
                
                <!-- Статус заказа -->
                <div class="info-card">
                    <div class="info-card-header">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Статус заказа</span>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-flag-checkered"></i>
                            <span>Текущий статус:</span>
                        </div>
                        <div class="info-value">
                            <span class="status-mini-card status-${getStatusClass(order.status, order.order_type)}" style="
                                background: ${getStatusColor(order.status, order.order_type)}20;
                                color: ${getStatusColor(order.status, order.order_type)};
                                border: 1px solid ${getStatusColor(order.status, order.order_type)};
                            ">
                                <i class="fas fa-${getStatusIcon(order.status, order.order_type)}"></i>
                                ${getStatusText(order.status, order.order_type)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-truck"></i>
                            <span>Тип доставки:</span>
                        </div>
                        <div class="info-value">
                            ${order.order_type === 'delivery' ? 
                                '<span class="status-mini-card" style="background: #e3f2fd; border-color: #2196f3; color: #0d47a1;"><i class="fas fa-motorcycle"></i> Доставка</span>' : 
                                '<span class="status-mini-card" style="background: #f3e5f5; border-color: #9c27b0; color: #4a148c;"><i class="fas fa-store"></i> Самовывоз</span>'
                            }
                        </div>
                    </div>
                </div>
                
                <!-- Контактная информация -->
                <div class="info-card">
                    <div class="info-card-header">
                        <i class="fas fa-user-circle"></i>
                        <span>Контактная информация</span>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-user"></i>
                            <span>Имя:</span>
                        </div>
                        <div class="info-value">${order.customer_name}</div>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-phone-alt"></i>
                            <span>Телефон:</span>
                        </div>
                        <div class="info-value">
                            <a href="tel:${order.customer_phone}" style="color: #e74c3c; text-decoration: none;">
                                ${order.customer_phone}
                            </a>
                        </div>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-map-marked-alt"></i>
                            <span>Адрес:</span>
                        </div>
                        <div class="info-value">
                            ${order.address || 'Не указан'}
                        </div>
                    </div>
                    
                    <div class="compact-info-row">
                        <div class="info-label">
                            <i class="fas fa-credit-card"></i>
                            <span>Оплата:</span>
                        </div>
                        <div class="info-value">
                            ${getPaymentMethod(order.payment_method)}
                        </div>
                    </div>
                </div>
                
                <!-- Мини трекер прогресса -->
                <div class="mini-tracker">
                    <div class="tracker-header">
                        <h4>
                            <i class="fas fa-shipping-fast"></i>
                            Отслеживание
                        </h4>
                        <div class="tracker-time">
                            <i class="fas fa-sync-alt"></i>
                            Обновлено: ${formatTime(order.updated_at || order.created_at)}
                        </div>
                    </div>
                    
                    <div class="tracker-steps">
                        ${statusSteps.map((step, index) => `
                            <div class="tracker-step">
                                <div class="step-dot ${index < currentStep ? 'completed' : index === currentStep ? 'active' : ''}">
                                    <i class="fas ${step.icon}"></i>
                                </div>
                                <div class="step-label ${index <= currentStep ? (index === currentStep ? 'active' : 'completed') : ''}">
                                    ${step.label}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Состав заказа -->
                <div class="info-card">
                    <div class="info-card-header">
                        <i class="fas fa-shopping-basket"></i>
                        <span>Состав заказа (${order.items.length} товаров)</span>
                    </div>
                    
                    <div class="compact-items-list">
                        ${order.items.map(item => `
                            <div class="compact-item">
                                <img src="${item.img}" 
                                     alt="${item.name}" 
                                     class="item-image-mini"
                                     onerror="this.src='https://via.placeholder.com/50x50/cccccc/ffffff?text=IMG'">
                                <div class="item-details-mini">
                                    <div class="item-name-mini">${item.name}</div>
                                    <div class="item-meta-mini">
                                        <span>
                                            <span class="item-quantity-mini">${item.quantity}</span>
                                            × ${item.price} TJS
                                        </span>
                                        <span style="color: #e74c3c; font-weight: 500;">
                                            ${item.price * item.quantity} TJS
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Итоговая сумма -->
                <div class="compact-total">
                    ${deliveryCost > 0 ? `
                        <div class="total-row-mini">
                            <span>Товары:</span>
                            <span>${itemsTotal.toFixed(2)} TJS</span>
                        </div>
                        <div class="total-row-mini">
                            <span>Доставка:</span>
                            <span>${deliveryCost.toFixed(2)} TJS</span>
                        </div>
                    ` : `
                        <div class="total-row-mini">
                            <span>Сумма товаров:</span>
                            <span>${itemsTotal.toFixed(2)} TJS</span>
                        </div>
                    `}
                    <div class="total-row-mini grand-total">
                        <span>ИТОГО:</span>
                        <span>${order.total_price.toFixed(2)} TJS</span>
                    </div>
                </div>
                
                ${order.comments ? `
                    <div class="compact-comments">
                        <div class="comments-header">
                            <i class="fas fa-comment-dots"></i>
                            Комментарий к заказу
                        </div>
                        <p class="comments-text">${order.comments}</p>
                    </div>
                ` : ''}
                
                ${order.tracking_history && order.tracking_history.length > 0 ? `
                    <div class="info-card" style="margin-top: 15px;">
                        <div class="info-card-header">
                            <i class="fas fa-history"></i>
                            <span>История изменений</span>
                        </div>
                        ${order.tracking_history.slice(0, 3).map(history => {
                            const historyDate = new Date(history.created_at);
                            const tajikHistoryDate = getTajikistanTime(historyDate);
                            const formattedHistoryTime = formatTime(history.created_at);
                            
                            return `
                            <div class="compact-info-row" style="align-items: flex-start;">
                                <div class="info-label">
                                    <i class="fas fa-circle" style="font-size: 0.5rem; color: #27ae60;"></i>
                                    <span>${formattedHistoryTime}</span>
                                </div>
                                <div class="info-value" style="font-size: 0.8rem;">
                                    ${history.message}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Кнопки действий -->
            <div class="modal-actions">
                <button class="modal-btn modal-btn-secondary" onclick="closeOrderModal()">
                    <i class="fas fa-times"></i>
                    Закрыть
                </button>
                <button class="modal-btn modal-btn-primary" onclick="repeatOrder(${order.id})">
                    <i class="fas fa-redo"></i>
                    Повторить заказ
                </button>
            </div>
        `;
        
        // Запускаем таймер обратного отсчета, если есть время готовки
        if (order.estimated_time && isOrderActive(order.status, order.order_type)) {
            const stopTimer = startCountdownTimer(
                order.id, 
                order.estimated_time, 
                `modal-countdown-${order.id}`,
                (remainingData) => {
                    const element = document.getElementById(`modal-countdown-${order.id}`);
                    if (element) {
                        const timeDisplay = remainingData.isOverdue ? 
                            'Готов' : 
                            `Осталось ${remainingData.formatted}`;
                        
                        element.innerHTML = `<i class="fas fa-hourglass-half"></i> ${timeDisplay}`;
                        
                        if (remainingData.isOverdue) {
                            element.style.color = '#27ae60';
                        } else if (remainingData.remaining < 10) {
                            element.style.color = '#e74c3c';
                        } else if (remainingData.remaining < 20) {
                            element.style.color = '#f39c12';
                        }
                    }
                }
            );
            
            // Сохраняем функцию остановки
            activeCountdowns.set(order.id, stopTimer);
        }
        
        // Добавляем плавную анимацию появления
        setTimeout(() => {
            document.querySelectorAll('.info-card, .mini-tracker, .compact-total').forEach((el, index) => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }, 50);
        
        // Добавляем анимацию пульсации для кода самовывоза
        if (!document.querySelector('#pickup-code-animation')) {
            const style = document.createElement('style');
            style.id = 'pickup-code-animation';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2); }
                    50% { transform: scale(1.02); box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4); }
                    100% { transform: scale(1); box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2); }
                }
                
                .pickup-code-display-large {
                    animation: pulse 2s infinite;
                }
                
                .copy-success {
                    background: #27ae60 !important;
                    color: white !important;
                    border-color: #219653 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Закрыть модальное окно
    window.closeOrderModal = function() {
        // Останавливаем все таймеры модального окна
        activeCountdowns.forEach(stop => stop());
        activeCountdowns.clear();
        
        elements.modalOverlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Добавляем анимацию закрытия
        const modalContainer = document.querySelector('.modal-container');
        if (modalContainer) {
            modalContainer.style.animation = 'modalSlideOut 0.3s ease-in';
            
            if (!document.querySelector('#modal-slide-out')) {
                const style = document.createElement('style');
                style.id = 'modal-slide-out';
                style.textContent = `
                    @keyframes modalSlideOut {
                        from {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                        to {
                            opacity: 0;
                            transform: translateY(30px) scale(0.95);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            setTimeout(() => {
                modalContainer.style.animation = '';
            }, 300);
        }
    };

    // Копировать код самовывоза
    window.copyPickupCode = function(code, orderId) {
        navigator.clipboard.writeText(code).then(() => {
            const element = document.getElementById(`pickup-code-${orderId}`);
            if (element) {
                const originalText = element.textContent;
                const originalBg = element.style.background;
                const originalColor = element.style.color;
                
                element.textContent = '✓ Скопировано!';
                element.classList.add('copy-success');
                
                setTimeout(() => {
                    element.textContent = originalText;
                    element.classList.remove('copy-success');
                }, 2000);
            }
            showToast('Код скопирован в буфер обмена', 'success');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            showToast('Ошибка копирования', 'error');
        });
    };

    // Показать QR-код
    window.showQRCode = function(code) {
        // Создаем модальное окно с QR-кодом
        const qrModal = document.createElement('div');
        qrModal.className = 'qr-modal-overlay';
        qrModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        qrModal.innerHTML = `
            <div class="qr-modal-container" style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                max-width: 300px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            ">
                <h3 style="color: #2c3e50; margin-bottom: 20px;">
                    <i class="fas fa-qrcode"></i> Код самовывоза
                </h3>
                
                <div style="
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #e74c3c;
                    background: #f9f9f9;
                    padding: 20px;
                    border-radius: 10px;
                    font-family: 'Courier New', monospace;
                    letter-spacing: 10px;
                    margin: 20px 0;
                    border: 2px solid #e74c3c;
                ">
                    ${code}
                </div>
                
                <div style="
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 20px 0;
                ">
                    <div style="width: 15px; height: 15px; background: #e74c3c; border-radius: 50%;"></div>
                    <div style="width: 15px; height: 15px; background: #3498db; border-radius: 50%;"></div>
                    <div style="width: 15px; height: 15px; background: #27ae60; border-radius: 50%;"></div>
                </div>
                
                <div style="
                    font-size: 0.9rem;
                    color: #666;
                    margin-bottom: 20px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 8px;
                ">
                    <i class="fas fa-info-circle" style="color: #3498db;"></i>
                    Покажите этот код при получении заказа
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="copyPickupCode('${code}', 'qr')" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-copy"></i> Копировать
                    </button>
                    <button onclick="this.closest('.qr-modal-overlay').remove()" style="
                        background: #95a5a6;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(qrModal);
        
        // Закрытие по клику вне окна
        qrModal.addEventListener('click', function(e) {
            if (e.target === qrModal) {
                qrModal.remove();
            }
        });
        
        // Закрытие по ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.querySelector('.qr-modal-overlay')) {
                qrModal.remove();
            }
        });
    };

    // Повторить заказ
    window.repeatOrder = function(orderId) {
        const order = userOrders.find(o => o.id == orderId);
        if (!order) return;
        
        // Показываем уведомление
        showToast('Добавляем товары в корзину...', 'info');
        
        // Добавляем все товары из заказа в корзину
        let addedCount = 0;
        order.items.forEach(item => {
            // Имитируем добавление в корзину
            console.log('Добавлено в корзину:', item.name, item.quantity);
            addedCount += item.quantity;
        });
        
        // Закрываем модальное окно
        closeOrderModal();
        
        // Показываем успешное уведомление
        setTimeout(() => {
            showToast(`✅ ${addedCount} товаров добавлено в корзину!`, 'success');
            
            // Перенаправляем на главную страницу для оформления заказа
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }, 300);
    };

    // ================== ФУНКЦИИ ПРИНУДИТЕЛЬНОГО ВЫХОДА ==================

    // Функция для показа стильного уведомления о принудительном выходе
    function showForceLogoutNotification(data) {
        if (isForceLogoutInProgress) return;
        isForceLogoutInProgress = true;
        
        // Останавливаем все таймеры и интервалы
        if (accountCheckInterval) {
            clearInterval(accountCheckInterval);
        }
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        orderTimers.forEach(timerId => clearInterval(timerId));
        orderTimers.clear();
        
        // Закрываем WebSocket соединение
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.close();
        }
        
        // Создаем модальное окно принудительного выхода
        const logoutModal = document.createElement('div');
        logoutModal.className = 'force-logout-modal';
        logoutModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(231, 76, 60, 0.95), rgba(192, 57, 43, 0.98));
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.5s ease;
            backdrop-filter: blur(10px);
            font-family: 'Inter', sans-serif;
        `;
        
        const reasonText = data.reason === 'account_deleted' ? 
            'Ваш аккаунт был удален администратором системы.' :
            'Ваш аккаунт был заблокирован администратором.';
        
        const iconColor = data.reason === 'account_deleted' ? '#e74c3c' : '#f39c12';
        
        logoutModal.innerHTML = `
            <div class="force-logout-content" style="
                background: white;
                padding: 40px 30px;
                border-radius: 20px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.5s ease;
            ">
                <div class="logout-icon" style="
                    font-size: 4rem;
                    color: ${iconColor};
                    margin-bottom: 20px;
                    animation: bounce 2s infinite;
                ">
                    <i class="fas ${data.reason === 'account_deleted' ? 'fa-user-slash' : 'fa-lock'}"></i>
                </div>
                
                <h2 style="
                    color: #2c3e50;
                    margin-bottom: 15px;
                    font-size: 1.8rem;
                ">
                    <i class="fas fa-exclamation-triangle"></i> 
                    ${data.reason === 'account_deleted' ? 'Аккаунт удален' : 'Аккаунт заблокирован'}
                </h2>
                
                <p style="
                    color: #7f8c8d;
                    line-height: 1.6;
                    margin-bottom: 25px;
                    font-size: 1.1rem;
                ">
                    ${data.message || reasonText}
                </p>
                
                <div class="logout-countdown" style="
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 25px;
                    border-left: 4px solid ${iconColor};
                ">
                    <div style="font-size: 0.9rem; color: #95a5a6; margin-bottom: 5px;">
                        Автоматический выход через:
                    </div>
                    <div id="logoutTimer" style="
                        font-size: 2rem;
                        font-weight: bold;
                        color: ${iconColor};
                        font-family: 'Courier New', monospace;
                    ">
                        10
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="performForcedLogout('${data.reason}')" style="
                        background: ${iconColor};
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        transition: all 0.3s ease;
                        flex: 1;
                    ">
                        <i class="fas fa-sign-out-alt"></i>
                        Выйти сейчас
                    </button>
                </div>
                
                <div style="margin-top: 15px; font-size: 0.8rem; color: #95a5a6;">
                    <i class="fas fa-info-circle" style="color: #3498db;"></i>
                    Вы будете перенаправлены на главную страницу
                </div>
            </div>
        `;
        
        document.body.appendChild(logoutModal);
        document.body.style.overflow = 'hidden';
        
        // Запускаем таймер обратного отсчета
        let seconds = 10;
        const timerElement = document.getElementById('logoutTimer');
        const countdown = setInterval(() => {
            seconds--;
            if (timerElement) {
                timerElement.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(countdown);
                    performForcedLogout(data.reason);
                }
            }
        }, 1000);
        
        // Добавляем стили анимаций
        if (!document.querySelector('#force-logout-styles')) {
            const style = document.createElement('style');
            style.id = 'force-logout-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                    40% {transform: translateY(-20px);}
                    60% {transform: translateY(-10px);}
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Функция для выполнения принудительного выхода
    window.performForcedLogout = async function(reason) {
        // Показываем анимацию выхода
        const logoutModal = document.querySelector('.force-logout-modal');
        if (logoutModal) {
            logoutModal.style.opacity = '0';
            logoutModal.style.transform = 'scale(0.9)';
            logoutModal.style.transition = 'all 0.5s ease';
        }
        
        // Выходим из аккаунта на сервере
        try {
            await fetch('/logout');
        } catch (error) {
            console.error('Ошибка выхода:', error);
        }
        
        // Показываем финальное сообщение
        setTimeout(() => {
            if (logoutModal) {
                logoutModal.innerHTML = `
                    <div style="text-align: center; color: white;">
                        <i class="fas fa-check-circle" style="font-size: 4rem; margin-bottom: 20px;"></i>
                        <h2 style="font-size: 2rem;">Вы успешно вышли</h2>
                        <p>Перенаправление на главную страницу...</p>
                    </div>
                `;
            }
            
            // Перенаправляем на главную страницу через 1.5 секунды
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }, 500);
    };

    // Функция для проверки статуса аккаунта
    async function checkAccountStatus() {
        if (isForceLogoutInProgress) return;
        
        try {
            const response = await fetch('/api/me');
            const data = await response.json();
            
            if (!data.loggedIn && (data.reason === 'account_deleted' || data.reason === 'account_blocked')) {
                showForceLogoutNotification({
                    reason: data.reason,
                    message: data.message
                });
            }
        } catch (error) {
            console.error('Ошибка проверки статуса аккаунта:', error);
        }
    }

    // Запуск проверки статуса аккаунта
    function startAccountStatusCheck() {
        if (accountCheckInterval) {
            clearInterval(accountCheckInterval);
        }
        
        accountCheckInterval = setInterval(checkAccountStatus, 30000); // Проверка каждые 30 секунд
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Выпадающее меню
        if (elements.userAvatar) {
            elements.userAvatar.addEventListener('click', toggleDropdown);
        }

        // Закрытие выпадающего меню при клике вне
        document.addEventListener('click', (e) => {
            if (isDropdownOpen && !elements.userAvatar.contains(e.target) && 
                !elements.dropdownMenu.contains(e.target)) {
                closeDropdown();
            }
        });

        // Переключение табов
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Навигация в выпадающем меню
        elements.dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                switchTab(item.dataset.section);
                closeDropdown();
            });
        });

        // Нижняя навигация
        elements.bottomNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('href').substring(1);
                switchTab(section);
                
                // Обновляем активный элемент
                elements.bottomNavItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Выход из аккаунта
        [elements.logoutBtn, elements.mobileLogout].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', async () => {
                    if (confirm('Вы уверены, что хотите выйти?')) {
                        try {
                            await fetch('/logout');
                            window.location.href = '/';
                        } catch (error) {
                            showToast('Ошибка при выходе', 'error');
                        }
                    }
                });
            }
        });

        // Обновление заказов
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', async () => {
                const icon = elements.refreshBtn.querySelector('i');
                icon.classList.add('fa-spin');
                await loadUserData();
                setTimeout(() => icon.classList.remove('fa-spin'), 500);
                showToast('Заказы обновлены', 'success');
            });
        }

        // Смена пароля
        if (elements.changePasswordForm) {
            elements.changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const oldPassword = document.getElementById('oldPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (newPassword.length < 6) {
                    showToast('Пароль должен содержать минимум 6 символов', 'error');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    showToast('Пароли не совпадают', 'error');
                    return;
                }

                try {
                    const response = await fetch('/api/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldPassword, newPassword, confirmPassword })
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        showToast('Пароль успешно изменен', 'success');
                        elements.changePasswordForm.reset();
                    } else {
                        showToast(data.error || 'Ошибка', 'error');
                    }
                } catch (error) {
                    showToast('Ошибка соединения', 'error');
                }
            });

            // Показать/скрыть пароль
            document.querySelectorAll('.toggle-password').forEach(btn => {
                btn.addEventListener('click', function() {
                    const input = this.parentElement.querySelector('input');
                    const icon = this;
                    
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    } else {
                        input.type = 'password';
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                });
            });
        }

        // Закрытие модального окна
        if (elements.modalClose) {
            elements.modalClose.addEventListener('click', closeOrderModal);
        }

        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                closeOrderModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modalOverlay.style.display === 'flex') {
                closeOrderModal();
            }
        });
    }

    // Переключение табов
    function switchTab(tabName) {
        // Обновляем кнопки табов
        elements.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Показываем соответствующую секцию
        elements.contentSections.forEach(section => {
            section.classList.toggle('active', section.id === tabName);
        });

        // Обновляем нижнюю навигацию
        elements.bottomNavItems.forEach(item => {
            const href = item.getAttribute('href').substring(1);
            item.classList.toggle('active', href === tabName);
        });
    }

    // Выпадающее меню
    function toggleDropdown() {
        if (isDropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        elements.dropdownMenu.classList.add('show');
        isDropdownOpen = true;
        
        // Добавляем затемнение фона
        const overlay = document.createElement('div');
        overlay.className = 'dropdown-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.1);
            z-index: 999;
        `;
        overlay.addEventListener('click', closeDropdown);
        document.body.appendChild(overlay);
    }

    function closeDropdown() {
        elements.dropdownMenu.classList.remove('show');
        isDropdownOpen = false;
        
        // Удаляем затемнение
        const overlay = document.querySelector('.dropdown-overlay');
        if (overlay) overlay.remove();
    }

    // Настройка WebSocket соединения
    function setupWebSocketConnection() {
        if (!currentUser) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            webSocket = new WebSocket(wsUrl);
            
            webSocket.onopen = function() {
                console.log('WebSocket подключен');
                // Отправляем идентификатор пользователя
                webSocket.send(JSON.stringify({
                    type: 'REGISTER',
                    userId: currentUser.id
                }));
            };
            
            webSocket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Обработка принудительного выхода
                    if (data.type === 'FORCE_LOGOUT') {
                        console.log('Получена команда принудительного выхода:', data);
                        showForceLogoutNotification(data.data);
                        return;
                    }
                    
                    if (data.type === 'ORDER_STATUS_UPDATED') {
                        showToast(`Статус заказа #${data.data.orderId} обновлен: ${getStatusText(data.data.status)}`, 'info');
                        
                        // Если есть новое время готовки, обновляем таймеры
                        if (data.data.estimatedTime) {
                            const orderId = data.data.orderId;
                            const elementId = `order-countdown-${orderId}`;
                            
                            // Обновляем таймер в списке заказов
                            if (document.getElementById(elementId)) {
                                startCountdownTimer(orderId, data.data.estimatedTime, elementId);
                            }
                            
                            // Обновляем таймер в модальном окне, если оно открыто
                            const modalElementId = `modal-countdown-${orderId}`;
                            if (document.getElementById(modalElementId)) {
                                startCountdownTimer(orderId, data.data.estimatedTime, modalElementId, (remainingData) => {
                                    const element = document.getElementById(modalElementId);
                                    if (element) {
                                        const timeDisplay = remainingData.isOverdue ? 
                                            'Готов' : 
                                            `Осталось ${remainingData.formatted}`;
                                        
                                        element.innerHTML = `<i class="fas fa-hourglass-half"></i> ${timeDisplay}`;
                                    }
                                });
                            }
                        }
                        
                        // Обновляем данные
                        if (document.querySelector('#track').classList.contains('active') ||
                            document.querySelector('#orders').classList.contains('active')) {
                            loadUserData();
                        }
                    }
                } catch (error) {
                    console.error('Ошибка обработки WebSocket сообщения:', error);
                }
            };
            
            webSocket.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
            
            webSocket.onclose = function() {
                console.log('WebSocket отключен');
                // Пытаемся переподключиться через 5 секунд
                if (!isForceLogoutInProgress) {
                    setTimeout(setupWebSocketConnection, 5000);
                }
            };
        } catch (error) {
            console.error('Ошибка подключения WebSocket:', error);
        }
    }

    // Запуск polling для обновления заказов
    function startOrderPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        pollingInterval = setInterval(async () => {
            if (isForceLogoutInProgress) return;
            
            try {
                const response = await fetch(`/api/check-updates?lastUpdate=${lastUpdateTime}`);
                const data = await response.json();
                
                if (data.hasUpdates) {
                    // Обновляем время последнего обновления
                    lastUpdateTime = new Date().toISOString();
                    
                    // Обновляем данные если активна вкладка заказов или отслеживания
                    const activeSection = document.querySelector('.content-section.active');
                    if (activeSection && (activeSection.id === 'orders' || activeSection.id === 'track')) {
                        loadUserData();
                    }
                }
            } catch (error) {
                console.error('Ошибка polling:', error);
            }
        }, 30000); // Проверка каждые 30 секунд
    }

    // Обновление UI
    function updateUI() {
        // Запрашиваем разрешение на уведомления
        requestNotificationPermission();
        
        // Обновляем время на странице (Таджикистан UTC+5)
        updateTime();
        setInterval(updateTime, 60000);
    }

    // Обновление времени на странице (Таджикистан UTC+5)
    function updateTime() {
        const timeElements = document.querySelectorAll('.current-time');
        if (timeElements.length > 0) {
            const tajikTime = getTajikistanTime();
            
            const timeString = tajikTime.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const dateString = tajikTime.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit'
            });
            
            timeElements.forEach(el => {
                el.textContent = `${dateString} ${timeString}`;
            });
        }
    }

    // Запрос разрешения на уведомления
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Разрешение на уведомления получено');
                }
            });
        }
    }

    // Функция для улучшения отображения модального окна на мобильных
    function enhanceModalForMobile() {
        const modalContainer = document.querySelector('.modal-container');
        if (!modalContainer || window.innerWidth > 480) return;
        
        // Добавляем возможность закрытия свайпом
        let touchStartY = 0;
        let touchEndY = 0;
        
        modalContainer.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].clientY;
        });
        
        modalContainer.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].clientY;
            const deltaY = touchEndY - touchStartY;
            
            // Если свайп вниз больше 100px, закрываем модальное окно
            if (deltaY > 100) {
                closeOrderModal();
            }
        });
        
        // Добавляем визуальный индикатор свайпа
        const swipeIndicator = document.createElement('div');
        swipeIndicator.className = 'swipe-indicator';
        swipeIndicator.innerHTML = `
            <div class="swipe-line"></div>
            <div class="swipe-hint">Потяните вниз, чтобы закрыть</div>
        `;
        
        if (!document.querySelector('#swipe-indicator-styles')) {
            const style = document.createElement('style');
            style.id = 'swipe-indicator-styles';
            style.textContent = `
                .swipe-indicator {
                    position: absolute;
                    top: 8px;
                    left: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    z-index: 1;
                }
                
                .swipe-line {
                    width: 40px;
                    height: 4px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 2px;
                    margin-bottom: 4px;
                }
                
                .swipe-hint {
                    font-size: 0.7rem;
                    color: rgba(0, 0, 0, 0.5);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                
                .modal-container:hover .swipe-hint {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }
        
        modalContainer.appendChild(swipeIndicator);
    }

    // Добавляем стили для таймера обратного отсчета
    function addCountdownStyles() {
        if (!document.querySelector('#countdown-styles')) {
            const style = document.createElement('style');
            style.id = 'countdown-styles';
            style.textContent = `
                .order-countdown {
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-top: 4px;
                    padding: 4px 8px;
                    border-radius: 10px;
                    background: rgba(52, 152, 219, 0.1);
                    display: inline-block;
                    min-width: 80px;
                    text-align: center;
                    transition: all 0.3s ease;
                }
                
                .order-countdown i {
                    font-size: 0.7rem;
                    margin-right: 3px;
                }
                
                .tracking-time-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 10px 0;
                    padding: 8px 12px;
                    background: rgba(52, 152, 219, 0.05);
                    border-radius: 8px;
                    font-size: 0.9rem;
                    color: #2c3e50;
                }
                
                .tracking-time-info i {
                    color: #3498db;
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
                
                .countdown-warning {
                    animation: pulse 1s infinite;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Вспомогательные функции с учетом Таджикистанского времени (UTC+5)
    function formatDate(dateString) {
        const date = new Date(dateString);
        const tajikDate = getTajikistanTime(date);
        
        return tajikDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatTime(dateString) {
        const date = new Date(dateString);
        const tajikDate = getTajikistanTime(date);
        
        return tajikDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatFullDate(dateString) {
        const date = new Date(dateString);
        const tajikDate = getTajikistanTime(date);
        
        return tajikDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(' г.', '');
    }

    function getItemsPreview(items) {
        if (!items || items.length === 0) return 'Нет товаров';
        
        const firstItem = items[0];
        const count = items.length;
        
        if (count === 1) {
            return firstItem.name;
        } else if (count === 2) {
            return `${firstItem.name} и еще 1 товар`;
        } else {
            return `${firstItem.name} и еще ${count - 1} товара`;
        }
    }

    function getPaymentMethod(method) {
        const methods = {
            'cash': 'Наличные',
            'ds': 'Душанбе Сити',
            'alif': 'Алиф'
        };
        return methods[method] || method;
    }

    // Функции для состояний
    function showLoading(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    function showEmptyState(container, title, message) {
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <a href="/" class="view-btn" style="margin-top: 20px;">
                        <i class="fas fa-utensils"></i>
                        Сделать заказ
                    </a>
                </div>
            `;
        }
    }

    function showError(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка</h3>
                    <p>${message}</p>
                    <button class="view-btn" onclick="location.reload()" style="margin-top: 20px;">
                        <i class="fas fa-redo"></i>
                        Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'exclamation'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Добавляем анимацию
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Очистка всех таймеров при размонтировании
    window.addEventListener('beforeunload', () => {
        // Останавливаем все таймеры
        orderTimers.forEach(timerId => clearInterval(timerId));
        orderTimers.clear();
        
        activeCountdowns.forEach(stop => stop());
        activeCountdowns.clear();
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        if (accountCheckInterval) {
            clearInterval(accountCheckInterval);
        }
        
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.close();
        }
    });

    // Отправляем данные в глобальную область видимости
    window.closeOrderModal = closeOrderModal;
    window.repeatOrder = repeatOrder;
    window.showOrderDetails = showOrderDetails;
    window.copyPickupCode = copyPickupCode;
    window.showQRCode = showQRCode;
    window.performForcedLogout = performForcedLogout;
});