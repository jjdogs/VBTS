/**
 * Line icons for the app's chrome (drawn for this app, 24×24, stroked with currentColor).
 * Styles: `.ico` in styles/layout.css.
 */
const svg = (d: string) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  files: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  toolbox: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  learn: svg('<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 11.5v4c0 1.4 2.2 2.8 5 2.8s5-1.4 5-2.8v-4"/><path d="M21 9.5v5"/>'),
  look: svg('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.2-1.8-.5-1.2.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'),
  share: svg('<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  blocks: svg('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  code: svg('<path d="m9 8-4 4 4 4M15 8l4 4-4 4M13.5 5l-3 14"/>'),
  split: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
  save: svg('<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  device: svg('<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 20h6M12 16v4"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  alert: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16.2v.1"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>'),
  inspect: svg('<path d="M4 4l6.5 16 2.3-6.7L19.5 11z"/>'),
  template: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
};
