/**
 * RIFT — v2 Skilltree Overlay (ported from ES module)
 * Non-module version for v1 unified architecture
 * Includes embedded skilltree schema
 */
(function() {
'use strict';

// ═══ Embedded Skilltree Schema ═══
var SKILLTREE_SCHEMA = {
  "skilltrees": {
    "barbar": {
      "id": "barbar",
      "name": "Barbar",
      "icon": "axe",
      "description": "Rohe Kraft und ungezähmte Wut",
      "pointsPerLevel": 1,
      "startingPoints": 0,

      "nodes": {
        "wilder_hieb": {
          "name": "Wilder Hieb",
          "type": "active",
          "tier": 1,
          "levelReq": 1,
          "cost": { "resource": "rage", "amount": 15 },
          "icon": "sword-cross",
          "description": "Ein brutaler Hieb der 2W6+KRF Schaden verursacht.",
          "effect": { "damage": "2d6+KRF", "target": "single" },
          "position": { "x": 50, "y": 10 },
          "requires": [],
          "isKeystone": false
        },
        "kampfschrei": {
          "name": "Kampfschrei",
          "type": "active",
          "tier": 1,
          "levelReq": 2,
          "cost": { "resource": "rage", "amount": 20 },
          "icon": "shout",
          "description": "Verbündete in 6m Radius erhalten +2 auf Angriffswürfe für 3 Runden.",
          "effect": { "buff": "attack+2", "radius": 6, "duration": 3 },
          "position": { "x": 25, "y": 25 },
          "requires": ["wilder_hieb"],
          "isKeystone": false
        },
        "zaehigkeit": {
          "name": "Zähigkeit",
          "type": "passive",
          "tier": 1,
          "levelReq": 2,
          "cost": null,
          "icon": "shield-heart",
          "description": "Maximale Lebenspunkte +10.",
          "effect": { "stat": "hp_max", "modifier": 10 },
          "position": { "x": 75, "y": 25 },
          "requires": ["wilder_hieb"],
          "isKeystone": false
        },
        "raserei": {
          "name": "Raserei",
          "type": "active",
          "tier": 2,
          "levelReq": 5,
          "cost": { "resource": "rage", "amount": 30 },
          "icon": "flame",
          "description": "Für 3 Runden: Schaden +50%, Rüstung -25%. Kann nicht unterbrochen werden.",
          "effect": { "buff": "damage+50%", "debuff": "armor-25%", "duration": 3 },
          "position": { "x": 15, "y": 45 },
          "requires": ["kampfschrei"],
          "isKeystone": false
        },
        "eisenhaut": {
          "name": "Eisenhaut",
          "type": "passive",
          "tier": 2,
          "levelReq": 5,
          "cost": null,
          "icon": "shield-solid",
          "description": "Schadensreduktion +5%.",
          "effect": { "stat": "damage_reduction", "modifier": 5 },
          "position": { "x": 40, "y": 45 },
          "requires": ["kampfschrei"],
          "isKeystone": false
        },
        "blutregen": {
          "name": "Blutregen",
          "type": "active",
          "tier": 2,
          "levelReq": 6,
          "cost": { "resource": "rage", "amount": 40 },
          "icon": "droplet",
          "description": "Heilt 3W4 LP über 3 Runden. Kostet zusätzlich 10% max LP.",
          "effect": { "heal": "3d4", "duration": 3, "hpCost": "10%" },
          "position": { "x": 65, "y": 45 },
          "requires": ["zaehigkeit"],
          "isKeystone": false
        },
        "spott": {
          "name": "Spott",
          "type": "active",
          "tier": 2,
          "levelReq": 7,
          "cost": { "resource": "rage", "amount": 10 },
          "icon": "megaphone",
          "description": "Ein Gegner muss dich 2 Runden lang angreifen.",
          "effect": { "taunt": true, "duration": 2, "target": "single" },
          "position": { "x": 85, "y": 45 },
          "requires": ["zaehigkeit"],
          "isKeystone": false
        },
        "hinrichtung": {
          "name": "Hinrichtung",
          "type": "active",
          "tier": 3,
          "levelReq": 10,
          "cost": { "resource": "rage", "amount": 50 },
          "icon": "skull",
          "description": "Gegner unter 25% LP: 4W8+KRF Schaden. Tötet bei unter 10% LP sofort.",
          "effect": { "damage": "4d8+KRF", "execute": "10%" },
          "position": { "x": 20, "y": 65 },
          "requires": ["raserei"],
          "isKeystone": false
        },
        "unbezwingbar": {
          "name": "Unbezwingbar",
          "type": "passive",
          "tier": 3,
          "levelReq": 10,
          "cost": null,
          "icon": "crown",
          "description": "Einmal pro Rast: Tödlicher Treffer lässt dich stattdessen auf 1 LP.",
          "effect": { "cheatDeath": true, "charges": 1, "recharge": "rest" },
          "position": { "x": 50, "y": 65 },
          "requires": ["eisenhaut", "blutregen"],
          "isKeystone": false
        },
        "regeneration": {
          "name": "Regeneration",
          "type": "passive",
          "tier": 3,
          "levelReq": 12,
          "cost": null,
          "icon": "leaf",
          "description": "Heilt 2 LP am Anfang jeder Runde.",
          "effect": { "regen": 2, "trigger": "round_start" },
          "position": { "x": 80, "y": 65 },
          "requires": ["spott"],
          "isKeystone": false
        },
        "titanenwut": {
          "name": "Titanenwut",
          "type": "active",
          "tier": 4,
          "levelReq": 15,
          "cost": { "resource": "rage", "amount": 100 },
          "icon": "star",
          "description": "Ultimate: 6W10 Schaden in 4m Radius. Volle Rage wird verbraucht. Betäubt für 1 Runde.",
          "effect": { "damage": "6d10", "radius": 4, "stun": 1, "drainsAll": true },
          "position": { "x": 35, "y": 85 },
          "requires": ["hinrichtung", "unbezwingbar"],
          "isKeystone": true
        },
        "unsterblich": {
          "name": "Unsterblich",
          "type": "passive",
          "tier": 4,
          "levelReq": 15,
          "cost": null,
          "icon": "infinity",
          "description": "Ultimate: Schadensreduktion +15%. Unbezwingbar hat 2 Ladungen.",
          "effect": { "stat": "damage_reduction", "modifier": 15, "upgradeNode": "unbezwingbar", "newCharges": 2 },
          "position": { "x": 65, "y": 85 },
          "requires": ["unbezwingbar", "regeneration"],
          "isKeystone": true
        }
      }
    }
  },

  "_schema_notes": {
    "position": "x/y in Prozent (0-100). Admin-Editor setzt diese per Drag&Drop.",
    "requires": "Array von Node-IDs. Alle müssen aktiv sein bevor dieser Node freigeschaltet werden kann.",
    "type": "active = kommt auf Skill-Slots (Q/W/E/R), passive = kommt auf die 2 breiten Passive-Slots.",
    "cost": "null bei Passiven. resource + amount bei Aktiven.",
    "effect": "Frei definierbar. Wird vom Game-State-System interpretiert.",
    "isKeystone": "Keystones sind größer dargestellt und erfordern meist mehrere Prerequisites.",
    "tier": "Visuelles Grouping. Höhere Tiers = weiter unten im Graph.",
    "levelReq": "Mindestlevel des Charakters um den Node freischalten zu können.",
    "icon": "String-Key der auf ein SVG-Icon im Icon-System gemappt wird."
  },

  "_firebase_path": "skilltrees/{classId}",
  
  "_character_state": {
    "_note": "Pro Charakter wird gespeichert welche Nodes aktiv sind und welche auf Slots liegen.",
    "_path": "rooms/{roomCode}/characters/{charId}/skills",
    "example": {
      "treeId": "barbar",
      "unlockedNodes": ["wilder_hieb", "kampfschrei", "zaehigkeit", "raserei"],
      "activeSlots": {
        "Q": "wilder_hieb",
        "W": "kampfschrei",
        "E": "raserei",
        "R": null
      },
      "passiveSlots": {
        "P1": "zaehigkeit",
        "P2": null
      },
      "pointsSpent": 4,
      "pointsAvailable": 3
    }
  }
}
;

/**
 * RIFT 2.0 — Skilltree Overlay
 * Fullscreen overlay inside the character sheet.
 * Renders a node graph from JSON tree data.
 */

// ── Demo tree (Barbar) until Firebase integration ──
const DEMO_TREE = {
    id: 'barbar',
    name: 'Barbar',
    description: 'Rohe Kraft und ungezähmte Wut',
    nodes: {
        wilder_hieb: {
            name: 'Wilder Hieb', type: 'active', tier: 1, levelReq: 1,
            cost: { resource: 'rage', amount: 15 },
            description: 'Brutaler Hieb: 2W6+KRF Schaden.',
            position: { x: 50, y: 8 }, requires: [], isKeystone: false
        },
        kampfschrei: {
            name: 'Kampfschrei', type: 'active', tier: 1, levelReq: 2,
            cost: { resource: 'rage', amount: 20 },
            description: 'Verbündete in 6m: +2 Angriff für 3 Runden.',
            position: { x: 25, y: 24 }, requires: ['wilder_hieb'], isKeystone: false
        },
        zaehigkeit: {
            name: 'Zähigkeit', type: 'passive', tier: 1, levelReq: 2,
            cost: null,
            description: 'Max LP +10.',
            position: { x: 75, y: 24 }, requires: ['wilder_hieb'], isKeystone: false
        },
        raserei: {
            name: 'Raserei', type: 'active', tier: 2, levelReq: 5,
            cost: { resource: 'rage', amount: 30 },
            description: 'Schaden +50%, Rüstung -25% für 3 Runden.',
            position: { x: 15, y: 42 }, requires: ['kampfschrei'], isKeystone: false
        },
        eisenhaut: {
            name: 'Eisenhaut', type: 'passive', tier: 2, levelReq: 5,
            cost: null,
            description: 'Schadensreduktion +5%.',
            position: { x: 40, y: 42 }, requires: ['kampfschrei'], isKeystone: false
        },
        blutregen: {
            name: 'Blutregen', type: 'active', tier: 2, levelReq: 6,
            cost: { resource: 'rage', amount: 40 },
            description: 'Heilt 3W4 LP über 3 Runden.',
            position: { x: 60, y: 42 }, requires: ['zaehigkeit'], isKeystone: false
        },
        spott: {
            name: 'Spott', type: 'active', tier: 2, levelReq: 7,
            cost: { resource: 'rage', amount: 10 },
            description: 'Gegner muss dich 2 Runden angreifen.',
            position: { x: 85, y: 42 }, requires: ['zaehigkeit'], isKeystone: false
        },
        hinrichtung: {
            name: 'Hinrichtung', type: 'active', tier: 3, levelReq: 10,
            cost: { resource: 'rage', amount: 50 },
            description: 'Gegner unter 25% LP: 4W8+KRF. Unter 10%: sofort tot.',
            position: { x: 20, y: 62 }, requires: ['raserei'], isKeystone: false
        },
        unbezwingbar: {
            name: 'Unbezwingbar', type: 'passive', tier: 3, levelReq: 10,
            cost: null,
            description: '1x pro Rast: Tödlicher Treffer → 1 LP.',
            position: { x: 50, y: 62 }, requires: ['eisenhaut', 'blutregen'], isKeystone: false
        },
        regeneration: {
            name: 'Regeneration', type: 'passive', tier: 3, levelReq: 12,
            cost: null,
            description: 'Heilt 2 LP jede Runde.',
            position: { x: 80, y: 62 }, requires: ['spott'], isKeystone: false
        },
        titanenwut: {
            name: 'Titanenwut', type: 'active', tier: 4, levelReq: 15,
            cost: { resource: 'rage', amount: 100 },
            description: 'Ultimate: 6W10 Schaden in 4m Radius. Volle Rage verbraucht.',
            position: { x: 35, y: 82 }, requires: ['hinrichtung', 'unbezwingbar'], isKeystone: true
        },
        unsterblich: {
            name: 'Unsterblich', type: 'passive', tier: 4, levelReq: 15,
            cost: null,
            description: 'Ultimate: Reduktion +15%, Unbezwingbar hat 2 Ladungen.',
            position: { x: 65, y: 82 }, requires: ['unbezwingbar', 'regeneration'], isKeystone: true
        }
    }
};

// ── Character skill state ──
let charSkills = {
    treeId: 'barbar',
    unlockedNodes: ['wilder_hieb', 'kampfschrei', 'zaehigkeit', 'raserei'],
    activeSlots: { Q: 'wilder_hieb', W: 'kampfschrei', E: 'raserei', R: null },
    passiveSlots: { P1: 'zaehigkeit', P2: null },
    pointsSpent: 4,
    pointsAvailable: 3,
    characterLevel: 8
};

let overlayEl = null;
let selectedNode = null;

// ══════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════

function openSkilltree() {
    if (overlayEl) return;
    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add('st-open'));
}

function closeSkilltree() {
    if (!overlayEl) return;
    overlayEl.classList.remove('st-open');
    overlayEl.addEventListener('transitionend', () => {
        overlayEl.remove();
        overlayEl = null;
        selectedNode = null;
    }, { once: true });
}

// ══════════════════════════════════════
//  BUILD OVERLAY DOM
// ══════════════════════════════════════

function buildOverlay() {
    const el = document.createElement('div');
    el.className = 'st-overlay';
    el.innerHTML = `
        <div class="st-backdrop"></div>
        <div class="st-panel">
            <header class="st-header">
                <div class="st-header__title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v3M10 13l-3 3M14 13l3 3"/></svg>
                    Skilltree
                </div>
                <div class="st-header__class">${DEMO_TREE.name}</div>
                <div class="st-header__points">
                    <span class="st-pts-val">${charSkills.pointsAvailable}</span> Punkte frei
                </div>
                <button class="st-header__close" title="Schließen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </header>
            <div class="st-body">
                <div class="st-graph" id="stGraph"></div>
                <div class="st-detail" id="stDetail">
                    <div class="st-detail__empty">Node auswählen</div>
                </div>
            </div>
            <footer class="st-footer">
                <div class="st-slots">
                    <div class="st-slots__label">Aktive</div>
                    <div class="st-slots__row" id="stActiveSlots"></div>
                </div>
                <div class="st-slots-sep"></div>
                <div class="st-slots">
                    <div class="st-slots__label">Passive</div>
                    <div class="st-slots__row" id="stPassiveSlots"></div>
                </div>
            </footer>
        </div>
    `;

    // Events
    el.querySelector('.st-backdrop').addEventListener('click', closeSkilltree);
    el.querySelector('.st-header__close').addEventListener('click', closeSkilltree);

    // Render
    renderGraph(el.querySelector('#stGraph'));
    renderSlots(el);

    return el;
}

// ══════════════════════════════════════
//  RENDER NODE GRAPH
// ══════════════════════════════════════

function renderGraph(container) {
    const nodes = DEMO_TREE.nodes;

    // SVG for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('st-connections');
    svg.setAttribute('preserveAspectRatio', 'none');
    container.appendChild(svg);

    // Draw connections
    for (const [id, node] of Object.entries(nodes)) {
        for (const reqId of node.requires) {
            const req = nodes[reqId];
            if (!req) continue;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', req.position.x + '%');
            line.setAttribute('y1', req.position.y + '%');
            line.setAttribute('x2', node.position.x + '%');
            line.setAttribute('y2', node.position.y + '%');

            const bothUnlocked = charSkills.unlockedNodes.includes(id) && charSkills.unlockedNodes.includes(reqId);
            if (bothUnlocked) line.classList.add('st-line--active');

            svg.appendChild(line);
        }
    }

    // Draw nodes
    for (const [id, node] of Object.entries(nodes)) {
        const isUnlocked = charSkills.unlockedNodes.includes(id);
        const canUnlock = !isUnlocked && canNodeBeUnlocked(id, node);
        const isLocked = !isUnlocked && !canUnlock;

        const el = document.createElement('div');
        el.className = 'st-node';
        if (isUnlocked) el.classList.add('st-node--unlocked');
        if (canUnlock) el.classList.add('st-node--available');
        if (isLocked) el.classList.add('st-node--locked');
        if (node.isKeystone) el.classList.add('st-node--keystone');
        if (node.type === 'passive') el.classList.add('st-node--passive');
        el.dataset.nodeId = id;

        el.style.left = node.position.x + '%';
        el.style.top = node.position.y + '%';

        el.innerHTML = `
            <div class="st-node__ring"></div>
            <div class="st-node__icon">${getNodeIcon(node)}</div>
            <div class="st-node__name">${node.name}</div>
        `;

        el.addEventListener('click', () => selectNode(id, node));
        container.appendChild(el);
    }
}

// ══════════════════════════════════════
//  NODE SELECTION & DETAIL PANEL
// ══════════════════════════════════════

function selectNode(id, node) {
    selectedNode = id;

    // Highlight
    document.querySelectorAll('.st-node').forEach(n => n.classList.remove('st-node--selected'));
    const nodeEl = document.querySelector(`.st-node[data-node-id="${id}"]`);
    if (nodeEl) nodeEl.classList.add('st-node--selected');

    const isUnlocked = charSkills.unlockedNodes.includes(id);
    const canUnlock = !isUnlocked && canNodeBeUnlocked(id, node);

    const detail = document.getElementById('stDetail');
    const costStr = node.cost ? `${node.cost.amount} ${node.cost.resource.charAt(0).toUpperCase() + node.cost.resource.slice(1)}` : 'Passiv';
    const typeStr = node.type === 'active' ? 'Aktiv' : 'Passiv';
    const reqNames = node.requires.map(r => DEMO_TREE.nodes[r]?.name || r).join(', ');

    let actionBtn = '';
    if (isUnlocked && node.type === 'active') {
        actionBtn = `<button class="st-detail__assign" data-action="assign" data-node="${id}">Auf Slot legen</button>`;
    } else if (isUnlocked && node.type === 'passive') {
        actionBtn = `<button class="st-detail__assign" data-action="assign-passive" data-node="${id}">Passiv-Slot zuweisen</button>`;
    } else if (canUnlock) {
        actionBtn = `<button class="st-detail__unlock" data-action="unlock" data-node="${id}">Freischalten (1 Punkt)</button>`;
    } else if (!isUnlocked) {
        const reasons = getLockedReasons(id, node);
        actionBtn = `<div class="st-detail__locked">${reasons}</div>`;
    }

    detail.innerHTML = `
        <div class="st-detail__type st-detail__type--${node.type}">${typeStr}</div>
        <div class="st-detail__name">${node.name}</div>
        <div class="st-detail__cost">${costStr}</div>
        <div class="st-detail__desc">${node.description}</div>
        ${reqNames ? `<div class="st-detail__reqs">Benötigt: ${reqNames}</div>` : ''}
        <div class="st-detail__tier">Tier ${node.tier} &middot; Ab Level ${node.levelReq}</div>
        ${actionBtn}
    `;

    // Bind action buttons
    const btn = detail.querySelector('[data-action]');
    if (btn) {
        btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.node));
    }
}

