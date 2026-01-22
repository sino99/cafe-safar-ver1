document.addEventListener("DOMContentLoaded", function() {
    // Элементы интерфейса
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const currentTimeElement = document.getElementById('currentTime');
    const notificationBell = document.getElementById('notificationBell');
    const adminNameElement = document.getElementById('adminName');
    const pageTitleElement = document.getElementById('pageTitle');
    
    // Элементы статистики
    const todayOrdersElement = document.getElementById('todayOrders');
    const todayRevenueElement = document.getElementById('todayRevenue');
    const newOrdersElement = document.getElementById('newOrders');
    const unreadNotificationsElement = document.getElementById('unreadNotifications');
    const newOrdersBadge = document.getElementById('newOrdersBadge');
    const unreadBadge = document.getElementById('unreadBadge');
    const notificationCount = document.querySelector('.notification-count');
    
    // Элементы для заказов
    const statusFilter = document.getElementById('statusFilter');
    const refreshOrdersBtn = document.getElementById('refreshOrders');
    const ordersTableBody = document.getElementById('ordersTableBody');
    const recentOrdersList = document.getElementById('recentOrders');
    
    // Элементы для уведомлений
    const notificationsList = document.getElementById('notificationsList');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    // Модальное окно
    const orderDetailsModal = document.getElementById('orderDetailsModal');
    const closeModalBtn = document.querySelector('.close-modal');
    
    // Пагинация
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageElement = document.getElementById('currentPage');
    
    // ========== ЗВУКОВОЕ УВЕДОМЛЕНИЕ ==========
    let soundEnabled = true;
    let notificationSound;
    let lastProcessedOrderId = 0;
    let lastNotificationId = 0;
    let isFirstLoad = true;
    let soundCooldown = false;
    
    // Глобальный обработчик ошибок fetch
    (function() {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            return originalFetch.apply(this, args)
                .then(response => {
                    if (!response.ok) {
                        console.error('Fetch error:', response.status, response.statusText, args[0]);
                    }
                    return response;
                })
                .catch(error => {
                    console.error('Fetch request failed:', error, args[0]);
                    throw error;
                });
        };
    })();
    
    // Инициализация звука
    function initNotificationSound() {
        try {
            notificationSound = new Audio('/sino.mp3');
            notificationSound.preload = 'auto';
            notificationSound.load();
            createSoundToggleButton();
            console.log('Звуковое уведомление инициализировано');
        } catch (error) {
            console.error('Ошибка инициализации звука:', error);
        }
    }
    
    // Создание кнопки переключения звука
    function createSoundToggleButton() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;
        
        const soundToggle = document.createElement('div');
        soundToggle.className = 'sound-toggle';
        soundToggle.innerHTML = `
            <button id="soundToggleBtn" class="sound-toggle-btn">
                <i class="fas fa-volume-up"></i>
                <span>Звук включен</span>
            </button>
        `;
        
        headerRight.insertBefore(soundToggle, notificationBell);
        
        const soundToggleBtn = document.getElementById('soundToggleBtn');
        soundToggleBtn.addEventListener('click', toggleSound);
        
        const savedSoundSetting = localStorage.getItem('adminSoundEnabled');
        if (savedSoundSetting !== null) {
            soundEnabled = savedSoundSetting === 'true';
            updateSoundButton();
        }
    }
    
    // Переключение звука
    function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem('adminSoundEnabled', soundEnabled);
        updateSoundButton();
        showToast(soundEnabled ? 'Звук включен' : 'Звук выключен', soundEnabled ? 'success' : 'info');
    }
    
    // Обновление кнопки звука
    function updateSoundButton() {
        const btn = document.getElementById('soundToggleBtn');
        if (!btn) return;
        
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (soundEnabled) {
            icon.className = 'fas fa-volume-up';
            text.textContent = 'Звук включен';
            btn.classList.add('sound-on');
            btn.classList.remove('sound-off');
        } else {
            icon.className = 'fas fa-volume-mute';
            text.textContent = 'Звук выключен';
            btn.classList.add('sound-off');
            btn.classList.remove('sound-on');
        }
    }
    
    // Воспроизведение звукового уведомления
    function playNotificationSound() {
        if (!soundEnabled || !notificationSound || soundCooldown) return;
        
        try {
            soundCooldown = true;
            setTimeout(() => {
                soundCooldown = false;
            }, 3000);
            
            notificationSound.currentTime = 0;
            createSoundAnimation();
            
            notificationSound.play()
                .then(() => {
                    console.log('Звуковое уведомление о новом заказе воспроизведено');
                })
                .catch(error => {
                    console.warn('Не удалось воспроизвести звук:', error);
                    soundEnabled = true;
                    updateSoundButton();
                });
        } catch (error) {
            console.error('Ошибка воспроизведения звука:', error);
        }
    }
    
    // Создание визуальной анимации звука
    function createSoundAnimation() {
        const existingAnimation = document.querySelector('.sound-wave-animation');
        if (existingAnimation) {
            existingAnimation.remove();
        }
        
        const animationContainer = document.createElement('div');
        animationContainer.className = 'sound-wave-animation';
        animationContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        for (let i = 0; i < 3; i++) {
            const wave = document.createElement('div');
            wave.style.cssText = `
                position: absolute;
                width: 100px;
                height: 100px;
                border: 3px solid #e74c3c;
                border-radius: 50%;
                opacity: 0;
                animation: soundWave 1.5s ease-out ${i * 0.2}s;
            `;
            animationContainer.appendChild(wave);
        }
        
        const icon = document.createElement('div');
        icon.innerHTML = '<i class="fas fa-cart-plus" style="color: #e74c3c; font-size: 50px;"></i>';
        icon.style.cssText = `
            position: absolute;
            animation: bellRing 1s ease-in-out;
        `;
        animationContainer.appendChild(icon);
        
        const text = document.createElement('div');
        text.innerHTML = 'НОВЫЙ ЗАКАЗ!';
        text.style.cssText = `
            position: absolute;
            top: 60%;
            color: #e74c3c;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            animation: fadeInOut 2s ease-in-out;
            font-family: 'Outfit', 'Roboto', sans-serif;
        `;
        animationContainer.appendChild(text);
        
        document.body.appendChild(animationContainer);
        
        if (!document.querySelector('#sound-wave-styles')) {
            const style = document.createElement('style');
            style.id = 'sound-wave-styles';
            style.textContent = `
                @keyframes soundWave {
                    0% { transform: scale(0.1); opacity: 1; }
                    70% { opacity: 0.5; }
                    100% { transform: scale(2); opacity: 0; }
                }
                
                @keyframes bellRing {
                    0%, 100% { transform: rotate(0deg) scale(1); }
                    10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg) scale(1.1); }
                    20%, 40%, 60%, 80% { transform: rotate(10deg) scale(1.1); }
                }
                
                @keyframes fadeInOut {
                    0%, 100% { opacity: 0; transform: translateY(20px); }
                    20%, 80% { opacity: 1; transform: translateY(0); }
                }
                
                .sound-toggle { position: relative; }
                
                .sound-toggle-btn {
                    background: transparent;
                    border: none;
                    color: var(--dark-color);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 8px 12px;
                    border-radius: 5px;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                    font-size: 0.9rem;
                    transition: all 0.3s;
                }
                
                .sound-toggle-btn:hover { background: #f0f0f0; }
                .sound-toggle-btn.sound-on { color: #27ae60; }
                .sound-toggle-btn.sound-off { color: #95a5a6; }
                .sound-toggle-btn i { font-size: 1.2rem; }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            animationContainer.remove();
        }, 3000);
    }
    
    // Проверка новых заказов с воспроизведением звука
    function checkForNewOrders(currentOrders) {
        if (!currentOrders || currentOrders.length === 0) return;
        
        const latestOrder = currentOrders[0];
        
        if (latestOrder && latestOrder.id > lastProcessedOrderId) {
            if (!isFirstLoad) {
                console.log(`Новый заказ обнаружен! ID: ${latestOrder.id}, предыдущий ID: ${lastProcessedOrderId}`);
                playNotificationSound();
                showNewOrderPopup(latestOrder);
            }
            
            lastProcessedOrderId = latestOrder.id;
        }
        
        isFirstLoad = false;
    }
    
    // Проверка новых уведомлений
    function checkForNewNotifications(currentNotifications) {
        if (!currentNotifications || currentNotifications.length === 0) return;
        
        const latestNotification = currentNotifications[0];
        
        if (latestNotification && latestNotification.id > lastNotificationId) {
            lastNotificationId = latestNotification.id;
        }
    }
    
    // Всплывающее уведомление о новом заказе
    function showNewOrderPopup(order) {
        const popup = document.createElement('div');
        popup.className = 'new-order-popup';
        
        // Определяем статус для отображения
        let displayStatus = order.display_status || order.status;
        
        // Проверяем, есть ли код самовывоза
        const pickupCodeInfo = order.pickup_code ? 
            `<p><strong>Код самовывоза:</strong> <span style="font-weight: bold; color: #e74c3c; font-family: monospace;">${order.pickup_code}</span></p>` : 
            '';
        
        popup.innerHTML = `
            <div class="popup-header">
                <i class="fas fa-cart-plus"></i>
                <h4>НОВЫЙ ЗАКАЗ #${order.id}</h4>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-body">
                <div class="order-summary">
                    <p><strong>Клиент:</strong> ${order.customer_name}</p>
                    <p><strong>Телефон:</strong> ${order.customer_phone}</p>
                    <p><strong>Тип:</strong> ${order.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</p>
                    <p><strong>Статус:</strong> <span style="color: ${getStatusColor(displayStatus)}; font-weight: bold;">${displayStatus}</span></p>
                    <p><strong>Сумма:</strong> ${order.total_price} TJS</p>
                    <p><strong>Товаров:</strong> ${order.items.length} шт.</p>
                    ${pickupCodeInfo}
                </div>
                <div class="order-items">
                    <p><strong>Товары:</strong></p>
                    <ul>
                        ${order.items.slice(0, 3).map(item => 
                            `<li>${item.name} × ${item.quantity}</li>`
                        ).join('')}
                        ${order.items.length > 3 ? `<li>...и еще ${order.items.length - 3} товаров</li>` : ''}
                    </ul>
                </div>
                <small class="order-time">${formatOrderTime(order.created_at)}</small>
            </div>
            <div class="popup-footer">
                <button class="btn-view-order" onclick="viewOrderDetails(${order.id})">
                    <i class="fas fa-eye"></i> Подробнее
                </button>
                <button class="btn-mark-processed" onclick="updateOrderStatus(${order.id}, 'в обработке')">
                    <i class="fas fa-check"></i> В обработку
                </button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        if (!document.querySelector('#new-order-popup-styles')) {
            const style = document.createElement('style');
            style.id = 'new-order-popup-styles';
            style.textContent = `
                .new-order-popup {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 380px;
                    background: linear-gradient(135deg, #fff, #f9f9f9);
                    border-radius: 15px;
                    box-shadow: 0 15px 40px rgba(231, 76, 60, 0.3);
                    z-index: 10000;
                    animation: newOrderSlideIn 0.5s ease-out;
                    overflow: hidden;
                    border: 3px solid #e74c3c;
                }
                
                @keyframes newOrderSlideIn {
                    from { transform: translateX(100%) scale(0.8); opacity: 0; }
                    to { transform: translateX(0) scale(1); opacity: 1; }
                }
                
                .popup-header {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .popup-header h4 {
                    margin: 0;
                    flex: 1;
                    font-size: 1.1rem;
                    font-weight: bold;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                }
                
                .popup-header i {
                    font-size: 1.3rem;
                    animation: pulse 1s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
                
                .close-popup {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.3s;
                }
                
                .close-popup:hover { background: rgba(255,255,255,0.3); }
                
                .popup-body { padding: 20px; }
                
                .order-summary {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .order-summary p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #333;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                }
                
                .order-summary strong { color: #555; }
                
                .order-items {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                }
                
                .order-items ul {
                    margin: 5px 0 0 0;
                    padding-left: 20px;
                }
                
                .order-items li {
                    font-size: 0.85rem;
                    color: #666;
                    margin-bottom: 3px;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                }
                
                .order-time {
                    display: block;
                    text-align: center;
                    color: #95a5a6;
                    font-size: 0.8rem;
                    margin-top: 10px;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                }
                
                .popup-footer {
                    padding: 15px 20px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 10px;
                    justify-content: space-between;
                }
                
                .btn-view-order {
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.3s;
                    flex: 1;
                    justify-content: center;
                }
                
                .btn-view-order:hover { background: #2980b9; }
                
                .btn-mark-processed {
                    background: #27ae60;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.3s;
                    flex: 1;
                    justify-content: center;
                }
                
                .btn-mark-processed:hover { background: #219653; }
            `;
            document.head.appendChild(style);
        }
        
        popup.querySelector('.close-popup').addEventListener('click', () => {
            popup.style.animation = 'newOrderSlideOut 0.5s ease-out';
            setTimeout(() => popup.remove(), 500);
        });
        
        if (!document.querySelector('#new-order-slide-out')) {
            const slideOutStyle = document.createElement('style');
            slideOutStyle.id = 'new-order-slide-out';
            slideOutStyle.textContent = `
                @keyframes newOrderSlideOut {
                    from { transform: translateX(0) scale(1); opacity: 1; }
                    to { transform: translateX(100%) scale(0.8); opacity: 0; }
                }
            `;
            document.head.appendChild(slideOutStyle);
        }
        
        setTimeout(() => {
            if (popup.parentNode) {
                popup.style.animation = 'newOrderSlideOut 0.5s ease-out';
                setTimeout(() => popup.remove(), 500);
            }
        }, 15000);
    }
    
    // Функция получения времени Таджикистана (UTC+5)
    function getTajikistanTime(date = new Date()) {
        const tajikOffset = 5 * 60 * 60 * 1000; // 5 часов в миллисекундах
        return new Date(date.getTime() + tajikOffset);
    }
    
    // Форматирование времени заказа (с учетом Таджикистана UTC+5)
    function formatOrderTime(dateString) {
        const date = new Date(dateString);
        const tajikDate = getTajikistanTime(date);
        const nowTajik = getTajikistanTime(new Date());
        
        const diffMs = nowTajik - tajikDate;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        
        return tajikDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        }) + ', ' + tajikDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit'
        });
    }
    
    // Переменные состояния
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalOrders = 0;
    let allOrders = [];
    let currentFilter = 'все';
    let adminUser = null;
    let autoRefreshInterval;
    
    // Проверка авторизации
    checkAdminAuth();
    
    // Инициализация звука
    initNotificationSound();
    
    // Обновление времени (Таджикистан UTC+5)
    updateTime();
    setInterval(updateTime, 60000);
    
    // Навигация
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const sectionId = this.dataset.section;
            switchSection(sectionId);
        });
    });
    
    // Мобильное меню
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
    
    // Фильтрация заказов
    statusFilter.addEventListener('change', function() {
        currentFilter = this.value;
        currentPage = 1;
        loadOrders();
    });
    
    // Обновление заказов
    refreshOrdersBtn.addEventListener('click', function() {
        loadOrders();
        loadRecentOrders();
        this.classList.add('pulse');
        setTimeout(() => this.classList.remove('pulse'), 500);
    });
    
    // Уведомления
    notificationBell.addEventListener('click', function() {
        switchSection('notifications');
    });
    
    // Отметить все как прочитанные
    markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    
    // Пагинация
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderOrdersTable();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(totalOrders / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            renderOrdersTable();
        }
    });
    
    // Модальное окно
    closeModalBtn.addEventListener('click', () => {
        orderDetailsModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === orderDetailsModal) {
            orderDetailsModal.style.display = 'none';
        }
    });
    
    // ========== КОМПАКТНЫЙ РЕЖИМ УПРАВЛЕНИЯ ЗАКАЗАМИ ==========
    
    // Создание кнопки компактного режима
    function createCompactViewButton() {
        const filterControls = document.querySelector('.filter-controls');
        if (!filterControls) return;
        
        // Проверяем, не добавлена ли уже кнопка
        if (document.getElementById('compactViewBtn')) return;
        
        const compactViewBtn = document.createElement('button');
        compactViewBtn.id = 'compactViewBtn';
        compactViewBtn.className = 'view-toggle-btn';
        compactViewBtn.innerHTML = '<i class="fas fa-compress"></i>';
        compactViewBtn.title = 'Компактный вид';
        
        // Добавляем кнопку в начало filter-controls
        filterControls.insertBefore(compactViewBtn, filterControls.firstChild);
        
        // Обработчик клика
        compactViewBtn.addEventListener('click', function() {
            const ordersTable = document.querySelector('.orders-table-container');
            if (ordersTable) {
                ordersTable.classList.toggle('compact-view');
                this.classList.toggle('active');
                
                const isCompact = ordersTable.classList.contains('compact-view');
                const icon = this.querySelector('i');
                if (isCompact) {
                    icon.className = 'fas fa-expand';
                    this.title = 'Обычный вид';
                } else {
                    icon.className = 'fas fa-compress';
                    this.title = 'Компактный вид';
                }
                
                // Сохраняем настройку в localStorage
                localStorage.setItem('ordersCompactView', isCompact);
                
                showToast(isCompact ? 'Компактный режим включен' : 'Обычный режим включен', 'info');
            }
        });
        
        // Загрузка сохраненной настройки
        const savedView = localStorage.getItem('ordersCompactView');
        if (savedView === 'true') {
            const ordersTable = document.querySelector('.orders-table-container');
            if (ordersTable) {
                ordersTable.classList.add('compact-view');
                compactViewBtn.classList.add('active');
                const icon = compactViewBtn.querySelector('i');
                icon.className = 'fas fa-expand';
                compactViewBtn.title = 'Обычный вид';
            }
        }
    }
    
    // ========== БЫСТРЫЙ ПРОСМОТР ЗАКАЗА ПРИ НАВЕДЕНИИ ==========
    
    let hoverTimeout;
    let currentQuickPreview = null;
    
    // Настройка быстрого просмотра
    function setupQuickPreview() {
        // Используем делегирование событий для динамических строк таблицы
        document.addEventListener('mouseover', function(e) {
            const orderRow = e.target.closest('.order-row');
            if (orderRow && !document.querySelector('.quick-preview.show')) {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    showQuickPreview(orderRow);
                }, 500);
            }
        });
        
        document.addEventListener('mouseout', function(e) {
            if (!e.target.closest('.order-row') && !e.target.closest('.quick-preview')) {
                clearTimeout(hoverTimeout);
                hideQuickPreview();
            }
        });
    }
    
    // Показать быстрый просмотр
    function showQuickPreview(row) {
        const orderId = row.dataset.orderId;
        if (!orderId) return;
        
        // Получаем данные из строки таблицы
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;
        
        // Получаем тип заказа
        const orderType = row.dataset.orderType || 'delivery';
        
        // Получаем статус из выпадающего списка
        const status = getStatusFromSelect(cells[6], orderType);
        
        const orderData = {
            id: orderId,
            customer_name: cells[1].textContent,
            customer_phone: cells[2].textContent,
            total_price: cells[5].textContent,
            status: status,
            order_type: orderType
        };
        
        // Скрываем предыдущий просмотр
        if (currentQuickPreview) {
            currentQuickPreview.remove();
        }
        
        // Создаем быстрый просмотр
        const preview = createQuickPreviewElement(orderData, row);
        document.body.appendChild(preview);
        currentQuickPreview = preview;
        
        // Позиционируем
        positionQuickPreview(preview, row);
    }
    
    // Получить статус из выпадающего списка с учетом типа заказа
    function getStatusFromSelect(cell, orderType) {
        const select = cell.querySelector('select');
        if (!select) return 'Неизвестно';
        
        const selectedValue = select.options[select.selectedIndex].value;
        
        // Для самовывоза преобразуем отображаемый статус
        if (orderType === 'pickup') {
            if (selectedValue === 'готов к выдаче') return 'готов к выдаче';
            if (selectedValue === 'выдан') return 'выдан';
        }
        
        return selectedValue;
    }
    
    // Создать элемент быстрого просмотра
    function createQuickPreviewElement(orderData, row) {
        const preview = document.createElement('div');
        preview.className = 'quick-preview';
        
        preview.innerHTML = `
            <div class="quick-preview-content">
                <h4>Заказ #${orderData.id}</h4>
                <p><strong>Тип:</strong> ${orderData.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</p>
                <p><strong>Клиент:</strong> ${orderData.customer_name}</p>
                <p><strong>Телефон:</strong> ${orderData.customer_phone}</p>
                <p><strong>Сумма:</strong> ${orderData.total_price}</p>
                <p><strong>Статус:</strong> ${orderData.status}</p>
                <div style="margin-top: 10px; display: flex; gap: 5px;">
                    <button onclick="viewOrderDetails(${orderData.id})" 
                            style="padding: 5px 10px; font-size: 0.8rem; background: var(--secondary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Подробнее
                    </button>
                </div>
            </div>
        `;
        
        // Закрытие при клике вне элемента
        preview.addEventListener('mouseleave', hideQuickPreview);
        preview.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        
        return preview;
    }
    
    // Позиционирование быстрого просмотра
    function positionQuickPreview(preview, row) {
        const rect = row.getBoundingClientRect();
        preview.style.position = 'fixed';
        
        // Позиционируем справа от строки
        preview.style.left = `${rect.right + 10}px`;
        preview.style.top = `${rect.top}px`;
        
        // Проверяем, чтобы не выходил за границы экрана
        const viewportWidth = window.innerWidth;
        const previewWidth = preview.offsetWidth;
        
        if (rect.right + previewWidth + 20 > viewportWidth) {
            preview.style.left = `${rect.left - previewWidth - 10}px`;
        }
        
        // Проверяем по вертикали
        const viewportHeight = window.innerHeight;
        const previewHeight = preview.offsetHeight;
        
        if (rect.top + previewHeight > viewportHeight) {
            preview.style.top = `${viewportHeight - previewHeight - 20}px`;
        }
        
        preview.classList.add('show');
    }
    
    // Скрыть быстрый просмотр
    function hideQuickPreview() {
        if (currentQuickPreview) {
            currentQuickPreview.classList.remove('show');
            setTimeout(() => {
                if (currentQuickPreview && currentQuickPreview.parentNode) {
                    currentQuickPreview.remove();
                    currentQuickPreview = null;
                }
            }, 300);
        }
    }
    
    // ========== МОБИЛЬНЫЕ ФУНКЦИИ ==========
    
    // Создание мобильного футера
    function createMobileFooter() {
        if (window.innerWidth > 480) return;
        
        const mobileFooter = document.createElement('div');
        mobileFooter.className = 'mobile-footer';
        mobileFooter.innerHTML = `
            <a href="#" class="mobile-footer-item active" data-section="dashboard">
                <i class="fas fa-tachometer-alt"></i>
                <span>Дашборд</span>
            </a>
            <a href="#" class="mobile-footer-item" data-section="orders">
                <i class="fas fa-shopping-cart"></i>
                <span>Заказы</span>
                <span class="mobile-footer-badge" id="mobileOrdersBadge">0</span>
            </a>
            <a href="#" class="mobile-footer-item" data-section="notifications">
                <i class="fas fa-bell"></i>
                <span>Уведом.</span>
                <span class="mobile-footer-badge" id="mobileNotificationsBadge">0</span>
            </a>
            <a href="#" class="mobile-footer-item" data-section="analytics">
                <i class="fas fa-chart-line"></i>
                <span>Анализ</span>
            </a>
        `;
        
        document.body.appendChild(mobileFooter);
        
        mobileFooter.querySelectorAll('.mobile-footer-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.dataset.section;
                
                mobileFooter.querySelectorAll('.mobile-footer-item').forEach(i => {
                    i.classList.remove('active');
                });
                this.classList.add('active');
                
                switchSection(sectionId);
            });
        });
        
        // Функция обновления бейджей
        function updateMobileBadges() {
            const ordersBadge = document.getElementById('mobileOrdersBadge');
            const notificationsBadge = document.getElementById('mobileNotificationsBadge');
            
            if (ordersBadge) {
                const newOrders = parseInt(newOrdersElement.textContent) || 0;
                ordersBadge.textContent = newOrders;
                ordersBadge.style.display = newOrders > 0 ? 'block' : 'none';
            }
            
            if (notificationsBadge) {
                const unread = parseInt(unreadNotificationsElement.textContent) || 0;
                notificationsBadge.textContent = unread;
                notificationsBadge.style.display = unread > 0 ? 'block' : 'none';
            }
        }
        
        // Обновляем бейджи при загрузке статистики
        const originalLoadStats = loadStats;
        window.loadStats = function() {
            return originalLoadStats()
                .then(() => {
                    updateMobileBadges();
                    return true;
                })
                .catch(error => {
                    console.error('Ошибка в loadStats:', error);
                    updateMobileBadges();
                    return false;
                });
        };
        
        updateMobileBadges();
    }
    
    // Адаптация таблицы для мобильных
    function adaptTableForMobile() {
        if (window.innerWidth > 480) return;
        
        const tableCells = document.querySelectorAll('#ordersTableBody td');
        const headers = ['ID', 'Клиент', 'Телефон', 'Тип', 'Товары', 'Сумма', 'Статус', 'Дата', 'Действия'];
        
        tableCells.forEach((cell, index) => {
            const headerIndex = index % headers.length;
            cell.setAttribute('data-label', headers[headerIndex]);
        });
    }
    
    // Инициализация мобильных функций
    function initMobileFeatures() {
        createMobileFooter();
        
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
        
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
        
        function handleSwipe() {
            const swipeThreshold = 50;
            const swipeDistance = touchEndX - touchStartX;
            
            if (Math.abs(swipeDistance) > swipeThreshold) {
                if (swipeDistance > 0 && touchStartX < 50) {
                    sidebar.classList.add('active');
                } else if (swipeDistance < 0 && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
            }
        }
    }
    
    // Инициализируем мобильные функции
    initMobileFeatures();
    
    // Ресайз окна
    window.addEventListener('resize', function() {
        adaptTableForMobile();
        
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('active');
        }
        
        const mobileFooter = document.querySelector('.mobile-footer');
        if (window.innerWidth <= 480 && !mobileFooter) {
            createMobileFooter();
        } else if (window.innerWidth > 480 && mobileFooter) {
            mobileFooter.remove();
        }
    });
    
    // Функции
    function checkAdminAuth() {
        fetch('/api/admin/check')
            .then(res => {
                if (!res.ok) throw new Error('Auth failed');
                return res.json();
            })
            .then(data => {
                if (data.loggedIn) {
                    adminUser = data.user;
                    adminNameElement.textContent = adminUser.login;
                    
                    // Инициализация функций UX
                    createCompactViewButton();
                    setupQuickPreview();
                    
                    loadStats();
                    loadOrders();
                    loadNotifications();
                    loadRecentOrders();
                    
                    startAutoRefresh();
                } else {
                    window.location.href = '/admin-login.html';
                }
            })
            .catch(() => {
                window.location.href = '/admin-login.html';
            });
    }
    
    // Обновление времени (Таджикистан UTC+5)
    function updateTime() {
        const tajikTime = getTajikistanTime();
        
        const timeString = tajikTime.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dateString = tajikTime.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // currentTimeElement.textContent = `${dateString} ${timeString} (Таджикистан UTC+5)`;
    }
    
    function switchSection(sectionId) {
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });
        
        contentSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `${sectionId}Section`) {
                section.classList.add('active');
                
                const titleMap = {
                    'dashboard': 'Дашборд',
                    'orders': 'Заказы',
                    'notifications': 'Уведомления',
                    'analytics': 'Аналитика'
                };
                pageTitleElement.textContent = titleMap[sectionId];
                
                // Загружаем аналитику при переходе на раздел
                if (sectionId === 'analytics') {
                    initAnalytics();
                }
            }
        });
        
        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('active');
        }
        
        if (sectionId === 'notifications') {
            loadNotifications();
        }
        
        if (window.innerWidth <= 480) {
            const mobileItems = document.querySelectorAll('.mobile-footer-item');
            mobileItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.section === sectionId) {
                    item.classList.add('active');
                }
            });
        }
    }
    
    function loadStats() {
        return fetch('/api/stats')
            .then(res => {
                if (!res.ok) throw new Error('Stats load failed');
                return res.json();
            })
            .then(data => {
                // Выручка сегодня (без отмененных заказов)
                todayOrdersElement.textContent = data.daily?.total_orders || 0;
                todayRevenueElement.textContent = `${data.daily?.total_revenue || 0} TJS`;
                
                // Новые заказы (статус "новый")
                const newOrdersCount = data.newOrders?.count || 0;
                newOrdersElement.textContent = newOrdersCount;
                newOrdersBadge.textContent = newOrdersCount;
                
                // Непрочитанные уведомления
                const unreadCount = data.notifications?.unread_notifications || 0;
                unreadNotificationsElement.textContent = unreadCount;
                unreadBadge.textContent = unreadCount;
                notificationCount.textContent = unreadCount;
                
                // Дополнительная информация об отмененных заказах
                if (data.allTime) {
                    console.log('Общая статистика:', {
                        allOrders: data.allTime.all_time_orders,
                        allRevenue: data.allTime.all_time_revenue,
                        cancelledOrders: data.allTime.cancelled_orders,
                        cancelledRevenue: data.allTime.cancelled_revenue
                    });
                }
                
                updateStatusChart(data.byStatus || []);
                
                return data;
            })
            .catch(error => {
                console.error('Ошибка загрузки статистики:', error);
                showToast('Ошибка загрузки статистики', 'error');
                return {};
            });
    }
    
    function updateStatusChart(statusData) {
        const chartElement = document.getElementById('statusChart');
        
        if (statusData.length === 0) {
            chartElement.innerHTML = `
                <div class="chart-placeholder">
                    <i class="fas fa-chart-pie"></i>
                    <p>Нет данных для отображения</p>
                </div>
            `;
            return;
        }
        
        let chartHTML = '<div class="status-chart">';
        const total = statusData.reduce((sum, item) => sum + item.count, 0);
        
        statusData.forEach(item => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            const color = getStatusColor(item.status);
            
            chartHTML += `
                <div class="status-bar">
                    <div class="status-label">
                        <span class="status-dot" style="background: ${color}"></span>
                        ${item.status}
                    </div>
                    <div class="status-bar-container">
                        <div class="status-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                        <span class="status-count">${item.count}</span>
                    </div>
                </div>
            `;
        });
        
        chartHTML += '</div>';
        chartElement.innerHTML = chartHTML;
        
        const style = document.createElement('style');
        style.textContent = `
            .status-chart { padding: 20px; }
            .status-bar { margin-bottom: 15px; }
            .status-label {
                display: flex;
                align-items: center;
                margin-bottom: 5px;
                font-size: 0.9rem;
                color: #555;
                font-family: 'Outfit', 'Roboto', sans-serif;
            }
            .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 10px;
            }
            .status-bar-container {
                height: 20px;
                background: #f0f0f0;
                border-radius: 10px;
                position: relative;
                overflow: hidden;
            }
            .status-bar-fill {
                height: 100%;
                border-radius: 10px;
                transition: width 0.5s ease;
            }
            .status-count {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 0.8rem;
                font-weight: 600;
                color: #333;
                font-family: 'Outfit', 'Roboto', sans-serif;
            }
        `;
        chartElement.appendChild(style);
    }
    
    function getStatusColor(status) {
        const colors = {
            'новый': '#FF9800',
            'в обработке': '#2196F3',
            'готовится': '#9C27B0',
            'в пути': '#00BCD4',
            'доставлен': '#4CAF50',
            'готов к выдаче': '#00BCD4',
            'выдан': '#4CAF50',
            'отменен': '#F44336'
        };
        return colors[status] || '#95a5a6';
    }
    
    // Основная функция загрузки заказов с проверкой на новые
    function loadOrders() {
        const statusParam = currentFilter === 'все' ? '' : `?status=${currentFilter}`;
        
        fetch(`/api/orders${statusParam}`)
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки заказов');
                return res.json();
            })
            .then(data => {
                const previousOrdersCount = allOrders.length;
                allOrders = data.orders || [];
                totalOrders = allOrders.length;
                
                if (previousOrdersCount > 0 && allOrders.length > 0) {
                    checkForNewOrders(allOrders);
                } else if (previousOrdersCount === 0 && allOrders.length > 0 && !isFirstLoad) {
                    checkForNewOrders(allOrders);
                }
                
                renderOrdersTable();
                loadStats();
            })
            .catch(error => {
                console.error('Ошибка загрузки заказов:', error);
                ordersTableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px; color: #e74c3c;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Ошибка загрузки заказов</p>
                        </td>
                    </tr>
                `;
            });
    }
    
    // Модифицированная функция renderOrdersTable с поддержкой разных статусов для самовывоза и доставки
    function renderOrdersTable() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageOrders = allOrders.slice(startIndex, endIndex);
        
        if (pageOrders.length === 0) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #95a5a6;">
                        <i class="fas fa-shopping-cart"></i>
                        <p>Заказов не найдено</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        let tableHTML = '';
        
        pageOrders.forEach(order => {
            const itemsPreview = order.items
                .slice(0, 2)
                .map(item => `${item.name} (${item.quantity})`)
                .join(', ');
            
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} еще` : '';
            
            // Форматируем дату в таджикистанском времени
            const orderDate = new Date(order.created_at);
            const tajikOrderDate = getTajikistanTime(orderDate);
            
            const formattedDate = tajikOrderDate.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const isMobile = window.innerWidth <= 480;
            
            // Используем display_status для отображения
            const displayStatus = order.display_status || order.status;
            
            // Создаем опции для выпадающего списка в зависимости от типа заказа
            let statusOptions = '';
            if (order.order_type === 'pickup') {
                // Статусы для самовывоза
                const pickupStatuses = [
                    { value: 'новый', label: 'Новый' },
                    { value: 'в обработке', label: 'В обработке' },
                    { value: 'готовится', label: 'Готовится' },
                    { value: 'готов к выдаче', label: 'Готов к выдаче' },
                    { value: 'выдан', label: 'Выдан' },
                    { value: 'отменен', label: 'Отменен' }
                ];
                
                statusOptions = pickupStatuses.map(option => 
                    `<option value="${option.value}" ${displayStatus === option.value ? 'selected' : ''}>
                        ${option.label}
                    </option>`
                ).join('');
            } else {
                // Статусы для доставки
                const deliveryStatuses = [
                    { value: 'новый', label: 'Новый' },
                    { value: 'в обработке', label: 'В обработке' },
                    { value: 'готовится', label: 'Готовится' },
                    { value: 'в пути', label: 'В пути' },
                    { value: 'доставлен', label: 'Доставлен' },
                    { value: 'отменен', label: 'Отменен' }
                ];
                
                statusOptions = deliveryStatuses.map(option => 
                    `<option value="${option.value}" ${order.status === option.value ? 'selected' : ''}>
                        ${option.label}
                    </option>`
                ).join('');
            }
            
            // HTML для кода самовывоза
            let pickupCodeHTML = '';
            if (order.order_type === 'pickup' && order.pickup_code) {
                pickupCodeHTML = `
                    <td data-label="Код" class="pickup-code-cell">
                        <div class="pickup-code-badge" onclick="copyPickupCodeAdmin('${order.pickup_code}', ${order.id})" 
                           title="Нажмите, чтобы скопировать код">
                            ${order.pickup_code}
                            <i class="fas fa-copy" style="margin-left: 5px; font-size: 0.8rem;"></i>
                        </div>
                    </td>
                `;
            } else {
                pickupCodeHTML = '<td data-label="Код">—</td>';
            }
            
            tableHTML += `
                <tr class="order-row" data-order-id="${order.id}" data-order-type="${order.order_type}">
                    <td data-label="ID">#${order.id}</td>
                    <td data-label="Клиент">${order.customer_name}</td>
                    <td data-label="Телефон">${order.customer_phone}</td>
                    ${!isMobile ? `<td data-label="Тип">${order.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</td>` : ''}
                    <td data-label="Товары" class="order-items-preview" title="${order.items.map(i => i.name).join(', ')}">
                        ${itemsPreview}${moreItems}
                    </td>
                    <td data-label="Сумма">${order.total_price} TJS</td>
                    <td data-label="Статус">
                        <select class="status-select" data-order-id="${order.id}" 
                                style="background: ${getStatusColor(displayStatus)}20; color: ${getStatusColor(displayStatus)}; border-color: ${getStatusColor(displayStatus)}">
                            ${statusOptions}
                        </select>
                    </td>
                    ${!isMobile ? `<td data-label="Дата">${formattedDate}</td>` : ''}
                    ${!isMobile ? pickupCodeHTML : ''}
                    <td data-label="Действия">
                        <button class="view-details-btn" onclick="viewOrderDetails(${order.id})">
                            <i class="fas fa-eye"></i> Подробнее
                        </button>
                    </td>
                </tr>
            `;
        });
        
        ordersTableBody.innerHTML = tableHTML;
        
        // Настройка обработчиков для выпадающих списков статуса
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', function() {
                const orderId = this.dataset.orderId;
                const orderRow = this.closest('.order-row');
                const orderType = orderRow ? orderRow.dataset.orderType : 'delivery';
                const newStatus = this.value;
                
                updateOrderStatus(orderId, newStatus, orderType);
            });
        });
        
        updatePagination();
        
        if (window.innerWidth <= 480) {
            adaptTableForMobile();
        }
        
        // Добавляем стили для кода самовывоза, если их еще нет
        if (!document.querySelector('#pickup-code-styles')) {
            const style = document.createElement('style');
            style.id = 'pickup-code-styles';
            style.textContent = `
                .pickup-code-badge:hover {
                    background: #c0392b !important;
                    transform: scale(1.05);
                    box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                }
                
                .pickup-code-cell {
                    min-width: 90px;
                }
                
                @media (max-width: 768px) {
                    .pickup-code-cell {
                        display: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function updatePagination() {
        const maxPage = Math.ceil(totalOrders / itemsPerPage);
        currentPageElement.textContent = currentPage;
        
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === maxPage || maxPage === 0;
    }
    
    function updateOrderStatus(orderId, newStatus, orderType = null) {
        // Если тип заказа не передан, пытаемся найти его в DOM
        if (!orderType) {
            const orderRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (orderRow) {
                orderType = orderRow.dataset.orderType || 'delivery';
            }
        }
        
        // Отправляем статус в формате, который понимает сервер
        // Сервер сам преобразует "готов к выдаче" -> "в пути" и "выдан" -> "доставлен" для самовывоза
        const statusToSend = newStatus;
        
        fetch(`/api/order/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: statusToSend })
        })
        .then(res => {
            if (!res.ok) throw new Error('Ошибка обновления статуса');
            return res.json();
        })
        .then(data => {
            if (data.success) {
                showToast(`Статус заказа #${orderId} обновлен на "${newStatus}"`);
                
                const select = document.querySelector(`select[data-order-id="${orderId}"]`);
                if (select) {
                    // Обновляем цвет выпадающего списка
                    const color = getStatusColor(newStatus);
                    select.style.background = `${color}20`;
                    select.style.color = color;
                    select.style.borderColor = color;
                    
                    // Обновляем выбранное значение
                    select.value = newStatus;
                }
                
                // Обновляем заказ в allOrders
                const orderIndex = allOrders.findIndex(o => o.id == orderId);
                if (orderIndex !== -1) {
                    allOrders[orderIndex].status = data.display_status || newStatus;
                    allOrders[orderIndex].display_status = data.display_status || newStatus;
                }
                
                return loadStats();
            }
        })
        .catch(error => {
            console.error('Ошибка обновления статуса:', error);
            showToast('Ошибка обновления статуса', 'error');
        });
    }
    
    function loadRecentOrders() {
        fetch('/api/orders?status=новый')
            .then(res => res.json())
            .then(data => {
                const recentOrders = data.orders?.slice(0, 5) || [];
                
                if (recentOrders.length === 0) {
                    recentOrdersList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-shopping-cart"></i>
                            <p>Нет новых заказов</p>
                        </div>
                    `;
                    return;
                }
                
                let ordersHTML = '';
                
                recentOrders.forEach(order => {
                    const orderDate = new Date(order.created_at);
                    const tajikOrderDate = getTajikistanTime(orderDate);
                    
                    const orderTime = tajikOrderDate.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    // Используем display_status для отображения
                    const displayStatus = order.display_status || order.status;
                    
                    // Добавляем информацию о коде самовывоза
                    const pickupInfo = order.pickup_code ? 
                        `<div class="pickup-code-mini" style="margin-top: 5px;">
                            <i class="fas fa-qrcode" style="color: #e74c3c; font-size: 0.8rem;"></i>
                            <span style="font-family: 'Courier New', monospace; font-weight: bold; color: #e74c3c;">${order.pickup_code}</span>
                        </div>` : '';
                    
                    ordersHTML += `
                        <div class="order-item">
                            <div class="order-info">
                                <h4>#${order.id} - ${order.customer_name}</h4>
                                <p>${order.items.length} товара • ${order.total_price} TJS</p>
                                <p><small>${order.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</small></p>
                                <small>${orderTime}</small>
                                ${pickupInfo}
                            </div>
                            <span class="order-status status-new">${displayStatus}</span>
                        </div>
                    `;
                });
                
                recentOrdersList.innerHTML = ordersHTML;
            })
            .catch(error => {
                console.error('Ошибка загрузки последних заказов:', error);
                recentOrdersList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Ошибка загрузки</p>
                    </div>
                `;
            });
    }
    
    function loadNotifications() {
        fetch('/api/notifications?limit=20')
            .then(res => res.json())
            .then(data => {
                const notifications = data.notifications || [];
                
                checkForNewNotifications(notifications);
                
                if (notifications.length === 0) {
                    notificationsList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-bell-slash"></i>
                            <p>Уведомлений нет</p>
                        </div>
                    `;
                    return;
                }
                
                let notificationsHTML = '';
                
                notifications.forEach(notification => {
                    const time = formatNotificationTime(notification.created_at);
                    
                    const icon = notification.message.includes('Новый заказ') ? 'fa-cart-plus' : 
                                notification.message.includes('Статус') ? 'fa-exchange-alt' : 
                                notification.message.includes('код') ? 'fa-qrcode' : 'fa-bell';
                    
                    // Подсвечиваем код самовывоза в уведомлениях
                    let message = notification.message;
                    if (notification.message.includes('код:')) {
                        message = notification.message.replace(/(код: \d{4})/, '<strong style="color: #e74c3c;">$1</strong>');
                    }
                    
                    notificationsHTML += `
                        <div class="notification-item ${notification.is_read ? '' : 'unread'}">
                            <div class="notification-icon-circle">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="notification-content">
                                <p class="notification-message">${message}</p>
                                <small class="notification-time">${time}</small>
                            </div>
                            <div class="notification-actions">
                                ${!notification.is_read ? `
                                    <button class="btn-mark-read" onclick="markNotificationAsRead(${notification.id})">
                                        <i class="fas fa-check"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
                
                notificationsList.innerHTML = notificationsHTML;
            })
            .catch(error => {
                console.error('Ошибка загрузки уведомлений:', error);
            });
    }
    
    // Форматирование времени уведомления (с учетом Таджикистана UTC+5)
    function formatNotificationTime(dateString) {
        const date = new Date(dateString);
        const tajikDate = getTajikistanTime(date);
        const nowTajik = getTajikistanTime(new Date());
        
        const diffMs = nowTajik - tajikDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        if (diffHours < 24) return `${diffHours} ч. назад`;
        if (diffDays < 7) return `${diffDays} дн. назад`;
        
        return tajikDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    function markAllNotificationsAsRead() {
        fetch('/api/notifications/read', {
            method: 'PUT'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(`${data.updated} уведомлений отмечено как прочитанные`);
                loadNotifications();
                loadStats();
            }
        })
        .catch(error => {
            console.error('Ошибка отметки уведомлений:', error);
            showToast('Ошибка отметки уведомлений', 'error');
        });
    }
    
    window.markNotificationAsRead = function(notificationId) {
        markAllNotificationsAsRead();
    };
    
    // ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ПРОСМОТРА ДЕТАЛЕЙ ЗАКАЗА С КОДОМ САМОВЫВОЗА И РАЗНЫМИ СТАТУСАМИ ==========
    
    window.viewOrderDetails = function(orderId) {
        // Показать индикатор загрузки
        document.getElementById('modalOrderId').textContent = orderId;
        document.getElementById('orderDetailsContent').innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Загрузка деталей заказа...</p>
            </div>
        `;
        
        orderDetailsModal.style.display = 'flex';
        
        // Загружаем полную информацию о заказе
        fetch(`/api/order/${orderId}`)
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки заказа');
                return res.json();
            })
            .then(data => {
                const order = data.order;
                
                // Загружаем информацию о пользователе, если есть user_id
                if (order.user_id) {
                    fetch(`/api/user-info/${order.user_id}`)
                        .then(userRes => userRes.json())
                        .then(userData => {
                            renderOrderDetails(order, userData.user);
                        })
                        .catch(userErr => {
                            console.warn('Не удалось загрузить информацию о пользователе:', userErr);
                            renderOrderDetails(order, null);
                        });
                } else {
                    renderOrderDetails(order, null);
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки заказа:', error);
                showToast('Ошибка загрузки заказа', 'error');
                document.getElementById('orderDetailsContent').innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Ошибка загрузки заказа</p>
                    </div>
                `;
            });
    };
    
    // Функция отображения деталей заказа с информацией о пользователе и кодом самовывоза
    function renderOrderDetails(order, userInfo) {
        // Форматируем дату в таджикистанском времени
        const orderDate = new Date(order.created_at);
        const tajikOrderDate = getTajikistanTime(orderDate);
        
        const orderTime = tajikOrderDate.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Используем display_status для отображения
        const displayStatus = order.display_status || order.status;
        
        // Создаем опции для изменения статуса в модальном окне
        let statusOptionsHTML = '';
        if (order.order_type === 'pickup') {
            // Статусы для самовывоза
            const pickupStatuses = [
                { value: 'новый', label: 'Новый' },
                { value: 'в обработке', label: 'В обработке' },
                { value: 'готовится', label: 'Готовится' },
                { value: 'готов к выдаче', label: 'Готов к выдаче' },
                { value: 'выдан', label: 'Выдан' },
                { value: 'отменен', label: 'Отменен' }
            ];
            
            statusOptionsHTML = pickupStatuses.map(status => 
                `<option value="${status.value}" ${displayStatus === status.value ? 'selected' : ''}>
                    ${status.label}
                </option>`
            ).join('');
        } else {
            // Статусы для доставки
            const deliveryStatuses = [
                { value: 'новый', label: 'Новый' },
                { value: 'в обработке', label: 'В обработке' },
                { value: 'готовится', label: 'Готовится' },
                { value: 'в пути', label: 'В пути' },
                { value: 'доставлен', label: 'Доставлен' },
                { value: 'отменен', label: 'Отменен' }
            ];
            
            statusOptionsHTML = deliveryStatuses.map(status => 
                `<option value="${status.value}" ${order.status === status.value ? 'selected' : ''}>
                    ${status.label}
                </option>`
            ).join('');
        }
        
        // Создаем HTML для товаров
        const itemsHTML = order.items.map(item => `
            <div class="admin-order-item-with-image">
                <div class="admin-order-item-image-container">
                    <img src="${item.img}" alt="${item.name}" 
                         class="admin-order-item-image"
                         onerror="this.src='https://via.placeholder.com/80x80/cccccc/ffffff?text=No+Image'">
                </div>
                <div class="admin-order-item-details">
                    <div class="admin-order-item-name">
                        <strong>${item.name}</strong>
                    </div>
                    <div class="admin-order-item-info">
                        <div class="admin-order-item-quantity">
                            Количество: <span class="item-quantity-badge">${item.quantity}</span>
                        </div>
                        <div class="admin-order-item-price">
                            Цена: ${item.price} TJS
                        </div>
                        <div class="admin-order-item-total">
                            Итого: <strong>${item.price * item.quantity} TJS</strong>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // HTML для информации о пользователе
        let userInfoHTML = '';
        if (userInfo) {
            // Форматируем дату регистрации
            const regDate = new Date(userInfo.created_at);
            const regDateFormatted = regDate.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            // Рассчитываем сколько дней пользователь с нами
            const daysWithUs = Math.floor((new Date() - regDate) / (1000 * 60 * 60 * 24));
            
            userInfoHTML = `
                <div class="detail-group user-info-group">
                    <h4><i class="fas fa-user-circle"></i> Информация о пользователе</h4>
                    <div class="user-info-card">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <div class="user-field">
                                <span class="user-label"><i class="fas fa-signature"></i> Логин:</span>
                                <span class="user-value login-value">${userInfo.login}</span>
                            </div>
                            <div class="user-field">
                                <span class="user-label"><i class="fas fa-phone"></i> Телефон:</span>
                                <span class="user-value phone-value">${userInfo.phone}</span>
                            </div>
                            <div class="user-field">
                                <span class="user-label"><i class="fas fa-user-tag"></i> Роль:</span>
                                <span class="user-value role-badge ${userInfo.role === 'admin' ? 'admin-badge' : 'user-badge'}">
                                    ${userInfo.role === 'admin' ? 'Администратор' : 'Пользователь'}
                                </span>
                            </div>
                            <div class="user-field">
                                <span class="user-label"><i class="fas fa-calendar-alt"></i> Дата регистрации:</span>
                                <span class="user-value">${regDateFormatted}</span>
                            </div>
                            <div class="user-field">
                                <span class="user-label"><i class="fas fa-history"></i> С нами:</span>
                                <span class="user-value">${daysWithUs} дней</span>
                            </div>
                        </div>
                    </div>
                    <div class="user-stats">
                        <div class="user-stat">
                            <i class="fas fa-shopping-cart"></i>
                            <span class="stat-label">Заказов:</span>
                            <span class="stat-value" id="userOrdersCount">Загрузка...</span>
                        </div>
                        <div class="user-stat">
                            <i class="fas fa-money-bill-wave"></i>
                            <span class="stat-label">Потрачено:</span>
                            <span class="stat-value" id="userTotalSpent">Загрузка...</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Загружаем статистику пользователя
            fetch(`/api/user-stats/${order.user_id}`)
                .then(res => res.json())
                .then(stats => {
                    const ordersCount = document.getElementById('userOrdersCount');
                    const totalSpent = document.getElementById('userTotalSpent');
                    
                    if (ordersCount) ordersCount.textContent = stats.total_orders || 0;
                    if (totalSpent) totalSpent.textContent = `${stats.total_spent || 0} TJS`;
                })
                .catch(err => {
                    console.warn('Не удалось загрузить статистику пользователя:', err);
                    const ordersCount = document.getElementById('userOrdersCount');
                    const totalSpent = document.getElementById('userTotalSpent');
                    
                    if (ordersCount) ordersCount.textContent = '0';
                    if (totalSpent) totalSpent.textContent = '0 TJS';
                });
        } else {
            userInfoHTML = `
                <div class="detail-group user-info-group">
                    <h4><i class="fas fa-user-circle"></i> Информация о пользователе</h4>
                    <div class="guest-user-info">
                        <i class="fas fa-user-slash"></i>
                        <p>Гостевой заказ (без регистрации)</p>
                        <small>Пользователь не зарегистрирован в системе</small>
                    </div>
                </div>
            `;
        }
        
        // HTML для кода самовывоза
        let pickupCodeHTML = '';
        if (order.order_type === 'pickup' && order.pickup_code) {
            pickupCodeHTML = `
                <div class="detail-group">
                    <h4><i class="fas fa-qrcode"></i> Код самовывоза</h4>
                    <div style="
                        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                        margin-top: 10px;
                        border: 2px solid #e74c3c;
                        box-shadow: 0 4px 15px rgba(231, 76, 60, 0.1);
                    ">
                        <div style="
                            font-size: 2.5rem;
                            font-weight: bold;
                            color: #e74c3c;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 8px;
                            margin-bottom: 15px;
                            padding: 10px;
                            background: white;
                            border-radius: 8px;
                            border: 2px dashed #e74c3c;
                        " id="pickup-code-display-${order.id}">
                            ${order.pickup_code}
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                            <button class="copy-pickup-code-btn" style="
                                background: #3498db;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.9rem;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                transition: background 0.3s;
                            " onclick="copyPickupCodeAdmin('${order.pickup_code}', ${order.id})">
                                <i class="fas fa-copy"></i> Скопировать код
                            </button>
                            <button class="verify-pickup-code-btn" style="
                                background: #27ae60;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.9rem;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                transition: background 0.3s;
                            " onclick="verifyPickupCode(${order.id}, '${order.pickup_code}')">
                                <i class="fas fa-check-circle"></i> Подтвердить выдачу
                            </button>
                        </div>
                        <p style="color: #666; margin-top: 15px; font-size: 0.9rem;">
                            <i class="fas fa-info-circle"></i> 
                            Клиент покажет этот код при получении заказа
                        </p>
                    </div>
                </div>
            `;
        }
        
        document.getElementById('modalOrderId').textContent = order.id;
        document.getElementById('orderDetailsContent').innerHTML = `
            <div class="order-details-grid">
                <div class="detail-group">
                    <h4><i class="fas fa-user"></i> Информация о клиенте</h4>
                    <p><strong>Имя:</strong> ${order.customer_name}</p>
                    <p><strong>Телефон:</strong> ${order.customer_phone}</p>
                    <p><strong>Тип заказа:</strong> ${order.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</p>
                </div>
                
                ${userInfoHTML}
                
                <div class="detail-group">
                    <h4><i class="fas fa-truck"></i> Детали доставки</h4>
                    <p><strong>Адрес:</strong> ${order.address || 'Не указан'}</p>
                    <p><strong>Способ оплаты:</strong> ${getPaymentMethodName(order.payment_method)}</p>
                    <p><strong>Статус:</strong> 
                        <select id="modal-status-select" class="modal-status-select" data-order-id="${order.id}" 
                                style="background: ${getStatusColor(displayStatus)}20; color: ${getStatusColor(displayStatus)}; border: 1px solid ${getStatusColor(displayStatus)}; padding: 5px 10px; border-radius: 4px; margin-left: 10px;">
                            ${statusOptionsHTML}
                        </select>
                    </p>
                </div>
                
                ${pickupCodeHTML}
                
                <div class="detail-group">
                    <h4><i class="fas fa-info-circle"></i> Информация о заказе</h4>
                    <p><strong>ID заказа:</strong> <span class="order-id">#${order.id}</span></p>
                    <p><strong>Дата создания:</strong> ${orderTime} (Таджикистан UTC+5)</p>
                    <p><strong>Время готовки:</strong> ${order.estimated_time || '30 минут'}</p>
                    <p><strong>Комментарий:</strong> ${order.comments || 'Нет комментариев'}</p>
                </div>
            </div>
            
            <div class="order-items-list-with-images">
                <div class="order-items-header">
                    <h4><i class="fas fa-shopping-basket"></i> Состав заказа</h4>
                    <span class="total-items-count">${order.items.length} товара</span>
                </div>
                <div class="order-items-container">
                    ${itemsHTML}
                </div>
                <div class="order-summary-total">
                    <div class="summary-row">
                        <span>Сумма товаров:</span>
                        <span>${order.total_price - (order.order_type === 'delivery' ? 10 : 0)} TJS</span>
                    </div>
                    ${order.order_type === 'delivery' ? `
                        <div class="summary-row">
                            <span>Доставка:</span>
                            <span>10 TJS</span>
                        </div>
                    ` : ''}
                    <div class="summary-row grand-total">
                        <span>ИТОГО:</span>
                        <span><strong>${order.total_price} TJS</strong></span>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем обработчик изменения статуса в модальном окне
        const modalStatusSelect = document.getElementById('modal-status-select');
        if (modalStatusSelect) {
            modalStatusSelect.addEventListener('change', function() {
                const newStatus = this.value;
                updateOrderStatus(order.id, newStatus, order.order_type);
            });
        }
        
        // Добавляем стили для информации о пользователе, если их еще нет
        if (!document.querySelector('#user-info-styles')) {
            const style = document.createElement('style');
            style.id = 'user-info-styles';
            style.textContent = `
                .user-info-group {
                    grid-column: span 2;
                }
                
                .user-info-card {
                    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    align-items: flex-start;
                    gap: 20px;
                    margin-bottom: 15px;
                    border: 1px solid #dee2e6;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                    transition: transform 0.3s, box-shadow 0.3s;
                }
                
                .user-info-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                
                .user-avatar {
                    width: 70px;
                    height: 70px;
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 28px;
                    flex-shrink: 0;
                    border: 3px solid white;
                    box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
                }
                
                .user-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .user-field {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 6px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }
                
                .user-field:last-child {
                    border-bottom: none;
                }
                
                .user-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 150px;
                    color: #495057;
                    font-weight: 500;
                    font-size: 0.9rem;
                }
                
                .user-label i {
                    width: 16px;
                    color: #3498db;
                }
                
                .user-value {
                    color: #212529;
                    font-weight: 600;
                    font-size: 0.95rem;
                }
                
                .login-value {
                    color: #e74c3c;
                    background: #ffe6e6;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-family: monospace;
                    letter-spacing: 0.5px;
                }
                
                .phone-value {
                    color: #27ae60;
                    font-weight: 700;
                    font-size: 1rem;
                }
                
                .role-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: inline-block;
                }
                
                .admin-badge {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                }
                
                .user-badge {
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    color: white;
                }
                
                .user-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                
                .user-stat {
                    background: white;
                    border-radius: 10px;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border: 1px solid #e9ecef;
                    transition: all 0.3s;
                }
                
                .user-stat:hover {
                    border-color: #3498db;
                    box-shadow: 0 3px 8px rgba(52, 152, 219, 0.2);
                }
                
                .user-stat i {
                    font-size: 1.5rem;
                    color: #3498db;
                    width: 30px;
                }
                
                .stat-label {
                    flex: 1;
                    color: #6c757d;
                    font-size: 0.9rem;
                }
                
                .stat-value {
                    font-weight: 700;
                    color: #212529;
                    font-size: 1.1rem;
                }
                
                .guest-user-info {
                    text-align: center;
                    padding: 30px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    border: 2px dashed #dee2e6;
                }
                
                .guest-user-info i {
                    font-size: 3rem;
                    color: #95a5a6;
                    margin-bottom: 15px;
                }
                
                .guest-user-info p {
                    color: #6c757d;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                
                .guest-user-info small {
                    color: #adb5bd;
                    font-size: 0.85rem;
                }
                
                @media (max-width: 768px) {
                    .user-info-card {
                        flex-direction: column;
                        text-align: center;
                    }
                    
                    .user-avatar {
                        align-self: center;
                    }
                    
                    .user-field {
                        flex-direction: column;
                        gap: 5px;
                        text-align: center;
                    }
                    
                    .user-label {
                        min-width: auto;
                        justify-content: center;
                    }
                    
                    .user-stats {
                        grid-template-columns: 1fr;
                    }
                    
                    .user-info-group {
                        grid-column: span 1;
                    }
                }
                
                .modal-status-select {
                    cursor: pointer;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                    font-size: 0.9rem;
                }
                
                .modal-status-select:hover {
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(style);
        }
    };
    
    function getPaymentMethodName(method) {
        const methods = {
            'cash': 'Наличные',
            'ds': 'Душанбе Сити',
            'alif': 'Алиф'
        };
        return methods[method] || method;
    }
    
    function showToast(message, type = 'success') {
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        if (window.innerWidth <= 480) {
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 15px;
                right: 15px;
                background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--secondary-color)'};
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                z-index: 3000;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: toastSlideIn 0.3s;
                justify-content: center;
                font-family: 'Outfit', 'Roboto', sans-serif;
            `;
        } else {
            toast.style.fontFamily = "'Outfit', 'Roboto', sans-serif";
        }
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
        
        if (!document.querySelector('#toast-out-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-out-animation';
            style.textContent = `
                @keyframes toastSlideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function startAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        autoRefreshInterval = setInterval(() => {
            if (!document.hidden) {
                loadStats();
                loadOrders();
                
                if (document.querySelector('#notificationsSection.active')) {
                    loadNotifications();
                }
            }
        }, 10000);
    }
    
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        } else {
            startAutoRefresh();
        }
    });
    
    // ========== ФУНКЦИИ АНАЛИТИКИ ==========
    
    // Инициализация аналитики
    function initAnalytics() {
        const applyDateRangeBtn = document.getElementById('applyDateRange');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        // Установка дат по умолчанию (последние 7 дней)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        startDateInput.value = formatDateForInput(startDate);
        endDateInput.value = formatDateForInput(endDate);
        
        if (applyDateRangeBtn) {
            applyDateRangeBtn.addEventListener('click', loadAnalytics);
        }
        
        // Загрузка аналитики при открытии раздела
        loadAnalytics();
    }
    
    // Форматирование даты для input[type="date"]
    function formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Загрузка аналитики
    function loadAnalytics() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            showToast('Выберите период для анализа', 'warning');
            return;
        }
        
        // Показывать индикатор загрузки
        const analyticsChart = document.querySelector('.analytics-chart .chart-placeholder-large');
        if (analyticsChart) {
            analyticsChart.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Загрузка аналитики...</p>
                </div>
            `;
        }
        
        fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`)
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки аналитики');
                return res.json();
            })
            .then(data => {
                updateAnalyticsUI(data);
            })
            .catch(error => {
                console.error('Ошибка загрузки аналитики:', error);
                showToast('Ошибка загрузки аналитики', 'error');
                resetAnalyticsUI();
            });
    }
    
    // Обновление UI аналитики с учетом отмененных заказов
    function updateAnalyticsUI(data) {
        // Обновляем статистические карточки
        const totalRevenue = document.getElementById('totalRevenue');
        const avgOrderValue = document.getElementById('avgOrderValue');
        const totalOrders = document.getElementById('totalOrders');
        
        if (totalRevenue && data.periodStats) {
            totalRevenue.textContent = `${data.periodStats.total_revenue || 0} TJS`;
            
            // Дополнительно показываем информацию об отмененных заказах
            if (data.periodStats.cancelled_revenue) {
                const cancelledInfo = document.createElement('small');
                cancelledInfo.className = 'cancelled-info';
                cancelledInfo.textContent = ` (исключено отмененных: ${data.periodStats.cancelled_orders || 0} заказов на ${data.periodStats.cancelled_revenue || 0} TJS)`;
                cancelledInfo.style.color = '#e74c3c';
                cancelledInfo.style.fontSize = '0.8rem';
                cancelledInfo.style.marginLeft = '10px';
                totalRevenue.appendChild(cancelledInfo);
            }
        }
        
        if (avgOrderValue && data.periodStats) {
            avgOrderValue.textContent = `${Math.round(data.periodStats.avg_order_value || 0)} TJS`;
        }
        
        if (totalOrders && data.periodStats) {
            totalOrders.textContent = data.periodStats.total_orders || 0;
        }
        
        // Строим график продаж по дням (уже исключены отмененные)
        if (data.dailyStats && data.dailyStats.length > 0) {
            renderSalesChart(data.dailyStats);
        } else {
            showNoDataChart();
        }
        
        // Обновляем диаграмму статусов (включая отмененные)
        if (data.byStatus && data.byStatus.length > 0) {
            updateAnalyticsStatusChart(data.byStatus);
        }
    }
    
    // Сброс UI аналитики при ошибке
    function resetAnalyticsUI() {
        document.getElementById('totalRevenue').textContent = '0 TJS';
        document.getElementById('avgOrderValue').textContent = '0 TJS';
        document.getElementById('totalOrders').textContent = '0';
        showNoDataChart();
    }
    
    // Отображение графика "нет данных"
    function showNoDataChart() {
        const chartContainer = document.querySelector('.analytics-chart .chart-placeholder-large');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <i class="fas fa-chart-bar"></i>
                <p>Нет данных за выбранный период</p>
            `;
        }
    }
    
    // Рендер графика продаж по дням
    function renderSalesChart(dailyStats) {
        const chartContainer = document.querySelector('.analytics-chart .chart-placeholder-large');
        if (!chartContainer) return;
        
        // Сортируем данные по дате
        const sortedStats = [...dailyStats].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Подготавливаем данные для графика
        const dates = sortedStats.map(stat => {
            const date = new Date(stat.date);
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        });
        
        const revenues = sortedStats.map(stat => stat.daily_revenue || 0);
        const orderCounts = sortedStats.map(stat => stat.order_count || 0);
        
        // Создаем HTML для простого бар-чарта
        const maxRevenue = Math.max(...revenues, 1);
        const maxOrders = Math.max(...orderCounts, 1);
        
        let chartHTML = `
            <div class="simple-bar-chart">
                <div class="chart-header">
                    <div class="chart-legend">
                        <span class="legend-item"><i class="fas fa-square" style="color: #3498db;"></i> Выручка (TJS)</span>
                        <span class="legend-item"><i class="fas fa-square" style="color: #e74c3c;"></i> Заказы (шт.)</span>
                    </div>
                </div>
                <div class="chart-bars-container">
        `;
        
        // Генерируем бары для каждой даты
        dates.forEach((date, index) => {
            const revenuePercent = (revenues[index] / maxRevenue) * 100;
            const ordersPercent = (orderCounts[index] / maxOrders) * 100;
            
            chartHTML += `
                <div class="chart-bar-group">
                    <div class="chart-date">${date}</div>
                    <div class="bars">
                        <div class="bar revenue-bar" style="height: ${revenuePercent}%" 
                             title="Выручка: ${revenues[index]} TJS">
                            <span class="bar-value">${revenues[index]}</span>
                        </div>
                        <div class="bar orders-bar" style="height: ${ordersPercent}%"
                             title="Заказов: ${orderCounts[index]} шт.">
                            <span class="bar-value">${orderCounts[index]}</span>
                        </div>
                    </div>
                    <div class="chart-label">${date}</div>
                </div>
            `;
        });
        
        chartHTML += `
                </div>
                <div class="chart-footer">
                    <div class="chart-summary">
                        <p>Всего выручка: <strong>${revenues.reduce((a, b) => a + b, 0)} TJS</strong></p>
                        <p>Всего заказов: <strong>${orderCounts.reduce((a, b) => a + b, 0)} шт.</strong></p>
                    </div>
                </div>
            </div>
        `;
        
        chartContainer.innerHTML = chartHTML;
        
        // Добавляем стили для графика, если их еще нет
        if (!document.querySelector('#analytics-chart-styles')) {
            const style = document.createElement('style');
            style.id = 'analytics-chart-styles';
            style.textContent = `
                .simple-bar-chart {
                    width: 100%;
                    height: 300px;
                    display: flex;
                    flex-direction: column;
                    font-family: 'Outfit', 'Roboto', sans-serif;
                }
                
                .chart-header {
                    margin-bottom: 20px;
                }
                
                .chart-legend {
                    display: flex;
                    gap: 20px;
                    font-size: 0.85rem;
                    color: #666;
                    margin-bottom: 10px;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .chart-bars-container {
                    flex: 1;
                    display: flex;
                    justify-content: space-around;
                    align-items: flex-end;
                    gap: 15px;
                    padding: 0 10px;
                    border-bottom: 2px solid #eee;
                    position: relative;
                }
                
                .chart-bar-group {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                    position: relative;
                    min-width: 50px;
                }
                
                .bars {
                    display: flex;
                    gap: 5px;
                    width: 80%;
                    height: 100%;
                    align-items: flex-end;
                    position: relative;
                }
                
                .bar {
                    position: relative;
                    width: 20px;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.3s ease, background-color 0.3s;
                    min-height: 3px;
                }
                
                .bar:hover {
                    opacity: 0.9;
                    transform: scale(1.05);
                }
                
                .revenue-bar {
                    background: linear-gradient(to top, #3498db, #2980b9);
                }
                
                .orders-bar {
                    background: linear-gradient(to top, #e74c3c, #c0392b);
                }
                
                .bar-value {
                    position: absolute;
                    top: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 0.7rem;
                    font-weight: bold;
                    color: #333;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                
                .bar:hover .bar-value {
                    opacity: 1;
                }
                
                .chart-date {
                    font-size: 0.8rem;
                    color: #666;
                    margin-bottom: 5px;
                    text-align: center;
                    height: 20px;
                }
                
                .chart-label {
                    font-size: 0.8rem;
                    color: #666;
                    margin-top: 5px;
                    text-align: center;
                    height: 20px;
                }
                
                .chart-footer {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                }
                
                .chart-summary {
                    display: flex;
                    justify-content: space-around;
                    font-size: 0.9rem;
                    color: #333;
                }
                
                .chart-summary p {
                    margin: 0;
                }
                
                .chart-summary strong {
                    color: #e74c3c;
                }
                
                @media (max-width: 768px) {
                    .simple-bar-chart {
                        height: 250px;
                    }
                    
                    .chart-bars-container {
                        gap: 8px;
                    }
                    
                    .chart-bar-group {
                        min-width: 30px;
                    }
                    
                    .bar {
                        width: 15px;
                    }
                    
                    .chart-legend {
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .chart-summary {
                        flex-direction: column;
                        gap: 5px;
                        text-align: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Обновление диаграммы статусов в разделе аналитики
    function updateAnalyticsStatusChart(statusData) {
        const chartContainer = document.querySelector('.analytics-status-chart');
        if (!chartContainer) {
            // Создаем контейнер для диаграммы статусов, если его нет
            const analyticsSection = document.getElementById('analyticsSection');
            if (analyticsSection) {
                const statusChartHTML = `
                    <div class="analytics-chart-status">
                        <h4>Распределение статусов за период</h4>
                        <div class="chart-placeholder-medium">
                            <i class="fas fa-chart-pie"></i>
                            <p>Диаграмма статусов</p>
                        </div>
                    </div>
                `;
                analyticsSection.querySelector('.analytics-chart').insertAdjacentHTML('afterend', statusChartHTML);
            }
        }
        
        const statusChartPlaceholder = document.querySelector('.chart-placeholder-medium');
        if (statusChartPlaceholder) {
            let chartHTML = '<div class="status-chart-analytics">';
            const total = statusData.reduce((sum, item) => sum + item.count, 0);
            
            statusData.forEach(item => {
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                const color = getStatusColor(item.status);
                
                chartHTML += `
                    <div class="status-row">
                        <div class="status-info">
                            <span class="status-dot" style="background: ${color}"></span>
                            <span class="status-name">${item.status}</span>
                            <span class="status-percentage">${percentage.toFixed(1)}%</span>
                        </div>
                        <div class="status-bar-container">
                            <div class="status-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                            <span class="status-count">${item.count}</span>
                        </div>
                    </div>
                `;
            });
            
            chartHTML += '</div>';
            statusChartPlaceholder.parentNode.innerHTML = `
                <h4>Распределение статусов за период</h4>
                ${chartHTML}
            `;
            
            // Добавляем стили
            if (!document.querySelector('#analytics-status-styles')) {
                const style = document.createElement('style');
                style.id = 'analytics-status-styles';
                style.textContent = `
                    .status-chart-analytics {
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 3px 15px rgba(0,0,0,0.1);
                        margin-top: 20px;
                    }
                    
                    .status-row {
                        margin-bottom: 15px;
                    }
                    
                    .status-info {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    
                    .status-dot {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        margin-right: 10px;
                    }
                    
                    .status-name {
                        flex: 1;
                        font-size: 0.9rem;
                        color: #333;
                    }
                    
                    .status-percentage {
                        font-size: 0.9rem;
                        font-weight: 600;
                        color: #333;
                        min-width: 50px;
                        text-align: right;
                    }
                    
                    .status-bar-container {
                        height: 20px;
                        background: #f5f5f5;
                        border-radius: 10px;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .status-bar-fill {
                        height: 100%;
                        border-radius: 10px;
                        transition: width 0.5s ease;
                    }
                    
                    .status-count {
                        position: absolute;
                        right: 10px;
                        top: 50%;
                        transform: translateY(-50%);
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: #333;
                    }
                    
                    .cancelled-info {
                        display: inline-block;
                        margin-top: 5px;
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }
    
    // ========== ФУНКЦИИ ДЛЯ КОДА САМОВЫВОЗА ==========
    
    // Функция копирования кода самовывоза
    window.copyPickupCodeAdmin = function(code, orderId) {
        navigator.clipboard.writeText(code).then(() => {
            showToast(`Код ${code} скопирован для заказа #${orderId}`, 'success');
            
            // Визуальная обратная связь
            const codeDisplay = document.getElementById(`pickup-code-display-${orderId}`);
            if (codeDisplay) {
                const originalText = codeDisplay.textContent;
                codeDisplay.textContent = 'СКОПИРОВАНО!';
                codeDisplay.style.background = '#27ae60';
                codeDisplay.style.color = 'white';
                
                setTimeout(() => {
                    codeDisplay.textContent = originalText;
                    codeDisplay.style.background = '';
                    codeDisplay.style.color = '';
                }, 2000);
            }
            
            // Также обновляем все кнопки копирования
            const buttons = document.querySelectorAll(`button[onclick="copyPickupCodeAdmin('${code}', ${orderId})"]`);
            buttons.forEach(btn => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Скопировано';
                btn.style.background = '#27ae60';
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                }, 2000);
            });
            
            // Обновляем бейджи в таблице
            const badges = document.querySelectorAll(`.pickup-code-badge[onclick="copyPickupCodeAdmin('${code}', ${orderId})"]`);
            badges.forEach(badge => {
                badge.style.background = '#27ae60';
                setTimeout(() => {
                    badge.style.background = '#e74c3c';
                }, 2000);
            });
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            showToast('Ошибка копирования', 'error');
        });
    };
    
    // Функция подтверждения кода самовывоза
    window.verifyPickupCode = function(orderId, code) {
        if (!confirm(`Подтвердить выдачу заказа #${orderId} по коду ${code}?`)) {
            return;
        }
        
        fetch(`/api/order/${orderId}/verify-pickup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code })
        })
        .then(res => {
            if (!res.ok) throw new Error('Ошибка подтверждения кода');
            return res.json();
        })
        .then(data => {
            if (data.success) {
                showToast(`Заказ #${orderId} выдан клиенту ${data.customer || ''}`, 'success');
                
                // Обновляем статус заказа на "выдан" для самовывоза
                updateOrderStatus(orderId, 'выдан', 'pickup');
                
                // Обновляем кнопку подтверждения
                const verifyBtn = document.querySelector(`button[onclick="verifyPickupCode(${orderId}, '${code}')"]`);
                if (verifyBtn) {
                    verifyBtn.innerHTML = '<i class="fas fa-check-double"></i> Выдан';
                    verifyBtn.style.background = '#95a5a6';
                    verifyBtn.disabled = true;
                }
                
                // Закрываем модальное окно через 2 секунды
                setTimeout(() => {
                    if (orderDetailsModal.style.display === 'flex') {
                        orderDetailsModal.style.display = 'none';
                    }
                }, 2000);
            } else {
                showToast(data.error || 'Ошибка подтверждения кода', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка подтверждения кода:', error);
            showToast('Ошибка подтверждения кода', 'error');
        });
    };
    
    // Функция для загрузки статистики по самовывозам
    function loadPickupStats() {
        fetch('/api/pickup-stats')
            .then(res => {
                if (!res.ok) throw new Error('Ошибка загрузки статистики самовывоза');
                return res.json();
            })
            .then(data => {
                // Можно добавить отображение статистики самовывоза
                console.log('Статистика самовывоза:', data);
                
                // Пример: добавить блок статистики в дашборд
                const dashboardSection = document.getElementById('dashboardSection');
                if (dashboardSection && data.total_pickup_orders > 0) {
                    // Проверяем, нет ли уже блока статистики самовывоза
                    if (!document.getElementById('pickupStatsCard')) {
                        const pickupStatsHTML = `
                            <div class="stat-card" id="pickupStatsCard" style="margin-top: 20px;">
                                <div class="stat-icon" style="background: #9b59b6;">
                                    <i class="fas fa-store"></i>
                                </div>
                                <div class="stat-info">
                                    <h3>${data.total_pickup_orders}</h3>
                                    <p>Самовывозов сегодня</p>
                                    <small style="color: #666; font-size: 0.8rem;">
                                        ${data.completed_pickups} завершено
                                    </small>
                                </div>
                            </div>
                        `;
                        
                        // Добавляем после существующих карточек статистики
                        const statsGrid = dashboardSection.querySelector('.stats-grid');
                        if (statsGrid) {
                            statsGrid.insertAdjacentHTML('beforeend', pickupStatsHTML);
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки статистики самовывоза:', error);
            });
    }
    
    // Обновляем loadStats для загрузки статистики самовывоза
    const originalLoadStats = loadStats;
    window.loadStats = function() {
        return originalLoadStats()
            .then(() => {
                loadPickupStats();
                return true;
            })
            .catch(error => {
                console.error('Ошибка в loadStats:', error);
                loadPickupStats();
                return false;
            });
    };
    
    window.updateOrderStatus = updateOrderStatus;
    window.viewOrderDetails = viewOrderDetails;
    window.markNotificationAsRead = markNotificationAsRead;
    window.loadStats = loadStats;
    window.copyPickupCodeAdmin = copyPickupCodeAdmin;
    window.verifyPickupCode = verifyPickupCode;
});