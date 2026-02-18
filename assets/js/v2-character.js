/**
 * RIFT — v2 Character Sheet Module (ported from ES modules)
 * Combined: renderer.js + character.js
 * Non-module version for v1 unified architecture
 */
(function() {
'use strict';

// ═══════════════════════════════════════
//  STATE BRIDGE (v2 State → v1 RiftState)
// ═══════════════════════════════════════

function _stateGet(path) {
    if (window.RIFT && RIFT.state) return RIFT.state.get(path);
    return undefined;
}

let _applyingRemote = false;
let _lastLocalInvChange = 0;  // timestamp of last local inventory modification
let _riftLinkActive = false;  // true when RiftLink manages Firestore sync

function _stateSet(path, value) {
    if (_applyingRemote) {
        console.log('[Character] _stateSet BLOCKED (applying remote):', path.substring(0, 40));
        return;
    }
    if (window.RIFT && RIFT.state) RIFT.state.set(path, value);
}

function _stateOn(path, callback) {
    if (window.RIFT && RIFT.state) return RIFT.state.on(path, callback);
    return function() {};
}

function _eventsEmit(event, data) {
    if (window.RIFT && RIFT.state) RIFT.state.emit(event, data);
}

// ═══════════════════════════════════════
//  RENDERER
// ═══════════════════════════════════════

/**
 * RIFT 2.0 — Character Sheet Renderer
 * 
 * Generiert die aufwändigen SVG-Komponenten (Card Corners, Orbs, Shield, etc.)
 * programmatisch, damit das HTML schlank bleibt.
 * 
 * Orbs sind 1:1 mit dem Prototype (charsheet-v10) — multi-layer waves, 
 * bubbles, embers, meniscus, glass reflections.
 */

// ─── Card Corner SVG ───
const CORNER_SVG = `<svg viewBox="0 0 36 36" fill="none"><path d="M0 36V6a6 6 0 016-6h30" stroke="currentColor" stroke-width="2"/><path d="M6 36V10a4 4 0 014-4h26" stroke="currentColor" stroke-width="0.75" opacity="0.3"/><circle cx="3" cy="3" r="3" fill="currentColor"/><path d="M0 14h10M14 0v10" stroke="currentColor" stroke-width="1" opacity="0.5"/><rect x="8" y="8" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.4" transform="rotate(45 10.5 10.5)"/></svg>`;

function addCardCorners(card) {
    if (card.querySelector('.card-corner')) return; // Already has corners
    const positions = ['cc-tl', 'cc-tr', 'cc-bl', 'cc-br'];
    for (const pos of positions) {
        const span = document.createElement('span');
        span.className = `card-corner ${pos}`;
        span.innerHTML = CORNER_SVG;
        card.prepend(span);
    }
}

function initCardCorners(container = document) {
    container.querySelectorAll('.card').forEach(addCardCorners);
}

// ─── Helper: Compute wave surface Y from fill percentage ───
// Circle clip: cx=60, cy=60, r=52 → visible y: 8..112
// Maps: 0%→108 (near bottom), 100%→12 (near top)
function surfaceY(pct) {
    return 108 - pct * 96;
}

// ─── HP Orb SVG (7 wave layers, meniscus, bubbles, glass) ───
function createHPOrb(current, max) {
    const pct = Math.max(0, Math.min(1, current / max));
    const s = surfaceY(pct);
    const L = [s, s+2, s+4, s+6, s+9, s+12, s+17];
    const A = [3, 3, 3, 4, 4, 4, 3];
    const D = [2, 2.6, 3.3, 4, 5, 6.5, 8];
    const C = ['#3ddf80','#2ecc71','#22a854','#1a8a42','#146b34','#0d4a22','#072e15'];
    const O = [0.3, 0.35, 0.45, 0.55, 0.7, 0.9, 1];

    let waves = '';
    for (let i = 6; i >= 0; i--) {
        const y = L[i], a = A[i], d = D[i];
        waves += `<path fill="${C[i]}" opacity="${O[i]}"><animate attributeName="d" dur="${d}s" repeatCount="indefinite" values="M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y+a} ${25+i*5} ${y} Q${45+i*5} ${y-a} ${65+i*3} ${y} Q${85+i*2} ${y+a} ${105+i*3} ${y} Q${120+i} ${y-a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z"/></path>`;
    }

    return `<svg viewBox="0 0 120 120">
<defs>
<clipPath id="cHp"><circle cx="60" cy="60" r="52"/></clipPath>
<radialGradient id="gHp" cx="30%" cy="25%" r="60%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
</defs>
<circle cx="60" cy="60" r="56" fill="none" stroke="#0d2818" stroke-width="1.5"/>
<circle cx="60" cy="60" r="55" fill="none" stroke="#1a3a28" stroke-width="3"/>
<circle cx="60" cy="60" r="52" fill="#050e08"/>
<g clip-path="url(#cHp)">
<g>${waves}</g>
<path fill="none" stroke="rgba(93,255,158,0.35)" stroke-width="1.5" stroke-linecap="round"><animate attributeName="d" dur="2.2s" repeatCount="indefinite" values="M9 ${s-3} Q11 ${s} 18 ${s} Q30 ${s-4} 42 ${s} Q54 ${s+4} 66 ${s} Q78 ${s-4} 90 ${s} Q102 ${s+4} 112 ${s} Q114 ${s} 115 ${s-3};M9 ${s-3} Q11 ${s} 18 ${s} Q30 ${s+4} 42 ${s} Q54 ${s-4} 66 ${s} Q78 ${s+4} 90 ${s} Q102 ${s-4} 112 ${s} Q114 ${s} 115 ${s-3};M9 ${s-3} Q11 ${s} 18 ${s} Q30 ${s-4} 42 ${s} Q54 ${s+4} 66 ${s} Q78 ${s-4} 90 ${s} Q102 ${s+4} 112 ${s} Q114 ${s} 115 ${s-3}"/></path>
<circle r="2" fill="#5dff9e" opacity="0"><animate attributeName="cx" dur="4s" repeatCount="indefinite" values="35;37;34;35"/><animate attributeName="cy" dur="4s" repeatCount="indefinite" values="100;42;28;100"/><animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;0.3;0.1;0"/><animate attributeName="r" dur="4s" repeatCount="indefinite" values="1.5;2;2.4;1.5"/></circle>
<circle r="1.2" fill="#5dff9e" opacity="0"><animate attributeName="cx" dur="5.5s" repeatCount="indefinite" values="72;74;70;72"/><animate attributeName="cy" dur="5.5s" repeatCount="indefinite" values="105;45;32;105"/><animate attributeName="opacity" dur="5.5s" repeatCount="indefinite" values="0;0.22;0.06;0"/></circle>
<circle r="1.6" fill="#a0ffc8" opacity="0"><animate attributeName="cx" dur="7s" repeatCount="indefinite" values="52;48;55;52"/><animate attributeName="cy" dur="7s" repeatCount="indefinite" values="110;38;24;110"/><animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="0;0.2;0.04;0"/></circle>
<circle r="0.9" fill="#a0ffc8" opacity="0"><animate attributeName="cx" dur="3.5s" repeatCount="indefinite" values="85;82;87;85"/><animate attributeName="cy" dur="3.5s" repeatCount="indefinite" values="95;50;36;95"/><animate attributeName="opacity" dur="3.5s" repeatCount="indefinite" values="0;0.28;0.05;0"/></circle>
</g>
<circle cx="60" cy="60" r="52" fill="url(#gHp)"/>
<ellipse cx="42" cy="36" rx="10" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-25 42 36)"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text x="60" y="65" text-anchor="middle" fill="white" font-family="Cinzel,serif" font-size="20" font-weight="700" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.8))">${current}</text>
</svg>`;
}

// ─── Rage Orb SVG (7 lava layers, meniscus, embers+glow, core pulse) ───
function createRageOrb(current, max) {
    const pct = Math.max(0, Math.min(1, current / max));
    const s = surfaceY(pct);
    const L = [s, s+2, s+4, s+7, s+10, s+13, s+17];
    const D = [1, 1.3, 1.7, 2.2, 2.8, 3.8, 5];
    const C = ['#ff5744','#e74c3c','#b83226','#8e1a1a','#5c1010','#3a0a0a','#1a0404'];
    const O = [0.3, 0.35, 0.45, 0.55, 0.7, 0.9, 1];

    let waves = '';
    for (let i = 6; i >= 0; i--) {
        const y = L[i], d = D[i], a = 3 + (i < 3 ? 1 : 0);
        waves += `<path fill="${C[i]}" opacity="${O[i]}"><animate attributeName="d" dur="${d}s" repeatCount="indefinite" values="M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y+a} ${25+i*5} ${y} Q${45+i*5} ${y-a} ${65+i*3} ${y} Q${85+i*2} ${y+a} ${105+i*3} ${y} Q${120+i} ${y-a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z"/></path>`;
    }

    return `<svg viewBox="0 0 120 120">
<defs>
<clipPath id="cRage"><circle cx="60" cy="60" r="52"/></clipPath>
<radialGradient id="gRage" cx="30%" cy="25%" r="60%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
<radialGradient id="ember" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff4422" stop-opacity="0.9"/><stop offset="50%" stop-color="#ff6633" stop-opacity="0.4"/><stop offset="100%" stop-color="#ff6633" stop-opacity="0"/></radialGradient>
<filter id="emberGlow"><feGaussianBlur stdDeviation="1.5"/></filter>
</defs>
<circle cx="60" cy="60" r="56" fill="none" stroke="#2a0808" stroke-width="1.5"/>
<circle cx="60" cy="60" r="55" fill="none" stroke="#3a1515" stroke-width="3"/>
<circle cx="60" cy="60" r="52" fill="#080303"/>
<g clip-path="url(#cRage)">
<ellipse cx="60" cy="100" rx="35" ry="18" fill="rgba(255,68,34,0.06)"><animate attributeName="rx" dur="1.2s" repeatCount="indefinite" values="35;44;35"/><animate attributeName="ry" dur="1.2s" repeatCount="indefinite" values="18;22;18"/><animate attributeName="opacity" dur="1.2s" repeatCount="indefinite" values="1;1.8;1"/></ellipse>
<g>${waves}</g>
<path fill="none" stroke="rgba(255,100,80,0.4)" stroke-width="1.5" stroke-linecap="round"><animate attributeName="d" dur="1.2s" repeatCount="indefinite" values="M9 ${s-2} Q11 ${s+1} 18 ${s+1} Q30 ${s-3} 42 ${s+1} Q54 ${s+5} 66 ${s+1} Q78 ${s-3} 90 ${s+1} Q102 ${s+5} 112 ${s+1} Q114 ${s+1} 115 ${s-2};M9 ${s-2} Q11 ${s+1} 18 ${s+1} Q30 ${s+5} 42 ${s+1} Q54 ${s-3} 66 ${s+1} Q78 ${s+5} 90 ${s+1} Q102 ${s-3} 112 ${s+1} Q114 ${s+1} 115 ${s-2};M9 ${s-2} Q11 ${s+1} 18 ${s+1} Q30 ${s-3} 42 ${s+1} Q54 ${s+5} 66 ${s+1} Q78 ${s-3} 90 ${s+1} Q102 ${s+5} 112 ${s+1} Q114 ${s+1} 115 ${s-2}"/></path>
<circle r="2.5" fill="url(#ember)"><animate attributeName="cx" dur="2.5s" repeatCount="indefinite" values="30;34;27;30"/><animate attributeName="cy" dur="2.5s" repeatCount="indefinite" values="102;52;40;102"/><animate attributeName="opacity" dur="2.5s" repeatCount="indefinite" values="0;1;0.3;0"/></circle>
<circle r="5" fill="#ff4422" opacity="0" filter="url(#emberGlow)"><animate attributeName="cx" dur="2.5s" repeatCount="indefinite" values="30;34;27;30"/><animate attributeName="cy" dur="2.5s" repeatCount="indefinite" values="102;52;40;102"/><animate attributeName="opacity" dur="2.5s" repeatCount="indefinite" values="0;0.15;0.04;0"/></circle>
<circle r="1.8" fill="url(#ember)"><animate attributeName="cx" dur="1.8s" repeatCount="indefinite" values="75;72;78;75"/><animate attributeName="cy" dur="1.8s" repeatCount="indefinite" values="108;58;44;108"/><animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" values="0;0.9;0.2;0"/></circle>
<circle r="4" fill="#ff4422" opacity="0" filter="url(#emberGlow)"><animate attributeName="cx" dur="1.8s" repeatCount="indefinite" values="75;72;78;75"/><animate attributeName="cy" dur="1.8s" repeatCount="indefinite" values="108;58;44;108"/><animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" values="0;0.12;0.03;0"/></circle>
<circle r="2" fill="url(#ember)"><animate attributeName="cx" dur="3.2s" repeatCount="indefinite" values="55;50;60;55"/><animate attributeName="cy" dur="3.2s" repeatCount="indefinite" values="100;48;34;100"/><animate attributeName="opacity" dur="3.2s" repeatCount="indefinite" values="0;0.8;0.12;0"/></circle>
<circle r="1.2" fill="#ff9080"><animate attributeName="cx" dur="1.5s" repeatCount="indefinite" values="45;42;48;45"/><animate attributeName="cy" dur="1.5s" repeatCount="indefinite" values="96;60;48;96"/><animate attributeName="opacity" dur="1.5s" repeatCount="indefinite" values="0;0.6;0;0"/></circle>
<circle r="1.5" fill="url(#ember)"><animate attributeName="cx" dur="3.8s" repeatCount="indefinite" values="88;84;92;88"/><animate attributeName="cy" dur="3.8s" repeatCount="indefinite" values="104;55;38;104"/><animate attributeName="opacity" dur="3.8s" repeatCount="indefinite" values="0;0.7;0.08;0"/></circle>
</g>
<circle cx="60" cy="60" r="52" fill="url(#gRage)"/>
<ellipse cx="42" cy="36" rx="10" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-25 42 36)"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text x="60" y="65" text-anchor="middle" fill="white" font-family="Cinzel,serif" font-size="20" font-weight="700" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.8))">${current}</text>
</svg>`;
}

// ─── Level Orb (matches prototype) ───
function createLevelOrb(level) {
    return `<svg viewBox="0 0 64 64">
<defs><radialGradient id="lvlGrad" cx="35%" cy="30%" r="65%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
<circle cx="32" cy="32" r="29" fill="none" stroke="#d4a844" stroke-width="3"/>
<circle cx="32" cy="32" r="26" fill="#1a1610"/>
<circle cx="32" cy="32" r="26" fill="url(#lvlGrad)"/>
<text x="32" y="30" text-anchor="middle" fill="var(--gold)" font-family="Cinzel,serif" font-size="18" font-weight="900">${level}</text>
<text x="32" y="42" text-anchor="middle" fill="var(--gold-dim)" font-family="Cinzel,serif" font-size="7" letter-spacing="1">LEVEL</text>
</svg>`;
}

// ─── Defense Shield SVG ───
function createDefenseShield(armor, mitigation, resistances = {}) {
    const res = { fire: 0, cold: 0, poison: 0, arcane: 0, ...resistances };
    const mitigationPct = Math.max(0, Math.min(100, mitigation));
    const fillH = (mitigationPct / 100) * 174;
    const fillY = 190 - fillH;

    return `<svg viewBox="0 0 160 190" class="defense-shield-svg">
<defs>
<linearGradient id="shieldBorder" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a4a4a"/><stop offset="100%" stop-color="#2e2e2e"/></linearGradient>
<linearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e1e1e"/><stop offset="100%" stop-color="#141414"/></linearGradient>
<clipPath id="shieldClip"><path d="M80 8 L148 35 C152 37 154 41 154 45 L154 100 C154 135 125 162 80 182 C35 162 6 135 6 100 L6 45 C6 41 8 37 12 35 Z"/></clipPath>
</defs>
<path d="M80 8 L148 35 C152 37 154 41 154 45 L154 100 C154 135 125 162 80 182 C35 162 6 135 6 100 L6 45 C6 41 8 37 12 35 Z" fill="url(#shieldFill)" stroke="url(#shieldBorder)" stroke-width="2.5"/>
<g clip-path="url(#shieldClip)"><rect x="0" y="${fillY}" width="160" height="${fillH}" fill="rgba(212,168,68,0.06)"/></g>
<path d="M80 18 L140 42 C142 43 143 45 143 47 L143 98 C143 128 118 152 80 170 C42 152 17 128 17 98 L17 47 C17 45 18 43 20 42 Z" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
<text x="80" y="80" text-anchor="middle" fill="var(--text-bright)" font-family="Cinzel,serif" font-size="38" font-weight="900">${armor}</text>
<text x="80" y="100" text-anchor="middle" fill="var(--text-dim)" font-family="Cinzel,serif" font-size="11" letter-spacing="2">RÜSTUNG</text>
<text x="80" y="122" text-anchor="middle" fill="var(--xp-blue)" font-family="Fira Code,monospace" font-size="14" font-weight="700">${mitigationPct}% Reduktion</text>
<g transform="translate(80,150)">
<circle cx="-36" cy="0" r="10" fill="rgba(192,57,43,0.15)" stroke="var(--rage-red)" stroke-width="1.5"/><text x="-36" y="4" text-anchor="middle" fill="var(--rage-red)" font-family="Fira Code,monospace" font-size="9" font-weight="700">${res.fire}</text>
<circle cx="-12" cy="0" r="10" fill="rgba(41,128,185,0.15)" stroke="var(--xp-blue)" stroke-width="1.5"/><text x="-12" y="4" text-anchor="middle" fill="var(--xp-blue)" font-family="Fira Code,monospace" font-size="9" font-weight="700">${res.cold}</text>
<circle cx="12" cy="0" r="10" fill="rgba(39,174,96,0.15)" stroke="var(--hp-green)" stroke-width="1.5"/><text x="12" y="4" text-anchor="middle" fill="var(--hp-green)" font-family="Fira Code,monospace" font-size="9" font-weight="700">${res.poison}</text>
<circle cx="36" cy="0" r="10" fill="rgba(155,89,182,0.15)" stroke="var(--rarity-epic)" stroke-width="1.5"/><text x="36" y="4" text-anchor="middle" fill="var(--rarity-epic)" font-family="Fira Code,monospace" font-size="9" font-weight="700">${res.arcane}</text>
</g>
<g transform="translate(80,168)" font-size="8" fill="var(--text-dim)" text-anchor="middle" font-family="Nunito,sans-serif" letter-spacing="0.5"><text x="-36">FEU</text><text x="-12">KÄL</text><text x="12">GIF</text><text x="36">ARK</text></g>
</svg>`;
}

// ─── Paperdoll Silhouette ───
const PAPERDOLL_SVG = `<svg viewBox="0 0 200 500" fill="var(--text-dim)">
<ellipse cx="100" cy="62" rx="32" ry="38"/>
<path d="M58 95 C48 100 28 120 24 150 L20 190 L48 185 L52 160 L60 200 L48 290 L40 360 L38 380 L30 440 L28 456 C26 466 30 474 44 476 L64 476 C68 476 68 470 66 464 L62 438 L80 258 L100 320 L120 258 L138 438 L134 464 C132 470 132 476 136 476 L156 476 C170 474 174 466 172 456 L170 440 L162 380 L160 360 L152 290 L140 200 L148 160 L152 185 L180 190 L176 150 C172 120 152 100 142 95 Z"/>
</svg>`;

// ─── D20 Icon ───
const D20_SVG = `<svg viewBox="0 0 100 100" class="d20-icon"><polygon points="50,5 95,30 95,70 50,95 5,70 5,30" fill="none" stroke="currentColor" stroke-width="4"/><polygon points="50,15 85,35 85,65 50,85 15,65 15,35" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/><text x="50" y="58" text-anchor="middle" font-size="24" font-family="Cinzel,serif" fill="currentColor" font-weight="700">20</text></svg>`;

// ─── Inventory Grid Builder ───
function buildInventoryGrid(container, cols = 8, rows = 6) {
    container.innerHTML = '';
    container.classList.add('inv-grid');
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
    const emptySvg = '';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'inv-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            // Explicit grid placement so item overlays don't displace cells
            cell.style.gridColumn = `${c + 1}`;
            cell.style.gridRow = `${r + 1}`;
            cell.innerHTML = emptySvg;
            container.appendChild(cell);
        }
    }
}

