const API_URL = 'https://script.google.com/macros/s/AKfycbwOARDT9PEQiPW14PWpkIaKi9wopY4Kmq3thvQXZ-6BtDibV1qnA8V_l1o9aCrwY8_t/exec'; // твой URL из деплоя

const searchInput = document.getElementById('searchInput');
const clientsList = document.getElementById('clientsList');
const addBtn = document.getElementById('addBtn');

// Отрисовать список клиентов на странице
function renderClients(clients) {
  clientsList.innerHTML = ''; // очищаем перед перерисовкой
  clients.forEach(c => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <p><b>${c['Имя']}</b> — ${c['Телефон']}</p>
      <p>${c['Модель']} | ${c['Работы']} | ${c['Сумма']} ₽</p>
      <p>${c['Комментарий'] || ''}</p>
    `;
    clientsList.appendChild(card);
  });
}

// Запрос списка (с фильтром, если есть текст в поиске)
async function loadClients(query = '') {
  const res = await fetch(`${API_URL}?search=${encodeURIComponent(query)}`);
  const data = await res.json();
  renderClients(data);
}

// Поиск срабатывает при каждом вводе символа
searchInput.addEventListener('input', () => {
  loadClients(searchInput.value);
});

// Добавление нового клиента
addBtn.addEventListener('click', async () => {
  const client = {
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    model: document.getElementById('model').value,
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
  ['name','phone','model','work','sum','comment'].forEach(id => {
    document.getElementById(id).value = '';
  });

  loadClients(); // обновляем список, чтобы новый клиент сразу появился
});

// Загружаем список сразу при открытии страницы
loadClients();