function handleAction(action, nodeId) {
    if (action === 'unlock') {
        unlockNode(nodeId);
    } else if (action === 'assign') {
        showSlotPicker(nodeId, 'active');
    } else if (action === 'assign-passive') {
        showSlotPicker(nodeId, 'passive');
    }
}

// ══════════════════════════════════════
//  UNLOCK LOGIC
// ══════════════════════════════════════

function canNodeBeUnlocked(id, node) {
    if (charSkills.pointsAvailable <= 0) return false;
    if (charSkills.characterLevel < node.levelReq) return false;
    return node.requires.every(r => charSkills.unlockedNodes.includes(r));
}

function getLockedReasons(id, node) {
    const reasons = [];
    if (charSkills.characterLevel < node.levelReq) {
        reasons.push(`Level ${node.levelReq} benötigt`);
    }
    const missing = node.requires.filter(r => !charSkills.unlockedNodes.includes(r));
    if (missing.length) {
        reasons.push('Benötigt: ' + missing.map(r => DEMO_TREE.nodes[r]?.name || r).join(', '));
    }
    if (charSkills.pointsAvailable <= 0) {
        reasons.push('Keine Punkte verfügbar');
    }
    return reasons.join('<br>');
}

function unlockNode(nodeId) {
    if (charSkills.unlockedNodes.includes(nodeId)) return;
    const node = DEMO_TREE.nodes[nodeId];
    if (!canNodeBeUnlocked(nodeId, node)) return;

    charSkills.unlockedNodes.push(nodeId);
    charSkills.pointsAvailable--;
    charSkills.pointsSpent++;

    // Re-render
    refreshOverlay();
}

