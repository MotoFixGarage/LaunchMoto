const API_URL = 'https://script.google.com/macros/s/AKfycbyXUlJgw6FlChr99aB-cwRvsK_l5wzT9fOt7Axzg0yn3zdEfJLM-bAo1Qfc31KnyTv6/exec'; // твой URL из деплоя

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

let pricesCache = []; // тут храним последний загруженный список расценок

function showCrm() {
  adminLogin.style.display = 'none';
  crmPanel.style.display = 'block';
  if (addPriceRow) addPriceRow.style.display = 'flex'; // форма добавления услуги видна только админу
  renderPrices(); // перерисовываем таблицу в режиме редактирования
}

function showLogin() {
  adminLogin.style.display = 'block';
  crmPanel.style.display = 'none';
  if (addPriceRow) addPriceRow.style.display = 'none';
  renderPrices(); // перерисовываем таблицу в обычном (только просмотр) режиме
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
  clientsList.innerHTML = ''; // список пуст, пока не начали искать
  return true;
}

loginBtn.addEventListener('click', () => {
  tryLogin(adminPass.value);
});

// Отрисовать список клиентов на странице
function renderClients(clients) {
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
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (query === '') {
    // отменяем всё, что ещё летит в фоне — иначе его ответ
    // придёт позже и снова покажет старую карточку
    if (searchController) {
      searchController.abort();
    }
    clientsList.innerHTML = '';
    return;
  }
  loadClients(query);
});

// Добавление нового клиента
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
// Если человек залогинен — ячейки превращаются в поля ввода (режим редактирования),
// если нет — обычный текст, а цены кликабельны (добавляют работу в форму CRM).
function renderPrices() {
  if (!priceTable) return;

  // убираем все строки, кроме самой первой (заголовок наименование/пит-скут/эндуро)
  const rows = priceTable.querySelectorAll('tr');
  rows.forEach((row, i) => {
    if (i > 0) row.remove();
  });

  pricesCache.forEach(item => {
    const tr = document.createElement('tr');

    if (ADMIN_KEY) {
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

  if (!ADMIN_KEY) {
    attachPriceCellClicks(); // навешиваем клики только в режиме просмотра
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

loadPrices(); // расценки грузим сразу при открытии страницы — они публичные
