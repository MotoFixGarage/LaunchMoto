const API_URL = 'https://script.google.com/macros/s/AKfycbyb3M2gzdOzG94f1nthzo1QQ5_ftxmLXSab9PmBhDUuoY5sAmdG-CICkrm9m-9GyZ1U/exec'; // твой URL из деплоя

const searchInput = document.getElementById('searchInput');
const clientsList = document.getElementById('clientsList');
const addBtn = document.getElementById('addBtn');

const adminLogin = document.getElementById('adminLogin');
const crmPanel = document.getElementById('crmPanel');
const loginBtn = document.getElementById('loginBtn');
const adminPass = document.getElementById('adminPass');

let ADMIN_KEY = sessionStorage.getItem('adminKey') || '';
let searchController = null;

// ==========================================================
// ЭКРАН ЗАГРУЗКИ
// Скрываем оверлей после window.load (все картинки/шрифты реально
// получены), но не раньше MIN_LOADER_TIME — иначе на быстром интернете
// лого мелькает и пропадает, не успев толком показаться.
// Если на странице нет #pageLoader, просто ничего не делаем.
// ==========================================================
const pageLoader = document.getElementById('pageLoader');
if (pageLoader) {
  const MIN_LOADER_TIME = 1000; // мс — минимальное время показа экрана загрузки
  const loaderStart = Date.now();

  const hidePageLoader = () => {
    pageLoader.classList.add('pageLoader-hidden');
    setTimeout(() => pageLoader.remove(), 500); // убираем из DOM после анимации затухания
  };

  window.addEventListener('load', () => {
    const elapsed = Date.now() - loaderStart;
    const remaining = Math.max(MIN_LOADER_TIME - elapsed, 0);
    setTimeout(hidePageLoader, remaining);
  });
}

// ==========================================================
// ИНДИКАТОР ЗАГРУЗКИ НА КНОПКАХ
// Пока идёт запрос к Apps Script, содержимое кнопки временно заменяется
// на гифку img/loading.gif, кнопка блокируется от повторного нажатия.
// После ответа сервера исходное содержимое кнопки возвращается.
// ==========================================================
function setButtonLoading(btn) {
  if (!btn || btn.dataset.loading === 'true') return;
  btn.dataset.loading = 'true';
  btn.dataset.originalContent = btn.innerHTML;
  btn.classList.add('btn-loading');
  btn.disabled = true;
  btn.innerHTML = '<img src="img/loading.gif" alt="загрузка" class="btnLoadingGif">';
}

function clearButtonLoading(btn) {
  if (!btn || btn.dataset.loading !== 'true') return;
  btn.innerHTML = btn.dataset.originalContent || '';
  btn.classList.remove('btn-loading');
  btn.disabled = false;
  delete btn.dataset.loading;
  delete btn.dataset.originalContent;
}

// --- Заявки ---
const leadFormPublic = document.getElementById('leadFormPublic');
const leadName = document.getElementById('leadName');
const leadPhone = document.getElementById('leadPhone');
const leadTech = document.getElementById('leadTech');
const leadWork = document.getElementById('leadWork');
const leadSendBtn = document.getElementById('leadSendBtn');
const leadsPanel = document.getElementById('leadsPanel');
const leadsList = document.getElementById('leadsList');

// --- Фильтр расценок для клиента (категория → узел → услуги), хранится как JSON.
// Это теперь ЕДИНСТВЕННОЕ место хранения и редактирования цен. ---
const categorySelect = document.getElementById('categorySelect');
const nodeSelect = document.getElementById('nodeSelect');
const issueSelect = document.getElementById('issueSelect');
const filterResult = document.getElementById('filterResult');
const filterResult1 = document.getElementById('filterResult1');
const categoryLabel = document.getElementById('categoryLabel');
const nodeLabel = document.getElementById('nodeLabel');
const issueLabel = document.getElementById('issueLabel');

