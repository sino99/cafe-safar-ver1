const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'safar-secret-key-2025-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// База данных SQLite
const db = new sqlite3.Database('database.db', (err) => {
  if (err) console.error('Ошибка подключения к БД:', err);
  else console.log('База данных подключена');
});

// WebSocket соединения для отслеживания в реальном времени
const wsClients = new Map(); // userId -> WebSocket

// Карта для отслеживания удаленных пользователей (userId -> timestamp)
const deletedUsers = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  
  if (userId) {
    wsClients.set(parseInt(userId), ws);
    console.log(`WebSocket подключен для пользователя ${userId}`);
  }

  // Обработка сообщений от клиента
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'REGISTER') {
        const userId = data.userId;
        if (userId) {
          wsClients.set(parseInt(userId), ws);
          console.log(`WebSocket зарегистрирован для пользователя ${userId}`);
        }
      }
    } catch (error) {
      console.error('Ошибка обработки WebSocket сообщения:', error);
    }
  });

  ws.on('close', () => {
    for (const [id, client] of wsClients.entries()) {
      if (client === ws) {
        wsClients.delete(id);
        console.log(`WebSocket отключен для пользователя ${id}`);
        break;
      }
    }
  });
});

// Функция для отправки уведомлений через WebSocket
function notifyUser(userId, type, data) {
  const ws = wsClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    return true;
  }
  return false;
}

// Функция для принудительного выхода пользователя через WebSocket
function forceLogoutUser(userId, reason = 'account_deleted') {
  const ws = wsClients.get(parseInt(userId));
  
  // Помечаем пользователя как удаленного (для middleware проверки)
  deletedUsers.set(parseInt(userId), Date.now());
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Отправляем команду принудительного выхода
    ws.send(JSON.stringify({
      type: 'FORCE_LOGOUT',
      data: {
        reason: reason,
        message: reason === 'account_deleted' 
          ? 'Ваш аккаунт был удален администратором системы.' 
          : 'Ваш аккаунт был заблокирован администратором системы.',
        timestamp: new Date().toISOString()
      }
    }));
    
    // Закрываем соединение через 3 секунды
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, reason === 'account_deleted' ? 'Account deleted' : 'Account blocked');
      }
      wsClients.delete(parseInt(userId));
    }, 3000);
    
    // Очищаем запись об удаленном пользователе через 5 минут
    setTimeout(() => {
      deletedUsers.delete(parseInt(userId));
    }, 5 * 60 * 1000);
    
    return true;
  }
  
  return false;
}

// Middleware для проверки удаленных пользователей при каждом запросе
app.use((req, res, next) => {
  // Проверяем только если пользователь авторизован и не админ/владелец
  if (req.session.user && req.session.user.role !== 'admin' && req.session.user.role !== 'owner') {
    const userId = req.session.user.id;
    
    // Проверяем в реальном времени
    db.get(`SELECT id FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) {
        console.error('Ошибка проверки пользователя:', err);
        return next();
      }
      
      if (!row) {
        // Пользователь не существует в БД
        console.log(`Пользователь ${userId} не найден в БД, уничтожаем сессию`);
        
        // Сохраняем ID для отправки уведомления
        const deletedUserId = userId;
        
        // Уничтожаем сессию
        req.session.destroy((err) => {
          if (err) {
            console.error('Ошибка уничтожения сессии:', err);
          }
          
          // Отправляем WebSocket уведомление, если есть соединение
          forceLogoutUser(deletedUserId, 'account_deleted');
          
          // Для API запросов возвращаем ошибку с редиректом
          if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ 
              success: false, 
              error: 'Ваш аккаунт был удален',
              code: 'ACCOUNT_DELETED',
              redirect: '/'
            });
          } else {
            // Для HTML запросов - редирект на главную
            return res.redirect('/');
          }
        });
        return;
      }
      
      // Проверяем, не заблокирован ли пользователь
      db.get(`SELECT * FROM blocked_users WHERE user_id = ?`, [userId], (err, blocked) => {
        if (err) {
          console.error('Ошибка проверки блокировки:', err);
          return next();
        }
        
        if (blocked) {
          // Пользователь заблокирован
          console.log(`Пользователь ${userId} заблокирован, уничтожаем сессию`);
          
          // Уничтожаем сессию
          req.session.destroy((err) => {
            if (err) {
              console.error('Ошибка уничтожения сессии:', err);
            }
            
            // Отправляем WebSocket уведомление
            forceLogoutUser(userId, 'account_blocked');
            
            // Для API запросов
            if (req.originalUrl.startsWith('/api')) {
              return res.status(403).json({ 
                success: false, 
                error: 'Ваш аккаунт заблокирован',
                code: 'ACCOUNT_BLOCKED',
                redirect: '/'
              });
            } else {
              return res.redirect('/');
            }
          });
          return;
        }
        
        next();
      });
    });
  } else {
    next();
  }
});

// Функция для генерации 4-значного кода самовывоза
function generatePickupCode() {
  // Генерируем 4 случайные цифры (1000-9999)
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Функция для получения правильного статуса в зависимости от типа заказа
function getDisplayStatus(status, orderType) {
  if (orderType === 'pickup') {
    const pickupStatusMap = {
      'в пути': 'готов к выдаче',
      'доставлен': 'выдан'
    };
    return pickupStatusMap[status] || status;
  }
  return status;
}

// Функция для получения правильного статуса для сохранения в БД
function getStorageStatus(status, orderType) {
  if (orderType === 'pickup') {
    const storageStatusMap = {
      'готов к выдаче': 'в пути',
      'выдан': 'доставлен'
    };
    return storageStatusMap[status] || status;
  }
  return status;
}

// Создание таблиц и добавление админа по умолчанию
db.serialize(async () => {
  // Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица заказов (ДОБАВЛЕН pickup_code для самовывоза)
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      order_type TEXT NOT NULL,
      address TEXT,
      payment_method TEXT NOT NULL,
      comments TEXT,
      items TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'новый',
      status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      estimated_time TEXT,
      pickup_code TEXT,  -- Код для самовывоза
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Таблица уведомлений для админа
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      user_id INTEGER,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'order',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Таблица трекинга (для истории изменений статуса)
  db.run(`
    CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER,
      status TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Проверяем и добавляем отсутствующие столбцы
  db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err) {
      console.error('Ошибка получения информации о таблице orders:', err);
      return;
    }
    
    if (!columns || !Array.isArray(columns)) {
      console.log('Таблица orders не существует или пуста');
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    
    // Проверяем наличие pickup_code
    if (!columnNames.includes('pickup_code')) {
      db.run("ALTER TABLE orders ADD COLUMN pickup_code TEXT", (alterErr) => {
        if (alterErr) {
          console.error('Ошибка добавления столбца pickup_code:', alterErr);
        } else {
          console.log('Столбец pickup_code успешно добавлен');
        }
      });
    }
    
    // Проверяем наличие estimated_time
    if (!columnNames.includes('estimated_time')) {
      db.run("ALTER TABLE orders ADD COLUMN estimated_time TEXT", (alterErr) => {
        if (alterErr) {
          console.error('Ошибка добавления столбца estimated_time:', alterErr);
        } else {
          console.log('Столбец estimated_time успешно добавлен');
        }
      });
    }
  });

  // Проверяем существует ли админ
  db.get("SELECT * FROM users WHERE login = 'safar'", async (err, row) => {
    if (err) {
      console.error('Ошибка при проверке админа:', err);
      return;
    }
    
    if (!row) {
      try {
        const hash = await bcrypt.hash('123456', 10);
        db.run(
          `INSERT INTO users (login, phone, password, role) VALUES (?, ?, ?, ?)`,
          ['safar', '928082552', hash, 'admin'],
          function(err) {
            if (err) {
              console.error('Ошибка при создании админа:', err);
            } else {
              console.log('Администратор создан: login: safar, password: 123456');
            }
          }
        );
      } catch (e) {
        console.error('Ошибка хэширования пароля:', e);
      }
    }
  });

  // Добавляем индекс для ускорения запросов
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON order_tracking(order_id)');
});

