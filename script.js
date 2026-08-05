const API_URL = 'https://script.google.com/macros/s/AKfycbxJJgol7l_PUEmUAVgZZ4e6uWrRj5X0yARAt3Bp8be47H9D3F9i6i166iA2dsaPR31x/exec'; // твой URL из деплоя

const searchInput = document.getElementById('searchInput');
const clientsList = document.getElementById('clientsList');
const addBtn = document.getElementById('addBtn');

const adminLogin = document.getElementById('adminLogin');
const crmPanel = document.getElementById('crmPanel');
const loginBtn = document.getElementById('loginBtn');
const adminPass = document.getElementById('adminPass');

let ADMIN_KEY = sessionStorage.getItem('adminKey') || '';
let searchController = null;

// --- Расценки ---
const priceTable = document.getElementById('infoll');
const addPriceRow = document.getElementById('addPriceRow');
const priceName = document.getElementById('priceName');
const pricePit = document.getElementById('pricePit');
const priceEnduro = document.getElementById('priceEnduro');
const addPriceBtn = document.getElementById('addPriceBtn');
const editModeBtn = document.getElementById('editModeBtn');
const priceSearchInput = document.getElementById('priceSearchInput');

// --- Заявки ---
const leadFormPublic = document.getElementById('leadFormPublic');
const leadName = document.getElementById('leadName');
const leadPhone = document.getElementById('leadPhone');
const leadTech = document.getElementById('leadTech');
const leadWork = document.getElementById('leadWork');
const leadSendBtn = document.getElementById('leadSendBtn');
const leadsPanel = document.getElementById('leadsPanel');
const leadsList = document.getElementById('leadsList');

// --- Фильтр расценок для клиента (категория → узел → услуги), хранится как JSON ---
const categorySelect = document.getElementById('categorySelect');
const nodeSelect = document.getElementById('nodeSelect');
const issueSelect = document.getElementById('issueSelect');
const filterResult = document.getElementById('filterResult');
const filterResult1 = document.getElementById('filterResult1');

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

let filterData = {}; // весь объект целиком: { Категория: { Узел: [ {name, price, time}, ... ] } }

let pricesCache = [];
let editMode = false;

function showCrm() {
  if (adminLogin) adminLogin.style.display = 'none';
  if (crmPanel) crmPanel.style.display = 'block';
  if (addPriceRow) addPriceRow.style.display = 'flex';
  if (priceTable) priceTable.style.display = 'table'; // ⚠ именно 'table', не 'block' — иначе строки ломаются
  if (priceSearchInput) priceSearchInput.style.display = 'block';
  if (leadFormPublic) leadFormPublic.style.display = 'none';
  if (leadsPanel) leadsPanel.style.display = 'block';
  if (filterAdminRow) filterAdminRow.style.display = 'flex';
  renderFilterAdminPanel();
  renderPrices();
  loadLeads();
}

function showLogin() {
  if (adminLogin) adminLogin.style.display = 'block';
  if (crmPanel) crmPanel.style.display = 'none';
  if (addPriceRow) addPriceRow.style.display = 'none';
  if (priceTable) priceTable.style.display = 'none';
  if (priceSearchInput) priceSearchInput.style.display = 'none';
  if (leadFormPublic) leadFormPublic.style.display = 'block';
  if (leadsPanel) leadsPanel.style.display = 'none';
  if (filterAdminRow) filterAdminRow.style.display = 'none';
  if (filterAdminServiceList) filterAdminServiceList.innerHTML = '';
  editMode = false;
  if (editModeBtn) editModeBtn.textContent = 'Редактировать таблицу';
  renderPrices();
}

if (editModeBtn) {
  editModeBtn.addEventListener('click', () => {
    editMode = !editMode;
    editModeBtn.textContent = editMode ? 'Готово' : 'Редактировать таблицу';
    renderPrices();
  });
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

if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    tryLogin(adminPass.value);
    adminPass.value = '';
  });
}

function renderClients(clients) {
  if (!clientsList) return;
  clientsList.innerHTML = '';
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

    ['name','phone','model','date','work','sum','comment'].forEach(id => {
      document.getElementById(id).value = '';
    });

    loadClients(searchInput.value.trim());
  });
}