const filterAdminRow = document.getElementById('filterAdminRow');
const filterAdminCategory = document.getElementById('filterAdminCategory');
const filterCategoryList = document.getElementById('filterCategoryList');
const filterAdminNode = document.getElementById('filterAdminNode');
const filterNodeList = document.getElementById('filterNodeList');
const filterAdminName = document.getElementById('filterAdminName');
const filterAdminPrice = document.getElementById('filterAdminPrice');
const filterAdminTime = document.getElementById('filterAdminTime');
const filterAdminAddBtn = document.getElementById('filterAdminAddBtn');
const filterAdminServiceList = document.getElementById('filterAdminServiceList');

// --- Таблица расценок для админа (динамические колонки = категории) ---
const filterTableWrap = document.getElementById('filterTableWrap');
const filterPriceTable = document.getElementById('filterPriceTable');

let filterData = {}; // весь объект целиком: { Категория: { Узел: [ {name, price, time}, ... ] } }

function showCrm() {
  if (adminLogin) adminLogin.style.display = 'none';
  if (crmPanel) crmPanel.style.display = 'block';
  if (leadFormPublic) leadFormPublic.style.display = 'none';
  if (leadsPanel) leadsPanel.style.display = 'block';
  if (filterAdminRow) filterAdminRow.style.display = 'flex';
  if (filterTableWrap) filterTableWrap.style.display = 'block';
  renderFilterAdminPanel();
  loadLeads();
}

function showLogin() {
  if (adminLogin) adminLogin.style.display = 'block';
  if (crmPanel) crmPanel.style.display = 'none';
  if (leadFormPublic) leadFormPublic.style.display = 'block';
  if (leadsPanel) leadsPanel.style.display = 'none';
  if (filterAdminRow) filterAdminRow.style.display = 'none';
  if (filterAdminServiceList) filterAdminServiceList.innerHTML = '';
  if (filterTableWrap) filterTableWrap.style.display = 'none';
  if (filterPriceTable) filterPriceTable.innerHTML = '';
}

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
  if (clientsList) clientsList.innerHTML = '';
  return true;
}

// ==========================================================
// ФОРМАТИРОВАНИЕ ТЕЛЕФОНА
// Приводит номер к виду 8 (999) 123-45-67 перед отправкой на сервер.
// Ключевая идея — не пытаться "дописать" скобки/тире в уже введённую строку
// (там и рождаются баги вроде двойных скобок), а всегда сначала вычистить
// все нецифровые символы и пересобрать формат с нуля. Тогда неважно, ввёл
// ли человек номер с +7, с пробелами, слитно или уже в этом же формате —
// результат всегда один и тот же, без дублей.
// ==========================================================
function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';

  // отбрасываем код страны (7 или 8 в начале 11-значного номера),
  // оставляя 10 цифр самого номера
  if (digits.length === 11) {
    digits = digits.slice(1);
  } else if (digits.length > 11) {
    digits = digits.slice(-10);
  }
  digits = digits.slice(0, 10);

  let result = '8 (' + digits.slice(0, 3);
  if (digits.length >= 3) result += ')';
  if (digits.length > 3) result += ' ' + digits.slice(3, 6);
  if (digits.length > 6) result += '-' + digits.slice(6, 8);
  if (digits.length > 8) result += '-' + digits.slice(8, 10);
  return result;
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    setButtonLoading(loginBtn);
    await tryLogin(adminPass.value);
    adminPass.value = '';
    clearButtonLoading(loginBtn);
  });
}

// Объединяет записи клиентов с одинаковым номером телефона в одну карточку
// и считает общую сумму по всем визитам — пригодится для скидок постоянным клиентам.
function groupClientsByPhone(clients) {
  const map = new Map();

  clients.forEach(c => {
    const phone = String(c['Телефон'] || '').trim();
    if (!map.has(phone)) {
      map.set(phone, { phone, name: c['Имя'], visits: [] });
    }
    const entry = map.get(phone);
    if (c['Имя']) entry.name = c['Имя']; // берём самое свежее имя из визитов
    entry.visits.push(c);
  });

  return Array.from(map.values());
}