// ─── Section Divider ───
function createDivider() {
    const div = document.createElement('div');
    div.className = 'section-divider';
    div.innerHTML = '<span class="dia"></span>';
    return div;
}


// ═══════════════════════════════════════
//  CHARACTER MODULE
// ═══════════════════════════════════════

/**
 * RIFT 2.0 — Character Module
 * 
 * Verwaltet den Charakterbogen:
 * - Lädt Daten aus State oder erzeugt Demo-Charakter
 * - Rendert alle Sektionen
 * - Bindet Inputs an _stateSet()
 * - Reagiert auf State-Änderungen (Echtzeit-Sync)
 */

// (renderer functions already defined above in this IIFE)

// ─── Demo-Charakter ───
// ═══════════════════════════════════════
//  CLASS DEFINITIONS
// ═══════════════════════════════════════

const CLASS_DEFINITIONS = [
    { id: 'barbarian',    name: 'Barbar',       resource: 'Rage',     color: 'var(--rage-red)',
      desc: 'Ungezähmte Krieger, die ihre Wut in rohe Zerstörungskraft verwandeln. Im Kampf kennen sie weder Furcht noch Gnade.',
      traits: ['Nahkampf-Spezialist', 'Hohe LP', 'Berserker-Rage'],
      image: '/assets/img/classes/barbarian.png' },
    { id: 'mage',         name: 'Magier',       resource: 'Mana',     color: 'var(--xp-blue)',
      desc: 'Meister der arkanen Künste. Sie formen die Realität durch pure Willenskraft und entfesseln verheerende Zauber.',
      traits: ['Fernkampf-Magie', 'Flächenschaden', 'Mana-Management'],
      image: '/assets/img/classes/mage.png' },
    { id: 'assassin',     name: 'Assassine',    resource: 'Fokus',    color: '#a855f7',
      desc: 'Lautlose Jäger aus den Schatten. Präzision und Geschwindigkeit sind ihre tödlichsten Waffen.',
      traits: ['Kritische Treffer', 'Stealth', 'Einzelziel-Schaden'],
      image: '/assets/img/classes/assassin.png' },
    { id: 'paladin',      name: 'Paladin',      resource: 'Glaube',   color: 'var(--gold)',
      desc: 'Heilige Streiter, die göttliche Macht mit Schwert und Schild vereinen. Sie schützen die Schwachen und richten die Verdorbenen.',
      traits: ['Tank/Heiler-Hybrid', 'Auren', 'Göttliche Macht'],
      image: '/assets/img/classes/paladin.png' },
    { id: 'druid',        name: 'Druide',       resource: 'Essenz',   color: 'var(--hp-green)',
      desc: 'Hüter der Natur, die das Gleichgewicht der Welt bewahren. Sie rufen die Elemente und wandeln ihre Gestalt.',
      traits: ['Gestaltwandler', 'Naturmagie', 'Heilung'],
      image: '/assets/img/classes/druid.png' },
    { id: 'warlock',      name: 'Hexenmeister', resource: 'Seelen',   color: '#c084fc',
      desc: 'Dunkle Paktmagier, die mit verbotenen Mächten handeln. Ihre Kraft hat einen hohen Preis — für andere.',
      traits: ['DoT-Schaden', 'Beschwörungen', 'Lebensentzug'],
      image: '/assets/img/classes/warlock.png' },
    { id: 'ranger',       name: 'Waldläufer',   resource: 'Ausdauer', color: '#fb923c',
      desc: 'Meister der Wildnis mit tödlicher Präzision auf Distanz. Kein Pfad ist ihnen zu verborgen, kein Ziel zu weit.',
      traits: ['Fernkampf-Experte', 'Fallen', 'Tierbegleiter'],
      image: '/assets/img/classes/ranger.png' },
    { id: 'cleric',       name: 'Kleriker',     resource: 'Hingabe',  color: '#e2e8f0',
      desc: 'Priester und Heiler, deren Gebete Wunden schließen und Verbündete stärken. Im Angesicht des Bösen strahlt ihr Licht am hellsten.',
      traits: ['Primär-Heiler', 'Buffs', 'Untoten-Bann'],
      image: '/assets/img/classes/cleric.png' },
];