// Статические файлы
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Страница администратора
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/admin-login.html');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Страница входа для админа
app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// API для сохранения заказа (ОБНОВЛЕН - добавляем код самовывоза)
app.post('/api/order', (req, res) => {
  if (!req.session.user) {
    return res.json({ success: false, error: 'Требуется авторизация' });
  }

  const { 
    customer_name, 
    customer_phone, 
    order_type, 
    address, 
    payment_method, 
    comments, 
    items, 
    total_price 
  } = req.body;

  if (!customer_name || !customer_phone || !items || !total_price) {
    return res.json({ success: false, error: 'Недостаточно данных' });
  }

  const itemsJson = JSON.stringify(items);
  const userId = req.session.user.id;
  
  // Генерируем код самовывоза если тип заказа 'pickup'
  const pickupCode = order_type === 'pickup' ? generatePickupCode() : null;
  
  // НЕ рассчитываем время готовки при создании заказа
  // Оно будет рассчитано только при статусе "в обработке"
  
  db.run(
    `INSERT INTO orders (user_id, customer_name, customer_phone, order_type, address, payment_method, comments, items, total_price, status, pickup_code) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, customer_name, customer_phone, order_type, address, payment_method, comments, itemsJson, total_price, 'новый', pickupCode],
    function(err) {
      if (err) {
        console.error('Ошибка сохранения заказа:', err);
        return res.json({ success: false, error: 'Ошибка сохранения заказа' });
      }
      
      const orderId = this.lastID;
      
      // Записываем в историю трекинга
      db.run(
        `INSERT INTO order_tracking (order_id, user_id, status, message) VALUES (?, ?, ?, ?)`,
        [orderId, userId, 'новый', 'Заказ создан']
      );
      
      // Создаем уведомление для админа
      let adminMessage = `Новый заказ #${orderId} от ${customer_name} на сумму ${total_price} TJS`;
      if (pickupCode) {
        adminMessage += ` (Самовывоз, код: ${pickupCode})`;
      }
      
      db.run(
        `INSERT INTO notifications (order_id, user_id, message) VALUES (?, ?, ?)`,
        [orderId, userId, adminMessage],
        function(notifErr) {
          if (notifErr) console.error('Ошибка создания уведомления:', notifErr);
        }
      );
      
      // Создаем уведомление для пользователя
      let userMessage = 'Ваш заказ успешно оформлен! Статус: новый';
      if (pickupCode) {
        userMessage += `\nКод для самовывоза: ${pickupCode}`;
      }
      
      db.run(
        `INSERT INTO notifications (order_id, user_id, message, type) VALUES (?, ?, ?, ?)`,
        [orderId, userId, userMessage, 'user']
      );
      
      res.json({ success: true, orderId: orderId, pickupCode: pickupCode });
    }
  );
});

// Функция расчета примерного времени готовности - РАССЧИТЫВАЕТСЯ ТОЛЬКО ПРИ СТАТУСЕ "В ОБРАБОТКЕ"
function calculateEstimatedTime(orderType, items, baseTime = null) {
  const baseMinutes = 30; // Фиксированные 30 минут для всех заказов
  
  // Используем переданное время или текущее время Таджикистана (UTC+5)
  const now = baseTime || new Date();
  const tajikOffset = 5 * 60 * 60 * 1000; // 5 часов в миллисекундах
  const tajikTime = new Date(now.getTime() + tajikOffset);
  
  // Добавляем 30 минут
  const estimatedTime = new Date(tajikTime.getTime() + baseMinutes * 60000);
  
  // Форматируем время в формате Таджикистана
  const hours = estimatedTime.getHours().toString().padStart(2, '0');
  const minutes = estimatedTime.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes} (через ${baseMinutes} мин)`;
}

// API для получения заказов (только для админа)
app.get('/api/orders', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const status = req.query.status || 'все';
  let query = 'SELECT * FROM orders';
  const params = [];

  if (status !== 'все') {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Ошибка получения заказов:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    
    // Парсим JSON items и добавляем display_status
    const orders = rows.map(row => ({
      ...row,
      items: JSON.parse(row.items),
      display_status: getDisplayStatus(row.status, row.order_type)
    }));
    
    res.json({ orders });
  });
});

// API для обновления статуса заказа (ОБНОВЛЕН - поддержка разных статусов для самовывоза)
app.put('/api/order/:id/status', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const orderId = req.params.id;
  let { status, message } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Статус не указан' });
  }

  // Получаем информацию о заказе для уведомления пользователя
  db.get(
    `SELECT user_id, customer_name, order_type, items FROM orders WHERE id = ?`,
    [orderId],
    (err, order) => {
      if (err || !order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      // Преобразуем статус для хранения в базе
      const statusForStorage = getStorageStatus(status, order.order_type);
      
      // Если статус меняется на "в обработке", рассчитываем время готовки
      let estimatedTime = null;
      
      if (status === 'в обработке' || statusForStorage === 'в обработке') {
        estimatedTime = calculateEstimatedTime(order.order_type, JSON.parse(order.items), new Date());
        console.log(`Рассчитано время готовки для заказа #${orderId}: ${estimatedTime}`);
      }

      // Обновляем заказ с новым estimated_time если статус "в обработке"
      const updateQuery = estimatedTime 
        ? `UPDATE orders SET status = ?, status_updated_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP, estimated_time = ? WHERE id = ?`
        : `UPDATE orders SET status = ?, status_updated_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      
      const updateParams = estimatedTime 
        ? [statusForStorage, estimatedTime, orderId]
        : [statusForStorage, orderId];

      db.run(
        updateQuery,
        updateParams,
        function(err) {
          if (err) {
            console.error('Ошибка обновления статуса:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }
          
          // Записываем в историю трекинга с отображаемым статусом
          const trackingMessage = message || `Статус изменен на "${status}"`;
          db.run(
            `INSERT INTO order_tracking (order_id, user_id, status, message) VALUES (?, ?, ?, ?)`,
            [orderId, order.user_id, statusForStorage, trackingMessage]
          );
          
          // Создаем уведомление об изменении статуса для админа
          const adminMessage = `Статус заказа #${orderId} изменен на "${status}"`;
          db.run(
            `INSERT INTO notifications (order_id, user_id, message) VALUES (?, ?, ?)`,
            [orderId, order.user_id, adminMessage]
          );
          
          // Создаем уведомление для пользователя
          let userMessage = `Статус вашего заказа #${orderId} обновлен: ${status}`;
          if (estimatedTime) {
            userMessage += `. Примерное время готовки: ${estimatedTime}`;
          }
          
          db.run(
            `INSERT INTO notifications (order_id, user_id, message, type) VALUES (?, ?, ?, ?)`,
            [orderId, order.user_id, userMessage, 'user']
          );
          
          // Отправляем WebSocket уведомление пользователю
          if (order.user_id) {
            notifyUser(order.user_id, 'ORDER_STATUS_UPDATED', {
              orderId: orderId,
              status: status,
              display_status: getDisplayStatus(status, order.order_type),
              estimatedTime: estimatedTime,
              message: trackingMessage,
              timestamp: new Date().toISOString()
            });
          }
          
          res.json({ success: true, estimatedTime: estimatedTime, display_status: getDisplayStatus(status, order.order_type) });
        }
      );
    }
  );
});

