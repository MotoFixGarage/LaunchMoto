// ==========================================================
// ФИКСАЦИЯ ВЫСОТЫ ФОНА НА ТЕЛЕФОНАХ
// На телефонах адресная строка при прокрутке сворачивается/разворачивается
// и меняет высоту окна. Если фон тянется по высоте окна, background-size: cover
// пересчитывает масштаб, и картинка "дёргается".
// Здесь высота слоя .background запоминается по МАКСИМУМУ высоты окна
// и больше не уменьшается (сбрасывается только при повороте экрана).
// На компьютерах (нет тач-экрана) ничего не делаем — работает CSS (100lvh).
// ==========================================================
(function () {
  const bg = document.querySelector('.background');
  if (!bg) return;

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;

  let maxH = 0;

  function apply(reset) {
    if (reset) maxH = 0;
    maxH = Math.max(maxH, window.innerHeight || 0, document.documentElement.clientHeight || 0);
    bg.style.height = maxH + 'px';
  }

  apply(true);
  window.addEventListener('resize', function () { apply(false); });
  window.addEventListener('orientationchange', function () {
    // после поворота размеры обновляются не мгновенно
    setTimeout(function () { apply(true); }, 300);
  });
})();