// ═══════════════════════════════════════
//  BLANK CHARACTER TEMPLATE
// ═══════════════════════════════════════

const BLANK_CHARACTER = {
    profile: { name: '', race: '', age: '', gender: '', faction: '', description: '' },
    portrait: '',
    class: { id: '', name: '', label: 'Disziplin' },
    level: 1,
    xp: { current: 0, max: 1000 },
    attributes: {
        kraft: 0, geschick: 0, belastbarkeit: 0, intellekt: 0, autoritaet: 0,
        points: { used: 0, total: 20 }
    },
    hp: { current: 100, max: 100, regen: 0 },
    resource: { name: '', current: 100, max: 100, perHit: 0 },
    defense: {
        armor: 0, mitigation: 0,
        dodge: 0, block: null, movement: 0,
        resistances: { fire: 0, cold: 0, poison: 0, arcane: 0 }
    },
    offense: { initiative: 0, iniFormula: '', range: '', carry: 0 },
    skills: [],
    skillPoints: 0,
    weakness: { name: '', description: '', icon: '' },
    abilities: {
        koerper: Array(10).fill(null).map(() => ({ name: '', value: '', active: true })),
        verstand: Array(10).fill(null).map(() => ({ name: '', value: '', active: true })),
        praesenz: Array(10).fill(null).map(() => ({ name: '', value: '', active: true }))
    },
    secondChance: { used: [false, false, false] },
    notes: '',
    currency: { gold: 0, silver: 0, copper: 0 },
    inventory: { cols: 16, rows: 11, items: [], placements: [] },
    equipment: {
        head: null, shoulders: null, chest: null, gloves: null, belt: null,
        legs: null, boots: null, cape: null, mainhand: null, offhand: null,
        ring1: null, ring2: null, amulet: null, talisman: null, ammo: null
    },
    quickbar: Array(8).fill(null),
    buffs: []
};

let charId = null;
let charData = null;
let _dirty = false;

// ─── Initialization ───

async function init(characterId, roomCode) {
    // Detect ?new=true → always start fresh
    const urlParams = new URLSearchParams(window.location.search);
    const isNew = urlParams.get('new') === 'true';

    // For new characters, generate a fresh ID if none provided
    if (isNew && !characterId) {
        characterId = 'wa_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        // Update URL so refreshes don't create yet another new one
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('char', characterId);
        newUrl.searchParams.delete('new');
        history.replaceState(null, '', newUrl.toString());
        console.log('[Character] New character created:', characterId);
    }

    charId = characterId;

    let source = 'blank';

    if (isNew) {
        // Force blank — never load old data for new characters
        charData = JSON.parse(JSON.stringify(BLANK_CHARACTER));
        source = 'new (blank)';
    } else {
        // Load from per-character localStorage, fallback to blank
        const localChar = _loadLocal();
        if (localChar && localChar.profile) {
            charData = localChar;
            source = 'localStorage';
        } else {
            charData = JSON.parse(JSON.stringify(BLANK_CHARACTER));
        }
    }
    
    console.log('[Character] Source:', source, '| ID:', charId || 'LOCAL', '|', charData.profile?.name || '(blank)');
    
    // Ensure all required fields exist (merge with BLANK defaults)
    _ensureDefaults();
    
    // Save immediately so the new char persists under its own key
    _saveLocal();
    
    renderAll();
    initCardCorners();
    
    if (charId && roomCode) {
        // If local wa_ ID, look up the actual Firestore character ID for this user
        let riftCharId = charId;
        
        if (charId.startsWith('wa_')) {
            try {
                const db = firebase.firestore();
                // Wait for auth if not ready
                let uid = firebase.auth().currentUser?.uid;
                if (!uid) {
                    console.log('[Character] Waiting for auth before Firestore lookup...');
                    uid = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
                        const unsub = firebase.auth().onAuthStateChanged(user => {
                            clearTimeout(timeout);
                            unsub();
                            resolve(user?.uid);
                        });
                    });
                }
                
                if (db && uid) {
                    const normalizedCode = roomCode.replace(/-/g, '').toUpperCase();
                    console.log('[Character] Looking up Firestore char for uid:', uid, 'in room:', normalizedCode);
                    const snap = await db.collection('rooms').doc(normalizedCode)
                        .collection('characters')
                        .where('ownerId', '==', uid)
                        .limit(1)
                        .get();
                    if (!snap.empty) {
                        riftCharId = snap.docs[0].id;
                        console.log('[Character] Resolved wa_ ID to Firestore ID:', charId, '→', riftCharId);
                    } else {
                        console.warn('[Character] No Firestore character found for uid', uid, 'in room', normalizedCode);
                    }
                } else {
                    console.warn('[Character] No db or uid — skipping Firestore lookup');
                }
            } catch (e) {
                console.warn('[Character] Firestore ID lookup failed:', e.message);
            }
        }
        
        // Connect via RiftLink
        if (window.RIFT && RIFT.link) {
            RIFT.link.watchChar(riftCharId, roomCode);
            _riftLinkActive = true;
            window._riftLinkActive = true;  // expose for CharacterStorage
            console.log('[Character] RiftLink connected for', riftCharId, 'in room', roomCode);
        }

        // Listen for remote changes (from GM or other sources)
        _stateOn(`characters.${riftCharId}:changed`, (data) => {
            if (!data || data === charData || _applyingRemote) return;
            
            _applyingRemote = true;
            let changed = false;
            
            // Merge inventory from remote — but NOT if user just edited locally
            const timeSinceLocalInv = Date.now() - _lastLocalInvChange;
            if (data.inventory && timeSinceLocalInv > 3000) {
                const incoming = JSON.stringify(data.inventory.items || []);
                const current = JSON.stringify(charData.inventory?.items || []);
                if (incoming !== current) {
                    console.log('[Character] Remote inventory merge (' + (data.inventory.items?.length || 0) + ' items)');
                    charData.inventory = data.inventory;
                    changed = true;
                }
            }
            if (data.equipment && timeSinceLocalInv > 3000) {
                charData.equipment = data.equipment;
                changed = true;
            }
            if (data.quickbar && timeSinceLocalInv > 3000) {
                charData.quickbar = data.quickbar;
                changed = true;
            }
            
            // Deep merge all other fields — never wipe local with empty remote
            const mergeKeys = ['hp', 'resource', 'class', 'level', 'xp', 'attributes',
                'defense', 'offense', 'skills', 'skillPoints', 'weakness', 'abilities',
                'secondChance', 'notes', 'currency', 'buffs', 'profile', 'portrait'];
            for (const key of mergeKeys) {
                if (data[key] === undefined) continue;
                // For profile: merge sub-fields, don't wipe
                if (key === 'profile' && typeof data.profile === 'object') {
                    for (const [pk, pv] of Object.entries(data.profile)) {
                        if (pv !== undefined && pv !== null && pv !== '') {
                            if (charData.profile[pk] !== pv) {
                                charData.profile[pk] = pv;
                                changed = true;
                            }
                        }
                    }
                } else if (JSON.stringify(charData[key]) !== JSON.stringify(data[key])) {
                    charData[key] = data[key];
                    changed = true;
                }
            }
            
            if (changed) {
                console.log('[Character] ← Remote update:', riftCharId);
                _ensureDefaults();
                _saveLocal(true);
                renderAll();
            }
            
            setTimeout(() => { _applyingRemote = false; }, 200);
        });
    } else {
        console.log('[Character] RiftLink SKIPPED — charId:', charId, 'roomCode:', roomCode, '(no room)');
    }

    // Auto-save every 30 seconds
    setInterval(() => {
        if (_dirty) { _saveLocal(); _dirty = false; }
    }, 30000);

    // Save on page leave (covers full reload + tab close)
    window.addEventListener('beforeunload', () => {
        _flushAllFields();
        _saveLocal();
        _syncToCharacterStorage(); // immediate
    });
    // Also save on SPA transitions and tab switches
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            _flushAllFields();
            _saveLocal();
            _syncToCharacterStorage(); // immediate
        }
    });
    // Catch SPA navigation (link clicks) — save before leaving
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (link && !link.href.includes('#')) {
            _flushAllFields();
            _saveLocal();
            _syncToCharacterStorage(); // immediate
        }
    }, true); // capture phase — fires before transition.js

    initInteractions();
    initSheetFooter();
    console.log('[Character] Initialized', charId || 'LOCAL');
}

