document.addEventListener("DOMContentLoaded", function() {
  // Изменение шапки при скролле
  const header = document.querySelector(".header");

  function checkScroll() {
    if (window.scrollY > 100) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }

  checkScroll();
  window.addEventListener("scroll", checkScroll);

  // Табы меню и фильтрация по категориям
  const menuTabs = document.querySelectorAll(".menu-tab");
  const menuItems = document.querySelectorAll(".menu-item");

  function animateItems(items) {
    items.forEach((item, index) => {
      setTimeout(() => {
        item.classList.add("show");
      }, index * 50);
    });
  }

  function filterMenu(category) {
    menuItems.forEach(item => {
      item.classList.remove("show");
      setTimeout(() => {
        item.style.display = "none";
      }, 300);
    });

    setTimeout(() => {
      let itemsToShow = [];

      if (category === "Все" || category === "All" || category === "Ҳама" || category === "所有") {
        itemsToShow = Array.from(menuItems);
      } else {
        itemsToShow = Array.from(menuItems).filter(item => {
          const itemCategory = item.querySelector(".menu-item-category").textContent.trim();
          return itemCategory === category ||
                 (category === "Хот-доги" && itemCategory.includes("хот дог")) ||
                 (category === "Hot Dogs" && itemCategory.includes("Hot Dog")) ||
                 (category === "Хот-догҳо" && itemCategory.includes("Хот-дог")) ||
                 (category === "热狗" && itemCategory.includes("热狗")) ||
                 (category === "Соусы" && itemCategory.includes("соус")) ||
                 (category === "Sauces" && itemCategory.includes("Sauce")) ||
                 (category === "Соусҳо" && itemCategory.includes("Соус")) ||
                 (category === "酱汁" && itemCategory.includes("酱"));
        });
      }

      itemsToShow.forEach(item => {
        item.style.display = "block";
      });

      animateItems(itemsToShow);
    }, 300);
  }

  menuTabs.forEach(tab => {
    tab.addEventListener("click", function() {
      menuTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");

      const category = this.textContent.trim();
      filterMenu(category);
    });
  });

  setTimeout(() => {
    menuItems.forEach(item => {
      item.style.display = "block";
    });
    animateItems(menuItems);
  }, 300);

  // Плавная прокрутка
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      e.preventDefault();
      if (this.getAttribute("href") === "#") return;

      const targetElement = document.querySelector(this.getAttribute("href"));
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: "smooth"
        });
      }
    });
  });

  // Корзина
  const cartModal = document.getElementById("cartModal");
  const cartItemsContainer = document.getElementById("cartItems");
  const cartTotalPrice = document.getElementById("cartTotalPrice");
  const orderTotal = document.getElementById("orderTotal");
  const closeModal = document.querySelector(".close-modal");
  const cartIcon = document.querySelectorAll(".cart-icon");
  const cartCount = document.querySelector(".cart-count");
  const checkoutForm = document.getElementById("checkoutForm");
  const orderTypeBtns = document.querySelectorAll(".order-type-btn");
  const addressGroup = document.getElementById("addressGroup");
  const pickupGroup = document.getElementById("pickupGroup");
  const paymentMethods = document.querySelectorAll(".payment-method");
  const submitOrder = document.getElementById("submitOrder");

  let cart = [];
  let totalPrice = 0;
  let orderType = "delivery";
  let paymentMethod = "cash";
  const deliveryCost = 10; // Стоимость доставки 10 TJS
  let currentUser = null;

  // Проверка авторизации
  async function checkAuth() {
    try {
      const response = await fetch('/api/me');
      const data = await response.json();
      currentUser = data.loggedIn ? data.user : null;
      
      // Обновляем кнопку входа/профиля
      const loginButton = document.getElementById('loginButton');
      if (loginButton) {
        if (currentUser) {
          loginButton.href = 'profil.html';
          const textSpan = loginButton.querySelector('.login-text');
          if (textSpan) {
            textSpan.textContent = currentUser.login || 'Профиль';
          }
        } else {
          loginButton.href = 'login.html';
          const textSpan = loginButton.querySelector('.login-text');
          if (textSpan) {
            const currentLang = document.documentElement.lang || 'ru';
            const loginText = {
              ru: 'Вход',
              en: 'Login',
              tg: 'Даромад',
              zh: '登录'
            }[currentLang] || 'Вход';
            textSpan.textContent = loginText;
          }
        }
      }
      
      return data.loggedIn;
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
      currentUser = null;
      return false;
    }
  }

  // Показываем уведомление о необходимости авторизации
  function showAuthRequiredNotification() {
    const currentLang = document.documentElement.lang || 'ru';
    
    const messages = {
      ru: {
        title: 'Требуется авторизация',
        text: 'Для оформления заказа необходимо войти в аккаунт или зарегистрироваться.',
        login: 'Войти',
        register: 'Зарегистрироваться',
        cancel: 'Отмена'
      },
      en: {
        title: 'Authorization Required',
        text: 'To place an order, you need to log in or register.',
        login: 'Log in',
        register: 'Register',
        cancel: 'Cancel'
      },
      tg: {
        title: 'Авторизасия талаб карда мешавад',
        text: 'Барои тасдиқи фармоиш, ба аккаунт ворид шудан ё ба қайд гирифтан зарур аст.',
        login: 'Даромад',
        register: 'Ба қайд гирифтан',
        cancel: 'Бекор кардан'
      },
      zh: {
        title: '需要授权',
        text: '要下订单，您需要登录或注册。',
        login: '登录',
        register: '注册',
        cancel: '取消'
      }
    };
    
    const msg = messages[currentLang] || messages.ru;
    
    // Создаем модальное окно для авторизации
    const authModal = document.createElement('div');
    authModal.className = 'auth-required-modal';
    authModal.innerHTML = `
      <div class="auth-modal-content">
        <div class="auth-modal-header">
          <h3>${msg.title}</h3>
          <span class="close-auth-modal">&times;</span>
        </div>
        <div class="auth-modal-body">
          <p>${msg.text}</p>
          <div class="auth-modal-buttons">
            <a href="login.html" class="btn btn-primary auth-btn">${msg.login}</a>
            <a href="register.html" class="btn btn-secondary auth-btn">${msg.register}</a>
            <button class="btn btn-outline auth-cancel">${msg.cancel}</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(authModal);
    document.body.style.overflow = 'hidden';
    
    // Обработчики закрытия модального окна
    const closeBtn = authModal.querySelector('.close-auth-modal');
    const cancelBtn = authModal.querySelector('.auth-cancel');
    
    function closeModal() {
      authModal.remove();
      document.body.style.overflow = 'auto';
    }
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    authModal.addEventListener('click', function(e) {
      if (e.target === authModal) {
        closeModal();
      }
    });
  }

  // Обработчик для неавторизованного доступа к заказу
  function handleUnauthorizedAccess(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    showAuthRequiredNotification();
  }

  // Проверяем авторизацию при загрузке
  checkAuth();

  // Добавляем нового адреса самовывоза в селектор
  const pickupLocationSelect = document.getElementById("pickupLocation");
  if (pickupLocationSelect) {
    // Проверяем, есть ли уже этот адрес
    const existingOption = Array.from(pickupLocationSelect.options).find(
      option => option.value === "Руба руи мехру мухаббат пиццерия"
    );
    
    if (!existingOption) {
      const newOption = document.createElement("option");
      newOption.value = "Руба руи мехру мухаббат пиццерия";
      newOption.textContent = "Руба руи мехру мухаббат пиццерия";
      newOption.setAttribute("data-translate", "pickup-option3");
      pickupLocationSelect.appendChild(newOption);
    }
  }

  // Обработчики для открытия корзины с проверкой авторизации
  cartIcon.forEach(icon => {
    icon.addEventListener("click", async function(e) {
      e.preventDefault();
      
      // Проверяем авторизацию перед открытием корзины
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        handleUnauthorizedAccess(e);
        return;
      }
      
      updateCartModal();
      cartModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    });
  });

  if (closeModal) {
    closeModal.addEventListener("click", function() {
      cartModal.style.display = "none";
      document.body.style.overflow = "auto";
    });
  }

  if (cartModal) {
    window.addEventListener("click", function(e) {
      if (e.target === cartModal) {
        cartModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }

  // Выбор типа заказа
  orderTypeBtns.forEach(btn => {
    btn.addEventListener("click", function() {
      orderTypeBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      orderType = this.dataset.type;

      if (orderType === "delivery") {
        addressGroup.style.display = "block";
        pickupGroup.style.display = "none";
      } else {
        addressGroup.style.display = "none";
        pickupGroup.style.display = "block";
      }
      
      // Обновляем корзину при изменении типа заказа
      updateCartModal();
    });
  });

  // Выбор способа оплаты
  paymentMethods.forEach(method => {
    method.addEventListener("click", function() {
      paymentMethods.forEach(m => m.classList.remove("active"));
      this.classList.add("active");
      paymentMethod = this.dataset.method;
    });
  });

  // Обновление корзины в модальном окне
  function updateCartModal() {
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = "";
    let itemsTotal = 0; // Сумма только товаров без доставки
    totalPrice = 0; // Общая сумма с учетом доставки

    if (cart.length === 0) {
      // Получаем текст в зависимости от текущего языка
      const currentLang = document.documentElement.lang || 'ru';
      const emptyCartText = {
        ru: "Ваша корзина пуста",
        en: "Your cart is empty",
        tg: "Корзинаи шумо холӣ",
        zh: "您的购物车是空的"
      }[currentLang] || "Ваша корзина пуста";
      
      cartItemsContainer.innerHTML = `<div class="empty-cart">${emptyCartText}</div>`;
      if (cartTotalPrice) cartTotalPrice.textContent = "0 TJS";
      if (orderTotal) orderTotal.textContent = "0 TJS";
      if (submitOrder) submitOrder.disabled = true;
      return;
    }

    cart.forEach((item, index) => {
      const cartItemElement = document.createElement("div");
      cartItemElement.className = "cart-item";
      cartItemElement.innerHTML = `
        <div class="cart-item-image-container">
          <img src="${item.img}" alt="${item.name}" class="cart-item-image">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${item.price} TJS</div>
        </div>
        <div class="cart-item-quantity">
          <button class="quantity-btn minus" data-index="${index}">-</button>
          <span class="quantity-value">${item.quantity}</span>
          <button class="quantity-btn plus" data-index="${index}">+</button>
        </div>
        <div class="remove-item" data-index="${index}">
          <i class="fas fa-trash"></i>
        </div>
      `;
      cartItemsContainer.appendChild(cartItemElement);
      itemsTotal += item.price * item.quantity;
    });

    // Добавляем стоимость доставки, если выбран тип "доставка"
    if (orderType === "delivery" && cart.length > 0) {
      const deliveryElement = document.createElement("div");
      deliveryElement.className = "cart-item delivery-item";
      deliveryElement.innerHTML = `
        <div class="cart-item-image-container">
          <div style="width: 40px; height: 40px; background: #f5f5f5; border-radius: 5px; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-shipping-fast" style="color: #e74c3c;"></i>
          </div>
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">Доставка</div>
          <div class="cart-item-price">${deliveryCost} TJS</div>
        </div>
        <div class="cart-item-quantity">
          <span class="quantity-value">1</span>
        </div>
        <div></div>
      `;
      cartItemsContainer.appendChild(deliveryElement);
      totalPrice = itemsTotal + deliveryCost;
    } else {
      totalPrice = itemsTotal;
    }

    if (cartTotalPrice) cartTotalPrice.textContent = `${totalPrice} TJS`;
    if (orderTotal) orderTotal.textContent = `${totalPrice} TJS`;
    if (submitOrder) submitOrder.disabled = false;

    document.querySelectorAll(".quantity-btn.minus").forEach(btn => {
      btn.addEventListener("click", function() {
        const index = parseInt(this.dataset.index);
        if (cart[index].quantity > 1) {
          cart[index].quantity--;
          showToast(`Уменьшено количество "${cart[index].name}"`);
        } else {
          const removedItem = cart[index].name;
          cart.splice(index, 1);
          showToast(`Удалено "${removedItem}" из корзины`);
        }
        updateCart();
      });
    });

    document.querySelectorAll(".quantity-btn.plus").forEach(btn => {
      btn.addEventListener("click", function() {
        const index = parseInt(this.dataset.index);
        cart[index].quantity++;
        showToast(`Увеличено количество "${cart[index].name}"`);
        updateCart();
      });
    });

    document.querySelectorAll(".remove-item").forEach(btn => {
      btn.addEventListener("click", function() {
        const index = parseInt(this.dataset.index);
        const removedItem = cart[index].name;
        cart.splice(index, 1);
        showToast(`Удалено "${removedItem}" из корзины`);
        updateCart();
      });
    });
  }

  function updateCart() {
    let count = 0;
    cart.forEach(item => {
      count += item.quantity;
    });

    if (cartCount) cartCount.textContent = count;
    updateCartModal();
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  function loadCart() {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      cart = JSON.parse(savedCart);
      updateCart();
    }
  }

  function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === "success" ? "check" : type === "error" ? "times" : "exclamation"}"></i>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Функция для показа уведомления с кодом самовывоза
  function showPickupCodeNotification(pickupCode, orderId) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const currentLang = document.documentElement.lang || 'ru';
    const messages = {
      ru: {
        title: 'Код самовывоза',
        instruction: 'Покажите этот код при получении заказа',
        copy: 'Копировать',
        copied: 'Скопировано!'
      },
      en: {
        title: 'Pickup Code',
        instruction: 'Show this code when picking up your order',
        copy: 'Copy',
        copied: 'Copied!'
      },
      tg: {
        title: 'Рамзи гирифтан',
        instruction: 'Ин рамзро ҳангоми гирифтани фармоиш нишон диҳед',
        copy: 'Нусхабардорӣ',
        copied: 'Нусхабардорӣ шуд!'
      },
      zh: {
        title: '取货代码',
        instruction: '取货时出示此代码',
        copy: '复制',
        copied: '已复制！'
      }
    };
    
    const msg = messages[currentLang] || messages.ru;
    
    const toast = document.createElement("div");
    toast.className = "toast success with-pickup-code";
    toast.innerHTML = `
      <div class="pickup-code-header">
        <i class="fas fa-qrcode"></i>
        <span>${msg.title}</span>
      </div>
      <div class="pickup-code-display" id="pickup-code-${orderId}">
        ${pickupCode}
      </div>
      <p class="pickup-code-instruction">${msg.instruction}</p>
      <div class="pickup-code-actions">
        <button class="copy-pickup-code-btn" onclick="copyPickupCode('${pickupCode}', ${orderId})">
          <i class="fas fa-copy"></i> ${msg.copy}
        </button>
        <button class="view-qr-code-btn" onclick="showQRCode('${pickupCode}')">
          <i class="fas fa-qrcode"></i> QR
        </button>
      </div>
      <small class="order-id">Заказ #${orderId}</small>
    `;
    
    toastContainer.appendChild(toast);
    
    // Добавляем стили для уведомления с кодом, если их еще нет
    if (!document.querySelector('#pickup-code-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'pickup-code-toast-styles';
      style.textContent = `
        .toast.with-pickup-code {
          max-width: 350px;
          padding: 20px;
          text-align: center;
        }
        
        .pickup-code-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 15px;
          font-size: 1.2rem;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .pickup-code-display {
          font-size: 2.5rem;
          font-weight: bold;
          color: #e74c3c;
          background: #ffe6e6;
          padding: 15px;
          border-radius: 10px;
          margin: 15px 0;
          font-family: 'Courier New', monospace;
          letter-spacing: 8px;
          text-align: center;
          border: 2px dashed #e74c3c;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        .pickup-code-instruction {
          font-size: 0.9rem;
          color: #666;
          margin: 10px 0 15px 0;
        }
        
        .pickup-code-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-bottom: 10px;
        }
        
        .copy-pickup-code-btn, .view-qr-code-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: background 0.3s;
        }
        
        .copy-pickup-code-btn:hover, .view-qr-code-btn:hover {
          background: #2980b9;
        }
        
        .view-qr-code-btn {
          background: #27ae60;
        }
        
        .view-qr-code-btn:hover {
          background: #219653;
        }
        
        .order-id {
          display: block;
          color: #95a5a6;
          font-size: 0.8rem;
          margin-top: 10px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Удаляем уведомление через 10 секунд
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 10000);
  }

  // Глобальные функции для работы с кодом самовывоза
  window.copyPickupCode = function(code, orderId) {
    navigator.clipboard.writeText(code).then(() => {
      const element = document.getElementById(`pickup-code-${orderId}`);
      if (element) {
        const originalText = element.textContent;
        const originalBg = element.style.background;
        const originalColor = element.style.color;
        
        element.textContent = 'Скопировано!';
        element.style.background = '#27ae60';
        element.style.color = 'white';
        
        setTimeout(() => {
          element.textContent = originalText;
          element.style.background = originalBg;
          element.style.color = originalColor;
        }, 2000);
      }
      
      // Показываем маленькое уведомление о копировании
      showToast('Код скопирован в буфер обмена', 'success');
    }).catch(err => {
      console.error('Ошибка копирования:', err);
      showToast('Ошибка копирования', 'error');
    });
  };

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
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // В реальном проекте можно использовать библиотеку qrcode.js
    // Сейчас создадим простой визуальный QR-код с помощью текста
    const qrText = generateTextQR(code);
    
    qrModal.innerHTML = `
      <div class="qr-modal-container" style="
        background: white;
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 320px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      ">
        <h3 style="color: #2c3e50; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
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
          letter-spacing: 8px;
          margin: 20px 0;
          border: 2px solid #e74c3c;
        ">
          ${code}
        </div>
        
        <div style="
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 25px;
          line-height: 1.5;
        ">
          <i class="fas fa-info-circle" style="color: #3498db;"></i>
          Покажите этот код или QR-код при получении заказа
        </div>
        
        <div style="margin: 20px 0;">
          <pre style="
            font-family: 'Courier New', monospace;
            font-size: 0.7rem;
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            text-align: left;
            overflow: auto;
            max-height: 200px;
            color: #333;
          ">
${qrText}</pre>
        </div>
        
        <button onclick="this.closest('.qr-modal-overlay').remove()" style="
          background: #e74c3c;
          color: white;
          border: none;
          padding: 12px 25px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: bold;
          width: 100%;
          transition: background 0.3s;
        " onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">
          <i class="fas fa-times"></i> Закрыть
        </button>
      </div>
    `;
    
    document.body.appendChild(qrModal);
    
    // Закрытие при клике вне окна
    qrModal.addEventListener('click', function(e) {
      if (e.target === qrModal) {
        qrModal.remove();
      }
    });
    
    // Закрытие при нажатии ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.querySelector('.qr-modal-overlay')) {
        qrModal.remove();
      }
    });
  };

  // Функция для генерации текстового QR-кода (упрощенная)
  function generateTextQR(code) {
    // Простая визуализация QR-кода с помощью символов
    const qrLines = [];
    
    // Верхняя граница
    qrLines.push("╔══════════════════════════════════╗");
    
    // Центральная часть с кодом
    const spaces = Math.max(0, 34 - code.length - 4);
    const leftSpaces = Math.floor(spaces / 2);
    const rightSpaces = spaces - leftSpaces;
    
    qrLines.push(`║${' '.repeat(leftSpaces)}[ ${code} ]${' '.repeat(rightSpaces)}║`);
    
    // Разделитель
    qrLines.push("╠══════════════════════════════════╣");
    
    // Инструкция
    qrLines.push("║       КОД ДЛЯ САМОВЫВОЗА        ║");
    qrLines.push("║                                  ║");
    qrLines.push("║   Покажите этот код при         ║");
    qrLines.push("║   получении вашего заказа       ║");
    qrLines.push("║                                  ║");
    qrLines.push("║   Сохраните код до получения    ║");
    
    // Нижняя граница
    qrLines.push("╚══════════════════════════════════╝");
    
    return qrLines.join('\n');
  }

  function getPaymentMethodName(method) {
    const currentLang = document.documentElement.lang || 'ru';
    
    if (currentLang === 'en') {
      switch(method) {
        case "cash": return "Cash";
        case "ds": return "Dushanbe City";
        case "alif": return "Alif";
        default: return "Unknown";
      }
    } else if (currentLang === 'tg') {
      switch(method) {
        case "cash": return "Нақд";
        case "ds": return "Душанбе Сити";
        case "alif": return "Алиф";
        default: return "Номаълум";
      }
    } else if (currentLang === 'zh') {
      switch(method) {
        case "cash": return "现金";
        case "ds": return "杜尚别城市";
        case "alif": return "阿里夫";
        default: return "未知";
      }
    } else {
      switch(method) {
        case "cash": return "Наличные";
        case "ds": return "Душанбе Сити";
        case "alif": return "Алиф";
        default: return "Неизвестно";
      }
    }
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      // Проверка авторизации перед оформлением заказа
      if (!currentUser) {
        handleUnauthorizedAccess(e);
        return;
      }
      
      // Валидация телефона
      const phoneInput = document.getElementById("phone");
      if (!phoneInput.checkValidity()) {
        const currentLang = document.documentElement.lang || 'ru';
        const errorText = {
          ru: "Пожалуйста, введите корректный номер телефона (9 цифр)",
          en: "Please enter a valid phone number (9 digits)",
          tg: "Лутфан рақами телефони дурустро ворид кунед (9 рақам)",
          zh: "请输入有效的电话号码（9位数字）"
        }[currentLang] || "Пожалуйста, введите корректный номер телефона (9 цифр)";
        
        showToast(errorText, "error");
        phoneInput.focus();
        return;
      }

      const name = document.getElementById("name").value;
      const phone = "+992" + document.getElementById("phone").value;
      const address = orderType === "delivery" 
        ? document.getElementById("address").value 
        : document.getElementById("pickupLocation").value;
      const comments = document.getElementById("comments").value;

      // Проверяем, есть ли товары в корзине
      if (cart.length === 0) {
        const currentLang = document.documentElement.lang || 'ru';
        const errorText = {
          ru: "Ваша корзина пуста. Добавьте товары перед оформлением заказа.",
          en: "Your cart is empty. Add items before placing an order.",
          tg: "Корзинаи шумо холӣ аст. Пеш аз тасдиқи фармоиш маҳсулот илова кунед.",
          zh: "您的购物车是空的。在下单前添加商品。"
        }[currentLang];
        
        showToast(errorText, "error");
        return;
      }

      // Подготавливаем данные заказа для нашей БД
      const orderData = {
        customer_name: name,
        customer_phone: phone,
        order_type: orderType,
        address: address,
        payment_method: paymentMethod,
        comments: comments || "",
        items: cart,
        total_price: totalPrice
      };

      // Подготавливаем сообщение для Telegram
      let message = `Новый заказ из SaFar:\n\n`;
      message += `Имя: ${name}\nТелефон: ${phone}\nТип заказа: ${orderType === "delivery" ? "Доставка" : "Самовывоз"}\nАдрес: ${address}\nСпособ оплаты: ${getPaymentMethodName(paymentMethod)}\nКомментарий: ${comments || "нет"}\n\nЗаказ:\n`;

      cart.forEach(item => {
        message += `${item.name} - ${item.quantity} x ${item.price} TJS = ${item.quantity * item.price} TJS\n`;
      });

      // Добавляем стоимость доставки в сообщение
      if (orderType === "delivery" && cart.length > 0) {
        message += `Доставка: ${deliveryCost} TJS\n`;
        message += `\nИтого: ${totalPrice} TJS (включая доставку)`;
      } else {
        message += `\nИтого: ${totalPrice} TJS`;
      }

      // Показываем уведомление о начале оформления
      const currentLang = document.documentElement.lang || 'ru';
      const processingText = {
        ru: "Оформляем ваш заказ...",
        en: "Processing your order...",
        tg: "Фармоиши шумо кор карда истодааст...",
        zh: "正在处理您的订单..."
      }[currentLang];
      
      showToast(processingText, "warning");

      try {
        // Шаг 1: Сохраняем заказ в нашу базу данных
        const orderResponse = await fetch('/api/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData)
        });

        const orderResult = await orderResponse.json();

        if (!orderResult.success) {
          // Проверяем, не связана ли ошибка с авторизацией
          if (orderResult.error === 'Требуется авторизация' || orderResponse.status === 401) {
            handleUnauthorizedAccess();
            return;
          }
          throw new Error(orderResult.error || 'Ошибка сохранения заказа');
        }

        console.log('Заказ сохранен в БД с ID:', orderResult.orderId);

        // Шаг 2: Отправляем уведомление в Telegram
        const botToken = "8491592583:AAGMhSt8TYXgbgpYkOdwzhSb8xMhfmlQgIs";
        const chatId = "6699477803";
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;

        const telegramResponse = await fetch(telegramUrl);
        const telegramResult = await telegramResponse.json();

        if (!telegramResult.ok) {
          console.warn('Не удалось отправить в Telegram, но заказ сохранен в БД');
          // Продолжаем, так как заказ уже сохранен в нашей БД
        }

        // Успешное завершение
        const successText = {
          ru: "Ваш заказ успешно оформлен! В панели пользователя можете наблюдать за заказом!.",
          en: "Your order has been successfully placed! You can monitor your order in the user panel!",
          tg: "Фармоиши шумо бомуваффақият анҷом ефт! Дар панели корбар шумо метавонед фармоишро тамошо кунед!",
          zh: "您的订单已成功订购！ 您可以在用户面板中观看订单！"
        }[currentLang];
        
        showToast(successText);

        // Если это самовывоз, показываем код
        if (orderType === 'pickup' && orderResult.pickupCode) {
          // Показываем специальное уведомление с кодом самовывоза
          setTimeout(() => {
            showPickupCodeNotification(orderResult.pickupCode, orderResult.orderId);
          }, 500);
          
          // Также сохраняем код в localStorage для истории
          const orderHistory = JSON.parse(localStorage.getItem('orderHistory') || '[]');
          orderHistory.unshift({
            id: orderResult.orderId,
            pickupCode: orderResult.pickupCode,
            date: new Date().toISOString(),
            total: totalPrice,
            type: 'pickup'
          });
          localStorage.setItem('orderHistory', JSON.stringify(orderHistory.slice(0, 10))); // Храним последние 10 заказов
        }

        // Очищаем корзину и сбрасываем форму
        cart = [];
        updateCart();
        if (cartModal) cartModal.style.display = "none";
        document.body.style.overflow = "auto";
        checkoutForm.reset();

        // Сбрасываем тип заказа на доставку по умолчанию
        orderType = "delivery";
        orderTypeBtns.forEach(btn => {
          btn.classList.remove("active");
          if (btn.dataset.type === "delivery") {
            btn.classList.add("active");
          }
        });
        addressGroup.style.display = "block";
        pickupGroup.style.display = "none";

      } catch (error) {
        console.error("Ошибка оформления заказа:", error);
        
        const errorText = {
          ru: "Произошла ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз или свяжитесь с нами по телефону.",
          en: "An error occurred while placing your order. Please try again or contact us by phone.",
          tg: "Ҳангоми тасдиқи фармоиш хато рух дод. Лутфан бори дигар кӯшиш кунед ё бо мо тамос гиред.",
          zh: "下单时发生错误。请重试或通过电话联系我们。"
        }[currentLang];
        
        showToast(errorText, "error");
      }
    });
  }

  // Добавление товаров в корзину с фото
  const addButtons = document.querySelectorAll(".menu-item-btn");

  addButtons.forEach(button => {
    button.addEventListener("click", function() {
      const productCard = this.closest(".menu-item");
      const productName = productCard.querySelector(".menu-item-name").textContent;
      const productPrice = parseFloat(productCard.querySelector(".menu-item-price").textContent);

      let imgStyle = productCard.querySelector(".menu-item-img").style.backgroundImage;
      let productImg = imgStyle.slice(5, -2);

      const existingItemIndex = cart.findIndex(item => item.name === productName);

      if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity++;
        const currentLang = document.documentElement.lang || 'ru';
        const toastText = {
          ru: `Добавлено еще "${productName}" в корзину`,
          en: `Added another "${productName}" to cart`,
          tg: `Боз як "${productName}" ба корзина илова шуд`,
          zh: `又添加了一个 "${productName}" 到购物车`
        }[currentLang] || `Добавлено еще "${productName}" в корзину`;
        
        showToast(toastText);
      } else {
        cart.push({
          name: productName,
          price: productPrice,
          quantity: 1,
          img: productImg
        });
        const currentLang = document.documentElement.lang || 'ru';
        const toastText = {
          ru: `"${productName}" добавлен в корзину`,
          en: `"${productName}" added to cart`,
          tg: `"${productName}" ба корзина илова шуд`,
          zh: `"${productName}" 已添加到购物车`
        }[currentLang] || `"${productName}" добавлен в корзину`;
        
        showToast(toastText);
      }

      updateCart();

      this.style.transform = "scale(1.2)";
      setTimeout(() => {
        this.style.transform = "";
      }, 200);

      if (productImg) {
        const productImgElement = document.createElement("div");
        productImgElement.style.position = "fixed";
        productImgElement.style.width = "50px";
        productImgElement.style.height = "50px";
        productImgElement.style.borderRadius = "50%";
        productImgElement.style.backgroundImage = `url(${productImg})`;
        productImgElement.style.backgroundSize = "cover";
        productImgElement.style.backgroundPosition = "center";
        productImgElement.style.zIndex = "1000";

        const rect = productCard.getBoundingClientRect();
        productImgElement.style.top = rect.top + "px";
        productImgElement.style.left = rect.left + "px";
        productImgElement.className = "flying-item";

        document.body.appendChild(productImgElement);

        setTimeout(() => {
          productImgElement.remove();
        }, 600);
      }
    });
  });

  // Маска для телефона
  const phoneInput = document.getElementById("phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function() {
      this.value = this.value.replace(/\D/g, "").slice(0, 9);
    });
  }

  // Открытие корзины по клику на "Заказать онлайн" с проверкой авторизации
  const openCartButtons = document.querySelectorAll(".open-cart");
  openCartButtons.forEach(button => {
    button.addEventListener("click", async function(e) {
      e.preventDefault();
      
      // Проверяем авторизацию перед открытием корзины
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        handleUnauthorizedAccess(e);
        return;
      }
      
      updateCartModal();
      if (cartModal) {
        cartModal.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
    });
  });

  // Логика для кнопки "Заказать доставку" с проверкой авторизации
  const orderDeliveryButtons = document.querySelectorAll(".order-delivery");
  orderDeliveryButtons.forEach(button => {
    button.addEventListener("click", async function(e) {
      e.preventDefault();
      
      // Проверяем авторизацию
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        handleUnauthorizedAccess(e);
        return;
      }
      
      if (cart.length === 0) {
        const currentLang = document.documentElement.lang || 'ru';
        const warningText = {
          ru: "Ваша корзина пуста. Выберите товар.",
          en: "Your cart is empty. Select a product.",
          tg: "Корзинаи шумо холӣ аст. Маҳсулотро интихоб кунед.",
          zh: "您的购物车是空的。请选择商品。"
        }[currentLang] || "Ваша корзина пуста. Выберите товар.";
        
        showToast(warningText, "warning");
        document.querySelector("#menu").scrollIntoView({ behavior: "smooth" });
      } else {
        // Устанавливаем тип заказа "доставка"
        orderType = "delivery";
        orderTypeBtns.forEach(btn => {
          btn.classList.remove("active");
          if (btn.dataset.type === "delivery") {
            btn.classList.add("active");
          }
        });
        addressGroup.style.display = "block";
        pickupGroup.style.display = "none";
        
        updateCartModal();
        if (cartModal) {
          cartModal.style.display = "flex";
          document.body.style.overflow = "hidden";
        }
      }
    });
  });
  
  // ========== КОМПАКТНЫЙ ЯЗЫКОВОЙ СЕЛЕКТОР ==========
  const compactLanguageBtn = document.getElementById('compactLanguageBtn');
  const compactLanguageDropdown = document.getElementById('compactLanguageDropdown');
  const compactLanguageItems = document.querySelectorAll('.compact-language-item');
  const compactLanguageSelector = document.querySelector('.compact-language-selector');

  if (compactLanguageBtn && compactLanguageDropdown && compactLanguageSelector) {
    // Открытие/закрытие выпадающего списка
    compactLanguageBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      compactLanguageSelector.classList.toggle('active');
    });
    
    // Обработка выбора языка
    compactLanguageItems.forEach(item => {
      item.addEventListener('click', function() {
        const lang = this.dataset.lang;
        
        // Убираем активный класс у всех
        compactLanguageItems.forEach(i => i.classList.remove('active'));
        // Добавляем активный класс текущему
        this.classList.add('active');
        
        // Обновляем кнопку
        const flag = this.querySelector('.compact-language-flag').textContent;
        const text = this.querySelector('span:not(.compact-language-flag)').textContent;
        const shortCode = lang.toUpperCase();
        
        compactLanguageBtn.querySelector('.compact-language-flag').textContent = flag;
        compactLanguageBtn.querySelector('span:not(.compact-language-flag)').textContent = shortCode;
        
        // Закрываем выпадающий список
        compactLanguageSelector.classList.remove('active');
        
        // Вызываем функцию смены языка из lang.js
        if (window.switchLanguage) {
          window.switchLanguage(lang);
        } else if (window.changeLanguage) {
          window.changeLanguage(lang);
        } else {
          // Если lang.js не загружен, перезагружаем с новым языком
          document.documentElement.lang = lang;
          console.log('Язык изменен на:', lang);
          location.reload();
        }
      });
    });
    
    // Закрытие при клике вне селектора
    document.addEventListener('click', function(e) {
      if (compactLanguageSelector && !compactLanguageSelector.contains(e.target)) {
        compactLanguageSelector.classList.remove('active');
      }
    });
    
    // Закрытие при нажатии ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && compactLanguageSelector) {
        compactLanguageSelector.classList.remove('active');
      }
    });
    
    // Устанавливаем начальный язык из localStorage
    const savedLang = localStorage.getItem('preferredLanguage') || 'ru';
    const activeItem = Array.from(compactLanguageItems).find(item => item.dataset.lang === savedLang);
    if (activeItem) {
      const flag = activeItem.querySelector('.compact-language-flag').textContent;
      const shortCode = savedLang.toUpperCase();
      compactLanguageBtn.querySelector('.compact-language-flag').textContent = flag;
      compactLanguageBtn.querySelector('span:not(.compact-language-flag)').textContent = shortCode;
      
      // Активируем соответствующий элемент в выпадающем списке
      compactLanguageItems.forEach(item => item.classList.remove('active'));
      activeItem.classList.add('active');
    }
  }

  // ========== УЛУЧШЕННЫЙ UI ДЛЯ МЕНЮ ТАБОВ НА МОБИЛЬНЫХ ==========
  
  // Функция для улучшения отображения табов на мобильных
  function enhanceMobileTabs() {
    const menuTabsContainer = document.querySelector('.menu-tabs');
    if (!menuTabsContainer) return;
    
    if (window.innerWidth <= 768) {
      // Добавляем класс для мобильных
      menuTabsContainer.classList.add('mobile-tabs');
      
      // Улучшаем доступность
      menuTabs.forEach(tab => {
        tab.setAttribute('role', 'button');
        tab.setAttribute('tabindex', '0');
        
        // Активация по Enter/Space
        tab.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
          }
        });
        
        // Визуальная обратная связь для тач-устройств
        tab.addEventListener('touchstart', function() {
          this.style.transform = 'scale(0.95)';
        });
        
        tab.addEventListener('touchend', function() {
          this.style.transform = '';
        });
      });
      
      // Скрываем лишние табы на очень маленьких экранах (опционально)
      if (window.innerWidth <= 360) {
        // Можно добавить логику для скрытия некоторых табов
        // или их перекомпоновки
      }
    } else {
      // На больших экранах убираем мобильные классы
      menuTabsContainer.classList.remove('mobile-tabs');
    }
  }
  
  // Авто-скролл активного таба в видимую область (только для десктопа)
  function scrollActiveTabIntoView() {
    if (window.innerWidth > 768) {
      const activeTab = document.querySelector('.menu-tab.active');
      if (activeTab) {
        activeTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }
  
  // Вызываем после клика по табу
  menuTabs.forEach(tab => {
    tab.addEventListener("click", function() {
      setTimeout(scrollActiveTabIntoView, 300);
    });
  });
  
  // Свайп по меню-табам на мобильных (только для горизонтальной прокрутки на десктопе)
  let touchStartX = 0;
  let touchEndX = 0;
  const menuTabsContainer = document.querySelector('.menu-tabs');
  
  if (menuTabsContainer) {
    // Только для больших экранов, где есть горизонтальная прокрутка
    if (window.innerWidth > 768) {
      menuTabsContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, {passive: true});
      
      menuTabsContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeTabs();
      }, {passive: true});
    }
  }
  
  function handleSwipeTabs() {
    if (window.innerWidth <= 768) return; // Отключаем свайп на мобильных
    
    const threshold = 50;
    const deltaX = touchEndX - touchStartX;
    
    if (Math.abs(deltaX) > threshold) {
      const scrollAmount = deltaX > 0 ? -100 : 100;
      menuTabsContainer.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  }
  
  // Ленивая загрузка изображений для мобильных
  function lazyLoadImages() {
    if ('IntersectionObserver' in window && window.innerWidth <= 768) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.style.backgroundImage = `url(${img.dataset.src})`;
              observer.unobserve(img);
            }
          }
        });
      });
      
      document.querySelectorAll('.menu-item-img').forEach(img => {
        const currentBg = img.style.backgroundImage;
        if (currentBg && currentBg !== 'none') {
          img.dataset.src = currentBg.slice(5, -2);
          img.style.backgroundImage = 'none';
          img.style.backgroundColor = '#f5f5f5';
          imageObserver.observe(img);
        }
      });
    }
  }
  
  // Оптимизация для очень маленьких экранов при загрузке
  function optimizeForUltraSmallScreens() {
    const isVerySmallScreen = window.innerWidth <= 320;
    
    if (isVerySmallScreen) {
      // Скрываем текст в языковом переключателе на очень маленьких экранах
      const compactLanguageBtnText = compactLanguageBtn?.querySelector('span:not(.compact-language-flag)');
      if (compactLanguageBtnText) {
        compactLanguageBtnText.style.display = 'none';
      }
    } else {
      // Сбрасываем стили для языка на больших экранах
      const compactLanguageBtnText = compactLanguageBtn?.querySelector('span:not(.compact-language-flag)');
      if (compactLanguageBtnText) {
        compactLanguageBtnText.style.display = '';
      }
    }
  }
  
  // Инициализация всех улучшений
  function initMobileOptimizations() {
    enhanceMobileTabs();
    lazyLoadImages();
    optimizeForUltraSmallScreens();
  }
  
  // Запускаем оптимизации при загрузке
  setTimeout(initMobileOptimizations, 500);
  
  // И при изменении размера окна
  window.addEventListener('resize', function() {
    initMobileOptimizations();
    
    // Переинициализируем свайп для табов при изменении размера
    if (menuTabsContainer) {
      menuTabsContainer.removeEventListener('touchstart', () => {});
      menuTabsContainer.removeEventListener('touchend', () => {});
      
      if (window.innerWidth > 768) {
        menuTabsContainer.addEventListener('touchstart', (e) => {
          touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        
        menuTabsContainer.addEventListener('touchend', (e) => {
          touchEndX = e.changedTouches[0].screenX;
          handleSwipeTabs();
        }, {passive: true});
      }
    }
  });
  
  // Предотвращаем масштабирование при двойном тапе на инпуты
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('touchstart', function(e) {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, {passive: false});
  });
  
  // Добавляем улучшенную анимацию кнопки добавления в корзину
  addButtons.forEach(button => {
    button.addEventListener("click", function() {
      // Добавляем класс для анимации
      this.classList.add('added');
      setTimeout(() => {
        this.classList.remove('added');
      }, 300);
    });
  });

  // Загрузка корзины при загрузке страницы
  loadCart();
});

// Отправка заказа
const orderForm = document.getElementById('orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(orderForm);
    const data = Object.fromEntries(formData);
    data.items = JSON.stringify(cartItems); // Из вашей корзины
    data.total_price = totalPrice;

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        alert(`Заказ создан! ${result.pickupCode ? `Код самовывоза: ${result.pickupCode}` : ''}`);
        // Очистить корзину
      }
    } catch (err) {
      alert('Ошибка заказа');
    }
  });
}

