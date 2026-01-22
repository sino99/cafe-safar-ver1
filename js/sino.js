// Sino Owner Panel JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Проверка авторизации
  checkSinoAuth();
  
  // Инициализация
  initNavigation();
  loadUsers();
  loadStats();
  
  // Обработчики событий
  setupEventListeners();
});

// Глобальные переменные
let currentUserId = null;
let currentUsers = [];
let currentOrders = [];
let revenueChart = null;
let statusChart = null;

// Проверка авторизации владельца
async function checkSinoAuth() {
  try {
    const response = await fetch('/api/sino/check');
    const data = await response.json();
    
    if (!data.loggedIn) {
      window.location.href = '/sino-login.html';
      return false;
    }
    
    document.getElementById('currentUser').textContent = data.sino.login;
    return true;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    window.location.href = '/sino-login.html';
    return false;
  }
}

// Инициализация навигации
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      
      // Обновляем активный элемент навигации
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      // Показываем соответствующий контент
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabId}-tab`) {
          content.classList.add('active');
          
          // Загружаем данные для активной вкладки
          switch(tabId) {
            case 'users':
              loadUsers();
              break;
            case 'orders':
              loadOrders();
              break;
            case 'stats':
              loadStats();
              initCharts();
              break;
          }
        }
      });
    });
  });
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Выход из системы
  document.getElementById('logoutBtn').addEventListener('click', function() {
    window.location.href = '/sino/logout';
  });
  
  // Обновление пользователей
  document.getElementById('refreshUsers').addEventListener('click', loadUsers);
  
  // Поиск пользователей
  document.getElementById('userSearch').addEventListener('input', function(e) {
    filterUsers(e.target.value);
  });
  
  // Обновление заказов
  document.getElementById('refreshOrders').addEventListener('click', loadOrders);
  
  // Фильтр статусов заказов
  document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
  
  // Изменение периода статистики
  document.getElementById('statsPeriod').addEventListener('change', loadStats);
  
  // Закрытие модальных окон
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
      });
    });
  });
  
  // Клик вне модального окна
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    });
  });
  
  // Нажатие ESC для закрытия модальных окон
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });
}

// Показ уведомлений с улучшенным дизайном
function showNotification(title, message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas ${icons[type]}"></i>
    </div>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <div class="notification-close">
      <i class="fas fa-times"></i>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Анимация появления
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Закрытие по клику
  notification.querySelector('.notification-close').addEventListener('click', function() {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  });
  
  // Автоматическое закрытие
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Загрузка пользователей
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="loading-cell">
        <i class="fas fa-spinner fa-spin"></i> Загрузка пользователей...
      </td>
    </tr>
  `;
  
  try {
    const response = await fetch('/api/sino/users');
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    currentUsers = data.users;
    renderUsersTable(currentUsers);
    updateUsersStats(data.users);
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell" style="color: var(--danger-color);">
          <i class="fas fa-exclamation-circle"></i> Ошибка: ${error.message}
        </td>
      </tr>
    `;
  }
}

// Отображение таблицы пользователей
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell">
          <i class="fas fa-users-slash"></i> Пользователи не найдены
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${escapeHtml(user.login)}</td>
      <td>${escapeHtml(user.phone)}</td>
      <td title="${escapeHtml(user.hashed_password)}">
        ${user.hashed_password.substring(0, 20)}...
      </td>
      <td>${escapeHtml(user.role)}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <span class="status-badge ${user.is_blocked ? 'status-blocked' : 'status-active'}">
          ${user.is_blocked ? 'Заблокирован' : 'Активен'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          ${user.is_blocked ? `
            <button class="btn-action btn-unblock" onclick="unblockUser(${user.id}, '${escapeHtml(user.login)}')">
              <i class="fas fa-lock-open"></i> Разблокировать
            </button>
          ` : `
            <button class="btn-action btn-block" onclick="showBlockModal(${user.id}, '${escapeHtml(user.login)}', '${escapeHtml(user.phone)}')">
              <i class="fas fa-lock"></i> Заблокировать
            </button>
          `}
          <button class="btn-action btn-delete" onclick="showDeleteModal(${user.id}, '${escapeHtml(user.login)}', '${escapeHtml(user.phone)}')">
            <i class="fas fa-trash"></i> Удалить
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Фильтрация пользователей
function filterUsers(searchTerm) {
  if (!searchTerm) {
    renderUsersTable(currentUsers);
    return;
  }
  
  const filtered = currentUsers.filter(user => 
    user.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  renderUsersTable(filtered);
}

// Обновление статистики пользователей
function updateUsersStats(users) {
  const totalUsers = users.length;
  const blockedUsers = users.filter(u => u.is_blocked).length;
  
  document.getElementById('totalUsers').textContent = totalUsers;
  document.getElementById('blockedUsers').textContent = blockedUsers;
}

// Показать модальное окно блокировки
function showBlockModal(userId, login, phone) {
  currentUserId = userId;
  
  document.getElementById('blockUserInfo').innerHTML = `
    <div class="user-info-block">
      <p><strong>Пользователь:</strong> ${login}</p>
      <p><strong>Телефон:</strong> ${phone}</p>
      <div class="warning-message">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <p><strong>Внимание!</strong> Пользователь будет немедленно выгнан из системы.</p>
          <p>При блокировке произойдет:</p>
          <ul>
            <li>Немедленный выход из всех сессий</li>
            <li>Запрет на вход в систему</li>
            <li>Уведомление о блокировке на всех устройствах</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('blockReason').value = '';
  document.getElementById('blockModal').classList.add('active');
  
  // Фокус на поле причины
  setTimeout(() => {
    document.getElementById('blockReason').focus();
  }, 100);
}

