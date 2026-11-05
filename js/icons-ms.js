// Microsoft 365-style app icons: a lighter "document" layer at the back (with cell lines, like Excel),
// a deeper gradient badge overlapping at the front with gloss + soft shadow, and a white glyph on the badge.
const MS_STYLE = {
  //            glyph         badge from / to          back from / to
  scan:      ["scan",      "#4C8BF5", "#1A56C4", "#BBD3FB", "#7AA7F2"], // Word blue
  leave:     ["calendar",  "#F25A4F", "#C62828", "#FBC3BE", "#F0857C"], // red
  wfh:       ["home",      "#FF8A3D", "#E2531F", "#FFD2B3", "#FFA66E"], // PowerPoint orange
  clock:     ["clock",     "#20B2A6", "#0B7A70", "#B5ECE6", "#64CFC4"], // teal
  insights:  ["chart",     "#F7B928", "#C98A00", "#FCE6A8", "#F6CD61"], // Power BI amber
  bills:     ["receipt",   "#2EA866", "#13713F", "#B8E8CB", "#6CCB94"], // Excel green
  track:     ["wallet",    "#9061F9", "#5B2BC9", "#D8C7FD", "#AF8BFB"], // OneNote purple
  timesheet: ["clipboard", "#2EA866", "#13713F", "#B8E8CB", "#6CCB94"],
  holidays:  ["sun",       "#FF7A59", "#E0442A", "#FFCDBF", "#FF9C82"],
  compoff:   ["coffee",    "#C98A4B", "#8A5524", "#EED6BC", "#D9AE7F"],
  logs:      ["history",   "#20B2A6", "#0B7A70", "#B5ECE6", "#64CFC4"],
  partial:   ["clock",     "#6366F1", "#3730A3", "#CDCEFB", "#9497F5"],
  onduty:    ["briefcase", "#3E6FC0", "#1E3F82", "#BCD0F0", "#7D9EDA"],
  balances:  ["list",      "#2EA866", "#13713F", "#B8E8CB", "#6CCB94"],
  helpdesk:  ["ticket",    "#0EA5E9", "#0369A1", "#B9E6FB", "#6CC8F3"],
  more:      ["gridPlus",  "#7C8798", "#4B5563", "#DDE2EA", "#B3BCC9"],
};
let MS_ID = 0;
function msIcon(id) {
  const [glyph, b1, b2, s1, s2] = MS_STYLE[id] || MS_STYLE.more;
  const k = "ms" + MS_ID++;
  return `<svg class="ms-ic" viewBox="0 0 48 48" aria-hidden="true"><defs>
    <linearGradient id="${k}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>
    <linearGradient id="${k}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>
    <linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${k}d" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="${b2}" flood-opacity=".45"/></filter></defs>
    <rect x="13" y="5" width="31" height="38" rx="7" fill="url(#${k}s)"/>
    <path d="M26 15h14M26 22h14M26 29h14M26 36h10" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round"/>
    <g filter="url(#${k}d)"><rect x="4" y="15" width="26" height="26" rx="7" fill="url(#${k}b)"/></g>
    <rect x="4" y="15" width="26" height="13" rx="7" fill="url(#${k}g)"/>
    <rect x="4.5" y="15.5" width="25" height="25" rx="6.5" fill="none" stroke="#fff" stroke-opacity=".28"/>
    <svg x="9" y="20" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[glyph] || ""}</svg>
  </svg>`;
}
