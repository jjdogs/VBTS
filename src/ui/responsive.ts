/**
 * Small-screen helpers. On phones the header keeps Blocks / Split / Text and Copy, and moves
 * Templates and Project into a "More" menu (see styles/responsive.css for the breakpoints).
 */
export function setupResponsive(): void {
  const more = document.getElementById('moreBtn') as HTMLButtonElement;
  let menu: HTMLElement | null = null;

  const close = () => {
    menu?.remove(); menu = null;
    more.setAttribute('aria-expanded', 'false');
  };

  more.addEventListener('click', () => {
    if (menu) { close(); return; }
    // Offer the header buttons that are hidden at this size.
    const items: Array<[string, HTMLElement]> = [
      ['Customize (appearance)', document.getElementById('lookBtn')!],
      ['Templates', document.getElementById('tmplBtn')!],
      ['Project (share, load, new)', document.getElementById('projBtn')!],
    ];
    menu = document.createElement('div');
    menu.className = 'panel-menu';
    menu.setAttribute('role', 'menu');
    for (const [label, target] of items) {
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem');
      b.textContent = label;
      b.onclick = () => { close(); target.click(); };
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const r = more.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth))}px`;
    more.setAttribute('aria-expanded', 'true');
    (menu.firstElementChild as HTMLElement).focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.contains(e.target as Node) && e.target !== more) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu) { close(); more.focus(); } });
  window.addEventListener('resize', close);
}
