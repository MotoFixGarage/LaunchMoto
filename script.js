const API_URL = 'https://script.google.com/macros/s/AKfycbyn0A2mJTOV6r0mQuTyFukbwNeiNQbfm657dBjroKWtnmMggtIY8tch0ssrjP8cDd4W/exec';
// ^ ссылка на твой Apps Script — это "бэкенд", через него идут все запросы к Google Таблице

const searchInput = document.getElementById('searchInput');
// находим на странице поле поиска по его id и сохраняем ссылку на этот элемент в переменную

const clientsList = document.getElementById('clientsList');
// находим контейнер, куда будем вставлять карточки клиентов

const addBtn = document.getElementById('addBtn');
// находим кнопку "Добавить клиента"

const adminLogin = document.getElementById('adminLogin');
// находим блок-обёртку формы входа (пароль администратора)

const crmPanel = document.getElementById('crmPanel');
// находим саму CRM-панель (поля клиента, поиск, список) — она скрыта, пока не войдёшь

const loginBtn = document.getElementById('loginBtn');
// находим кнопку "Войти"

const adminPass = document.getElementById('adminPass');
// находим поле ввода пароля администратора

// Ключ храним в sessionStorage — живёт, пока открыта вкладка,
// при закрытии браузера/вкладки слетает и придётся войти заново
let ADMIN_KEY = sessionStorage.getItem('adminKey') || '';
// пытаемся достать сохранённый ключ из sessionStorage браузера;
// если его там нет — используем пустую строку

// Контроллер последнего запроса на поиск — нужен, чтобы отменять
// устаревшие запросы и не дать им перезаписать уже очищенный список
let searchController = null;
// сюда будем класть объект AbortController — им можно "отменить" fetch-запрос,
// который ещё не завершился

function showCrm() {
  // функция, которая показывает CRM-панель и прячет форму логина
  adminLogin.style.display = 'none';
  // прячем форму входа
  crmPanel.style.display = 'block';
  // показываем CRM-панель
}

function showLogin() {
  // функция, которая показывает форму логина и прячет CRM-панель
  adminLogin.style.display = 'block';
  // показываем форму входа
  crmPanel.style.display = 'none';
  // прячем CRM-панель
}

