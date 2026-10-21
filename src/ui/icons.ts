const s = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  upgrades: s('<path d="M12 3v18"/><path d="M5 10l7-7 7 7"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="19" r="2" fill="currentColor"/><path d="M5 17v-3h14v3"/>'),
  build: s('<path d="M3 21h18"/><rect x="5" y="10" width="6" height="11"/><rect x="13" y="6" width="6" height="15"/><path d="M8 10V5l3-2"/><path d="M15 9h2M15 12h2M15 15h2"/>'),
  tools: s('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 0-5-5L13 5z"/><path d="M3 21l6-6"/>'),
  contracts: s('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 11l2 2 4-4"/><path d="M8.5 17h7"/>'),
  workshop: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  inventory: s('<path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M9 13h6"/>'),
  map: s('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  stats: s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  coin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c99a1c"/><circle cx="12" cy="11" r="8" fill="#ffd54f"/><text x="12" y="15.5" text-anchor="middle" font-size="11" font-weight="900" fill="#8a6508" font-family="system-ui">$</text></svg>`,
  bag: `<svg viewBox="0 0 24 24"><path d="M5 9h14l-1 12H6z" fill="#7b6a4a"/><path d="M8 9V7a4 4 0 0 1 8 0v2" stroke="#5a4a30" stroke-width="2" fill="none"/><rect x="7" y="13" width="10" height="5" rx="1.5" fill="#5f5036"/></svg>`,
  gear: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#64748b"/><circle cx="12" cy="12" r="3" fill="#1e293b"/><g fill="#64748b">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="10.5" y="2" width="3" height="5" transform="rotate(${a} 12 12)"/>`).join('')}</g></svg>`,
};