async function createCharacter(roomCode, userId) {
    const id = 'char_' + Date.now().toString(36);
    const newChar = JSON.parse(JSON.stringify(BLANK_CHARACTER)); // deep copy
    newChar.profile.name = 'Neuer Charakter';
    newChar.ownerId = userId;
    newChar.createdAt = new Date().toISOString();
    _stateSet(`characters.${id}`, newChar);
    return id;
}

// ─── Render All ───

function renderAll() {
    renderProfile();
    renderPortrait();
    renderClassAndOrbs();
    renderAttributes();
    renderSkills();
    renderDefense();
    renderStats();
    renderInventoryGrid();
    renderAbilities();
    renderSecondChance();
    renderNotes();
    renderCurrency();
}

function renderProfile() {
    const p = charData.profile;
    txtSafe('charName', p.name);
    txtSafe('fieldRace', p.race);
    txtSafe('fieldAge', p.age);
    txtSafe('fieldGender', p.gender);
    txtSafe('fieldFaction', p.faction);
    val('charDesc', p.description);
    _updateSilhouette(p.gender);
}

function renderPortrait() {
    const src = charData.portrait || '';
    const img = document.getElementById('portraitImg');
    const placeholder = document.getElementById('portraitPlaceholder');
    const delBtn = document.getElementById('portraitDeleteBtn');
    if (!img) return;

    if (src) {
        img.src = src;
        img.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (delBtn) delBtn.style.display = 'flex';
    } else {
        img.style.display = 'none';
        img.src = '';
        if (placeholder) placeholder.style.display = '';
        if (delBtn) delBtn.style.display = 'none';
    }
}

// ─── Portrait Gallery Config ───
const PORTRAIT_GALLERY = [
    'char_worldsapart_01', 'char_worldsapart_02', 'char_worldsapart_03',
    'char_worldsapart_04', 'char_worldsapart_05', 'char_worldsapart_06',
    'char_worldsapart_07'
];

function initPortrait() {
    let cropper = null;
    const fileInput = document.getElementById('portraitFileInput');
    const overlay = document.getElementById('portraitOverlay');
    const cropperModal = document.getElementById('portraitCropperModal');
    const galleryModal = document.getElementById('portraitGalleryModal');
    const cropperImage = document.getElementById('cropperImage');
    if (!overlay) return;

    // ── Button actions ──
    overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('.portrait-btn');
        if (!btn) return;
        e.stopPropagation();
        const action = btn.dataset.action;

        if (action === 'upload') {
            fileInput.click();
        } else if (action === 'gallery') {
            openGallery();
        } else if (action === 'delete') {
            if (confirm('Portrait wirklich entfernen?')) {
                charData.portrait = '';
                save('portrait', '');
                renderPortrait();
            }
        }
    });

    // ── File Upload → Cropper ──
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.type)) {
            notify('Nur JPG, PNG, WebP und GIF erlaubt');
            fileInput.value = '';
            return;
        }

        // GIF: skip cropper, use directly (preserve animation)
        if (file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = (ev) => {
                applyPortrait(ev.target.result);
            };
            reader.readAsDataURL(file);
            fileInput.value = '';
            return;
        }

        // Other formats: open cropper
        const reader = new FileReader();
        reader.onload = (ev) => {
            cropperImage.src = ev.target.result;
            openCropperModal();
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });

    // ── Cropper Modal ──
    function openCropperModal() {
        cropperModal.classList.add('open');
        if (cropper) cropper.destroy();
        setTimeout(() => {
            cropper = new Cropper(cropperImage, {
                aspectRatio: 130 / 160, // match portrait box
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false
            });
        }, 100);
    }

    function closeCropperModal() {
        cropperModal.classList.remove('open');
        if (cropper) { cropper.destroy(); cropper = null; }
    }

    document.getElementById('cropperApplyBtn')?.addEventListener('click', () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({
            width: 260,
            height: 320,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        applyPortrait(dataUrl);
        closeCropperModal();
    });

    document.getElementById('cropperCancelBtn')?.addEventListener('click', closeCropperModal);
    document.getElementById('cropperCloseBtn')?.addEventListener('click', closeCropperModal);
    cropperModal?.querySelector('.portrait-modal__backdrop')?.addEventListener('click', closeCropperModal);

    // ── Gallery Modal ──
    function openGallery() {
        galleryModal.classList.add('open');
        const grid = document.getElementById('portraitGalleryGrid');
        if (!grid) return;

        // Only build once
        if (grid.children.length === 0) {
            PORTRAIT_GALLERY.forEach(name => {
                const item = document.createElement('div');
                item.className = 'portrait-gallery-item';
                item.innerHTML = `<img src="/assets/img/rift_chars/hero_card/${name}.png" alt="${name}" loading="lazy">`;
                item.addEventListener('click', () => {
                    // Load full-res version
                    const fullSrc = `/assets/img/rift_chars/full/${name}.png`;
                    // Convert to base64 for storage
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 260;
                        canvas.height = 320;
                        const ctx = canvas.getContext('2d');
                        // Cover-fit
                        const scale = Math.max(260 / img.width, 320 / img.height);
                        const w = img.width * scale;
                        const h = img.height * scale;
                        ctx.drawImage(img, (260 - w) / 2, (320 - h) / 2, w, h);
                        applyPortrait(canvas.toDataURL('image/jpeg', 0.85));
                        closeGallery();
                    };
                    img.onerror = () => {
                        // Fallback: use hero_card size
                        applyPortrait(`/assets/img/rift_chars/hero_card/${name}.png`);
                        closeGallery();
                    };
                    img.src = fullSrc;
                });
                grid.appendChild(item);
            });
        }
    }

    function closeGallery() {
        galleryModal.classList.remove('open');
    }

    document.getElementById('galleryCloseBtn')?.addEventListener('click', closeGallery);
    galleryModal?.querySelector('.portrait-modal__backdrop')?.addEventListener('click', closeGallery);

    // ── Apply + Save ──
    function applyPortrait(dataUrl) {
        charData.portrait = dataUrl;
        save('portrait', dataUrl);
        renderPortrait();
        notify('Portrait gespeichert');
    }
}

function renderClassAndOrbs() {
    // Defensive defaults for incomplete data
    if (!charData.class) charData.class = { id: '', name: '', label: 'Disziplin' };
    if (!charData.hp) charData.hp = { current: 100, max: 100, regen: 0 };
    if (!charData.resource) charData.resource = { name: '', current: 100, max: 100, perHit: 0 };
    if (!charData.xp) charData.xp = { current: 0, max: 1000 };
    if (!charData.level) charData.level = 1;

    txt('className', charData.class.name || '\u2014');
    txt('classSubLabel', charData.class.name ? charData.class.label : 'Klasse wählen');
    
    const levelEl = document.getElementById('levelOrb');
    if (levelEl) levelEl.innerHTML = createLevelOrb(charData.level);
    
    const hpEl = document.getElementById('hpOrb');
    if (hpEl) hpEl.innerHTML = createHPOrb(charData.hp.current, charData.hp.max);
    txt('hpValues', `${charData.hp.current} / ${charData.hp.max}`);
    
    const rageEl = document.getElementById('rageOrb');
    if (rageEl) rageEl.innerHTML = createRageOrb(charData.resource.current, charData.resource.max);
    txt('rageLabel', charData.resource.name || 'Ressource');
    txt('rageValues', `${charData.resource.current} / ${charData.resource.max}`);
    
    const xpMax = charData.xp.max || 1;
    const xpPct = Math.min(100, (charData.xp.current / xpMax) * 100);
    const xpFill = document.getElementById('xpFill');
    if (xpFill) xpFill.style.width = xpPct + '%';
    txt('xpText', `${charData.xp.current.toLocaleString('de-DE')} / ${charData.xp.max.toLocaleString('de-DE')} XP`);
    txt('xpLabel', `Erfahrung (Level ${charData.level})`);
}

function renderAttributes() {
    const a = charData.attributes;
    txtSafe('attrKraft', a.kraft);
    txtSafe('attrGeschick', a.geschick);
    txtSafe('attrBelastbarkeit', a.belastbarkeit);
    txtSafe('attrIntellekt', a.intellekt);
    txtSafe('attrAutoritaet', a.autoritaet);
    const used = a.kraft + a.geschick + a.belastbarkeit + a.intellekt + a.autoritaet;
    const remaining = Math.max(0, (a.points?.total || 20) - used);
    txt('attrPoints', `Noch ${remaining} von ${a.points?.total || 20} Punkten übrig`);

    const attrContent = document.querySelector('.attr-content');
    if (attrContent) attrContent.classList.toggle('attr-full', remaining === 0);

    txtSafe('initValue', charData.offense.initiative);
    txtSafe('combatMovement', charData.defense.movement);
    txtSafe('combatRange', charData.offense.range);
    txtSafe('combatIniFormula', charData.offense.iniFormula);
}

