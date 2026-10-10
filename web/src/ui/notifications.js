export function createNotifier(element, { place = () => {} } = {}) {
  let timer;
  return function notify(message, error = false) {
    clearTimeout(timer);
    element.textContent = message;
    element.classList.toggle("error", error);
    element.setAttribute("role", error ? "alert" : "status");
    place(element);
    element.hidden = false;
    timer = setTimeout(() => (element.hidden = true), 6500);
  };
}