if (ADMIN_KEY) {
  tryLogin(ADMIN_KEY);
} else {
  showLogin();
}


// ==========================================================
// РАСЦЕНКИ
// ==========================================================

async function loadPrices() {
  if (!priceTable) return;
  const res = await fetch(`${API_URL}?type=prices`);
  const data = await res.json();
  pricesCache = data;
  renderPrices();
}

async function savePrice({ id, name, pit, enduro }) {
  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      type: id ? 'price_edit' : 'price_add',
      key: ADMIN_KEY,
      id, name, pit, enduro
    })
  });
}

function renderPrices(list) {
  if (!priceTable) return;

  const items = list || pricesCache;
  const isEditing = ADMIN_KEY && editMode;

  const rows = priceTable.querySelectorAll('tr');
  rows.forEach((row, i) => { if (i > 0) row.remove(); });

  items.forEach(item => {
    const tr = document.createElement('tr');

    if (isEditing) {
      tr.innerHTML = `
        <td><input type="text" class="edit-name" value="${item['Название']}"></td>
        <td><input type="text" class="edit-pit" value="${item['ЦенаПитСкут']}"></td>
        <td><input type="text" class="edit-enduro" value="${item['ЦенаЭндуро']}"></td>
      `;
      const saveThisRow = () => {
        savePrice({
          id: item['ID'],
          name: tr.querySelector('.edit-name').value,
          pit: tr.querySelector('.edit-pit').value,
          enduro: tr.querySelector('.edit-enduro').value
        });
      };
      tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', saveThisRow));
    } else {
      tr.innerHTML = `
        <td><p>${item['Название']}</p></td>
        <td class="price-cell" data-price="${item['ЦенаПитСкут']}" data-type="пит/ скут"><p>${item['ЦенаПитСкут']}</p></td>
        <td class="price-cell" data-price="${item['ЦенаЭндуро']}" data-type="эндуро"><p>${item['ЦенаЭндуро']}</p></td>
      `;
    }

    priceTable.appendChild(tr);
  });

  if (!isEditing) {
    attachPriceCellClicks();
  }
}

function attachPriceCellClicks() {
  document.querySelectorAll('.price-cell').forEach(cell => {
    const priceText = cell.dataset.price || '';
    const match = priceText.match(/\d[\d\s]*\d|\d/);
    const priceNumber = match ? parseInt(match[0].replace(/\s/g, ''), 10) : NaN;

    if (!priceNumber || isNaN(priceNumber)) {
      cell.classList.add('disabled');
      return;
    }

    cell.classList.add('price-cell');
    cell.addEventListener('click', () => {
      const workField = document.getElementById('work');
      const sumField = document.getElementById('sum');
      if (!workField || !sumField) return;

      const serviceNameEl = cell.closest('tr').querySelector('td p');
      const serviceName = serviceNameEl ? serviceNameEl.textContent.trim() : '';
      const bikeType = cell.dataset.type || '';
      const entry = `${serviceName} (${bikeType}) — ${priceText}`;

      workField.value = workField.value ? `${workField.value}, ${entry}` : entry;
      const currentSum = parseInt(sumField.value, 10) || 0;
      sumField.value = currentSum + priceNumber;
    });
  });
}

if (addPriceBtn) {
  addPriceBtn.addEventListener('click', async () => {
    await savePrice({ name: priceName.value, pit: pricePit.value, enduro: priceEnduro.value });
    priceName.value = '';
    pricePit.value = '';
    priceEnduro.value = '';
    loadPrices();
  });
}

if (priceSearchInput) {
  priceSearchInput.addEventListener('input', () => {
    const query = priceSearchInput.value.trim().toLowerCase();
    if (query === '') {
      renderPrices();
      return;
    }
    const filtered = pricesCache.filter(item =>
      String(item['Название']).toLowerCase().includes(query)
    );
    renderPrices(filtered);
  });
}

loadPrices();


// ==========================================================
// ЗАЯВКИ ОТ КЛИЕНТОВ
// ==========================================================

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