function renderSkills() {
    txt('skillPointsBadge', `${charData.skillPoints} Skillpunkt${charData.skillPoints !== 1 ? 'e' : ''} verfügbar`);
    if (charData.weakness) {
        txtSafe('weaknessName', charData.weakness.name);
        txtSafe('weaknessDesc', charData.weakness.description);
    }
}

function renderDefense() {
    const d = charData.defense;
    const el = document.getElementById('defenseShield');
    if (el) el.innerHTML = createDefenseShield(d.armor, d.mitigation, d.resistances);
    el.style.cursor = 'pointer';
    txtSafe('ds-block', d.block != null ? d.block + '%' : '\u2014');
    txtSafe('ds-dodge', d.dodge + '%');
    txtSafe('ds-movement', d.movement + ' Felder');
}

function renderStats() {
    const d = charData.defense;
    const r = d.resistances || {};
    txt('s-res-fire', (r.fire || 0) + '%');
    txt('s-res-cold', (r.cold || 0) + '%');
    txt('s-res-poison', (r.poison || 0) + '%');
    txt('s-res-arcane', (r.arcane || 0) + '%');
    txtSafe('s-movement', d.movement + ' Felder');
    txtSafe('s-carry', charData.offense.carry + ' kg');
    txtSafe('s-hp-max', charData.hp.max);
    txtSafe('s-hp-regen', charData.hp.regen + '/Runde');
    txtSafe('s-res-max', charData.resource.max);
    txtSafe('s-res-perHit', charData.resource.perHit);
}

function renderInventoryGrid() {
    const grid = document.getElementById('inventoryGrid');
    if (grid && !grid.hasChildNodes()) {
        buildInventoryGrid(grid, charData.inventory.cols, charData.inventory.rows);
    }
    // Render items, equipment, quickbar via inventory system (only if init() was called)
    if (window.RiftInventory && RiftInventory.isReady) {
        try { RiftInventory.render(); } catch (e) { console.warn('[Character] Inventory render error:', e); }
    }
}

function renderAbilities() {
    let total = 0;
    for (const cat of ['koerper', 'verstand', 'praesenz']) {
        const rows = document.querySelectorAll(`[data-ability-cat="${cat}"] .abilities-row`);
        const abilities = charData.abilities?.[cat] || [];
        rows.forEach((row, i) => {
            const ab = abilities[i] || { name: '', value: '', active: true };
            const nameInput = row.querySelector('.ability-name');
            const valInput = row.querySelector('.ability-val');
            const toggle = row.querySelector('.ability-toggle');
            if (nameInput && nameInput !== document.activeElement) nameInput.value = ab.name;
            if (valInput && valInput !== document.activeElement) valInput.value = ab.value;
            if (toggle) {
                toggle.classList.toggle('active', ab.active !== false);
                toggle.classList.toggle('inactive', ab.active === false);
            }
            if (ab.value) total += Number(ab.value) || 0;
        });
    }
    txt('abilitiesUsed', total);
}

function renderSecondChance() {
    const tokens = document.querySelectorAll('.chance-token');
    const used = charData.secondChance?.used || [false, false, false];
    tokens.forEach((t, i) => t.classList.toggle('used', used[i] === true));
}

function renderNotes() {
    const area = document.getElementById('notesArea');
    if (area && area !== document.activeElement && area.value !== (charData.notes || '')) {
        area.value = charData.notes || '';
    }
}

function renderCurrency() {
    const c = charData.currency || {};
    txtSafe('currGold', c.gold || 0);
    txtSafe('currSilver', c.silver || 0);
    txtSafe('currCopper', c.copper || 0);
}

// ─── Debounce Helper ───
const _timers = {};
function debounce(key, fn, ms = 800) {
    clearTimeout(_timers[key]);
    _timers[key] = setTimeout(fn, ms);
}

// ─── Storage Keys ───
// Per-character storage: 'rift_wa_char_{charId}'
function _storageKey(id) {
    return 'rift_wa_char_' + (id || 'local');
}
// Legacy single key (migration)
const LEGACY_STORAGE_KEY = 'rift_wa_character';

// ─── State write (localStorage always + RiftLink when connected) ───
function save(path, value) {
    // Update local charData
    setNested(charData, path, value);
    _dirty = true;

    // Persist immediately to localStorage
    _saveLocal();

    // If connected to a room, also push to RiftState → RiftLink → Firebase
    if (charId) {
        _stateSet(`characters.${charId}`, { ...charData });
    }
}

function _saveLocal(skipSync) {
    try {
        const json = JSON.stringify(charData);
        const key = _storageKey(charId);
        localStorage.setItem(key, json);

        // Bridge to CharacterStorage (debounced — hub doesn't need instant updates)
        // Skip sync when saving remote data to prevent echo loops
        if (!skipSync) {
            debounce('charStorageBridge', _syncToCharacterStorage, 2000);
        }

        console.log('[Character] Saved to', key, '(' + Math.round(json.length / 1024) + 'kB)', charData.profile?.name || '', skipSync ? '(no sync)' : '');
    } catch (e) {
        console.error('[Character] localStorage save FAILED:', e);
    }
}

/**
 * Bridge v2 charData → CharacterStorage format.
 * The hub/sheet.html reads from CharacterStorage.getByRuleset(),
 * so we must keep it in sync.
 */
function _syncToCharacterStorage() {
    if (typeof CharacterStorage === 'undefined') return;

    try {
        const stableId = charId || _getOrCreateLocalCharId();
        const a = charData.attributes || {};

        // Portrait: send path reference, not full base64 (too large for Firebase)
        const portraitRef = charData.portrait?.startsWith('data:') ? '' : (charData.portrait || '');

        const hubChar = {
            id:       stableId,
            name:     charData.profile?.name || 'Unbenannt',
            ruleset:  'worldsapart',
            class:    charData.class?.name || '',
            portrait: portraitRef,
            data: {
                role:   charData.class?.name || '',
                race:   charData.profile?.race || '',
                age:    charData.profile?.age || '',
                gender: charData.profile?.gender || '',
                status: {
                    health: charData.hp ? Math.round((charData.hp.current / (charData.hp.max || 100)) * 100) : 100,
                    moral:  charData.resource ? Math.round((charData.resource.current / (charData.resource.max || 100)) * 100) : 100
                },
                attributes: {
                    power:     a.kraft || 0,
                    agility:   a.geschick || 0,
                    endurance: a.belastbarkeit || 0,
                    mind:      a.intellekt || 0,
                    presence:  a.autoritaet || 0
                }
            }
        };

        // When RiftLink is active, only save locally — RiftLink handles Firestore
        if (_riftLinkActive) {
            if (!hubChar.createdAt) hubChar.createdAt = new Date().toISOString();
            hubChar.updatedAt = new Date().toISOString();
            const all = CharacterStorage.getLocalAll();
            all[hubChar.id] = hubChar;
            localStorage.setItem(CharacterStorage.STORAGE_KEY, JSON.stringify(all));
            return;
        }

        CharacterStorage.save(hubChar);
    } catch (e) {
        console.warn('[Character] CharacterStorage bridge error:', e);
    }
}

/** Get or create a stable local char ID so repeated saves update same slot */
function _getOrCreateLocalCharId() {
    let id = localStorage.getItem('rift_wa_local_char_id');
    if (!id) {
        id = 'wa_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('rift_wa_local_char_id', id);
    }
    return id;
}

/**
 * Ensure charData has all required fields from BLANK_CHARACTER.
 * Loaded data may be incomplete (old format, hub format, etc.)
 */
function _ensureDefaults() {
    if (!charData || typeof charData !== 'object') {
        charData = JSON.parse(JSON.stringify(BLANK_CHARACTER));
        return;
    }
    const blank = JSON.parse(JSON.stringify(BLANK_CHARACTER));
    _deepMergeDefaults(charData, blank);
}

function _deepMergeDefaults(target, defaults) {
    if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return;
    if (!target || typeof target !== 'object' || Array.isArray(target)) return;
    const keys = Object.keys(defaults);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const dVal = defaults[key];
        const tVal = target[key];
        // Missing or null in target → take default
        if (tVal === undefined || tVal === null) {
            target[key] = dVal;
        }
        // Both are plain objects → recurse
        else if (
            dVal !== null && dVal !== undefined &&
            typeof dVal === 'object' && !Array.isArray(dVal) &&
            tVal !== null && tVal !== undefined &&
            typeof tVal === 'object' && !Array.isArray(tVal)
        ) {
            _deepMergeDefaults(tVal, dVal);
        }
    }
}

function _loadLocal() {
    try {
        const key = _storageKey(charId);
        let raw = localStorage.getItem(key);

        // Migration: if no per-char data, check legacy single key
        if (!raw && charId) {
            const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyRaw) {
                const legacy = JSON.parse(legacyRaw);
                if (legacy && legacy.profile) {
                    console.log('[Character] Migrating from legacy key to', key);
                    localStorage.setItem(key, legacyRaw);
                    raw = legacyRaw;
                }
            }
        }

        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profile) {
            console.log('[Character] Loaded from', key + ':', parsed.profile?.name || '');
            return parsed;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// ─── Interactions ───

function initInteractions() {
    initSectionNav();
    initProfileBindings();
    initPortrait();
    initAbilityBindings();
    initCurrencyBindings();
    initSecondChanceBindings();
    initNotesBinding();
    initAttributeBindings();
    initOrbBindings();
    initLevelBinding();
    initDefenseBindings();
    initRestBindings();
    initCombatBindings();
    initWeaknessBindings();
    initClassPicker();
    initXpBinding();
    initInventorySystem();
}

// ── Profile fields (contenteditable divs + textarea) ──

function initProfileBindings() {
    const fieldMap = {
        charName:     'profile.name',
        fieldRace:    'profile.race',
        fieldAge:     'profile.age',
        fieldGender:  'profile.gender',
        fieldFaction: 'profile.faction',
    };

    for (const [id, path] of Object.entries(fieldMap)) {
        const el = document.getElementById(id);
        if (!el) continue;

        if (el.tagName === 'SELECT') {
            el.addEventListener('change', () => {
                save(path, el.value);
                if (id === 'fieldGender') _updateSilhouette(el.value);
            });
        } else {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            });

            el.addEventListener('input', () => {
                setNested(charData, path, el.textContent.trim());
                _dirty = true;
                debounce(id, () => save(path, el.textContent.trim()));
            });

            el.addEventListener('blur', () => {
                save(path, el.textContent.trim());
            });
        }
    }

    // Description textarea
    const desc = document.getElementById('charDesc');
    if (desc) {
        desc.addEventListener('input', () => {
            setNested(charData, 'profile.description', desc.value);
            _dirty = true;
            debounce('charDesc', () => save('profile.description', desc.value));
        });
        desc.addEventListener('blur', () => {
            save('profile.description', desc.value);
        });
    }

    // Initial silhouette based on saved gender
    _updateSilhouette(charData.profile?.gender);
}

