/**
 * One popup menu at a time (panel ⋯ menus, the top bar's ⋯, a file's ⋯). Closes on a click
 * outside, Escape, or a window resize. Styles: `.panel-menu` in styles/layout.css.
 */
export type MenuItem =
  | { label: string; run: (button: HTMLButtonElement) => void; keepOpen?: boolean; danger?: boolean }
  | { note: string }
  | 'separator';

let open: { el: HTMLElement; anchor: HTMLElement } | null = null;

export function closeMenu(): void {
  if (!open) return;
  open.anchor.setAttribute('aria-expanded', 'false');
  open.el.remove();
  open = null;
}

export const menuIsOpenFor = (anchor: HTMLElement) => open?.anchor === anchor;

/** Opens a menu under `anchor` (or toggles it closed if it is already open there). */
export function openMenu(anchor: HTMLElement, items: MenuItem[]): void {
  listen();
  if (menuIsOpenFor(anchor)) { closeMenu(); return; }
  closeMenu();
  const el = document.createElement('div');
  el.className = 'panel-menu';
  el.setAttribute('role', 'menu');
  for (const item of items) {
    if (item === 'separator') { el.appendChild(Object.assign(document.createElement('hr'), { className: 'menu-sep' })); continue; }
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    if ('note' in item) {
      b.className = 'note'; b.setAttribute('aria-disabled', 'true'); b.textContent = item.note;
    } else {
      b.textContent = item.label;
      if (item.danger) b.classList.add('danger');
      b.onclick = () => { if (!item.keepOpen) closeMenu(); item.run(b); };
    }
    el.appendChild(b);
  }
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const below = r.bottom + 4 + el.offsetHeight <= window.innerHeight - 8;
  el.style.top = `${below ? r.bottom + 4 : Math.max(8, r.top - 4 - el.offsetHeight)}px`;
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, r.right - el.offsetWidth))}px`;
  anchor.setAttribute('aria-expanded', 'true');
  open = { el, anchor };
  (el.querySelector('button:not(.note)') as HTMLElement | null)?.focus();
}

/** Page listeners, added when the first menu opens (so this module also loads in Node tests). */
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('pointerdown', (e) => {
    if (open && !open.el.contains(e.target as Node) && !open.anchor.contains(e.target as Node)) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    const a = open.anchor; closeMenu(); a.focus();
  });
  window.addEventListener('resize', closeMenu);
}
