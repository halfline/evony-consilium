import { view } from "./dom.js";
export function createAccountMenu({ root, switchAccount, signOut }) {
  const $ = view(root);
  const menu = root;
  const avatar = $("account-avatar");
  const initial = $("account-initial");
  $("switch-account").onclick = () => {
    menu.open = false;
    switchAccount();
  };
  $("sign-out").onclick = signOut;
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
  return {
    show(visible) {
      menu.hidden = !visible;
      menu.open = false;
    },
    render(account) {
      avatar.onload = null;
      avatar.onerror = null;
      avatar.removeAttribute("src");
      avatar.hidden = true;
      initial.hidden = false;
      $("account-name").textContent = account?.name || account?.email || "";
      $("account-email").textContent = account?.email || "";
      initial.textContent = account
        ? (account.name || account.email || "?").slice(0, 1).toUpperCase()
        : "";
      if (account?.picture) {
        avatar.onload = () => {
          avatar.hidden = false;
          initial.hidden = true;
        };
        avatar.onerror = () => {
          avatar.hidden = true;
          initial.hidden = false;
        };
        avatar.src = account.picture;
      }
    },
  };
}