function _updateSilhouette(gender) {
    const img = document.getElementById('equipSilhouette');
    if (!img) return;
    if (gender === 'Weiblich') {
        img.src = '/assets/img/inventory/silhouette_female.png';
    } else {
        img.src = '/assets/img/inventory/silhouette_male.png';
    }
}

// ── Attribute editing ──

function initAttributeBindings() {
    const attrMap = {
        attrKraft: 'kraft', attrGeschick: 'geschick',
        attrBelastbarkeit: 'belastbarkeit', attrIntellekt: 'intellekt',
        attrAutoritaet: 'autoritaet'
    };

    for (const [id, key] of Object.entries(attrMap)) {
        const el = document.getElementById(id);
        if (!el) continue;

        el.addEventListener('focus', () => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
            }
        });

        el.addEventListener('blur', () => {
            let val = parseInt(el.textContent, 10) || 0;

            // Clamp to 0..15 per attribute
            val = Math.max(0, Math.min(15, val));

            // Check total budget (20 points)
            const a = charData.attributes;
            const othersTotal = (a.kraft + a.geschick + a.belastbarkeit + a.intellekt + a.autoritaet) - a[key];
            const maxForThis = Math.min(15, 20 - othersTotal);
            val = Math.min(val, maxForThis);

            charData.attributes[key] = val;
            el.textContent = val;
            updateAttrPoints();
            save(`attributes.${key}`, val);
        });
    }
}

function updateAttrPoints() {
    const a = charData.attributes;
    const used = a.kraft + a.geschick + a.belastbarkeit + a.intellekt + a.autoritaet;
    a.points.used = used;
    const remaining = Math.max(0, a.points.total - used);
    txt('attrPoints', `Noch ${remaining} von ${a.points.total} Punkten übrig`);

    // Toggle full state — pill collapses, boxes grow
    const attrContent = document.querySelector('.attr-content');
    if (attrContent) {
        attrContent.classList.toggle('attr-full', remaining === 0);
    }

    save('attributes.points', a.points);
}

// ── Orb editing (HP + Resource) ──

function initOrbBindings() {
    bindOrbDrag('hpOrb', 'hpValues', 'hp');
    bindOrbDrag('rageOrb', 'rageValues', 'resource');
}

/**
 * Combined click + drag on orb.
 * - Quick click (no movement) → prompt to type exact value
 * - Drag up/down → fill level follows mouse → release commits
 */
function bindOrbDrag(orbId, valuesId, dataKey) {
    const orb = document.getElementById(orbId);
    const valuesEl = document.getElementById(valuesId);
    if (!orb) return;

    let dragging = false;
    let didMove = false;
    let startY = 0;
    let startVal = 0;
    const MOVE_THRESHOLD = 4; // px before drag activates
    const isHp = dataKey === 'hp';

    // ── Indicator element (lives OUTSIDE the orb so innerHTML replacement doesn't kill it) ──
    const indicator = document.createElement('div');
    indicator.className = 'orb-drag-indicator';
    indicator.innerHTML = '<div class="orb-drag-line"></div><div class="orb-drag-value"></div>';
    indicator.style.display = 'none';
    orb.parentElement.appendChild(indicator); // attach to orb-wrapper, not orb
    orb.style.cursor = 'ns-resize';

    function yToPct(clientY) {
        const rect = orb.getBoundingClientRect();
        // Orb circle visible from ~7% to ~93% of element
        const pad = rect.height * 0.07;
        const top = rect.top + pad;
        const h = rect.height - pad * 2;
        return Math.max(0, Math.min(1, 1 - (clientY - top) / h));
    }

    function pctToValue(pct) {
        const max = charData[dataKey]?.max || 100;
        return Math.round(pct * max);
    }

    function updateIndicator(pct, val) {
        const max = charData[dataKey]?.max || 100;
        const orbRect = orb.getBoundingClientRect();
        const wrapRect = orb.parentElement.getBoundingClientRect();

        // Position relative to wrapper
        const pad = orbRect.height * 0.07;
        const orbTop = orbRect.top - wrapRect.top + pad;
        const orbH = orbRect.height - pad * 2;
        const lineY = orbTop + orbH * (1 - pct);

        const line = indicator.querySelector('.orb-drag-line');
        const valueEl = indicator.querySelector('.orb-drag-value');
        line.style.top = lineY + 'px';
        valueEl.style.top = (lineY - 22) + 'px';
        valueEl.textContent = `${val} / ${max}`;

        const color = isHp
            ? (pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444')
            : '#d4a844';
        line.style.background = color;
        line.style.boxShadow = `0 0 8px ${color}`;
        valueEl.style.color = color;
    }

    function updateOrbPreview(val) {
        // Live-update the text below the orb
        const max = charData[dataKey]?.max || 100;
        if (valuesEl) valuesEl.textContent = `${val} / ${max}`;
    }

    function startDrag(e) {
        e.preventDefault();
        dragging = true;
        didMove = false;
        startVal = charData[dataKey]?.current ?? 0;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
    }

    function moveDrag(e) {
        if (!dragging) return;
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Only activate drag after threshold
        if (!didMove && Math.abs(clientY - startY) < MOVE_THRESHOLD) return;

        if (!didMove) {
            // First move: show indicator, dim orb
            didMove = true;
            indicator.style.display = 'block';
            orb.classList.add('orb--dragging');
        }

        const pct = yToPct(clientY);
        const val = pctToValue(pct);
        updateIndicator(pct, val);
        updateOrbPreview(val);
    }

    function endDrag(e) {
        if (!dragging) return;
        dragging = false;

        if (didMove) {
            // Drag ended → commit value
            indicator.style.display = 'none';
            orb.classList.remove('orb--dragging');

            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const pct = yToPct(clientY);
            const val = pctToValue(pct);

            if (val !== startVal) {
                charData[dataKey].current = val;
                save(dataKey, charData[dataKey]);
                renderClassAndOrbs();
            }
        } else {
            // No movement → treat as click → open prompt
            const data = charData[dataKey];
            if (!data) return;
            const label = isHp ? 'Leben' : (charData.resource?.name || 'Ressource');
            const input = prompt(`${label} (aktuell / max):`, `${data.current} / ${data.max}`);
            if (input === null) return;
            const parts = input.split('/').map(s => parseInt(s.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                data.current = parts[0];
                data.max = parts[1];
            } else if (parts.length === 1 && !isNaN(parts[0])) {
                data.current = parts[0];
            }
            save(dataKey, data);
            renderClassAndOrbs();
        }
    }

    // Mouse
    orb.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);

    // Touch
    orb.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

// ── Level editing ──

function initLevelBinding() {
    const el = document.getElementById('levelOrb');
    if (!el) return;

    el.addEventListener('click', () => {
        const input = prompt('Level:', charData.level);
        if (input === null) return;
        const val = parseInt(input, 10);
        if (!isNaN(val) && val >= 1) {
            charData.level = val;
            save('level', val);
            renderClassAndOrbs();
        }
    });
}

// ── XP editing ──

function initXpBinding() {
    const el = document.getElementById('xpText');
    if (!el) return;

    el.addEventListener('click', () => {
        const input = prompt('XP (aktuell / max):', `${charData.xp.current} / ${charData.xp.max}`);
        if (input === null) return;
        const parts = input.split('/').map(s => parseInt(s.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            charData.xp.current = parts[0];
            charData.xp.max = parts[1];
        } else if (parts.length === 1 && !isNaN(parts[0])) {
            charData.xp.current = parts[0];
        }
        save('xp', charData.xp);
        renderClassAndOrbs();
    });
}

// ── Defense editing ──

function initDefenseBindings() {
    const defMap = {
        'ds-dodge': 'defense.dodge',
        'ds-block': 'defense.block',
        'ds-movement': 'defense.movement'
    };

    for (const [id, path] of Object.entries(defMap)) {
        const el = document.getElementById(id);
        if (!el) continue;

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });

        el.addEventListener('blur', () => {
            const raw = el.textContent.replace(/[^0-9.\-]/g, '');
            const val = parseFloat(raw) || 0;
            setNested(charData, path, val);
            debounce(id, () => save(path, val));
            renderDefense();
        });
    }

    // Shield click → edit armor + mitigation
    const shield = document.getElementById('defenseShield');
    if (shield) {
        shield.addEventListener('click', () => {
            const input = prompt('Rüstung / Mitigation %:', `${charData.defense.armor} / ${charData.defense.mitigation}`);
            if (input === null) return;
            const parts = input.split('/').map(s => parseInt(s.trim(), 10));
            if (parts.length >= 1 && !isNaN(parts[0])) charData.defense.armor = parts[0];
            if (parts.length >= 2 && !isNaN(parts[1])) charData.defense.mitigation = parts[1];
            save('defense', charData.defense);
            renderDefense();
        });
        shield.style.cursor = 'pointer';
    }
}

// ── Combat stat editing ──

// ── Rest Mechanics ──

function initRestBindings() {
    const kurzBtn = document.getElementById('rastKurz');
    const langBtn = document.getElementById('rastLang');

    if (kurzBtn) {
        kurzBtn.addEventListener('click', () => doRest(25, 'kurze', 3));
        kurzBtn.addEventListener('mouseenter', () => {
            const hpGain = Math.min(25, (charData.hp?.max || 100) - (charData.hp?.current || 0));
            const resGain = Math.min(25, (charData.resource?.max || 100) - (charData.resource?.current || 0));
            kurzBtn.title = `Du legst eine kurze Rast von 3 Stunden ein, du stellst ${hpGain} LP und ${resGain} Ressource wieder her.`;
        });
    }

    if (langBtn) {
        langBtn.addEventListener('click', () => doRest(50, 'lange', 8));
        langBtn.addEventListener('mouseenter', () => {
            const hpGain = Math.min(50, (charData.hp?.max || 100) - (charData.hp?.current || 0));
            const resGain = Math.min(50, (charData.resource?.max || 100) - (charData.resource?.current || 0));
            langBtn.title = `Du legst eine lange Rast von 8 Stunden ein, du stellst ${hpGain} LP und ${resGain} Ressource wieder her.`;
        });
    }
}

function doRest(amount, label, hours) {
    const hp = charData.hp;
    const res = charData.resource;
    if (!hp || !res) return;

    const hpBefore = hp.current;
    const resBefore = res.current;

    hp.current = Math.min(hp.max, hp.current + amount);
    res.current = Math.min(res.max, res.current + amount);

    const hpGained = hp.current - hpBefore;
    const resGained = res.current - resBefore;

    save('hp', hp);
    save('resource', res);
    renderClassAndOrbs();

    notify(`${label.charAt(0).toUpperCase() + label.slice(1)} Rast (${hours}h): +${hpGained} LP, +${resGained} Ressource`);
}

// ── Combat stats editing ──

function initCombatBindings() {
    const combatMap = {
        initValue: 'offense.initiative',
        combatMovement: 'defense.movement',
        combatRange: 'offense.range',
        combatIniFormula: 'offense.iniFormula'
    };

    for (const [id, path] of Object.entries(combatMap)) {
        const el = document.getElementById(id);
        if (!el) continue;

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });

        el.addEventListener('blur', () => {
            const text = el.textContent.trim();
            const isNum = path.includes('initiative') || path.includes('movement');
            const val = isNum ? (parseInt(text, 10) || 0) : text;
            setNested(charData, path, val);
            debounce(id, () => save(path, val));
        });
    }
}

