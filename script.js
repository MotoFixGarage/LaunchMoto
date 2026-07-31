const API_URL = 'https://script.google.com/macros/s/AKfycbyvU8kEj-A4EFnRpkqCUKwUrhcH4-1Sv1tmxccDx8fnsCzaLrxBUuLQMdCM4xZAUph6/exec'; // твой URL из деплоя

const searchInput = document.getElementById('searchInput');
const clientsList = document.getElementById('clientsList');
const addBtn = document.getElementById('addBtn');

const adminLogin = document.getElementById('adminLogin');
const crmPanel = document.getElementById('crmPanel');
const loginBtn = document.getElementById('loginBtn');
const adminPass = document.getElementById('adminPass');

// Ключ храним в sessionStorage — живёт, пока открыта вкладка,
// при закрытии браузера/вкладки слетает и придётся войти заново
let ADMIN_KEY = sessionStorage.getItem('adminKey') || '';

// Контроллер последнего запроса на поиск — нужен, чтобы отменять
// устаревшие запросы и не дать им перезаписать уже очищенный список
let searchController = null;

// --- Элементы блока расценок (могут отсутствовать не на всех страницах) ---
const priceTable = document.getElementById('infoll');
const addPriceRow = document.getElementById('addPriceRow');
const priceName = document.getElementById('priceName');
const pricePit = document.getElementById('pricePit');
const priceEnduro = document.getElementById('priceEnduro');
const addPriceBtn = document.getElementById('addPriceBtn');
const editModeBtn = document.getElementById('editModeBtn');
const priceSearchInput = document.getElementById('priceSearchInput');

// --- Элементы заявок от клиентов (публичная форма + админ-панель) ---
const leadFormPublic = document.getElementById('leadFormPublic');
const leadName = document.getElementById('leadName');
const leadPhone = document.getElementById('leadPhone');
const leadTech = document.getElementById('leadTech');
const leadWork = document.getElementById('leadWork');
const leadSendBtn = document.getElementById('leadSendBtn');
const leadsPanel = document.getElementById('leadsPanel');
const leadsList = document.getElementById('leadsList');

let pricesCache = []; // тут храним последний загруженный список расценок

// editMode отделён от факта логина: залогинен ≠ таблица сразу редактируется.
// Пока editMode = false, даже у админа таблица кликабельна как у обычного посетителя
// (заполняет карточку клиента), и превращается в поля ввода только после явного клика на кнопку.
let editMode = false;

// showCrm/showLogin теперь безопасны на любой странице — каждое обращение
// к элементу проверяется на существование, т.к. index.html не содержит
// админ-элементов вовсе (там их просто нет в разметке).
function showCrm() {
  if (adminLogin) adminLogin.style.display = 'none';
  if (crmPanel) crmPanel.style.display = 'block';
  if (addPriceRow) addPriceRow.style.display = 'flex'; // форма добавления услуги видна только админу
  if (leadFormPublic) leadFormPublic.style.display = 'none'; // форма заявки скрыта от админа
  if (leadsPanel) leadsPanel.style.display = 'block'; // панель заявок видна только админу
  renderPrices();
  loadLeads();
}

function showLogin() {
  if (adminLogin) adminLogin.style.display = 'block';
  if (crmPanel) crmPanel.style.display = 'none';
  if (addPriceRow) addPriceRow.style.display = 'none';
  if (leadFormPublic) leadFormPublic.style.display = 'block'; // форма заявки видна всем, кроме админа
  if (leadsPanel) leadsPanel.style.display = 'none';
  editMode = false; // при выходе сбрасываем режим редактирования на всякий случай
  if (editModeBtn) editModeBtn.textContent = 'Редактировать таблицу';
  renderPrices();
}

// Кнопка переключения режима редактирования таблицы расценок
if (editModeBtn) {
  editModeBtn.addEventListener('click', () => {
    editMode = !editMode;
    editModeBtn.textContent = editMode ? 'Готово' : 'Редактировать таблицу';
    renderPrices();
  });
}

// Пробуем ключ на бэкенде: если он верный — бэкенд вернёт список (пустой или нет),
// если неверный — вернёт {error: 'unauthorized'}
async function tryLogin(key) {
  const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}&search=`);
  const data = await res.json();

  if (data && data.error) {
    alert('Неверный пароль');
    sessionStorage.removeItem('adminKey');
    showLogin();
    return false;
  }

  ADMIN_KEY = key;
  sessionStorage.setItem('adminKey', key);
  showCrm();
  if (clientsList) clientsList.innerHTML = ''; // список пуст, пока не начали искать
  return true;
}

if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    tryLogin(adminPass.value);
    adminPass.value = '';
  });
}

// Отрисовать список клиентов на странице
function renderClients(clients) {
  if (!clientsList) return;
  clientsList.innerHTML = ''; // очищаем перед перерисовкой
  clients.forEach(c => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <p><b>${c['Имя']}</b> </p>
      <a href="tel:${c['Телефон']}"><p>${c['Телефон']}</p><a/>
      <p>${c['Модель']}</p>
      <p>${c['Работы']}</p>
      <p>${c['Сумма']} ₽</p>
      <p>${c['Комментарий'] || ''}</p>
    `;
    clientsList.appendChild(card);
  });
}