// Пробуем ключ на бэкенде: если он верный — бэкенд вернёт список (пустой или нет),
// если неверный — вернёт {error: 'unauthorized'}
async function tryLogin(key) {
  // асинхронная функция — значит внутри можно использовать await и ждать ответ сервера
  const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}&search=`);
  // отправляем GET-запрос на бэкенд с переданным ключом и пустым поиском —
  // это просто "пробный" запрос, чтобы проверить, верный ли пароль
  const data = await res.json();
  // превращаем текстовый ответ сервера в JS-объект/массив

  if (data && data.error) {
    // если сервер вернул поле error — значит ключ неверный
    alert('Неверный пароль');
    // показываем всплывающее окно с сообщением
    sessionStorage.removeItem('adminKey');
    // на всякий случай стираем неверный ключ из хранилища
    showLogin();
    // возвращаем пользователя на форму входа
    return false;
    // выходим из функции с результатом "не получилось"
  }

  ADMIN_KEY = key;
  // если ошибки не было — запоминаем ключ как рабочий в переменной
  sessionStorage.setItem('adminKey', key);
  // сохраняем ключ в sessionStorage, чтобы не спрашивать пароль повторно в этой вкладке
  showCrm();
  // показываем CRM-панель
  clientsList.innerHTML = ''; // список пуст, пока не начали искать
  // очищаем список клиентов — он должен быть пустым сразу после входа
  return true;
  // выходим из функции с результатом "успешно"
}

loginBtn.addEventListener('click', () => {
  // вешаем обработчик на кнопку "Войти" — сработает при клике
  tryLogin(adminPass.value);
  // вызываем проверку пароля, передавая туда то, что человек ввёл в поле пароля
});

// Отрисовать список клиентов на странице
function renderClients(clients) {
  // функция принимает массив клиентов и рисует их карточками на странице
  clientsList.innerHTML = ''; // очищаем перед перерисовкой
  // стираем всё, что было в списке раньше, чтобы не дублировать карточки
  clients.forEach(c => {
    // проходим по каждому клиенту в массиве по очереди
    const card = document.createElement('div');
    // создаём новый пустой div — это будет "карточка"
    card.className = 'client-card';
    // присваиваем ему класс для стилизации в CSS
    card.innerHTML = `
      <p><b>${c['Имя']}</b> </p>
      <a href="tel:${c['Телефон']}"><p>${c['Телефон']}</p><a/>
      <p>${c['Модель']}</p>
      <p>${c['Работы']}</p>
      <p>${c['Сумма']} ₽</p>
      <p>${c['Комментарий'] || ''}</p>
    `;
    // заполняем карточку HTML-разметкой с данными конкретного клиента;
    // c['Имя'], c['Телефон'] и т.д. — это значения из соответствующих колонок таблицы;
    // c['Комментарий'] || '' означает "если комментария нет — вставить пустую строку"
    clientsList.appendChild(card);
    // добавляем готовую карточку в контейнер на странице
  });
}

// Запрос списка (с фильтром и ключом администратора)
async function loadClients(query = '') {
  // функция загружает клиентов с сервера; query — необязательный параметр поиска
  if (searchController) {
    // если уже есть предыдущий незавершённый запрос
    searchController.abort();
    // отменяем его — иначе он может прийти позже и перезаписать актуальные данные
  }
  searchController = new AbortController();
  // создаём новый "пульт отмены" для текущего запроса

  try {
    // пробуем выполнить код ниже; если что-то пойдёт не так — перейдём в catch
    const res = await fetch(
      `${API_URL}?key=${encodeURIComponent(ADMIN_KEY)}&search=${encodeURIComponent(query)}`,
      { signal: searchController.signal }
    );
    // отправляем запрос на сервер с ключом и текстом поиска;
    // signal привязывает этот fetch к нашему AbortController, чтобы его можно было отменить
    const data = await res.json();
    // превращаем ответ сервера в JS-объект/массив

    if (data && data.error) {
      // если сервер ответил ошибкой (например, ключ больше не подходит)
      sessionStorage.removeItem('adminKey');
      // стираем невалидный ключ
      showLogin();
      // возвращаем на экран входа
      return;
      // прекращаем выполнение функции
    }

    renderClients(data);
    // если всё хорошо — рисуем полученных клиентов на странице
  } catch (err) {
    // сюда попадаем, если fetch выбросил ошибку (в том числе если мы сами его отменили)
    if (err.name === 'AbortError') {
      // если ошибка именно "запрос отменён" — это нормально и ожидаемо
      return;
      // просто тихо выходим, ничего не делаем
    }
    console.error('Ошибка загрузки клиентов:', err);
    // если ошибка какая-то другая (например, нет интернета) — выводим её в консоль браузера
  }
}

// Поиск срабатывает при каждом вводе символа
searchInput.addEventListener('input', () => {
  // вешаем обработчик на поле поиска — срабатывает при каждом изменении текста в нём
  const query = searchInput.value.trim();
  // берём текущий текст из поля поиска и убираем лишние пробелы по краям
  if (query === '') {
    // если поле поиска пустое
    if (searchController) {
      // и есть незавершённый запрос
      searchController.abort();
      // отменяем всё, что ещё летит в фоне — иначе его ответ
      // придёт позже и снова покажет старую карточку
    }
    clientsList.innerHTML = '';
    // очищаем список клиентов на странице
    return;
    // выходим из функции, не делая новый запрос
  }
  loadClients(query);
  // если текст не пустой — запрашиваем клиентов с учётом введённого текста
});

// Добавление нового клиента
addBtn.addEventListener('click', async () => {
  // вешаем обработчик на кнопку "Добавить" — асинхронная функция, т.к. внутри есть await
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
  // собираем объект со всеми данными нового клиента —
  // берём значения прямо из полей ввода на странице по их id

  await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(client)
  });
  // отправляем эти данные на сервер методом POST;
  // JSON.stringify превращает JS-объект в текстовую строку JSON для передачи;
  // Content-Type: text/plain нужен, чтобы Apps Script не спотыкался на CORS-запросах

  // очищаем поля после отправки
  ['name','phone','model','date','work','sum','comment'].forEach(id => {
    document.getElementById(id).value = '';
  });
  // проходим по списку id всех полей формы и очищаем каждое —
  // чтобы форма была пустой перед вводом следующего клиента

  loadClients(searchInput.value.trim()); // обновляем список с учётом текущего поиска
  // заново запрашиваем список клиентов, чтобы новый клиент сразу появился в результатах
});

// Если ключ уже сохранён с прошлого раза (в этой же вкладке) — сразу пробуем войти
if (ADMIN_KEY) {
  // если в переменной ADMIN_KEY что-то есть (не пустая строка)
  tryLogin(ADMIN_KEY);
  // пробуем сразу войти с этим ключом, не спрашивая пароль заново
} else {
  // если ключа нет
  showLogin();
  // показываем форму входа
}

// --- Клик по расценкам добавляет работу и сумму в форму CRM ---
const priceTable = document.getElementById('infoll');
// находим на странице таблицу с расценками по её id
if (priceTable) {
  // проверяем, что таблица вообще есть на этой странице (на некоторых страницах её может не быть)
  const headerCells = priceTable.querySelectorAll('tr:first-child th p');
  // находим все <p> внутри заголовков первой строки таблицы (там названия колонок)
  const bikeTypes = Array.from(headerCells).map(p => p.textContent.trim());
  // превращаем эти заголовки в обычный JS-массив текстовых строк, например ["пит/ скут", "эндуро"]
  // bikeTypes[0] — вторая колонка (пит/скут), bikeTypes[1] — третья (эндуро)

  const rows = priceTable.querySelectorAll('tr');
  // находим вообще все строки таблицы (включая заголовок)
  rows.forEach((row, rowIndex) => {
    // проходим по каждой строке, rowIndex — её порядковый номер (начиная с 0)
    if (rowIndex === 0) return; // пропускаем заголовок
    // если это первая строка (заголовок) — пропускаем её, там нет цен для клика
    const cells = row.querySelectorAll('td');
    // находим все ячейки <td> в текущей строке
    if (cells.length < 3) return;
    // если в строке меньше 3 ячеек — что-то не так, пропускаем такую строку

    const nameEl = cells[0].querySelector('p');
    // находим <p> внутри первой ячейки строки — там название услуги
    const serviceName = nameEl ? nameEl.textContent.trim() : '';
    // достаём текст названия услуги; если вдруг <p> не нашёлся — используем пустую строку

    [1, 2].forEach(colIndex => {
      // проходим по индексам второй и третьей ячейки (0 — первая уже использована для имени)
      const cell = cells[colIndex];
      // берём саму ячейку с ценой
      const priceEl = cell.querySelector('p');
      // находим <p> внутри неё
      const priceText = priceEl ? priceEl.textContent.trim() : '';
      // достаём текст цены, например "2 000 ₽"

      // берём первое число в тексте ячейки (учитывает "2 000 ₽", "от 2000 ₽",
      // "1500 - 3000 ₽" — в последнем случае возьмётся нижняя граница)
      const match = priceText.match(/\d[\d\s]*\d|\d/);
      // ищем в тексте первую последовательность цифр (с возможными пробелами внутри, как разделитель тысяч)
      const priceNumber = match ? parseInt(match[0].replace(/\s/g, ''), 10) : NaN;
      // если число нашлось — убираем из него пробелы и превращаем в настоящее число;
      // если не нашлось (например, там просто "-") — получаем NaN ("не число")

      if (!priceNumber || isNaN(priceNumber)) {
        // если число не получилось или оно равно 0
        cell.classList.add('disabled'); // "-" или пусто — не кликабельно
        // добавляем класс disabled для внешнего вида и прекращаем работу с этой ячейкой
        return;
      }

      cell.classList.add('price-cell');
      // добавляем класс price-cell — по нему в CSS стоит курсор-указатель и подсветка
      cell.addEventListener('click', () => {
        // вешаем обработчик клика на саму ячейку с ценой
        const workField = document.getElementById('work');
        // находим поле "Какие работы" в форме добавления клиента
        const sumField = document.getElementById('sum');
        // находим поле "Сумма" в той же форме
        if (!workField || !sumField) return; // на этой странице формы CRM может не быть
        // если этих полей на странице нет — выходим, чтобы не было ошибки

        const bikeType = bikeTypes[colIndex - 1] || '';
        // берём название колонки (пит/скут или эндуро) по индексу текущей ячейки
        const entry = `${serviceName} (${bikeType}) — ${priceNumber}₽`;
        // собираем текстовую строку вида "диагностика (пит/ скут) — 2000₽"

        workField.value = workField.value
          ? `${workField.value}, ${entry}`
          : entry;
        // если в поле "работы" уже что-то есть — дописываем через запятую,
        // если поле было пустым — просто вставляем новую запись

        const currentSum = parseInt(sumField.value, 10) || 0;
        // берём текущее значение поля "Сумма" и превращаем его в число;
        // если поле было пустым или там был не-числовой мусор — считаем, что там 0
        sumField.value = currentSum + priceNumber;
        // прибавляем цену этой услуги к текущей сумме и записываем обратно в поле
      });
    });
  });
}