// ══════════════════════════════════════
//  SLOT ASSIGNMENT
// ══════════════════════════════════════

function showSlotPicker(nodeId, type) {
    const detail = document.getElementById('stDetail');
    const slots = type === 'active' ? charSkills.activeSlots : charSkills.passiveSlots;
    const keys = Object.keys(slots);

    let html = `<div class="st-slot-picker"><div class="st-slot-picker__title">Slot wählen:</div><div class="st-slot-picker__options">`;
    for (const key of keys) {
        const current = slots[key];
        const currentName = current ? DEMO_TREE.nodes[current]?.name || current : 'Leer';
        html += `<button class="st-slot-picker__btn" data-slot="${key}"><span class="st-slot-picker__key">${key}</span><span class="st-slot-picker__current">${currentName}</span></button>`;
    }
    html += `</div></div>`;

    // Append picker to detail
    const existing = detail.querySelector('.st-slot-picker');
    if (existing) existing.remove();
    detail.insertAdjacentHTML('beforeend', html);

    detail.querySelectorAll('.st-slot-picker__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const slotKey = btn.dataset.slot;
            if (type === 'active') {
                // Remove from any other active slot first
                for (const k of Object.keys(charSkills.activeSlots)) {
                    if (charSkills.activeSlots[k] === nodeId) charSkills.activeSlots[k] = null;
                }
                charSkills.activeSlots[slotKey] = nodeId;
            } else {
                for (const k of Object.keys(charSkills.passiveSlots)) {
                    if (charSkills.passiveSlots[k] === nodeId) charSkills.passiveSlots[k] = null;
                }
                charSkills.passiveSlots[slotKey] = nodeId;
            }
            refreshOverlay();
        });
    });
}