// Запрос списка (с фильтром и ключом администратора)
async function loadClients(query = '') {
  // если предыдущий запрос ещё летит — отменяем его,
  // чтобы его устаревший ответ не перезаписал актуальный список
  if (searchController) {
    searchController.abort();
  }
  searchController = new AbortController();

  try {
    const res = await fetch(
      `${API_URL}?key=${encodeURIComponent(ADMIN_KEY)}&search=${encodeURIComponent(query)}`,
      { signal: searchController.signal }
    );
    const data = await res.json();

    if (data && data.error) {
      // ключ протух/невалиден — выкидываем на логин
      sessionStorage.removeItem('adminKey');
      showLogin();
      return;
    }

    renderClients(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      // это ожидаемо — запрос отменили, потому что стартовал более новый
      return;
    }
    console.error('Ошибка загрузки клиентов:', err);
  }
}

// Поиск срабатывает при каждом вводе символа
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query === '') {
      // отменяем всё, что ещё летит в фоне — иначе его ответ
      // придёт позже и снова покажет старую карточку
      if (searchController) {
        searchController.abort();
      }
      if (clientsList) clientsList.innerHTML = '';
      return;
    }
    loadClients(query);
  });
}

// Добавление нового клиента
if (addBtn) {
  addBtn.addEventListener('click', async () => {
    const client = {
      key: ADMIN_KEY,
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      model: document.getElementById('model').value,
      date: document.getElementById('date').value,
      work: document.getElementById('work').value,
      sum: document.getElementById('sum').value,
      comment: document.getElementById('comment').value
    };

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(client)
    });

    // очищаем поля после отправки
    ['name','phone','model','date','work','sum','comment'].forEach(id => {
      document.getElementById(id).value = '';
    });

    loadClients(searchInput.value.trim()); // обновляем список с учётом текущего поиска
  });
}

// Если ключ уже сохранён с прошлого раза (в этой же вкладке) — сразу пробуем войти
if (ADMIN_KEY) {
  tryLogin(ADMIN_KEY);
} else {
  showLogin();
}


// ==========================================================
// РАСЦЕНКИ — загрузка, отображение, добавление и редактирование
// ==========================================================

// Загружает список расценок с бэкенда — доступно всем, без ключа
async function loadPrices() {
  if (!priceTable) return; // на этой странице таблицы расценок нет

  const res = await fetch(`${API_URL}?type=prices`);
  const data = await res.json();
  pricesCache = data;
  renderPrices();
}

// Сохраняет одну услугу — либо новую (price_add), либо правку существующей (price_edit)
async function savePrice({ id, name, pit, enduro }) {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      type: id ? 'price_edit' : 'price_add',
      key: ADMIN_KEY,
      id,
      name,
      pit,
      enduro
    })
  });
}

// Рисует строки таблицы расценок на основе pricesCache.
// Поля ввода (редактирование) показываются только если залогинен И включён editMode.
// Во всех остальных случаях (гость, либо админ вне режима редактирования) —
// обычный текст с кликабельными ценами, заполняющими форму CRM.
function renderPrices(list) {
  if (!priceTable) return;

  const items = list || pricesCache;
  const isEditing = ADMIN_KEY && editMode;

  // убираем все строки, кроме самой первой (заголовок наименование/пит-скут/эндуро)
  const rows = priceTable.querySelectorAll('tr');
  rows.forEach((row, i) => {
    if (i > 0) row.remove();
  });

  items.forEach(item => {
    const tr = document.createElement('tr');

    if (isEditing) {
      // режим редактирования: три поля ввода вместо текста
      tr.innerHTML = `
        <td><input type="text" class="edit-name" value="${item['Название']}"></td>
        <td><input type="text" class="edit-pit" value="${item['ЦенаПитСкут']}"></td>
        <td><input type="text" class="edit-enduro" value="${item['ЦенаЭндуро']}"></td>
      `;

      // сохраняем изменение сразу, как только человек ушёл из поля (событие change)
      const saveThisRow = () => {
        savePrice({
          id: item['ID'],
          name: tr.querySelector('.edit-name').value,
          pit: tr.querySelector('.edit-pit').value,
          enduro: tr.querySelector('.edit-enduro').value
        });
      };
      tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('change', saveThisRow);
      });
    } else {
      // обычный режим просмотра: текст + возможность клика по цене
      tr.innerHTML = `
        <td><p>${item['Название']}</p></td>
        <td class="price-cell" data-price="${item['ЦенаПитСкут']}" data-type="пит/ скут"><p>${item['ЦенаПитСкут']}</p></td>
        <td class="price-cell" data-price="${item['ЦенаЭндуро']}" data-type="эндуро"><p>${item['ЦенаЭндуро']}</p></td>
      `;
    }

    priceTable.appendChild(tr);
  });

  if (!isEditing) {
    attachPriceCellClicks(); // клики работают у гостя И у залогиненного вне режима редактирования
  }
}

