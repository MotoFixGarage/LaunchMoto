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
    delBtn.addEventListener('click', () => {
      filterData[cat][node].splice(idx, 1);
      if (filterData[cat][node].length === 0) delete filterData[cat][node];
      if (Object.keys(filterData[cat]).length === 0) delete filterData[cat];
      saveFilterData();
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
    renderFilterPriceTable();
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

  nodeOrder.forEach(node => {
    html += `<tr class="node-header"><th colspan="${categories.length + 1}">` +
      `<input type="text" class="node-header-cell" data-old-node="${node}" value="${node}">` +
      '</th></tr>';

    nodeServices[node].forEach(name => {
      html += '<tr>';
      html += `<td><input type="text" class="name-cell" data-node="${node}" data-old-name="${name}" value="${name}"></td>`;
      categories.forEach(cat => {
        const service = findService(cat, node, name);
        const value = service ? service.price : '';
        html += `<td><input type="text" class="price-cell" data-cat="${cat}" data-node="${node}" data-name="${name}" value="${value}" placeholder="—"></td>`;
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