// Блокировка пользователя
async function blockUser() {
  const reason = document.getElementById('blockReason').value.trim();
  
  if (!reason) {
    showNotification('Ошибка', 'Укажите причину блокировки', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/sino/block-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        reason: reason
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Показываем анимацию блокировки
      const userRow = document.querySelector(`tr:has(td:contains("${currentUserId}"))`);
      if (userRow) {
        userRow.style.backgroundColor = '#ffebee';
        userRow.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
          userRow.style.opacity = '0.5';
          setTimeout(() => {
            userRow.style.opacity = '1';
            userRow.style.backgroundColor = '';
          }, 1000);
        }, 500);
      }
      
      showNotification('Успех', data.message, 'success');
      document.getElementById('blockModal').classList.remove('active');
      loadUsers(); // Перезагружаем список пользователей
    } else {
      showNotification('Ошибка', data.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка блокировки пользователя:', error);
    showNotification('Ошибка', 'Ошибка соединения с сервером', 'error');
  }
}

// Разблокировка пользователя
async function unblockUser(userId, login) {
  if (!confirm(`Вы уверены, что хотите разблокировать пользователя "${login}"?\n\nПользователь сможет войти в систему снова.`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/sino/unblock-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Показываем анимацию разблокировки
      const userRow = document.querySelector(`tr:has(td:contains("${userId}"))`);
      if (userRow) {
        userRow.style.backgroundColor = '#e8f5e9';
        userRow.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
          userRow.style.backgroundColor = '';
        }, 2000);
      }
      
      showNotification('Успех', data.message, 'success');
      loadUsers(); // Перезагружаем список пользователей
    } else {
      showNotification('Ошибка', data.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка разблокировки пользователя:', error);
    showNotification('Ошибка', 'Ошибка соединения с сервером', 'error');
  }
}

// Показать модальное окно удаления
function showDeleteModal(userId, login, phone) {
  currentUserId = userId;
  
  document.getElementById('deleteUserInfo').innerHTML = `
    <div class="user-to-delete">
      <div class="user-info">
        <p><strong>Пользователь для удаления:</strong></p>
        <div class="user-details">
          <p><i class="fas fa-user"></i> Логин: <strong>${login}</strong></p>
          <p><i class="fas fa-phone"></i> Телефон: <strong>${phone}</strong></p>
        </div>
      </div>
      
      <div class="deletion-effects">
        <h4><i class="fas fa-bolt"></i> Что произойдет:</h4>
        <ul>
          <li><i class="fas fa-sign-out-alt"></i> <strong>Немедленный выход</strong> из всех сессий</li>
          <li><i class="fas fa-user-slash"></i> Полное удаление аккаунта из БД</li>
          <li><i class="fas fa-shopping-cart"></i> Удаление всех заказов пользователя</li>
          <li><i class="fas fa-history"></i> Удаление истории заказов</li>
          <li><i class="fas fa-bell"></i> Удаление всех уведомлений</li>
        </ul>
      </div>
      
      <div class="irreversible-warning">
        <i class="fas fa-radiation-alt"></i>
        <p><strong>Это действие НЕОБРАТИМО!</strong> Восстановить данные будет невозможно.</p>
      </div>
    </div>
  `;
  
  document.getElementById('deleteModal').classList.add('active');
}