// ── Weakness editing ──

function initWeaknessBindings() {
    const nameEl = document.getElementById('weaknessName');
    const descEl = document.getElementById('weaknessDesc');

    if (nameEl) {
        nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
        nameEl.addEventListener('input', () => {
            charData.weakness.name = nameEl.textContent.trim();
            debounce('wkName', () => save('weakness.name', charData.weakness.name));
        });
    }
    if (descEl) {
        descEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); descEl.blur(); } });
        descEl.addEventListener('input', () => {
            charData.weakness.description = descEl.textContent.trim();
            debounce('wkDesc', () => save('weakness.description', charData.weakness.description));
        });
    }
}

// ── Class Picker ──

function initClassPicker() {
    const portrait = document.getElementById('classPortrait');
    const overlay = document.getElementById('classPicker');
    const grid = document.getElementById('classPickerGrid');
    const closeBtn = document.getElementById('classPickerClose');
    if (!portrait || !overlay || !grid) return;

    // ── Fetch session members from Firestore ──
    let sessionMembers = {}; // classId → [{name, portrait}]

    // Map legacy German IDs to new English IDs
    const LEGACY_CLASS_IDS = {
        barbar: 'barbarian', magier: 'mage', assassine: 'assassin',
        druide: 'druid', hexenmeister: 'warlock', waldlaeufer: 'ranger', kleriker: 'cleric'
    };

    async function _loadSessionMembers() {
        sessionMembers = {};
        try {
            const urlP = new URLSearchParams(window.location.search);
            const rc = urlP.get('room') || urlP.get('roomCode') || RIFT?.state?.get('room.code');
            if (!rc) return;
            const db = RIFT?.firebase?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
            if (!db) return;
            const snap = await db.collection('rooms').doc(rc.replace(/-/g, '').toUpperCase())
                .collection('characters').get();
            snap.docs.forEach(doc => {
                const d = doc.data();
                let cid = d.class?.id;
                if (!cid) return;
                // Normalize legacy IDs
                cid = LEGACY_CLASS_IDS[cid] || cid;
                if (!sessionMembers[cid]) sessionMembers[cid] = [];
                sessionMembers[cid].push({
                    name: d.profile?.name || d.name || 'Unbekannt',
                    portrait: d.portrait || ''
                });
            });
        } catch (e) {
            console.warn('[ClassPicker] Could not load session members:', e);
        }
    }

    // ── Fallback SVG icons per class ──
    const CLASS_ICONS = {
        barbarian:    'M14.5 2.5L12 5 9.5 2.5 7 5l5 5 5-5-2.5-2.5zM7 12l-5 5h7l3 5 3-5h7l-5-5-5 5-5-5z',
        mage:         'M12 2L2 19h20L12 2zm0 4l6.5 11h-13L12 6z',
        assassin:     'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3l2.5 5H15l-3 7-3-7h.5L12 5z',
        paladin:      'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5zm0 3.2L18 9v4.5c0 4-2.5 7.8-6 9-3.5-1.2-6-5-6-9V9l6-3.8z',
        druid:        'M12 2C8 2 4 4.5 4 9c0 3.5 2 6 4 7.5V22h8v-5.5c2-1.5 4-4 4-7.5 0-4.5-4-7-8-7zm0 2c3 0 6 2 6 5s-2 5.5-3.5 6.5L14 16h-4l-.5-.5C8 14.5 6 12 6 9c0-3 3-5 6-5z',
        warlock:      'M12 2L8 8l-6 2 4 5-1 6 7-3 7 3-1-6 4-5-6-2-4-6z',
        ranger:       'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2zm0 4.24L16.66 18H7.34L12 6.24z',
        cleric:       'M12 2v6H8v4h4v10h2V12h4V8h-4V2h-2z'
    };

    function _buildCards() {
        grid.innerHTML = '';

        // Scroll wrapper
        const scrollWrap = document.createElement('div');
        scrollWrap.className = 'cp-scroll-wrap';

        const track = document.createElement('div');
        track.className = 'cp-track';

        CLASS_DEFINITIONS.forEach(cls => {
            const isSelected = charData.class.id === cls.id;
            const members = sessionMembers[cls.id] || [];

            const card = document.createElement('div');
            card.className = `cp-card${isSelected ? ' cp-card--selected' : ''}`;
            card.dataset.classId = cls.id;
            card.style.setProperty('--cls-color', cls.color);

            // Portrait
            const portraitDiv = document.createElement('div');
            portraitDiv.className = 'cp-card__portrait';
            const img = document.createElement('img');
            img.src = cls.image;
            img.alt = cls.name;
            img.draggable = false;
            img.onerror = function() {
                // Fallback: SVG icon
                this.style.display = 'none';
                const svg = document.createElement('div');
                svg.className = 'cp-card__fallback';
                svg.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${CLASS_ICONS[cls.id] || CLASS_ICONS.barbarian}"/></svg>`;
                this.parentElement.appendChild(svg);
            };
            portraitDiv.appendChild(img);

            // Hover info overlay
            const info = document.createElement('div');
            info.className = 'cp-card__info';
            info.innerHTML = `
                <div class="cp-card__desc">${cls.desc}</div>
                <div class="cp-card__traits">
                    ${cls.traits.map(t => `<span class="cp-card__trait">${t}</span>`).join('')}
                </div>`;
            portraitDiv.appendChild(info);
            card.appendChild(portraitDiv);

            // Name + Resource
            const meta = document.createElement('div');
            meta.className = 'cp-card__meta';
            meta.innerHTML = `
                <div class="cp-card__name">${cls.name}</div>
                <div class="cp-card__resource">${cls.resource}</div>`;
            card.appendChild(meta);

            // Session members
            if (members.length > 0) {
                const mDiv = document.createElement('div');
                mDiv.className = 'cp-card__members';
                members.forEach(m => {
                    const avatar = document.createElement('div');
                    avatar.className = 'cp-card__avatar';
                    avatar.title = m.name;
                    if (m.portrait) {
                        avatar.innerHTML = `<img src="${m.portrait}" alt="${m.name}">`;
                    } else {
                        avatar.textContent = m.name.charAt(0).toUpperCase();
                    }
                    mDiv.appendChild(avatar);
                });
                card.appendChild(mDiv);
            }

            track.appendChild(card);
        });

        scrollWrap.appendChild(track);
        grid.appendChild(scrollWrap);

        // Scroll arrows
        const arrowL = document.createElement('button');
        arrowL.className = 'cp-arrow cp-arrow--left';
        arrowL.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
        arrowL.onclick = () => track.scrollBy({ left: -240, behavior: 'smooth' });

        const arrowR = document.createElement('button');
        arrowR.className = 'cp-arrow cp-arrow--right';
        arrowR.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
        arrowR.onclick = () => track.scrollBy({ left: 240, behavior: 'smooth' });

        grid.appendChild(arrowL);
        grid.appendChild(arrowR);

        // Show/hide arrows based on scroll position
        function _updateArrows() {
            arrowL.style.opacity = track.scrollLeft > 10 ? '1' : '0';
            arrowL.style.pointerEvents = track.scrollLeft > 10 ? 'auto' : 'none';
            const maxScroll = track.scrollWidth - track.clientWidth;
            arrowR.style.opacity = track.scrollLeft < maxScroll - 10 ? '1' : '0';
            arrowR.style.pointerEvents = track.scrollLeft < maxScroll - 10 ? 'auto' : 'none';
        }
        track.addEventListener('scroll', _updateArrows);
        requestAnimationFrame(_updateArrows);

        // Click handler
        track.addEventListener('click', (e) => {
            const cardEl = e.target.closest('.cp-card');
            if (!cardEl) return;
            const clsId = cardEl.dataset.classId;
            const cls = CLASS_DEFINITIONS.find(c => c.id === clsId);
            if (!cls) return;

            charData.class = { id: cls.id, name: cls.name, label: 'Disziplin' };
            charData.resource.name = cls.resource;
            save('class', charData.class);
            save('resource.name', cls.resource);

            txt('className', cls.name);
            txt('classSubLabel', 'Disziplin');
            txt('rageLabel', cls.resource);
            renderClassAndOrbs();

            track.querySelectorAll('.cp-card').forEach(c => c.classList.remove('cp-card--selected'));
            cardEl.classList.add('cp-card--selected');

            overlay.style.display = 'none';
            notify(`Disziplin: ${cls.name}`);
        });
    }

    // Open picker
    portrait.addEventListener('click', async () => {
        overlay.style.display = 'flex';
        await _loadSessionMembers();
        _buildCards();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
}

// ── Helper: set nested value ──

function setNested(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

// ── Abilities (3 categories x 10 rows) ──

function initAbilityBindings() {
    for (const cat of ['koerper', 'verstand', 'praesenz']) {
        const col = document.querySelector(`[data-ability-cat="${cat}"]`);
        if (!col) continue;
        const rows = col.querySelectorAll('.abilities-row');

        rows.forEach((row, i) => {
            const nameInput = row.querySelector('.ability-name');
            const valInput = row.querySelector('.ability-val');
            const toggle = row.querySelector('.ability-toggle');

            const saveRow = () => {
                if (!charId) return;
                const abilities = readAbilitiesFromDOM(cat);
                save(`abilities.${cat}`, abilities);
            };

            if (nameInput) nameInput.addEventListener('input', () => debounce(`ab-${cat}-${i}`, saveRow));
            if (valInput) {
                valInput.addEventListener('input', () => {
                    // Live counter update
                    let total = 0;
                    document.querySelectorAll('.ability-val').forEach(inp => { total += Number(inp.value) || 0; });
                    txt('abilitiesUsed', total);
                    debounce(`ab-${cat}-${i}`, saveRow);
                });
            }
            if (toggle) {
                toggle.addEventListener('click', () => {
                    toggle.classList.toggle('active');
                    toggle.classList.toggle('inactive');
                    saveRow();
                });
            }
        });
    }
}

function readAbilitiesFromDOM(cat) {
    const col = document.querySelector(`[data-ability-cat="${cat}"]`);
    if (!col) return [];
    return [...col.querySelectorAll('.abilities-row')].map(row => {
        const nameInput = row.querySelector('.ability-name');
        const valInput = row.querySelector('.ability-val');
        const toggle = row.querySelector('.ability-toggle');
        return {
            name: nameInput ? nameInput.value : '',
            value: valInput ? valInput.value : '',
            active: toggle ? toggle.classList.contains('active') : true
        };
    });
}

// ── Currency (contenteditable spans) ──

function initCurrencyBindings() {
    const currMap = { currGold: 'currency.gold', currSilver: 'currency.silver', currCopper: 'currency.copper' };

    for (const [id, path] of Object.entries(currMap)) {
        const el = document.getElementById(id);
        if (!el) continue;

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });

        el.addEventListener('input', () => {
            debounce(id, () => save(path, parseInt(el.textContent, 10) || 0));
        });
    }
}

// ── Second Chance Tokens ──

function initSecondChanceBindings() {
    document.querySelectorAll('.chance-token').forEach(token => {
        token.addEventListener('click', () => {
            token.classList.toggle('used');
            const used = [...document.querySelectorAll('.chance-token')].map(t => t.classList.contains('used'));
            save('secondChance.used', used);
        });
    });
}

// ── Notes ──

function initNotesBinding() {
    const notesArea = document.getElementById('notesArea');
    if (!notesArea) return;
    notesArea.addEventListener('input', () => {
        charData.notes = notesArea.value;
        _dirty = true;
        debounce('notes', () => _saveLocal(), 1000);
    });
    notesArea.addEventListener('blur', () => {
        charData.notes = notesArea.value;
        _saveLocal();
    });
}

function initSectionNav() {
    const navLinks = document.querySelectorAll('.section-nav a');
    navLinks.forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(a.dataset.sec);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
    
    const sections = [...navLinks].map(a => ({ link: a, el: document.getElementById(a.dataset.sec) })).filter(s => s.el);
    
    function updateActiveNav() {
        const scrollY = window.scrollY + window.innerHeight / 3;
        let active = sections[0];
        for (const s of sections) { if (s.el.offsetTop <= scrollY) active = s; }
        navLinks.forEach(l => l.classList.remove('active'));
        if (active) active.link.classList.add('active');
    }
    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
}

// ─── Helpers ───
function txt(id, text) { const el = document.getElementById(id); if (el) { if (el.tagName === 'SELECT') el.value = text; else el.textContent = text; } }
function txtSafe(id, text) { const el = document.getElementById(id); if (el && el !== document.activeElement) { if (el.tagName === 'SELECT') el.value = text; else el.textContent = text; } }
function val(id, v) { const el = document.getElementById(id); if (!el) return; if (el === document.activeElement) return; if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = v || ''; else el.textContent = v || ''; }

function notify(msg) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}



