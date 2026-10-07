// Substitui a lista nativa de um <select> por uma lista estilizável.
// O <select> continua sendo a fonte do valor: a escolha atualiza select.value e dispara "change".
function enhanceSelect(select) {
  "use strict";

  const label = document.querySelector(`label[for="${select.id}"]`);
  const wrapper = document.createElement("div");
  wrapper.className = "dropdown";

  const button = document.createElement("button");
  button.type = "button";
  button.id = `${select.id}-button`;
  button.className = "dropdown-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const list = document.createElement("ul");
  list.id = `${select.id}-list`;
  list.className = "dropdown-list";
  list.setAttribute("role", "listbox");
  list.tabIndex = -1;
  list.hidden = true;
  button.setAttribute("aria-controls", list.id);

  if (label) {
    label.id ||= `${select.id}-label`;
    label.htmlFor = button.id;
    list.setAttribute("aria-labelledby", label.id);
  }

  const items = [...select.options].map((option, index) => {
    const item = document.createElement("li");
    item.id = `${select.id}-option-${index}`;
    item.className = "dropdown-option";
    item.setAttribute("role", "option");
    item.textContent = option.textContent;
    item.style.fontFamily = option.style.fontFamily;
    item.addEventListener("click", () => choose(index));
    item.addEventListener("mousemove", () => setActive(index));
    list.append(item);
    return item;
  });

  let active = 0;

  function setActive(index) {
    active = Math.max(0, Math.min(items.length - 1, index));
    items.forEach((item, i) => item.classList.toggle("active", i === active));
    list.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  }

  function sync() {
    const index = Math.max(0, select.selectedIndex);
    button.textContent = select.options[index]?.textContent || "";
    button.style.fontFamily = select.options[index]?.style.fontFamily || "";
    items.forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
  }

  function open() {
    list.hidden = false;
    wrapper.classList.add("open");
    // A janela da extensão cresce até 600 px; se a lista não couber embaixo, abre para cima.
    const rect = button.getBoundingClientRect();
    const below = Math.max(window.innerHeight, 600) - rect.bottom;
    wrapper.classList.toggle("up", below < list.offsetHeight + 16 && rect.top > below);
    button.setAttribute("aria-expanded", "true");
    setActive(Math.max(0, select.selectedIndex));
    list.focus();
  }

  function close(returnFocus = true) {
    if (list.hidden) return;
    list.hidden = true;
    wrapper.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function choose(index) {
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    sync();
    close();
    if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  button.addEventListener("click", () => (list.hidden ? open() : close()));
  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });

  list.addEventListener("keydown", (event) => {
    const keys = {
      ArrowDown: () => setActive(active + 1),
      ArrowUp: () => setActive(active - 1),
      Home: () => setActive(0),
      End: () => setActive(items.length - 1),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => close(),
      Tab: () => close(false)
    };
    if (keys[event.key]) {
      if (event.key !== "Tab") event.preventDefault();
      keys[event.key]();
      return;
    }
    // Digitar uma letra pula para a próxima opção que começa com ela.
    if (event.key.length === 1) {
      const letter = event.key.toLocaleLowerCase();
      for (let step = 1; step <= items.length; step += 1) {
        const index = (active + step) % items.length;
        if (items[index].textContent.toLocaleLowerCase().startsWith(letter)) {
          setActive(index);
          break;
        }
      }
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!wrapper.contains(event.target)) close(false);
  });

  select.hidden = true;
  select.tabIndex = -1;
  select.after(wrapper);
  wrapper.append(button, list);
  sync();
  return { sync };
}