// API для получения уведомлений
app.get('/api/notifications', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const limit = req.query.limit || 10;
  
  db.all(
    `SELECT n.*, o.customer_name, o.total_price 
     FROM notifications n 
     LEFT JOIN orders o ON n.order_id = o.id 
     WHERE n.type != 'user' OR n.type IS NULL
     ORDER BY n.created_at DESC 
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения уведомлений:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      
      res.json({ notifications: rows });
    }
  );
});

// API для отметки уведомлений как прочитанных
app.put('/api/notifications/read', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  db.run(
    `UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND (type != 'user' OR type IS NULL)`,
    function(err) {
      if (err) {
        console.error('Ошибка обновления уведомлений:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      
      res.json({ success: true, updated: this.changes });
    }
  );
});

// API для статистики (ИСПРАВЛЕН - исключаем отмененные заказы из выручки)
app.get('/api/stats', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const today = new Date().toISOString().split('T')[0];
  
  // Статистика за сегодня (ИСКЛЮЧАЕМ отмененные заказы)
  db.get(
    `SELECT 
      COUNT(*) as total_orders,
      SUM(total_price) as total_revenue,
      AVG(total_price) as avg_order_value
     FROM orders 
     WHERE DATE(created_at) = ? AND status != 'отменен'`,
    [today],
    (err, dailyStats) => {
      if (err) {
        console.error('Ошибка получения статистики:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Статистика по статусам (ВКЛЮЧАЕМ все статусы для диаграммы)
      db.all(
        `SELECT status, COUNT(*) as count 
         FROM orders 
         WHERE DATE(created_at) = ?
         GROUP BY status`,
        [today],
        (err, statusStats) => {
          if (err) {
            console.error('Ошибка получения статистики по статусам:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // Новые заказы сегодня (статус "новый")
          const newOrdersCount = statusStats.find(s => s.status === 'новый')?.count || 0;
          
          // Непрочитанные уведомления
          db.get(
            `SELECT COUNT(*) as unread_notifications 
             FROM notifications 
             WHERE is_read = 0 AND (type != 'user' OR type IS NULL)`,
            (err, notifStats) => {
              if (err) {
                console.error('Ошибка получения статистики уведомлений:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
              }

              // Полная статистика за все время (ИСКЛЮЧАЕМ отмененные)
              db.get(
                `SELECT 
                    COUNT(*) as all_time_orders,
                    SUM(total_price) as all_time_revenue,
                    SUM(CASE WHEN status = 'отменен' THEN 1 ELSE 0 END) as cancelled_orders,
                    SUM(CASE WHEN status = 'отменен' THEN total_price ELSE 0 END) as cancelled_revenue
                 FROM orders`,
                (err, allTimeStats) => {
                  if (err) {
                    console.error('Ошибка получения общей статистики:', err);
                    return res.json({ 
                      daily: dailyStats,
                      byStatus: statusStats,
                      notifications: notifStats,
                      newOrders: { count: newOrdersCount }
                    });
                  }

                  res.json({
                    daily: dailyStats,
                    byStatus: statusStats,
                    notifications: notifStats,
                    newOrders: { count: newOrdersCount },
                    allTime: allTimeStats
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Вход для админа
app.post('/admin/login', (req, res) => {
  const { login, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE login = ? AND role = 'admin'`,
    [login],
    async (err, user) => {
      if (err || !user) {
        return res.json({ success: false, error: 'Неверные учетные данные' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.json({ success: false, error: 'Неверные учетные данные' });
      }

      req.session.user = { 
        id: user.id, 
        login: user.login, 
        phone: user.phone,
        role: user.role 
      };
      
      res.json({ success: true });
    }
  );
});

// Проверка статуса админа
app.get('/api/admin/check', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Выход
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({ success: false, error: 'Пустые данные формы' });
  }

  const { login, phone, password, password_confirm } = req.body;

  if (!login || !phone || !password || password !== password_confirm) {
    return res.json({ success: false, error: 'Неверные данные или пароли не совпадают' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (login, phone, password) VALUES (?, ?, ?)`,
      [login.trim(), phone.trim(), hash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.json({ success: false, error: 'Логин или телефон уже заняты' });
          }
          return res.json({ success: false, error: 'Ошибка сервера' });
        }

        // Автоматический вход после регистрации
        req.session.user = { id: this.lastID, login: login.trim(), phone: phone.trim() };
        res.json({ success: true });
      }
    );
  } catch (e) {
    console.error(e);
    res.json({ success: false, error: 'Ошибка сервера' });
  }
});

// Вход пользователя
app.post('/login', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({ success: false, error: 'Пустые данные формы' });
  }

  const { login: input, password } = req.body;

  if (!input || !password) {
    return res.json({ success: false, error: 'Заполните все поля' });
  }

  db.get(
    `SELECT * FROM users WHERE login = ? OR phone = ?`,
    [input.trim(), input.trim()],
    async (err, user) => {
      if (err) {
        console.error(err);
        return res.json({ success: false, error: 'Ошибка сервера' });
      }
      if (!user) {
        return res.json({ success: false, error: 'Неверный логин/телефон или пароль' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.json({ success: false, error: 'Неверный логин/телефон или пароль' });
      }

      req.session.user = { 
        id: user.id, 
        login: user.login, 
        phone: user.phone,
        role: user.role || 'user'
      };
      res.json({ success: true });
    }
  );
});

// API для проверки статуса входа (для index.html) - ОБНОВЛЕНА С ПРОВЕРКОЙ УДАЛЕНИЯ
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    // Проверяем, существует ли пользователь в БД
    db.get(`SELECT id FROM users WHERE id = ?`, [req.session.user.id], (err, row) => {
      if (err || !row) {
        // Пользователь не существует, уничтожаем сессию
        const userId = req.session.user.id;
        req.session.destroy(() => {
          // Отправляем WebSocket уведомление
          forceLogoutUser(userId, 'account_deleted');
          res.json({ 
            loggedIn: false, 
            reason: 'account_deleted',
            message: 'Ваш аккаунт был удален'
          });
        });
        return;
      }
      
      // Проверяем, не заблокирован ли пользователь
      db.get(`SELECT * FROM blocked_users WHERE user_id = ?`, [req.session.user.id], (err, blocked) => {
        if (err) {
          console.error('Ошибка проверки блокировки:', err);
          return res.json({ loggedIn: true, user: req.session.user });
        }
        
        if (blocked) {
          // Пользователь заблокирован, уничтожаем сессию
          const userId = req.session.user.id;
          req.session.destroy(() => {
            forceLogoutUser(userId, 'account_blocked');
            res.json({ 
              loggedIn: false, 
              reason: 'account_blocked',
              message: 'Ваш аккаунт заблокирован'
            });
          });
          return;
        }
        
        res.json({ loggedIn: true, user: req.session.user });
      });
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Выход из аккаунта
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// API для получения заказа по ID (с учетом типа заказа для отображения статуса)
app.get('/api/order/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const orderId = req.params.id;

  db.get(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId],
    (err, row) => {
      if (err) {
        console.error('Ошибка получения заказа:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      // Парсим JSON items и добавляем display_status
      const order = {
        ...row,
        items: JSON.parse(row.items),
        display_status: getDisplayStatus(row.status, row.order_type)
      };

      res.json({ order });
    }
  );
});

// ================== ОСНОВНЫЕ МАРШРУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЬСКОГО ПРОФИЛЯ ==================

// API для получения заказов пользователя (ОБНОВЛЕН - с трекингом и display_status)
app.get('/api/my-orders', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;

  db.all(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения заказов пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Получаем историю трекинга для каждого заказа
      const ordersPromises = rows.map(row => {
        return new Promise((resolve, reject) => {
          db.all(
            `SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at DESC`,
            [row.id],
            (trackingErr, trackingRows) => {
              if (trackingErr) {
                console.error('Ошибка получения истории трекинга:', trackingErr);
                resolve({
                  ...row,
                  items: JSON.parse(row.items),
                  tracking_history: [],
                  display_status: getDisplayStatus(row.status, row.order_type)
                });
              } else {
                resolve({
                  ...row,
                  items: JSON.parse(row.items),
                  tracking_history: trackingRows,
                  display_status: getDisplayStatus(row.status, row.order_type)
                });
              }
            }
          );
        });
      });

      Promise.all(ordersPromises)
        .then(orders => {
          // Получаем уведомления пользователя
          db.all(
            `SELECT COUNT(*) as unread_count FROM notifications 
             WHERE user_id = ? AND type = 'user' AND is_read = 0`,
            [userId],
            (notifErr, notifRows) => {
              if (notifErr) {
                console.error('Ошибка получения уведомлений:', notifErr);
                res.json({ 
                  orders: orders,
                  stats: {
                    total: orders.length,
                    active: orders.filter(o => ['новый', 'в обработке', 'готовится', 'в пути'].includes(o.status)).length
                  }
                });
              } else {
                res.json({ 
                  orders: orders,
                  stats: {
                    total: orders.length,
                    active: orders.filter(o => ['новый', 'в обработке', 'готовится', 'в пути'].includes(o.status)).length,
                    unread_notifications: notifRows[0].unread_count
                  }
                });
              }
            }
          );
        })
        .catch(error => {
          console.error('Ошибка обработки заказов:', error);
          res.status(500).json({ error: 'Ошибка сервера' });
        });
    }
  );
});

// API для смены пароля пользователя
app.post('/api/change-password', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { oldPassword, newPassword, confirmPassword } = req.body;
  const userId = req.session.user.id;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.json({ success: false, error: 'Заполните все поля' });
  }

  if (newPassword !== confirmPassword) {
    return res.json({ success: false, error: 'Новые пароли не совпадают' });
  }

  if (newPassword.length < 6) {
    return res.json({ success: false, error: 'Пароль должен содержать минимум 6 символов' });
  }

  try {
    // Получаем текущего пользователя
    db.get(
      `SELECT * FROM users WHERE id = ?`,
      [userId],
      async (err, user) => {
        if (err || !user) {
          return res.json({ success: false, error: 'Пользователь не найден' });
        }

        // Проверяем старый пароль
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) {
          return res.json({ success: false, error: 'Неверный старый пароль' });
        }

        // Хешируем новый пароль
        const hash = await bcrypt.hash(newPassword, 10);

        // Обновляем пароль
        db.run(
          `UPDATE users SET password = ? WHERE id = ?`,
          [hash, userId],
          function(err) {
            if (err) {
              console.error('Ошибка обновления пароля:', err);
              return res.json({ success: false, error: 'Ошибка сервера' });
            }

            res.json({ success: true });
          }
        );
      }
    );
  } catch (e) {
    console.error('Ошибка смены пароля:', e);
    res.json({ success: false, error: 'Ошибка сервера' });
  }
});

// API для получения деталей заказа пользователя (ОБНОВЛЕН - с трекингом и display_status)
app.get('/api/my-order/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const orderId = req.params.id;
  const userId = req.session.user.id;

  db.get(
    `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
    [orderId, userId],
    (err, row) => {
      if (err) {
        console.error('Ошибка получения заказа:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      // Получаем историю трекинга
      db.all(
        `SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC`,
        [orderId],
        (trackingErr, trackingRows) => {
          if (trackingErr) {
            console.error('Ошибка получения истории трекинга:', trackingErr);
          }

          const order = {
            ...row,
            items: JSON.parse(row.items),
            tracking_history: trackingRows || [],
            display_status: getDisplayStatus(row.status, row.order_type)
          };

          res.json({ order });
        }
      );
    }
  );
});

// API для удаления уведомления
app.delete('/api/notification/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const notificationId = req.params.id;

  db.run(
    `DELETE FROM notifications WHERE id = ?`,
    [notificationId],
    function(err) {
      if (err) {
        console.error('Ошибка удаления уведомления:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      res.json({ success: true });
    }
  );
});

// API для получения аналитики за период (ИСПРАВЛЕН - исключаем отмененные заказы)
app.get('/api/analytics', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Не указан период' });
  }

  // Общая статистика за период (ИСКЛЮЧАЕМ отмененные заказы)
  db.get(
    `SELECT 
      COUNT(*) as total_orders,
      SUM(total_price) as total_revenue,
      AVG(total_price) as avg_order_value,
      SUM(CASE WHEN status = 'отменен' THEN 1 ELSE 0 END) as cancelled_orders,
      SUM(CASE WHEN status = 'отменен' THEN total_price ELSE 0 END) as cancelled_revenue
     FROM orders 
     WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'отменен'`,
    [startDate, endDate],
    (err, stats) => {
      if (err) {
        console.error('Ошибка получения аналитики:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Продажи по дням (ИСКЛЮЧАЕМ отмененные заказы)
      db.all(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total_price) as daily_revenue
         FROM orders 
         WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'отменен'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [startDate, endDate],
        (err, dailyStats) => {
          if (err) {
            console.error('Ошибка получения ежедневной статистики:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // Популярные товары (ИСКЛЮЧАЕМ отмененные заказы)
          db.all(
            `SELECT items FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'отменен'
             ORDER BY created_at DESC 
             LIMIT 100`,
            [startDate, endDate],
            (err, orderRows) => {
              if (err) {
                console.error('Ошибка получения товаров:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
              }

              // Анализ популярных товаров
              const itemStats = {};
              orderRows.forEach(row => {
                const items = JSON.parse(row.items);
                items.forEach(item => {
                  if (itemStats[item.name]) {
                    itemStats[item.name].quantity += item.quantity;
                    itemStats[item.name].revenue += item.price * item.quantity;
                  } else {
                    itemStats[item.name] = {
                      quantity: item.quantity,
                      revenue: item.price * item.quantity,
                      price: item.price
                    };
                  }
                });
              });

              // Преобразуем в массив и сортируем
              const popularItems = Object.entries(itemStats)
                .map(([name, stats]) => ({ name, ...stats }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

              // Статистика по статусам за период (для диаграммы)
              db.all(
                `SELECT status, COUNT(*) as count 
                 FROM orders 
                 WHERE DATE(created_at) BETWEEN ? AND ?
                 GROUP BY status`,
                [startDate, endDate],
                (err, statusStats) => {
                  if (err) {
                    console.error('Ошибка получения статистики по статусам:', err);
                  }

                  res.json({
                    periodStats: stats,
                    dailyStats: dailyStats,
                    popularItems: popularItems,
                    byStatus: statusStats || []
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// API для получения количества заказов по часам (для графика)
app.get('/api/orders-by-hour', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const today = new Date().toISOString().split('T')[0];

  db.all(
    `SELECT 
      strftime('%H', created_at) as hour,
      COUNT(*) as count
     FROM orders 
     WHERE DATE(created_at) = ?
     GROUP BY strftime('%H', created_at)
     ORDER BY hour`,
    [today],
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения статистики по часам:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Создаем полный массив часов (0-23)
      const hoursData = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        const existing = rows.find(r => r.hour === hour);
        return {
          hour: `${hour}:00`,
          count: existing ? existing.count : 0
        };
      });

      res.json({ hoursData });
    }
  );
});

// ================== НОВЫЕ МАРШРУТЫ ДЛЯ ТРЕКИНГА И УВЕДОМЛЕНИЙ ==================

// API для получения активных заказов для отслеживания
app.get('/api/active-orders', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;
  
  db.all(
    `SELECT * FROM orders 
     WHERE user_id = ? AND status IN ('новый', 'в обработке', 'готовится', 'в пути')
     ORDER BY status_updated_at DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения активных заказов:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      const orders = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items),
        display_status: getDisplayStatus(row.status, row.order_type)
      }));

      res.json({ orders });
    }
  );
});

// API для получения уведомлений пользователя
app.get('/api/user-notifications', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;
  const limit = req.query.limit || 10;

  db.all(
    `SELECT * FROM notifications 
     WHERE user_id = ? AND type = 'user'
     ORDER BY created_at DESC 
     LIMIT ?`,
    [userId, limit],
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения уведомлений пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      res.json({ notifications: rows });
    }
  );
});

// API для отметки уведомлений пользователя как прочитанных
app.put('/api/user-notifications/read', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;

  db.run(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = 'user' AND is_read = 0`,
    function(err) {
      if (err) {
        console.error('Ошибка обновления уведомлений:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Отправляем WebSocket уведомление
      notifyUser(userId, 'NOTIFICATIONS_READ', { count: this.changes });

      res.json({ success: true, updated: this.changes });
    }
  );
});

// API для получения статистики пользователя
app.get('/api/user-stats', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;

  db.get(
    `SELECT 
      COUNT(*) as total_orders,
      SUM(total_price) as total_spent,
      MIN(created_at) as first_order_date
     FROM orders 
     WHERE user_id = ?`,
    [userId],
    (err, stats) => {
      if (err) {
        console.error('Ошибка получения статистики пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Получаем активные заказы
      db.get(
        `SELECT COUNT(*) as active_orders 
         FROM orders 
         WHERE user_id = ? AND status IN ('новый', 'в обработке', 'готовится', 'в пути')`,
        [userId],
        (err, activeStats) => {
          if (err) {
            console.error('Ошибка получения активных заказов:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // Получаем непрочитанные уведомления
          db.get(
            `SELECT COUNT(*) as unread_notifications 
             FROM notifications 
             WHERE user_id = ? AND type = 'user' AND is_read = 0`,
            [userId],
            (err, notifStats) => {
              if (err) {
                console.error('Ошибка получения уведомлений:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
              }

              res.json({
                ...stats,
                ...activeStats,
                ...notifStats,
                member_since: stats.first_order_date ? 
                  new Date(stats.first_order_date).getFullYear() : 
                  new Date().getFullYear()
              });
            }
          );
        }
      );
    }
  );
});

// API для проверки обновлений заказов (для polling)
app.get('/api/check-updates', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const userId = req.session.user.id;
  const lastUpdate = req.query.lastUpdate || new Date(0).toISOString();

  db.all(
    `SELECT o.*, MAX(ot.created_at) as last_tracking_update
     FROM orders o
     LEFT JOIN order_tracking ot ON o.id = ot.order_id
     WHERE o.user_id = ? 
       AND (o.updated_at > ? OR ot.created_at > ?)
     GROUP BY o.id`,
    [userId, lastUpdate, lastUpdate],
    (err, rows) => {
      if (err) {
        console.error('Ошибка проверки обновлений:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      const hasUpdates = rows.length > 0;
      res.json({ 
        hasUpdates, 
        updatedOrders: rows.map(row => ({
          id: row.id,
          status: row.status,
          display_status: getDisplayStatus(row.status, row.order_type),
          lastUpdate: row.last_tracking_update || row.updated_at
        }))
      });
    }
  );
});

// WebSocket endpoint для тестирования
app.get('/ws-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'ws-test.html'));
});

// API для получения оставшегося времени готовки
app.get('/api/order/:id/remaining-time', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const orderId = req.params.id;
  const userId = req.session.user.id;

  db.get(
    `SELECT estimated_time FROM orders 
     WHERE id = ? AND user_id = ?`,
    [orderId, userId],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (!row.estimated_time) {
        return res.json({ remaining: null, message: 'Время готовки еще не установлено' });
      }

      // Парсим время готовки
      const match = row.estimated_time.match(/(\d{2}):(\d{2}) \(через (\d+) мин\)/);
      if (!match) {
        return res.json({ remaining: null, message: 'Некорректный формат времени' });
      }

      const targetHour = parseInt(match[1]);
      const targetMinute = parseInt(match[2]);
      
      // Получаем текущее время Таджикистана (UTC+5)
      const now = new Date();
      const tajikOffset = 5 * 60 * 60 * 1000;
      const tajikTime = new Date(now.getTime() + tajikOffset);
      
      const targetTime = new Date(tajikTime);
      targetTime.setHours(targetHour, targetMinute, 0, 0);
      
      // Если время уже прошло, устанавливаем 0
      let remainingMinutes = Math.max(0, Math.floor((targetTime - tajikTime) / (1000 * 60)));
      
      res.json({
        remaining: remainingMinutes,
        formatted: `${Math.floor(remainingMinutes / 60)}ч ${remainingMinutes % 60}мин`,
        targetTime: `${targetHour}:${targetMinute.toString().padStart(2, '0')}`,
        isOverdue: remainingMinutes === 0
      });
    }
  );
});

// ================== НОВЫЕ МАРШРУТЫ ДЛЯ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ ==================

// API для получения информации о пользователе по ID
app.get('/api/user-info/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const userId = req.params.id;

  db.get(
    `SELECT id, login, phone, role, created_at FROM users WHERE id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error('Ошибка получения информации о пользователе:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      res.json({ user: row });
    }
  );
});

// API для получения статистики пользователя по ID
app.get('/api/user-stats/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const userId = req.params.id;

  db.get(
    `SELECT 
      COUNT(*) as total_orders,
      SUM(total_price) as total_spent
     FROM orders 
     WHERE user_id = ? AND status != 'отменен'`,
    [userId],
    (err, stats) => {
      if (err) {
        console.error('Ошибка получения статистики пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      res.json({
        total_orders: stats.total_orders || 0,
        total_spent: stats.total_spent || 0
      });
    }
  );
});

// ================== ДОПОЛНИТЕЛЬНЫЕ МАРШРУТЫ ДЛЯ КОДА САМОВЫВОЗА ==================

// API для подтверждения кода самовывоза (для админа)
app.post('/api/order/:id/verify-pickup', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const orderId = req.params.id;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Код не указан' });
  }

  db.get(
    `SELECT id, pickup_code, customer_name, order_type FROM orders WHERE id = ?`,
    [orderId],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (row.pickup_code !== code) {
        return res.json({ 
          success: false, 
          error: 'Неверный код',
          message: 'Код самовывоза не совпадает'
        });
      }

      // Обновляем статус на "выдан" (для самовывоза)
      const statusForStorage = 'доставлен'; // В БД храним как "доставлен"
      const displayStatus = 'выдан'; // Для отображения
      
      db.run(
        `UPDATE orders SET status = ?, status_updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [statusForStorage, orderId],
        function(updateErr) {
          if (updateErr) {
            console.error('Ошибка обновления статуса заказа:', updateErr);
            return res.status(500).json({ error: 'Ошибка обновления статуса' });
          }

          // Записываем в историю трекинга
          db.run(
            `INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)`,
            [orderId, statusForStorage, `Код самовывоза ${code} подтвержден. Заказ выдан клиенту.`]
          );

          // Создаем уведомление
          db.run(
            `INSERT INTO notifications (order_id, message) VALUES (?, ?)`,
            [orderId, `Код самовывоза ${code} подтвержден для заказа #${orderId}. Статус: ${displayStatus}`]
          );

          res.json({ 
            success: true, 
            message: 'Код подтвержден! Заказ выдан.',
            customer: row.customer_name,
            display_status: displayStatus
          });
        }
      );
    }
  );
});

// API для получения статистики по самовывозам
app.get('/api/pickup-stats', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const today = new Date().toISOString().split('T')[0];

  db.get(
    `SELECT 
      COUNT(*) as total_pickup_orders,
      SUM(total_price) as pickup_revenue,
      COUNT(CASE WHEN status = 'доставлен' THEN 1 END) as completed_pickups
     FROM orders 
     WHERE DATE(created_at) = ? AND order_type = 'pickup' AND status != 'отменен'`,
    [today],
    (err, stats) => {
      if (err) {
        console.error('Ошибка получения статистики самовывоза:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      // Получаем список последних самовывозов
      db.all(
        `SELECT id, customer_name, pickup_code, status, total_price, created_at 
         FROM orders 
         WHERE order_type = 'pickup' 
         ORDER BY created_at DESC 
         LIMIT 10`,
        (err, rows) => {
          if (err) {
            console.error('Ошибка получения списка самовывозов:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // Добавляем display_status для каждого заказа
          const ordersWithDisplayStatus = rows.map(row => ({
            ...row,
            display_status: getDisplayStatus(row.status, 'pickup')
          }));

          res.json({
            ...stats,
            recentPickups: ordersWithDisplayStatus
          });
        }
      );
    }
  );
});

// ================== ПАНЕЛЬ ВЛАДЕЛЬЦА (SINO) ==================

// Создание таблицы для заблокированных пользователей
db.run(`
  CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    login TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Проверяем и добавляем владельца sino
db.get("SELECT * FROM users WHERE login = 'sino'", async (err, row) => {
  if (err) {
    console.error('Ошибка при проверке владельца:', err);
    return;
  }
  
  if (!row) {
    try {
      const hash = await bcrypt.hash('sino99', 10);
      db.run(
        `INSERT INTO users (login, phone, password, role) VALUES (?, ?, ?, ?)`,
        ['sino', '000000000', hash, 'owner'],
        function(err) {
          if (err) {
            console.error('Ошибка при создании владельца:', err);
          } else {
            console.log('Владелец создан: login: sino, password: sino99');
          }
        }
      );
    } catch (e) {
      console.error('Ошибка хэширования пароля:', e);
    }
  }
});

// Вход в панель владельца
app.post('/sino/login', (req, res) => {
  const { login, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE login = ? AND role = 'owner'`,
    [login],
    async (err, user) => {
      if (err || !user) {
        return res.json({ success: false, error: 'Неверные учетные данные' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.json({ success: false, error: 'Неверные учетные данные' });
      }

      req.session.sino = { 
        id: user.id, 
        login: user.login,
        role: 'owner'
      };
      
      res.json({ success: true });
    }
  );
});

// Проверка статуса владельца
app.get('/api/sino/check', (req, res) => {
  if (req.session.sino && req.session.sino.role === 'owner') {
    res.json({ loggedIn: true, sino: req.session.sino });
  } else {
    res.json({ loggedIn: false });
  }
});

// Получение всех пользователей с паролями (расшифрованными)
app.get('/api/sino/users', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  db.all(`
    SELECT 
      u.id, 
      u.login, 
      u.phone, 
      u.password as hashed_password,
      u.role,
      u.created_at,
      CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as is_blocked,
      b.reason as block_reason,
      b.blocked_at
    FROM users u
    LEFT JOIN blocked_users b ON u.id = b.user_id
    WHERE u.role != 'owner'
    ORDER BY u.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Ошибка получения пользователей:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    res.json({ users: rows });
  });
});

// Блокировка пользователя
app.post('/api/sino/block-user', async (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { userId, reason } = req.body;

  // Получаем информацию о пользователе
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, не заблокирован ли уже
    db.get(`SELECT * FROM blocked_users WHERE user_id = ?`, [userId], (err, blocked) => {
      if (blocked) {
        return res.json({ success: false, error: 'Пользователь уже заблокирован' });
      }

      // Блокируем пользователя
      db.run(
        `INSERT INTO blocked_users (user_id, login, phone, reason) VALUES (?, ?, ?, ?)`,
        [userId, user.login, user.phone, reason || 'Блокировка администратором'],
        function(err) {
          if (err) {
            console.error('Ошибка блокировки пользователя:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // ПРИНУДИТЕЛЬНЫЙ ВЫХОД ПОЛЬЗОВАТЕЛЯ
          const forcedLogout = forceLogoutUser(userId, 'account_blocked');

          res.json({ 
            success: true, 
            message: 'Пользователь заблокирован и выгнан из системы',
            forcedLogout: forcedLogout,
            blockId: this.lastID
          });
        }
      );
    });
  });
});

// Разблокировка пользователя
app.post('/api/sino/unblock-user', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { userId } = req.body;

  db.run(
    `DELETE FROM blocked_users WHERE user_id = ?`,
    [userId],
    function(err) {
      if (err) {
        console.error('Ошибка разблокировки пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      res.json({ 
        success: true, 
        message: 'Пользователь разблокирован',
        changes: this.changes
      });
    }
  );
});

// Удаление пользователя (ОБНОВЛЕНО С ПРИНУДИТЕЛЬНЫМ ВЫХОДОМ)
app.post('/api/sino/delete-user', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { userId } = req.body;

  // ПРИНУДИТЕЛЬНЫЙ ВЫХОД ПОЛЬЗОВАТЕЛЯ ПЕРЕД УДАЛЕНИЕМ
  const forcedLogout = forceLogoutUser(userId, 'account_deleted');

  // Начинаем транзакцию
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Удаляем уведомления пользователя
    db.run(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
    
    // 2. Удаляем историю трекинга заказов пользователя
    db.run(`DELETE FROM order_tracking WHERE user_id = ?`, [userId]);
    
    // 3. Удаляем заказы пользователя
    db.run(`DELETE FROM orders WHERE user_id = ?`, [userId]);
    
    // 4. Удаляем из заблокированных (если есть)
    db.run(`DELETE FROM blocked_users WHERE user_id = ?`, [userId]);
    
    // 5. Удаляем самого пользователя
    db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
      if (err) {
        db.run('ROLLBACK');
        console.error('Ошибка удаления пользователя:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      db.run('COMMIT', (commitErr) => {
        if (commitErr) {
          console.error('Ошибка коммита транзакции:', commitErr);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        res.json({ 
          success: true, 
          message: 'Пользователь полностью удален и выгнан из системы',
          forcedLogout: forcedLogout,
          changes: this.changes
        });
      });
    });
  });
});

// Получение всех заказов
app.get('/api/sino/all-orders', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { limit = 50, offset = 0, status } = req.query;
  let query = `
    SELECT o.*, u.login as customer_login, u.phone as customer_phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
  `;
  const params = [];

  if (status && status !== 'все') {
    query += ' WHERE o.status = ?';
    params.push(status);
  }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Ошибка получения заказов:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    // Получаем общее количество для пагинации
    let countQuery = 'SELECT COUNT(*) as total FROM orders';
    if (status && status !== 'все') {
      countQuery += ' WHERE status = ?';
    }

    db.get(countQuery, status && status !== 'все' ? [status] : [], (countErr, countRow) => {
      if (countErr) {
        console.error('Ошибка получения количества заказов:', countErr);
      }

      const orders = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items),
        display_status: getDisplayStatus(row.status, row.order_type)
      }));

      res.json({ 
        orders, 
        total: countRow ? countRow.total : rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

// Получение статистики выручки
app.get('/api/sino/stats', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }

  const { period = 'today' } = req.query; // today, week, month, year, all
  let dateCondition = '';
  let params = [];

  const now = new Date();
  switch(period) {
    case 'today':
      const today = now.toISOString().split('T')[0];
      dateCondition = 'DATE(created_at) = ?';
      params = [today];
      break;
    case 'week':
      dateCondition = 'created_at >= date("now", "-7 days")';
      break;
    case 'month':
      dateCondition = 'created_at >= date("now", "-30 days")';
      break;
    case 'year':
      dateCondition = 'created_at >= date("now", "-365 days")';
      break;
    case 'all':
    default:
      dateCondition = '1=1';
      break;
  }

  // Основная статистика (исключаем отмененные заказы)
  db.get(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total_price) as total_revenue,
      AVG(total_price) as avg_order,
      MIN(total_price) as min_order,
      MAX(total_price) as max_order,
      COUNT(DISTINCT user_id) as unique_customers
    FROM orders 
    WHERE ${dateCondition} AND status != 'отменен'
  `, params, (err, stats) => {
    if (err) {
      console.error('Ошибка получения статистики:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    // Статистика по дням (последние 30 дней)
    db.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders_count,
        SUM(total_price) as daily_revenue
      FROM orders 
      WHERE created_at >= date("now", "-30 days") AND status != 'отменен'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, (err, dailyStats) => {
      if (err) {
        console.error('Ошибка получения ежедневной статистики:', err);
      }

      // Статистика по типам заказов
      db.all(`
        SELECT 
          order_type,
          COUNT(*) as count,
          SUM(total_price) as revenue
        FROM orders 
        WHERE ${dateCondition} AND status != 'отменен'
        GROUP BY order_type
      `, params, (err, typeStats) => {
        if (err) {
          console.error('Ошибка получения статистики по типам:', err);
        }

        // Статистика по статусам
        db.all(`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(total_price) as revenue
          FROM orders 
          WHERE ${dateCondition}
          GROUP BY status
        `, params, (err, statusStats) => {
          if (err) {
            console.error('Ошибка получения статистики по статусам:', err);
          }

          res.json({
            period: period,
            stats: stats,
            dailyStats: dailyStats || [],
            typeStats: typeStats || [],
            statusStats: statusStats || []
          });
        });
      });
    });
  });
});

// Обновленный маршрут регистрации с проверкой блокировки
app.post('/register', async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({ success: false, error: 'Пустые данные формы' });
  }

  const { login, phone, password, password_confirm } = req.body;

  if (!login || !phone || !password || password !== password_confirm) {
    return res.json({ success: false, error: 'Неверные данные или пароли не совпадают' });
  }

  // Проверяем, не заблокирован ли пользователь
  db.get(
    `SELECT * FROM blocked_users WHERE login = ? OR phone = ?`,
    [login.trim(), phone.trim()],
    async (err, blocked) => {
      if (err) {
        return res.json({ success: false, error: 'Ошибка сервера' });
      }

      if (blocked) {
        return res.json({ 
          success: false, 
          error: 'Этот логин или телефон заблокирован. Регистрация невозможна.' 
        });
      }

      try {
        const hash = await bcrypt.hash(password, 10);

        db.run(
          `INSERT INTO users (login, phone, password) VALUES (?, ?, ?)`,
          [login.trim(), phone.trim(), hash],
          function (err) {
            if (err) {
              if (err.message.includes('UNIQUE')) {
                return res.json({ success: false, error: 'Логин или телефон уже заняты' });
              }
              return res.json({ success: false, error: 'Ошибка сервера' });
            }

            req.session.user = { id: this.lastID, login: login.trim(), phone: phone.trim() };
            res.json({ success: true });
          }
        );
      } catch (e) {
        console.error(e);
        res.json({ success: false, error: 'Ошибка сервера' });
      }
    }
  );
});

// Обновленный маршрут входа с проверкой блокировки
app.post('/login', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({ success: false, error: 'Пустые данные формы' });
  }

  const { login: input, password } = req.body;

  if (!input || !password) {
    return res.json({ success: false, error: 'Заполните все поля' });
  }

  // Проверяем, не заблокирован ли пользователь
  db.get(
    `SELECT * FROM blocked_users WHERE login = ? OR phone = ?`,
    [input.trim(), input.trim()],
    async (err, blocked) => {
      if (err) {
        console.error(err);
        return res.json({ success: false, error: 'Ошибка сервера' });
      }

      if (blocked) {
        return res.json({ 
          success: false, 
          error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' 
        });
      }

      db.get(
        `SELECT * FROM users WHERE login = ? OR phone = ?`,
        [input.trim(), input.trim()],
        async (err, user) => {
          if (err) {
            console.error(err);
            return res.json({ success: false, error: 'Ошибка сервера' });
          }
          if (!user) {
            return res.json({ success: false, error: 'Неверный логин/телефон или пароль' });
          }

          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            return res.json({ success: false, error: 'Неверный логин/телефон или пароль' });
          }

          req.session.user = { 
            id: user.id, 
            login: user.login, 
            phone: user.phone,
            role: user.role || 'user'
          };
          res.json({ success: true });
        }
      );
    }
  );
});

// Выход из панели владельца
app.get('/sino/logout', (req, res) => {
  req.session.sino = null;
  res.redirect('/sino-login.html');
});

// Статические файлы для панели владельца
app.get('/sino-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'sino-login.html'));
});

app.get('/sino.html', (req, res) => {
  if (!req.session.sino || req.session.sino.role !== 'owner') {
    return res.redirect('/sino-login.html');
  }
  res.sendFile(path.join(__dirname, 'sino.html'));
});

// ================== МИГРАЦИЯ СУЩЕСТВУЮЩИХ ДАННЫХ ==================

// Функция для миграции существующих статусов самовывоза
function migratePickupStatuses() {
  console.log('Начинаем миграцию статусов самовывоза...');
  
  db.all(
    `SELECT id, status, order_type FROM orders WHERE order_type = 'pickup'`,
    (err, rows) => {
      if (err) {
        console.error('Ошибка получения заказов для миграции:', err);
        return;
      }
      
      console.log(`Найдено ${rows.length} заказов самовывоза для миграции`);
      
      rows.forEach(row => {
        // Проверяем, нужно ли мигрировать
        const displayStatus = getDisplayStatus(row.status, 'pickup');
        
        if (displayStatus !== row.status) {
          console.log(`Заказ ${row.id}: ${row.status} -> ${displayStatus} (отображение)`);
        }
      });
      
      console.log('Миграция статусов самовывоза завершена');
    }
  );
}

// Вызываем миграцию при запуске сервера (опционально)
// migratePickupStatuses();

// Запуск сервера
server.listen(PORT, () => {
  
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`WebSocket сервер: ws://localhost:${PORT}`);
  
});