// Удаление пользователя с улучшенной анимацией
async function deleteUser() {
  try {
    // Показываем анимацию загрузки в модальном окне
    const deleteBtn = document.getElementById('confirmDelete');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
    deleteBtn.disabled = true;
    
    const response = await fetch('/api/sino/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: currentUserId })
    });
    
    const data = await response.json();
    
    // Восстанавливаем кнопку
    deleteBtn.innerHTML = originalText;
    deleteBtn.disabled = false;
    
    if (data.success) {
      // Показываем анимацию удаления в таблице
      const userRow = document.querySelector(`tr:has(td:contains("${currentUserId}"))`);
      if (userRow) {
        // Анимация удаления строки
        userRow.style.backgroundColor = '#ffebee';
        userRow.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
          userRow.style.opacity = '0';
          userRow.style.transform = 'translateX(100%)';
          userRow.style.height = '0';
          userRow.style.padding = '0';
          userRow.style.margin = '0';
          userRow.style.border = 'none';
          
          setTimeout(() => {
            userRow.remove();
            updateUsersStatsAfterDeletion();
          }, 500);
        }, 300);
      }
      
      // Показываем уведомление с деталями
      let notificationMessage = data.message;
      if (data.forcedLogout) {
        notificationMessage += '\nПользователь был выгнан из системы.';
      }
      
      showNotification('Успех', notificationMessage, 'success');
      
      // Закрываем модальное окно с анимацией
      const modal = document.getElementById('deleteModal');
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      modal.style.transition = 'all 0.3s ease';
      
      setTimeout(() => {
        modal.classList.remove('active');
        modal.style.opacity = '';
        modal.style.transform = '';
      }, 300);
      
      // Обновляем статистику
      loadStats();
      
      // Показываем финальное уведомление
      setTimeout(() => {
        showNotification('Удаление завершено', 'Все данные пользователя были успешно удалены из системы.', 'success');
      }, 1000);
      
    } else {
      showNotification('Ошибка', data.error, 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    showNotification('Ошибка', 'Ошибка соединения с сервером', 'error');
    
    // Восстанавливаем кнопку в случае ошибки
    const deleteBtn = document.getElementById('confirmDelete');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Удалить навсегда';
    deleteBtn.disabled = false;
  }
}

// Обновление статистики после удаления
function updateUsersStatsAfterDeletion() {
  const totalUsers = parseInt(document.getElementById('totalUsers').textContent) - 1;
  document.getElementById('totalUsers').textContent = totalUsers;
  
  // Обновляем счетчики в реальном времени
  const statsPeriod = document.getElementById('statsPeriod');
  if (statsPeriod) {
    loadStats();
  }
}