function sumVisits(visits) {
  return visits.reduce((total, v) => {
    const n = parseFloat(String(v['Сумма']).replace(/[^\d.-]/g, '')) || 0;
    return total + n;
  }, 0);
}

// Мягкая прокрутка: встроенный smooth в браузерах быстрый и не настраивается,
// поэтому анимируем сами — с плавным разгоном и торможением (easeInOutCubic).
// Элемент ставится по центру экрана; если он выше экрана — по верхнему краю с небольшим отступом.
// behavior:'instant' нужен, чтобы CSS-правило html{scroll-behavior:smooth} не мешало покадровой анимации.
function smoothScrollToCenter(el, duration = 1200) {
  const rect = el.getBoundingClientRect();
  const startY = window.scrollY;
  let targetY = rect.height >= window.innerHeight
    ? startY + rect.top - 20
    : startY + rect.top + rect.height / 2 - window.innerHeight / 2;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  targetY = Math.max(0, Math.min(targetY, maxY));
  const dist = targetY - startY;
  if (Math.abs(dist) < 2) return;

  const t0 = performance.now();
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function step(now) {
    const t = Math.min((now - t0) / duration, 1);
    window.scrollTo({ top: startY + dist * ease(t), behavior: 'instant' });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderClients(clients) {
  if (!clientsList) return;
  clientsList.innerHTML = '';

  const groups = groupClientsByPhone(clients);

  groups.forEach(group => {
    const total = sumVisits(group.visits);

    const visitsHtml = group.visits.map(v => `
      <p>${v['Модель'] || ''} — ${v['Работы'] || ''} — ${v['Сумма'] || 0} ₽${v['Комментарий'] ? ' (' + v['Комментарий'] + ')' : ''}</p>
    `).join('');

    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <p><b>${group.name}</b></p>
      <a href="tel:${group.phone}"><p>${group.phone}</p></a>
      ${visitsHtml}
      <p><b>Всего потрачено: ${total} ₽</b></p>
    `;

    // Кнопка «Добавить»: переносит имя и номер клиента в форму добавления
    // и прокручивает страницу к ней — чтобы не вводить данные заново.
    const fillBtn = document.createElement('button');
    fillBtn.className = 'addBtn';
    fillBtn.textContent = 'Добавить продажу';
    fillBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('name');
      const phoneInput = document.getElementById('phone');
      if (nameInput) nameInput.value = group.name || '';
      if (phoneInput) phoneInput.value = formatPhone(group.phone);
      if (crmPanel) smoothScrollToCenter(crmPanel, 1200);
    });
    card.appendChild(fillBtn);

    clientsList.appendChild(card);
  });
}

async function loadClients(query = '') {
  if (searchController) searchController.abort();
  searchController = new AbortController();

  try {
    const res = await fetch(
      `${API_URL}?key=${encodeURIComponent(ADMIN_KEY)}&search=${encodeURIComponent(query)}`,
      { signal: searchController.signal }
    );
    const data = await res.json();

    if (data && data.error) {
      sessionStorage.removeItem('adminKey');
      showLogin();
      return;
    }

    renderClients(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Ошибка загрузки клиентов:', err);
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query === '') {
      if (searchController) searchController.abort();
      if (clientsList) clientsList.innerHTML = '';
      return;
    }
    loadClients(query);
  });
}

if (addBtn) {
  addBtn.addEventListener('click', async () => {
    setButtonLoading(addBtn);

    const phoneInput = document.getElementById('phone');
    phoneInput.value = formatPhone(phoneInput.value);

    const client = {
      key: ADMIN_KEY,
      name: document.getElementById('name').value,
      phone: phoneInput.value,
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

    ['name','phone','model','date','work','sum','comment'].forEach(id => {
      document.getElementById(id).value = '';
    });

    await loadClients(searchInput.value.trim());
    clearButtonLoading(addBtn);
  });
}

if (ADMIN_KEY) {
  tryLogin(ADMIN_KEY);
} else {
  showLogin();
}


// ==========================================================
// ЗАЯВКИ ОТ КЛИЕНТОВ
// ==========================================================

if (leadSendBtn) {
  leadSendBtn.addEventListener('click', async () => {
    setButtonLoading(leadSendBtn);

    leadPhone.value = formatPhone(leadPhone.value);

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
    clearButtonLoading(leadSendBtn);
    alert('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
  });
}

async function loadLeads() {
  if (!leadsPanel) return;

  const res = await fetch(`${API_URL}?type=leads&key=${encodeURIComponent(ADMIN_KEY)}`);
  const data = await res.json();

  if (data && data.error) return;
  renderLeads(data);
}

function renderLeads(leads) {
  if (!leadsList) return;
  leadsList.innerHTML = '';

  leads.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'client-card';
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
      setButtonLoading(readBtn);
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'lead_read', key: ADMIN_KEY, id: lead['ID'] })
      });
      card.remove();
    });

    card.appendChild(readBtn);
    leadsList.appendChild(card);
  });
}


// ==========================================================
// ФИЛЬТР РАСЦЕНОК — единственный источник цен на сайте
// (категория → узел → услуга), хранится и передаётся одним JSON-объектом.
// ==========================================================

// Загружает весь объект фильтра — публично, без ключа
async function loadFilterData() {
  if (!categorySelect) return;

  const res = await fetch(`${API_URL}?type=filter`);
  filterData = await res.json();

  populateCategories();
  renderFilterAdminPanel(); // если админ залогинен — сразу обновит и панель управления, и таблицу
}

// Отправляет ВЕСЬ объект фильтра на сервер (полная перезапись)
async function saveFilterData() {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'filter_save', key: ADMIN_KEY, filterData })
  });
}

// --- Публичный калькулятор ---

// Обновляет внешний вид поля выбора: текст подписи, доступность и "заполненность".
// Сам <select> невидим (см. .select в CSS), пользователь видит только подпись <p>.
function setSelectUi(selectEl, labelEl, text, filled) {
  if (!selectEl || !labelEl) return;
  labelEl.textContent = text;
  const box = selectEl.closest('.select');
  if (!box) return;
  box.classList.toggle('select-disabled', selectEl.disabled);
  box.classList.toggle('select-filled', !!filled);
}

function resetIssue() {
  issueSelect.innerHTML = '<option value="">Сначала выберите узел</option>';
  issueSelect.disabled = true;
  setSelectUi(issueSelect, issueLabel, 'Сначала выберите узел', false);
  if (filterResult) filterResult.textContent = '';
  if (filterResult1) filterResult1.textContent = '';
}

function resetNodeAndIssue() {
  nodeSelect.innerHTML = '<option value="">Сначала выберите категорию</option>';
  nodeSelect.disabled = true;
  setSelectUi(nodeSelect, nodeLabel, 'Сначала выберите категорию', false);
  resetIssue();
}

function populateCategories() {
  const categories = Object.keys(filterData);
  categorySelect.innerHTML = '<option value="">Выберите категорию</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
  setSelectUi(categorySelect, categoryLabel, 'Выберите категорию', false);
  resetNodeAndIssue();
}

if (categorySelect) {
  categorySelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    if (!cat || !filterData[cat]) {
      setSelectUi(categorySelect, categoryLabel, 'Выберите категорию', false);
      resetNodeAndIssue();
      return;
    }
    setSelectUi(categorySelect, categoryLabel, cat, true);

    const nodes = Object.keys(filterData[cat]);
    nodeSelect.innerHTML = '<option value="">Выберите узел</option>' +
      nodes.map(n => `<option value="${n}">${n}</option>`).join('');
    nodeSelect.disabled = false;
    setSelectUi(nodeSelect, nodeLabel, 'Выберите узел', false);
    resetIssue();
  });
}

if (nodeSelect) {
  nodeSelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    const node = nodeSelect.value;
    if (!node || !filterData[cat] || !filterData[cat][node]) {
      setSelectUi(nodeSelect, nodeLabel, 'Выберите узел', false);
      resetIssue();
      return;
    }
    setSelectUi(nodeSelect, nodeLabel, node, true);

    const services = filterData[cat][node];
    issueSelect.innerHTML = '<option value="">Выберите поломку</option>' +
      services.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
    issueSelect.disabled = false;
    setSelectUi(issueSelect, issueLabel, 'Выберите поломку', false);
    if (filterResult) filterResult.textContent = '';
    if (filterResult1) filterResult1.textContent = '';
  });
}

if (issueSelect) {
  issueSelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    const node = nodeSelect.value;
    const idx = issueSelect.value;
    if (idx === '' || !filterData[cat] || !filterData[cat][node]) {
      setSelectUi(issueSelect, issueLabel, 'Выберите поломку', false);
      if (filterResult) filterResult.textContent = '';
      if (filterResult1) filterResult1.textContent = '';
      return;
    }

    const service = filterData[cat][node][idx];
    if (!service || !filterResult) return;
    setSelectUi(issueSelect, issueLabel, service.name, true);

    const base = parseFloat(String(service.price).replace(/[^\d.]/g, '')) || 0;
    const low = Math.round(base);
    const timeText = service.time ? ` · Примерное время: ${service.time}` : '';
    filterResult.textContent = `Примерная стоимость: ${low}₽ +- 30% `;
    if (filterResult1) filterResult1.textContent = `${timeText}`;
  });
}

// --- Панель управления для админа (единственное место добавления/удаления услуг) ---

function updateFilterDatalists() {
  if (!filterCategoryList) return;
  filterCategoryList.innerHTML = Object.keys(filterData)
    .map(c => `<option value="${c}">`).join('');
}

function updateNodeDatalist() {
  if (!filterNodeList || !filterAdminCategory) return;
  const cat = filterAdminCategory.value.trim();
  const nodes = filterData[cat] ? Object.keys(filterData[cat]) : [];
  filterNodeList.innerHTML = nodes.map(n => `<option value="${n}">`).join('');
}

// Показывает список услуг для того сочетания категория+узел, что сейчас введено в полях
function renderFilterServiceList() {
  if (!filterAdminServiceList || !filterAdminCategory || !filterAdminNode) return;
  filterAdminServiceList.innerHTML = '';

  const cat = filterAdminCategory.value.trim();
  const node = filterAdminNode.value.trim();
  if (!cat || !node || !filterData[cat] || !filterData[cat][node]) return;

  filterData[cat][node].forEach((service, idx) => {
    const row = document.createElement('div');
    row.className = 'client-card';
    row.innerHTML = `
      <input type="text" class="fs-name" value="${service.name}">
      <input type="text" class="fs-price" value="${service.price}">
      <input type="text" class="fs-time" value="${service.time || ''}">
    `;

    const saveRow = () => {
      service.name = row.querySelector('.fs-name').value;
      service.price = row.querySelector('.fs-price').value;
      service.time = row.querySelector('.fs-time').value;
      saveFilterData();
      renderFilterPriceTable();
    };
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', saveRow));

    const delBtn = document.createElement('button');
    delBtn.className = 'addBtn';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', async () => {
      setButtonLoading(delBtn);
      filterData[cat][node].splice(idx, 1);
      if (filterData[cat][node].length === 0) delete filterData[cat][node];
      if (Object.keys(filterData[cat]).length === 0) delete filterData[cat];
      await saveFilterData();
      renderFilterServiceList();
      updateFilterDatalists();
      updateNodeDatalist();
      renderFilterPriceTable();
    });

    row.appendChild(delBtn);
    filterAdminServiceList.appendChild(row);
  });
}

if (filterAdminCategory) {
  filterAdminCategory.addEventListener('input', () => {
    updateNodeDatalist();
    renderFilterServiceList();
  });
}
if (filterAdminNode) {
  filterAdminNode.addEventListener('input', renderFilterServiceList);
}

if (filterAdminAddBtn) {
  filterAdminAddBtn.addEventListener('click', async () => {
    const cat = filterAdminCategory.value.trim();
    const node = filterAdminNode.value.trim();
    const name = filterAdminName.value.trim();
    if (!cat || !node || !name) return; // категория/узел/название обязательны

    setButtonLoading(filterAdminAddBtn);

    if (!filterData[cat]) filterData[cat] = {};
    if (!filterData[cat][node]) filterData[cat][node] = [];

    filterData[cat][node].push({
      name,
      price: filterAdminPrice.value.trim(),
      time: filterAdminTime.value.trim()
    });

    filterAdminName.value = '';
    filterAdminPrice.value = '';
    filterAdminTime.value = '';

    await saveFilterData();
    renderFilterServiceList();
    updateFilterDatalists();
    updateNodeDatalist();
    renderFilterPriceTable();

    clearButtonLoading(filterAdminAddBtn);
  });
}

function renderFilterAdminPanel() {
  updateFilterDatalists();
  updateNodeDatalist();
  renderFilterServiceList();
  renderFilterPriceTable();
}


// ==========================================================
// ТАБЛИЦА РАСЦЕНОК ДЛЯ АДМИНА
// Строки — последовательно по узлам (мотор, электрика и т.д.), внутри узла — услуги.
// Столбцы — категории техники, полностью динамические: сколько категорий в
// filterData, столько и колонок. Узел и цена редактируются прямо в таблице.
// Видна и редактируется только админом.
// ==========================================================

// Собирает порядок узлов и список уникальных названий услуг внутри каждого узла,
// сохраняя порядок первого появления (а не сортируя по алфавиту).
function buildNodeServiceMap() {
  const nodeOrder = [];
  const nodeServices = {}; // node -> [serviceName, ...] в порядке появления

  Object.keys(filterData).forEach(cat => {
    Object.keys(filterData[cat]).forEach(node => {
      if (!nodeServices[node]) {
        nodeServices[node] = [];
        nodeOrder.push(node);
      }
      filterData[cat][node].forEach(service => {
        if (!nodeServices[node].includes(service.name)) {
          nodeServices[node].push(service.name);
        }
      });
    });
  });

  return { nodeOrder, nodeServices };
}

function findService(cat, node, name) {
  if (!filterData[cat] || !filterData[cat][node]) return null;
  return filterData[cat][node].find(s => s.name === name) || null;
}

// Режим таблицы: false — текст (просмотр), true — поля ввода (редактирование).
let filterTableEditMode = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Кнопка переключения режима — над таблицей (внутри обёртки, перед самой таблицей).
// sticky + left:0 — чтобы кнопка не уезжала при горизонтальной прокрутке широкой таблицы.
if (filterTableWrap && filterPriceTable) {
  const editBar = document.createElement('div');
  editBar.className = 'tableEditBar';
  editBar.style.cssText = 'position: sticky; left: 0; display: flex; justify-content: center;';

  const editToggleBtn = document.createElement('button');
  editToggleBtn.className = 'addBtn';
  editToggleBtn.textContent = 'Редактировать таблицу';
  editToggleBtn.addEventListener('click', () => {
    filterTableEditMode = !filterTableEditMode;
    editToggleBtn.textContent = filterTableEditMode ? 'Готово' : 'Редактировать таблицу';
    renderFilterPriceTable();
  });

  editBar.appendChild(editToggleBtn);
  filterTableWrap.insertBefore(editBar, filterPriceTable);
}

function renderFilterPriceTable() {
  if (!filterPriceTable) return;

  const categories = Object.keys(filterData);
  if (categories.length === 0) {
    filterPriceTable.innerHTML = '';
    return;
  }

  const { nodeOrder, nodeServices } = buildNodeServiceMap();

  let html = '<tr><th><p>услуга</p></th>' +
    categories.map(c => `<th><p>${c}</p></th>`).join('') +
    '</tr>';

  // Обычный режим — просто текст; режим редактирования (кнопка над таблицей) — поля ввода.
  nodeOrder.forEach(node => {
    html += `<tr class="node-header"><th colspan="${categories.length + 1}">` +
      (filterTableEditMode
        ? `<input type="text" class="node-header-cell" data-old-node="${node}" value="${node}">`
        : `<p>${escapeHtml(node)}</p>`) +
      '</th></tr>';

    nodeServices[node].forEach(name => {
      html += '<tr>';
      html += filterTableEditMode
        ? `<td><input type="text" class="name-cell" data-node="${node}" data-old-name="${name}" value="${name}"></td>`
        : `<td><p>${escapeHtml(name)}</p></td>`;
      categories.forEach(cat => {
        const service = findService(cat, node, name);
        const value = service ? service.price : '';
        html += filterTableEditMode
          ? `<td><input type="text" class="price-cell" data-cat="${cat}" data-node="${node}" data-name="${name}" value="${value}" placeholder="—"></td>`
          : `<td><p>${value === '' ? '—' : escapeHtml(value)}</p></td>`;
      });
      html += '</tr>';
    });
  });

  filterPriceTable.innerHTML = html;

  filterPriceTable.querySelectorAll('.price-cell').forEach(inp => {
    inp.addEventListener('change', () => {
      const cat = inp.dataset.cat;
      const node = inp.dataset.node;
      const name = inp.dataset.name;
      const value = inp.value.trim();
      let service = findService(cat, node, name);

      if (!service) {
        if (!value) return; // пустое поле для несуществующей услуги — ничего не делаем
        if (!filterData[cat]) filterData[cat] = {};
        if (!filterData[cat][node]) filterData[cat][node] = [];
        filterData[cat][node].push({ name, price: value, time: '' });
        saveFilterData();
        return;
      }

      if (!value) {
        // очистили цену у существующей услуги — убираем её из этой категории
        filterData[cat][node] = filterData[cat][node].filter(s => s !== service);
        if (filterData[cat][node].length === 0) delete filterData[cat][node];
        if (Object.keys(filterData[cat]).length === 0) delete filterData[cat];
        saveFilterData();
        renderFilterPriceTable();
        return;
      }

      service.price = value;
      saveFilterData();
    });
  });

  // Переименование узла целиком — сразу во всех категориях, где он встречается
  filterPriceTable.querySelectorAll('.node-header-cell').forEach(inp => {
    inp.addEventListener('change', () => {
      const oldNode = inp.dataset.oldNode;
      const newNode = inp.value.trim();

      if (!newNode || newNode === oldNode) {
        inp.value = oldNode;
        return;
      }

      categories.forEach(cat => {
        if (!filterData[cat] || !filterData[cat][oldNode]) return;
        if (!filterData[cat][newNode]) filterData[cat][newNode] = [];
        filterData[cat][newNode] = filterData[cat][newNode].concat(filterData[cat][oldNode]);
        delete filterData[cat][oldNode];
      });

      saveFilterData();
      renderFilterPriceTable();
      updateFilterDatalists();
      updateNodeDatalist();
    });
  });

  // Переименование услуги — сразу во всех категориях этого узла
  filterPriceTable.querySelectorAll('.name-cell').forEach(inp => {
    inp.addEventListener('change', () => {
      const node = inp.dataset.node;
      const oldName = inp.dataset.oldName;
      const newName = inp.value.trim();

      if (!newName || newName === oldName) {
        inp.value = oldName;
        return;
      }

      categories.forEach(cat => {
        const service = findService(cat, node, oldName);
        if (!service) return;
        service.name = newName;
      });

      saveFilterData();
      renderFilterPriceTable();
    });
  });
}

loadFilterData(); // грузим сразу при открытии страницы — калькулятор публичный
