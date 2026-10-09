export function createNotifier(element) {
  let timer;
  return function notify(message, error = false) {
    clearTimeout(timer);
    element.textContent = message;
    element.classList.toggle("error", error);
    element.hidden = false;
    timer = setTimeout(() => (element.hidden = true), 6500);
  };
}
