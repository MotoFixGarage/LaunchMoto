// ==========================================================
// ФИКСАЦИЯ ФОНА НА ТЕЛЕФОНАХ
// На телефонах адресная строка при прокрутке сворачивается/разворачивается
// и меняет высоту окна. Если фон тянется по высоте окна, background-size: cover
// пересчитывает масштаб, и картинка "дёргается".
//
// 1) Высота слоя .background запоминается по МАКСИМУМУ высоты окна
//    и больше не уменьшается (сбрасывается только при повороте экрана).
// 2) Высота КАРТИНКИ внутри слоя (CSS-переменная --bg-img-h) один раз
//    берётся с запасом (EXTRA) сверх текущей высоты окна и дальше не меняется.
//    Слой обрезает картинку по краю окна, поэтому при сворачивании адресной строки
//    масштаб остаётся прежним, а просто открывается заранее готовая нижняя часть.
//    Если окно когда-нибудь окажется выше картинки, она вырастет до его высоты.
//
// Запас EXTRA: примерная высота, на которую окно вырастает при сворачивании
// адресной строки (на iPhone ~80–100px). Поставьте 0, чтобы выключить запас.
//
// На компьютерах (нет тач-экрана) ничего не делаем — работает CSS (100lvh).
// ==========================================================
(function () {
  const EXTRA = 120; // px запаса для картинки

  const bg = document.querySelector('.background');
  if (!bg) return;

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;

  let maxH = 0;   // высота слоя
  let imgH = 0;   // высота картинки внутри слоя

  function winH() {
    return Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  }

  function apply(reset) {
    const h = winH();
    if (reset) { maxH = 0; imgH = 0; }
    maxH = Math.max(maxH, h);
    if (imgH === 0) imgH = h + EXTRA;      // один раз, с запасом
    imgH = Math.max(imgH, h);              // только если окно выше картинки
    bg.style.height = maxH + 'px';
    bg.style.setProperty('--bg-img-h', imgH + 'px');
  }

  apply(true);
  window.addEventListener('resize', function () { apply(false); });
  window.addEventListener('orientationchange', function () {
    // после поворота размеры обновляются не мгновенно
    setTimeout(function () { apply(true); }, 300);
  });
})();