// Загрузка заказов
async function loadOrders(page = 1) {
  const ordersGrid = document.getElementById('ordersGrid');
  ordersGrid.innerHTML = `
    <div class="loading-orders">
      <i class="fas fa-spinner fa-spin"></i> Загрузка заказов...
    </div>
  `;
  
  const statusFilter = document.getElementById('orderStatusFilter').value;
  const limit = 12;
  const offset = (page - 1) * limit;
  
  try {
    const response = await fetch(`/api/sino/all-orders?limit=${limit}&offset=${offset}&status=${statusFilter}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    currentOrders = data.orders;
    renderOrdersGrid(data.orders);
    renderOrdersPagination(data.total, limit, page);
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error);
    ordersGrid.innerHTML = `
      <div class="loading-orders" style="color: var(--danger-color);">
        <i class="fas fa-exclamation-circle"></i> Ошибка: ${error.message}
      </div>
    `;
  }
}

// Отображение сетки заказов
function renderOrdersGrid(orders) {
  const ordersGrid = document.getElementById('ordersGrid');
  
  if (orders.length === 0) {
    ordersGrid.innerHTML = `
      <div class="loading-orders">
        <i class="fas fa-shopping-cart"></i> Заказы не найдены
      </div>
    `;
    return;
  }
  
  ordersGrid.innerHTML = orders.map(order => {
    const statusClass = getStatusClass(order.status);
    const items = Array.isArray(order.items) ? order.items : [];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-id">Заказ #${order.id}</div>
          <div class="order-status ${statusClass}">${order.display_status || order.status}</div>
        </div>
        
        <div class="order-customer">
          <p><strong>Клиент:</strong> ${escapeHtml(order.customer_name)}</p>
          <p><strong>Телефон:</strong> ${escapeHtml(order.customer_phone)}</p>
          ${order.customer_login ? `<p><strong>Логин:</strong> ${escapeHtml(order.customer_login)}</p>` : ''}
        </div>
        
        <div class="order-details">
          <div class="order-items">
            ${items.slice(0, 3).map(item => `
              <div class="order-item">
                <span>${escapeHtml(item.name)} × ${item.quantity}</span>
                <span>${item.price * item.quantity} TJS</span>
              </div>
            `).join('')}
            ${items.length > 3 ? `<div class="order-item"><em>... и еще ${items.length - 3} позиций</em></div>` : ''}
          </div>
          
          <div class="order-total">
            <span>Итого (${totalItems} шт.):</span>
            <span class="total-price">${order.total_price} TJS</span>
          </div>
        </div>
        
        <div class="order-footer">
          <div class="order-type">
            <strong>Тип:</strong> ${order.order_type === 'delivery' ? 'Доставка' : 'Самовывоз'}
          </div>
          <div class="order-date">
            ${formatDateTime(order.created_at)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Пагинация заказов
function renderOrdersPagination(total, limit, currentPage) {
  const pagination = document.getElementById('ordersPagination');
  const totalPages = Math.ceil(total / limit);
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Кнопка "Назад"
  if (currentPage > 1) {
    paginationHTML += `<button class="page-btn" onclick="loadOrders(${currentPage - 1})">‹ Назад</button>`;
  } else {
    paginationHTML += `<button class="page-btn" disabled>‹ Назад</button>`;
  }
  
  // Номера страниц
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      paginationHTML += `<button class="page-btn active" disabled>${i}</button>`;
    } else {
      paginationHTML += `<button class="page-btn" onclick="loadOrders(${i})">${i}</button>`;
    }
  }
  
  // Кнопка "Вперед"
  if (currentPage < totalPages) {
    paginationHTML += `<button class="page-btn" onclick="loadOrders(${currentPage + 1})">Вперед ›</button>`;
  } else {
    paginationHTML += `<button class="page-btn" disabled>Вперед ›</button>`;
  }
  
  paginationHTML += `<div class="page-info">Страница ${currentPage} из ${totalPages}</div>`;
  
  pagination.innerHTML = paginationHTML;
}

// Загрузка статистики
async function loadStats() {
  const period = document.getElementById('statsPeriod').value;
  
  try {
    const response = await fetch(`/api/sino/stats?period=${period}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    updateStatsDisplay(data);
    updateDailyStatsTable(data.dailyStats);
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    showNotification('Ошибка', 'Не удалось загрузить статистику', 'error');
  }
}

// Обновление отображения статистики
function updateStatsDisplay(data) {
  const stats = data.stats || {};
  
  // Основные метрики
  document.getElementById('totalRevenue').textContent = `${(stats.total_revenue || 0).toFixed(2)} TJS`;
  document.getElementById('totalOrders').textContent = stats.total_orders || 0;
  document.getElementById('avgOrder').textContent = `${(stats.avg_order || 0).toFixed(2)} TJS`;
  document.getElementById('uniqueCustomers').textContent = stats.unique_customers || 0;
  
  // Для изменения можно добавить сравнение с предыдущим периодом
  // Здесь просто ставим заглушки
  document.getElementById('revenueChange').textContent = '+0%';
  document.getElementById('ordersChange').textContent = '+0';
  document.getElementById('avgChange').textContent = '+0%';
  document.getElementById('customersChange').textContent = '+0';
  
  // Обновление графиков
  updateCharts(data);
  
  // Обновление информации в настройках
  document.getElementById('systemTotalOrders').textContent = stats.total_orders || 0;
  document.getElementById('systemTotalUsers').textContent = currentUsers.length || 0;
}

// Обновление таблицы ежедневной статистики
function updateDailyStatsTable(dailyStats) {
  const tbody = document.getElementById('dailyStatsBody');
  
  if (!dailyStats || dailyStats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">
          Нет данных за выбранный период
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = dailyStats.map(day => `
    <tr>
      <td>${formatDate(day.date)}</td>
      <td>${day.orders_count}</td>
      <td>${day.daily_revenue ? day.daily_revenue.toFixed(2) : '0.00'} TJS</td>
      <td>${day.orders_count ? (day.daily_revenue / day.orders_count).toFixed(2) : '0.00'} TJS</td>
    </tr>
  `).join('');
}

// Инициализация графиков с улучшенным дизайном
function initCharts() {
  const revenueCtx = document.getElementById('revenueChart').getContext('2d');
  const statusCtx = document.getElementById('statusChart').getContext('2d');
  
  // График выручки с градиентом
  revenueChart = new Chart(revenueCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Выручка (TJS)',
        data: [],
        borderColor: '#4cc9f0',
        backgroundColor: createGradient(revenueCtx, '#4cc9f0'),
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4cc9f0',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              size: 14
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#4cc9f0',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.2)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: {
              size: 12
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.2)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: {
              size: 12
            },
            callback: function(value) {
              return value + ' TJS';
            }
          },
          beginAtZero: true
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animations: {
        tension: {
          duration: 1000,
          easing: 'linear'
        }
      }
    }
  });
  
  // График статусов с анимацией
  statusChart = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#3498db', // Новый
          '#f39c12', // В обработке
          '#2ecc71', // Готовится
          '#9b59b6', // В пути
          '#1abc9c', // Доставлен
          '#e74c3c'  // Отменен
        ],
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 2,
        hoverOffset: 15
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            padding: 20,
            font: {
              size: 12
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1000
      }
    }
  });
}

