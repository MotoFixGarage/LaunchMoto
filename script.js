const API_URL = 'https://script.google.com/macros/s/AKfycbyn0A2mJTOV6r0mQuTyFukbwNeiNQbfm657dBjroKWtnmMggtIY8tch0ssrjP8cDd4W/exec'; // твой URL из деплоя

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

function showCrm() {
  adminLogin.style.display = 'none';
  crmPanel.style.display = 'block';
}

function showLogin() {
  adminLogin.style.display = 'block';
  crmPanel.style.display = 'none';
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
  const res = await fetch(`${API_URL}?key=${encodeURIComponent(ADMIN_KEY)}&search=${encodeURIComponent(query)}`);
  const data = await res.json();

  if (data && data.error) {
    // ключ протух/невалиден — выкидываем на логин
    sessionStorage.removeItem('adminKey');
    showLogin();
    return;
  }

  renderClients(data);
}

// Поиск срабатывает при каждом вводе символа
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (query === '') {
    clientsList.innerHTML = ''; // ничего не показываем, если поле пустое
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

   // обновляем список с учётом текущего поиска
});

// Если ключ уже сохранён с прошлого раза (в этой же вкладке) — сразу пробуем войти
if (ADMIN_KEY) {
  tryLogin(ADMIN_KEY);
} else {
  showLogin();
}
