const API_URL = 'https://script.google.com/macros/s/AKfycbzbQgHkcDulay49B9oSsdtJF_fAGCno3J-cd82cRip9TT8qDWTCRLGiv3eN7-oh5irN/exec'; // твой URL из деплоя

const searchInput = document.getElementById('searchInput');
const clientsList = document.getElementById('clientsList');
const addBtn = document.getElementById('addBtn');

const adminLogin = document.getElementById('adminLogin');
const crmPanel = document.getElementById('crmPanel');
const loginBtn = document.getElementById('loginBtn');
const adminPass = document.getElementById('adminPass');

let ADMIN_KEY = sessionStorage.getItem('adminKey') || '';
let searchController = null;

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

function showCrm() {
  if (adminLogin) adminLogin.style.display = 'none';
  if (crmPanel) crmPanel.style.display = 'block';
  if (leadFormPublic) leadFormPublic.style.display = 'none';
  if (leadsPanel) leadsPanel.style.display = 'block';
  if (filterAdminRow) filterAdminRow.style.display = 'flex';
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
// ФИЛЬТР РАСЦЕНОК — единственный источник цен на сайте
// (категория → узел → услуга), хранится и передаётся одним JSON-объектом.
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
  if (filterResult1) filterResult1.textContent = '';
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
    if (filterResult1) filterResult1.textContent = '';
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
    if (filterResult1) filterResult1.textContent = '';
  });
}

if (issueSelect) {
  issueSelect.addEventListener('change', () => {
    const cat = categorySelect.value;
    const node = nodeSelect.value;
    const idx = issueSelect.value;
    if (idx === '' || !filterData[cat] || !filterData[cat][node]) {
      if (filterResult) filterResult.textContent = '';
      if (filterResult1) filterResult1.textContent = '';
      return;
    }

    const service = filterData[cat][node][idx];
    if (!service || !filterResult) return;

    const base = parseFloat(String(service.price).replace(/[^\d.]/g, '')) || 0;
    const low = Math.round(base);
    const timeText = service.time ? ` · Примерное время: ${service.time}` : '';
    filterResult.textContent = `Примерная стоимость: ${low}₽ +- 30% `;
    if (filterResult1) filterResult1.textContent = `${timeText}`;
  });
}

// --- Панель управления для админа (единственное место редактирования цен) ---

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
