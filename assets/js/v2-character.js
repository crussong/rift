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

function _stateSet(path, value) {
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
<linearGradient id="shieldBorder" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a4a5f"/><stop offset="100%" stop-color="#2a2a3a"/></linearGradient>
<linearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a1a26"/><stop offset="100%" stop-color="#101018"/></linearGradient>
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
const DEMO_CHARACTER = {
    profile: {
        name: 'Grimjaw',
        race: 'Mensch',
        age: '34 Jahre',
        gender: 'Männlich',
        faction: 'Blutclan',
        description: 'Ein ehemaliger Gladiator aus den nördlichen Eiswüsten. Spricht wenig, schlägt viel.'
    },
    class: { name: 'Barbar', label: 'Disziplin' },
    level: 5,
    xp: { current: 1750, max: 5000 },
    attributes: {
        kraft: 6, geschick: 2, belastbarkeit: 0, intellekt: 0, autoritaet: 0,
        points: { used: 8, total: 15 }
    },
    hp: { current: 78, max: 100, regen: 2 },
    resource: { name: 'Rage', current: 45, max: 100, perHit: 8 },
    defense: {
        armor: 24, mitigation: 18,
        dodge: 5, block: null, movement: 3,
        resistances: { fire: 0, cold: 0, poison: 0, arcane: 0 }
    },
    offense: {
        initiative: 13, iniFormula: 'W20+RES/5',
        range: 'Nahkampf (1)', carry: 120
    },
    skills: [
        { name: 'Wilder Hieb', cost: '15 Rage', hotkey: 'Q', active: true, icon: '\u2694', iconColor: 'var(--rage-red)' },
        { name: 'Gesperrt', level: 5, hotkey: 'W', locked: true },
        { name: 'Gesperrt', level: 8, hotkey: 'E', locked: true },
        { name: 'Gesperrt', level: 10, hotkey: 'R', locked: true },
        { name: 'Gesperrt', level: 12, locked: true },
        { name: 'Gesperrt', level: 15, locked: true },
        { name: 'Gesperrt', level: 18, locked: true },
        { name: 'Gesperrt', level: 20, locked: true }
    ],
    skillPoints: 1,
    weakness: {
        name: 'Blutrausch',
        description: 'Bei unter 25% HP: -2 auf alle Intellektproben. Kann Freund und Feind nicht unterscheiden.',
        icon: '\u2717'
    },
    abilities: {
        koerper: Array(10).fill(null).map(() => ({ name: '', value: '', active: true })),
        verstand: Array(10).fill(null).map(() => ({ name: '', value: '', active: true })),
        praesenz: Array(10).fill(null).map(() => ({ name: '', value: '', active: true }))
    },
    secondChance: { used: [false, false, false] },
    notes: '',
    currency: { gold: 12, silver: 45, copper: 230 },
    inventory: { cols: 16, rows: 11, placements: [] },
    equipment: {},
    quickbar: Array(8).fill(null),
    buffs: []
};

let charId = null;
let charData = null;

// ─── Initialization ───

function init(characterId) {
    charId = characterId;
    const stateChar = charId ? _stateGet(`characters.${charId}`) : null;
    charData = stateChar || { ...DEMO_CHARACTER };
    
    renderAll();
    initCardCorners();
    
    if (charId) {
        _stateOn(`characters.${charId}`, (data) => {
            if (data) { charData = data; renderAll(); }
        });
    }
    
    initInteractions();
    console.log('[Character] Initialized', charId || 'DEMO');
}

async function createCharacter(roomCode, userId) {
    const id = 'char_' + Date.now().toString(36);
    await _stateSet(`characters.${id}`, {
        ...DEMO_CHARACTER,
        profile: { ...DEMO_CHARACTER.profile, name: 'Neuer Charakter' },
        ownerId: userId,
        createdAt: new Date().toISOString()
    });
    return id;
}

// ─── Render All ───

function renderAll() {
    renderProfile();
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
}

function renderClassAndOrbs() {
    txt('className', charData.class.name);
    txt('classSubLabel', charData.class.label);
    
    const levelEl = document.getElementById('levelOrb');
    if (levelEl) levelEl.innerHTML = createLevelOrb(charData.level);
    
    const hpEl = document.getElementById('hpOrb');
    if (hpEl) hpEl.innerHTML = createHPOrb(charData.hp.current, charData.hp.max);
    txt('hpValues', `${charData.hp.current} / ${charData.hp.max}`);
    
    const rageEl = document.getElementById('rageOrb');
    if (rageEl) rageEl.innerHTML = createRageOrb(charData.resource.current, charData.resource.max);
    txt('rageLabel', charData.resource.name);
    txt('rageValues', `${charData.resource.current} / ${charData.resource.max}`);
    
    const xpPct = (charData.xp.current / charData.xp.max) * 100;
    const xpFill = document.getElementById('xpFill');
    if (xpFill) xpFill.style.width = xpPct + '%';
    txt('xpText', `${charData.xp.current.toLocaleString('de-DE')} / ${charData.xp.max.toLocaleString('de-DE')} XP`);
    txt('xpLabel', `Erfahrung (Level ${charData.level})`);
}

function renderAttributes() {
    const a = charData.attributes;
    txt('attrKraft', a.kraft);
    txt('attrGeschick', a.geschick);
    txt('attrBelastbarkeit', a.belastbarkeit);
    txt('attrIntellekt', a.intellekt);
    txt('attrAutoritaet', a.autoritaet);
    txt('attrPoints', `${a.points.used} / ${a.points.total} Attributs-Punkte verteilt`);
    txt('initValue', charData.offense.initiative);
    txt('combatMovement', charData.defense.movement);
    txt('combatRange', charData.offense.range);
    txt('combatIniFormula', charData.offense.iniFormula);
}

function renderSkills() {
    txt('skillPointsBadge', `${charData.skillPoints} Skillpunkt${charData.skillPoints !== 1 ? 'e' : ''} verfügbar`);
    if (charData.weakness) {
        txt('weaknessName', charData.weakness.name);
        txt('weaknessDesc', charData.weakness.description);
    }
}

function renderDefense() {
    const d = charData.defense;
    const el = document.getElementById('defenseShield');
    if (el) el.innerHTML = createDefenseShield(d.armor, d.mitigation, d.resistances);
    txt('ds-block', d.block != null ? d.block + '%' : '\u2014');
    txt('ds-dodge', d.dodge + '%');
    txt('ds-movement', d.movement + ' Felder');
}

function renderStats() {
    const d = charData.defense;
    const r = d.resistances || {};
    txt('s-res-fire', (r.fire || 0) + '%');
    txt('s-res-cold', (r.cold || 0) + '%');
    txt('s-res-poison', (r.poison || 0) + '%');
    txt('s-res-arcane', (r.arcane || 0) + '%');
    txt('s-movement', d.movement + ' Felder');
    txt('s-carry', charData.offense.carry + ' kg');
}

function renderInventoryGrid() {
    const grid = document.getElementById('inventoryGrid');
    if (grid && !grid.hasChildNodes()) {
        buildInventoryGrid(grid, charData.inventory.cols, charData.inventory.rows);
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

// ─── State write shortcut (no-op in demo mode) ───
function save(path, value) {
    if (!charId) return;
    _stateSet(`characters.${charId}.${path}`, value);
}

// ─── Interactions ───

function initInteractions() {
    initSectionNav();
    initProfileBindings();
    initAbilityBindings();
    initCurrencyBindings();
    initSecondChanceBindings();
    initNotesBinding();
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

        // Prevent newlines in contenteditable
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });

        el.addEventListener('input', () => {
            const text = el.textContent.trim();
            debounce(id, () => save(path, text));
        });
    }

    // Description textarea
    const desc = document.getElementById('charDesc');
    if (desc) {
        desc.addEventListener('input', () => {
            debounce('charDesc', () => save('profile.description', desc.value));
        });
    }
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
        debounce('notes', () => save('notes', notesArea.value), 1000);
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
function txt(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function txtSafe(id, text) { const el = document.getElementById(id); if (el && el !== document.activeElement) el.textContent = text; }
function val(id, v) { const el = document.getElementById(id); if (!el) return; if (el === document.activeElement) return; if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = v || ''; else el.textContent = v || ''; }

function notify(msg) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}



// ═══════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════

window.initV2Character = init;
window.createV2Character = createCharacter;

})();