// Клик по цене (не в режиме редактирования) добавляет работу и сумму в форму CRM
function attachPriceCellClicks() {
  document.querySelectorAll('.price-cell').forEach(cell => {
    const priceText = cell.dataset.price || '';

    // берём первое число в тексте цены (учитывает "2 000 ₽", "от 2000 ₽",
    // "1500 - 3000 ₽" — в последнем случае возьмётся нижняя граница)
    const match = priceText.match(/\d[\d\s]*\d|\d/);
    const priceNumber = match ? parseInt(match[0].replace(/\s/g, ''), 10) : NaN;

    if (!priceNumber || isNaN(priceNumber)) {
      cell.classList.add('disabled'); // "-" или пусто — не кликабельно
      return;
    }

    cell.classList.add('price-cell');
    cell.addEventListener('click', () => {
      const workField = document.getElementById('work');
      const sumField = document.getElementById('sum');
      if (!workField || !sumField) return; // на этой странице формы CRM может не быть

      const serviceNameEl = cell.closest('tr').querySelector('td p');
      const serviceName = serviceNameEl ? serviceNameEl.textContent.trim() : '';
      const bikeType = cell.dataset.type || '';
      const entry = `${serviceName} (${bikeType}) — ${priceText}`;

      workField.value = workField.value
        ? `${workField.value}, ${entry}`
        : entry;

      const currentSum = parseInt(sumField.value, 10) || 0;
      sumField.value = currentSum + priceNumber;
    });
  });
}

// Добавление новой услуги (доступно только в режиме админа — кнопка скрыта иначе)
if (addPriceBtn) {
  addPriceBtn.addEventListener('click', async () => {
    await savePrice({
      name: priceName.value,
      pit: pricePit.value,
      enduro: priceEnduro.value
    });

    priceName.value = '';
    pricePit.value = '';
    priceEnduro.value = '';

    loadPrices(); // перезагружаем список, чтобы новая услуга сразу появилась
  });
}

// Поиск услуги — заменяет содержимое таблицы найденными строками,
// при очистке поля возвращается полный список
if (priceSearchInput) {
  priceSearchInput.addEventListener('input', () => {
    const query = priceSearchInput.value.trim().toLowerCase();
    if (query === '') {
      renderPrices(); // пусто — показываем всю таблицу
      return;
    }
    const filtered = pricesCache.filter(item =>
      String(item['Название']).toLowerCase().includes(query)
    );
    renderPrices(filtered);
  });
}

loadPrices(); // расценки грузим сразу при открытии страницы — они публичные


// ==========================================================
// ЗАЯВКИ ОТ КЛИЕНТОВ — публичная форма + просмотр админом
// ==========================================================

// Отправка новой заявки — доступно всем, ключ не нужен (форма скрыта от админа через showCrm/showLogin)
if (leadSendBtn) {
  leadSendBtn.addEventListener('click', async () => {
    const lead = {
      type: 'lead_add',
      name: leadName.value,
      phone: leadPhone.value,
      tech: leadTech.value,
      work: leadWork.value
    };

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(lead)
    });

    [leadName, leadPhone, leadTech, leadWork].forEach(inp => { inp.value = ''; });
    alert('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
  });
}

// Загружает непрочитанные заявки — только для админа
async function loadLeads() {
  if (!leadsPanel) return; // на этой странице панели заявок нет

  const res = await fetch(`${API_URL}?type=leads&key=${encodeURIComponent(ADMIN_KEY)}`);
  const data = await res.json();

  if (data && data.error) return; // ключ не подошёл — просто не показываем
  renderLeads(data);
}

// Рисует карточки заявок с кнопкой "Прочитано"
function renderLeads(leads) {
  if (!leadsList) return;
  leadsList.innerHTML = '';

  leads.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'client-card';

    // время приходит из таблицы как дата — форматируем в привычный вид
    const time = lead['Время'] ? new Date(lead['Время']).toLocaleString('ru-RU') : '';

    card.innerHTML = `
      <p><b>${lead['Имя']}</b></p>
      <a href="tel:${lead['Телефон']}"><p>${lead['Телефон']}</p></a>
      <p>${lead['Техника']}</p>
      <p>${lead['Работы']}</p>
      <p>${time}</p>
    `;

    const readBtn = document.createElement('button');
    readBtn.className = 'addBtn';
    readBtn.textContent = 'Прочитано';
    readBtn.addEventListener('click', async () => {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'lead_read', key: ADMIN_KEY, id: lead['ID'] })
      });
      card.remove(); // убираем карточку сразу, не дожидаясь перезагрузки списка
    });

    card.appendChild(readBtn);
    leadsList.appendChild(card);
  });
}