// Создание градиента для графика
function createGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, hexToRgba(color, 0.8));
  gradient.addColorStop(1, hexToRgba(color, 0.1));
  return gradient;
}

// Конвертация hex в rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Обновление графиков
function updateCharts(data) {
  if (!revenueChart || !statusChart) return;
  
  // Обновление графика выручки
  if (data.dailyStats && data.dailyStats.length > 0) {
    const labels = data.dailyStats.map(day => formatDate(day.date)).reverse();
    const revenueData = data.dailyStats.map(day => day.daily_revenue || 0).reverse();
    
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = revenueData;
    revenueChart.update('none'); // Обновляем без анимации для производительности
  }
  
  // Обновление графика статусов
  if (data.statusStats && data.statusStats.length > 0) {
    const labels = data.statusStats.map(stat => {
      const statusMap = {
        'новый': 'Новые',
        'в обработке': 'В обработке',
        'готовится': 'Готовятся',
        'в пути': 'В пути',
        'доставлен': 'Доставлены',
        'отменен': 'Отменены'
      };
      return statusMap[stat.status] || stat.status;
    });
    const statusData = data.statusStats.map(stat => stat.count);
    
    statusChart.data.labels = labels;
    statusChart.data.datasets[0].data = statusData;
    
    // Анимируем обновление графика статусов
    statusChart.update();
  }
}

// Вспомогательные функции
function getStatusClass(status) {
  const statusMap = {
    'новый': 'order-status-new',
    'в обработке': 'order-status-processing',
    'готовится': 'order-status-processing',
    'в пути': 'order-status-processing',
    'доставлен': 'order-status-delivered',
    'выдан': 'order-status-delivered',
    'отменен': 'order-status-cancelled'
  };
  
  return statusMap[status] || 'order-status-processing';
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Делаем функции глобальными для использования в onclick
window.showBlockModal = showBlockModal;
window.unblockUser = unblockUser;
window.showDeleteModal = showDeleteModal;
window.loadOrders = loadOrders;
window.deleteUser = deleteUser;
window.blockUser = blockUser;

// Привязка кнопок подтверждения в модальных окнах
document.addEventListener('DOMContentLoaded', function() {
  const confirmBlockBtn = document.getElementById('confirmBlock');
  const confirmDeleteBtn = document.getElementById('confirmDelete');
  
  if (confirmBlockBtn) {
    confirmBlockBtn.addEventListener('click', blockUser);
  }
  
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', deleteUser);
  }
});

// Добавляем CSS стили для анимаций
const style = document.createElement('style');
style.textContent = `
  /* Анимации для уведомлений */
  .notification {
    opacity: 0;
    transform: translateX(100%);
    transition: opacity 0.3s, transform 0.3s;
  }
  
  /* Анимация для строк таблицы */
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); }
    to { transform: translateX(100%); }
  }
  
  /* Анимация пульсации для важных элементов */
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
  }
  
  .btn-delete {
    animation: pulse 2s infinite;
  }
  
  /* Стили для модальных окон */
  .modal {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
  }
  
  .modal.active {
    opacity: 1;
    visibility: visible;
  }
  
  .modal-content {
    transform: translateY(-50px) scale(0.95);
    opacity: 0;
    transition: transform 0.3s, opacity 0.3s;
  }
  
  .modal.active .modal-content {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  
  /* Стили для статистики */
  .stat-card {
    transition: transform 0.3s, box-shadow 0.3s;
  }
  
  .stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
  }
  
  /* Анимация загрузки */
  .fa-spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Инициализация при загрузке
setTimeout(initCharts, 500);