async function loadLeads() {
  if (!leadsPanel) return;

  // ВАЖНО: тут запрашиваются именно заявки (type=leads), не клиенты.
  // Если сюда прилетают карточки клиентов — дело не в этой функции,
  // а в том, что отвечает сам API_URL на этот конкретный запрос.
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
// ФИЛЬТР РАСЦЕНОК ДЛЯ КЛИЕНТА (категория → узел → услуга)
// Вся иерархия хранится и передаётся одним JSON-объектом.
// ==========================================================

// Загружает весь объект фильтра — публично, без ключа
async function loadFilterData() {
  if (!categorySelect) return;

  const res = await fetch(`${API_URL}?type=filter`);
  filterData = await res.json();

  populateCategories();
  renderFilterAdminPanel(); // если админ залогинен — сразу обновит и панель управления
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

function populateCategories() {
  const categories = Object.keys(filterData);
  categorySelect.innerHTML = '<option value="">Выберите категорию</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
  resetNodeAndIssue();
}

function resetNodeAndIssue() {
  nodeSelect.innerHTML = '<option value="">Сначала выберите категорию</option>';
  nodeSelect.disabled = true;
  issueSelect.innerHTML = '<option value="">Сначала выберите узел</option>';
  issueSelect.disabled = true;
  if (filterResult) filterResult.textContent = '';
}

if (categorySelect) {
  categorySelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    if (!cat || !filterData[cat]) {
      resetNodeAndIssue();
      return;
    }
    const nodes = Object.keys(filterData[cat]);
    nodeSelect.innerHTML = '<option value="">Выберите узел</option>' +
      nodes.map(n => `<option value="${n}">${n}</option>`).join('');
    nodeSelect.disabled = false;

    issueSelect.innerHTML = '<option value="">Сначала выберите узел</option>';
    issueSelect.disabled = true;
    if (filterResult) filterResult.textContent = '';
  });
}

if (nodeSelect) {
  nodeSelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    const node = nodeSelect.value;
    if (!node || !filterData[cat] || !filterData[cat][node]) return;

    const services = filterData[cat][node];
    issueSelect.innerHTML = '<option value="">Выберите поломку</option>' +
      services.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
    issueSelect.disabled = false;
    if (filterResult) filterResult.textContent = '';
  });
}

if (issueSelect) {
  issueSelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    const node = nodeSelect.value;
    const idx = issueSelect.value;
    if (idx === '' || !filterData[cat] || !filterData[cat][node]) {
      if (filterResult) filterResult.textContent = '';
      return;
    }

    const service = filterData[cat][node][idx];
    if (!service || !filterResult) return;

    const base = parseFloat(String(service.price).replace(/[^\d.]/g, '')) || 0;
    const low = Math.round(base);
    const high = Math.round(base * 1.2);
    const timeText = service.time ? ` · Примерное время: ${service.time}` : '';
    filterResult.textContent = `Примерная стоимость: ${low}₽ +- 30% `;
    filterResult1.textContent = `${timeText}`;
  });
}

// --- Панель управления для админа ---

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
    };
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', saveRow));

    const delBtn = document.createElement('button');
    delBtn.className = 'addBtn';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => {
      filterData[cat][node].splice(idx, 1);
      if (filterData[cat][node].length === 0) delete filterData[cat][node];
      if (Object.keys(filterData[cat]).length === 0) delete filterData[cat];
      saveFilterData();
      renderFilterServiceList();
      updateFilterDatalists();
      updateNodeDatalist();
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
  filterAdminAddBtn.addEventListener('click', () => {
    const cat = filterAdminCategory.value.trim();
    const node = filterAdminNode.value.trim();
    const name = filterAdminName.value.trim();
    if (!cat || !node || !name) return; // категория/узел/название обязательны

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

    saveFilterData();
    renderFilterServiceList();
    updateFilterDatalists();
    updateNodeDatalist();
  });
}

function renderFilterAdminPanel() {
  updateFilterDatalists();
  updateNodeDatalist();
  renderFilterServiceList();
}

loadFilterData(); // грузим сразу при открытии страницы — калькулятор публичный