// ══════════════════════════════════════
//  RENDER SLOTS (FOOTER)
// ══════════════════════════════════════

function renderSlots(root) {
    const activeContainer = root.querySelector('#stActiveSlots');
    const passiveContainer = root.querySelector('#stPassiveSlots');

    // Active: Q W E R
    activeContainer.innerHTML = '';
    for (const [key, nodeId] of Object.entries(charSkills.activeSlots)) {
        const node = nodeId ? DEMO_TREE.nodes[nodeId] : null;
        const el = document.createElement('div');
        el.className = 'st-slot' + (node ? ' st-slot--filled' : '');
        el.innerHTML = `
            <span class="st-slot__key">${key}</span>
            <span class="st-slot__name">${node ? node.name : ''}</span>
            ${node?.cost ? `<span class="st-slot__cost">${node.cost.amount} ${node.cost.resource}</span>` : ''}
        `;
        if (nodeId) {
            el.addEventListener('click', () => selectNode(nodeId, DEMO_TREE.nodes[nodeId]));
        }
        activeContainer.appendChild(el);
    }

    // Passive: P1 P2
    passiveContainer.innerHTML = '';
    for (const [key, nodeId] of Object.entries(charSkills.passiveSlots)) {
        const node = nodeId ? DEMO_TREE.nodes[nodeId] : null;
        const el = document.createElement('div');
        el.className = 'st-slot st-slot--passive' + (node ? ' st-slot--filled' : '');
        el.innerHTML = `
            <span class="st-slot__key">${key}</span>
            <span class="st-slot__name">${node ? node.name : ''}</span>
            ${node ? `<span class="st-slot__desc">${node.description}</span>` : ''}
        `;
        if (nodeId) {
            el.addEventListener('click', () => selectNode(nodeId, DEMO_TREE.nodes[nodeId]));
        }
        passiveContainer.appendChild(el);
    }
}

// ══════════════════════════════════════
//  REFRESH
// ══════════════════════════════════════

function refreshOverlay() {
    if (!overlayEl) return;

    // Update points
    const ptsEl = overlayEl.querySelector('.st-pts-val');
    if (ptsEl) ptsEl.textContent = charSkills.pointsAvailable;

    // Re-render graph
    const graph = overlayEl.querySelector('#stGraph');
    graph.innerHTML = '';
    renderGraph(graph);

    // Re-render slots
    renderSlots(overlayEl);

    // Re-select if needed
    if (selectedNode && DEMO_TREE.nodes[selectedNode]) {
        selectNode(selectedNode, DEMO_TREE.nodes[selectedNode]);
    }
}

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════

function getNodeIcon(node) {
    // Simple SVG icons per type — will be replaced with proper icon system
    if (node.isKeystone) return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>`;
    if (node.type === 'passive') return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z"/></svg>`;
}


// Public API
window.openSkilltree = openSkilltree;
window.closeSkilltree = closeSkilltree;

})();