// ═══════════════════════════════════════
//  SHEET FOOTER ACTIONS
// ═══════════════════════════════════════

function initSheetFooter() {
    const footer = document.getElementById('sheetFooter');
    if (!footer) return;

    footer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        switch (btn.dataset.action) {
            case 'save':      doSave(); break;
            case 'main-char': doSetMainChar(); break;
            case 'reset':     doReset(); break;
            case 'export':    doExport(); break;
        }
    });

    _updateMainCharBtn();
}

function doSave() {
    // Flush all current DOM values into charData first
    _flushAllFields();
    _saveLocal();
    _syncToCharacterStorage(); // immediate, not debounced
    if (charId) {
        _stateSet(`characters.${charId}`, { ...charData });
    }
    _dirty = false;
    notify('Charakter gespeichert');
    const btn = document.querySelector('[data-action="save"]');
    if (btn) { btn.classList.add('saved'); setTimeout(() => btn.classList.remove('saved'), 1200); }
}

/**
 * Read all current DOM field values back into charData.
 * Ensures nothing is lost even if blur handlers haven't fired.
 */
function _flushAllFields() {
    const fieldMap = {
        charName:     'profile.name',
        fieldRace:    'profile.race',
        fieldAge:     'profile.age',
        fieldGender:  'profile.gender',
        fieldFaction: 'profile.faction',
    };
    for (const [id, path] of Object.entries(fieldMap)) {
        const el = document.getElementById(id);
        if (el) setNested(charData, path, el.tagName === 'SELECT' ? el.value : el.textContent.trim());
    }
    const desc = document.getElementById('charDesc');
    if (desc) charData.profile.description = desc.value;

    // Attributes
    const attrMap = { attrKraft: 'kraft', attrGeschick: 'geschick', attrBelastbarkeit: 'belastbarkeit', attrIntellekt: 'intellekt', attrAutoritaet: 'autoritaet' };
    for (const [id, key] of Object.entries(attrMap)) {
        const el = document.getElementById(id);
        if (el) charData.attributes[key] = parseInt(el.textContent) || 0;
    }

    // Notes
    const notes = document.getElementById('notesArea');
    if (notes) charData.notes = notes.value;

    // Defense inline fields
    const defMap = { 'def-dodge': 'defense.dodge', 'def-block': 'defense.block', 'def-movement': 'defense.movement' };
    for (const [id, path] of Object.entries(defMap)) {
        const el = document.getElementById(id);
        if (el) setNested(charData, path, parseInt(el.textContent) || 0);
    }

    // Combat inline fields
    const combatMap = { 'combat-ini': 'offense.initiative', 'combat-movement': 'offense.movement', 'combat-range': 'offense.range', 'combat-ini-formula': 'offense.iniFormula' };
    for (const [id, path] of Object.entries(combatMap)) {
        const el = document.getElementById(id);
        if (el) {
            const val = el.textContent.trim();
            setNested(charData, path, isNaN(val) ? val : (parseInt(val) || 0));
        }
    }

    // Stats
    const statMap = { 's-hp-max': 'hp.max', 's-hp-regen': 'hp.regen', 's-res-max': 'resource.max', 's-res-perHit': 'resource.perHit' };
    for (const [id, path] of Object.entries(statMap)) {
        const el = document.getElementById(id);
        if (el) setNested(charData, path, parseInt(el.textContent) || 0);
    }

    // Weakness
    const wName = document.getElementById('weakness-name');
    const wDesc = document.getElementById('weakness-desc');
    if (wName) charData.weakness.name = wName.textContent.trim();
    if (wDesc) charData.weakness.description = wDesc.textContent.trim();
}

function doSetMainChar() {
    try {
        const id = charId || localStorage.getItem('rift_wa_local_char_id');
        if (!id) { notify('Kein Charakter-ID'); return; }
        
        // Use CharacterStorage main character system
        if (typeof CharacterStorage !== 'undefined') {
            CharacterStorage.setMainCharacter(id, 'worldsapart');
        }

        notify('Als Haupt-Charakter gesetzt');
        _updateMainCharBtn();
    } catch (e) {
        notify('Fehler beim Speichern');
    }
}

function doReset() {
    if (!confirm('Charakterbogen wirklich zurücksetzen? Alle Daten gehen verloren.')) return;
    charData = JSON.parse(JSON.stringify(BLANK_CHARACTER)); // deep copy
    _saveLocal();
    if (charId) {
        _stateSet(`characters.${charId}`, { ...charData });
    }
    renderAll();
    notify('Charakterbogen zurückgesetzt');
}

function doExport() {
    const name = charData.profile?.name || 'charakter';
    const filename = `${name.toLowerCase().replace(/[^a-z0-9äöüß]/g, '-')}_export.json`;
    const blob = new Blob([JSON.stringify(charData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exportiert: ${filename}`);
}

function _updateMainCharBtn() {
    const btn = document.querySelector('[data-action="main-char"]');
    if (!btn) return;
    try {
        const id = charId || localStorage.getItem('rift_wa_local_char_id');
        const isMain = id && typeof CharacterStorage !== 'undefined' && CharacterStorage.isMainCharacter(id);
        btn.classList.toggle('active', !!isMain);
    } catch (e) {}
}


// ── Inventory System Integration ──

function initInventorySystem() {
    if (!window.RiftInventory) {
        console.warn('[Character] RiftInventory not loaded');
        return;
    }

    RiftInventory.init(
        // getter: returns current charData
        () => charData,
        // setter: saves charData via _stateSet and re-renders orbs etc.
        (updatedChar) => {
            _lastLocalInvChange = Date.now();
            Object.assign(charData, updatedChar);
            console.log('[Character] Inventory save →', (charData.inventory?.items || []).length, 'items,',
                (charData.quickbar || []).filter(Boolean).length, 'quickbar');
            _stateSet(`characters.${charId}`, { ...charData });
            // Re-render orbs if HP/Resource changed
            if (typeof renderOrbs === 'function') renderOrbs();
        },
        charId
    );

    console.log('[Character] Inventory system initialized');
}


// ═══════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════

window.initV2Character = init;       // init(charId, roomCode)
window.createV2Character = createCharacter;

})();
