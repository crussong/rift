/**
 * RIFT — D&D 5e Quality-of-Life Module
 * 
 * Features:
 *   1. Combat Mode        — Toggle compact combat-only view
 *   2. Inline Spell Cards — Expand spell details inline (replaces alert)
 *   3. Section Memory     — Remember collapsed sections
 *   4. HP Flash           — Visual feedback on HP changes
 *   5. Rest Summary       — Detailed rest change log
 *   6. Scroll-to-Top FAB  — Quick scroll button
 * 
 * Hooks into existing sheet JS without modifying it.
 * Requires data-section attributes on .section elements.
 */

(function() {
    'use strict';

    // Wait for DOM + sheet init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQoL);
    } else {
        // Small delay to let sheet JS init first
        setTimeout(initQoL, 200);
    }

    function initQoL() {
        initCombatMode();
        initInlineSpellCards();
        initSectionMemory();
        initHPFlash();
        initRestSummary();
        initScrollFAB();
    }


    /* ═══════════════════════════════════════════
       1. COMBAT MODE
       ═══════════════════════════════════════════ */

    function initCombatMode() {
        // Create toggle button
        const btn = document.createElement('button');
        btn.id = 'combatModeToggle';
        btn.className = 'qol-combat-toggle';
        btn.title = getLangQoL() === 'de' ? 'Kampfmodus' : 'Combat Mode';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6.92 5L5 5 14 14l-1.5 1.5 1.42 1.42 1.5-1.5L19 19l-2.5 2.5L14 19l-6.5 6.5-3-3L11 16l-1.5-1.5L3 21 1 19l8-8L2 4l2-2 7 7 5-5H14L12 2l2.5-2.5L17 2l-5 5 7 7-2 2L10 9z"/>
            </svg>
            <span class="qol-combat-label"></span>
        `;
        document.body.appendChild(btn);

        updateCombatLabel(btn);

        btn.addEventListener('click', () => {
            document.body.classList.toggle('combat-mode');
            const active = document.body.classList.contains('combat-mode');
            btn.classList.toggle('active', active);
            updateCombatLabel(btn);

            // Expand combat sections, collapse non-combat
            if (active) {
                enterCombatMode();
            } else {
                exitCombatMode();
            }

            // Save state
            try { localStorage.setItem('rift-5e-combat-mode', active ? '1' : '0'); } catch(e) {}
        });

        // Restore state
        try {
            if (localStorage.getItem('rift-5e-combat-mode') === '1') {
                btn.click();
            }
        } catch(e) {}
    }

    function updateCombatLabel(btn) {
        const label = btn.querySelector('.qol-combat-label');
        const active = document.body.classList.contains('combat-mode');
        const lang = getLangQoL();
        if (active) {
            label.textContent = lang === 'de' ? 'Kampf' : 'Combat';
        } else {
            label.textContent = lang === 'de' ? 'Kampfmodus' : 'Combat Mode';
        }
    }

    function enterCombatMode() {
        document.querySelectorAll('.section[data-section]').forEach(section => {
            const type = section.dataset.section;
            const isCombat = ['combat', 'weapons', 'spells'].includes(type);
            if (isCombat) {
                section.classList.remove('collapsed');
            } else {
                section.classList.add('collapsed');
            }
        });

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exitCombatMode() {
        // Restore from section memory
        restoreSectionStates();
    }


    /* ═══════════════════════════════════════════
       2. INLINE SPELL CARDS
       ═══════════════════════════════════════════ */

    function initInlineSpellCards() {
        // Override the global showSpellDetails function
        if (typeof window.showSpellDetails === 'function') {
            window._originalShowSpellDetails = window.showSpellDetails;
        }

        window.showSpellDetails = function(index) {
            const spell = window.char?.spells?.[index];
            if (!spell) return;

            const SRD = window.SRD_SPELLS || [];
            const spellData = SRD.find(sp => sp.name === spell.srdName);
            const lang = getLangQoL();

            // Find the spell row
            const row = document.querySelector(`.spell-row[data-spell-index="${index}"]`);
            if (!row) {
                // Fallback: check cantrip rows
                const cantripRow = document.querySelector(`.cantrip-row[data-cantrip-index="${index}"]`);
                if (!cantripRow) return;
                toggleSpellCard(cantripRow, spell, spellData, lang);
                return;
            }

            toggleSpellCard(row, spell, spellData, lang);
        };
    }

    function toggleSpellCard(row, spell, spellData, lang) {
        // Check if card already open
        const existing = row.nextElementSibling;
        if (existing && existing.classList.contains('spell-card-inline')) {
            existing.classList.add('closing');
            setTimeout(() => existing.remove(), 200);
            row.classList.remove('spell-card-open');
            return;
        }

        // Close any other open cards
        document.querySelectorAll('.spell-card-inline').forEach(card => {
            card.previousElementSibling?.classList.remove('spell-card-open');
            card.remove();
        });

        // Build card
        const card = document.createElement('div');
        card.className = 'spell-card-inline';
        row.classList.add('spell-card-open');

        const desc = spellData
            ? (lang === 'de' && spellData.desc_de ? spellData.desc_de : spellData.desc)
            : (spell.notes || (lang === 'de' ? 'Keine Beschreibung verfügbar.' : 'No description available.'));

        const higherLevels = spellData?.higher_levels
            ? (lang === 'de' && spellData.higher_levels_de ? spellData.higher_levels_de : spellData.higher_levels)
            : null;

        const school = spell.school || spellData?.school || '';
        const range = spell.range || spellData?.range || '—';
        const duration = spell.duration || spellData?.duration || '—';
        const castTime = spell.time || spellData?.casting_time || '—';
        const ritual = spell.ritual || spellData?.ritual || false;
        const concentration = spell.conc || false;
        const level = spell.level || '0';

        // Component details
        const hasV = spell.verbal !== false;
        const hasS = spell.somatic !== false;
        const hasM = spell.mat === true;
        const matDesc = spell.matDesc || spellData?.material || '';

        const levelText = level === '0'
            ? (lang === 'de' ? 'Zaubertrick' : 'Cantrip')
            : (lang === 'de' ? `Grad ${level}` : `Level ${level}`);

        const schoolLabel = school
            ? (lang === 'de' ? translateSchool(school) : school)
            : '';

        card.innerHTML = `
            <div class="spell-card-header">
                <div class="spell-card-title">${spell.name || (lang === 'de' ? 'Unbenannt' : 'Unnamed')}</div>
                <div class="spell-card-subtitle">${levelText}${schoolLabel ? ' — ' + schoolLabel : ''}${ritual ? ' (Ritual)' : ''}</div>
                <button class="spell-card-close" onclick="this.closest('.spell-card-inline').previousElementSibling.classList.remove('spell-card-open');this.closest('.spell-card-inline').remove()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="spell-card-meta">
                <div class="spell-card-meta-item">
                    <span class="spell-card-meta-label">${lang === 'de' ? 'Zeitaufwand' : 'Casting Time'}</span>
                    <span class="spell-card-meta-value">${castTime}</span>
                </div>
                <div class="spell-card-meta-item">
                    <span class="spell-card-meta-label">${lang === 'de' ? 'Reichweite' : 'Range'}</span>
                    <span class="spell-card-meta-value">${range}</span>
                </div>
                <div class="spell-card-meta-item">
                    <span class="spell-card-meta-label">${lang === 'de' ? 'Komponenten' : 'Components'}</span>
                    <span class="spell-card-meta-value">${[hasV ? 'V' : '', hasS ? 'S' : '', hasM ? 'M' : ''].filter(Boolean).join(', ')}${matDesc ? ' (' + matDesc + ')' : ''}</span>
                </div>
                <div class="spell-card-meta-item">
                    <span class="spell-card-meta-label">${lang === 'de' ? 'Wirkungsdauer' : 'Duration'}</span>
                    <span class="spell-card-meta-value">${concentration ? (lang === 'de' ? 'Konzentration, ' : 'Concentration, ') : ''}${duration}</span>
                </div>
            </div>
            <div class="spell-card-desc">${formatSpellDesc(desc)}</div>
            ${higherLevels ? `
            <div class="spell-card-higher">
                <span class="spell-card-higher-label">${lang === 'de' ? 'Auf höheren Graden' : 'At Higher Levels'}</span>
                <span>${higherLevels}</span>
            </div>` : ''}
        `;

        row.after(card);

        // Animate in
        requestAnimationFrame(() => {
            card.classList.add('open');
        });
    }

    function formatSpellDesc(text) {
        if (!text) return '';
        // Convert line breaks to <br>, bold **text**
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    function translateSchool(school) {
        const map = {
            'Abjuration': 'Bannmagie',
            'Conjuration': 'Beschwörung',
            'Divination': 'Wahrsagerei',
            'Enchantment': 'Verzauberung',
            'Evocation': 'Hervorrufung',
            'Illusion': 'Illusion',
            'Necromancy': 'Nekromantie',
            'Transmutation': 'Verwandlung'
        };
        return map[school] || school;
    }


    /* ═══════════════════════════════════════════
       3. SECTION COLLAPSE MEMORY
       ═══════════════════════════════════════════ */

    function initSectionMemory() {
        // Override toggleSection to save state
        const original = window.toggleSection;
        window.toggleSection = function(header) {
            original.call(this, header);
            saveSectionStates();
        };

        // Restore states on load
        restoreSectionStates();
    }

    function saveSectionStates() {
        try {
            const states = {};
            document.querySelectorAll('.section[data-section]').forEach(section => {
                states[section.dataset.section] = section.classList.contains('collapsed');
            });
            localStorage.setItem('rift-5e-section-states', JSON.stringify(states));
        } catch(e) {}
    }

    function restoreSectionStates() {
        try {
            const saved = localStorage.getItem('rift-5e-section-states');
            if (!saved) return;
            const states = JSON.parse(saved);
            document.querySelectorAll('.section[data-section]').forEach(section => {
                const key = section.dataset.section;
                if (key in states) {
                    section.classList.toggle('collapsed', states[key]);
                }
            });
        } catch(e) {}
    }


    /* ═══════════════════════════════════════════
       4. HP FLASH
       ═══════════════════════════════════════════ */

    function initHPFlash() {
        // Watch HP current input for changes
        const hpInput = document.querySelector('input[data-field="hp_current"]');
        if (!hpInput) return;

        let lastHP = parseInt(hpInput.value) || 0;

        hpInput.addEventListener('input', () => {
            const newHP = parseInt(hpInput.value) || 0;
            if (newHP === lastHP) return;

            const block = hpInput.closest('.armor-stat-box') || hpInput.closest('.hp-block');
            if (!block) { lastHP = newHP; return; }

            if (newHP < lastHP) {
                flashElement(block, 'hp-flash-damage');
            } else if (newHP > lastHP) {
                flashElement(block, 'hp-flash-heal');
            }
            lastHP = newHP;
        });
    }

    function flashElement(el, className) {
        el.classList.remove('hp-flash-damage', 'hp-flash-heal');
        // Force reflow
        void el.offsetWidth;
        el.classList.add(className);
        setTimeout(() => el.classList.remove(className), 600);
    }


    /* ═══════════════════════════════════════════
       5. REST SUMMARY
       ═══════════════════════════════════════════ */

    function initRestSummary() {
        // Wrap shortRest and longRest to capture before/after state
        if (typeof window.shortRest === 'function') {
            const origShort = window.shortRest;
            window.shortRest = function() {
                const before = captureRestState();
                origShort.call(this);
                const after = captureRestState();
                showRestDiff(before, after, 'short');
            };
        }

        if (typeof window.longRest === 'function') {
            const origLong = window.longRest;
            window.longRest = function() {
                const before = captureRestState();
                origLong.call(this);
                const after = captureRestState();
                showRestDiff(before, after, 'long');
            };
        }
    }

    function captureRestState() {
        const state = {};
        const hpCurrent = document.querySelector('input[data-field="hp_current"]');
        const hpTemp = document.querySelector('input[data-field="hp_temp"]');
        const diceCurrent = document.querySelector('input[data-field="hit_dice_current"]');
        const exhaustion = document.querySelector('input[data-field="exhaustion"]');

        state.hp = parseInt(hpCurrent?.value) || 0;
        state.temp = parseInt(hpTemp?.value) || 0;
        state.dice = parseInt(diceCurrent?.value) || 0;
        state.exhaustion = parseInt(exhaustion?.value) || 0;

        // Spell slots
        state.slots = {};
        for (let i = 1; i <= 9; i++) {
            const input = document.querySelector(`input[data-field="spell_slots_${i}_current"]`);
            if (input) state.slots[i] = parseInt(input.value) || 0;
        }

        // Pact slots
        const pactCurrent = document.querySelector('input[data-field="pact_slots_current"]');
        if (pactCurrent) state.pact = parseInt(pactCurrent.value) || 0;

        // Death saves
        state.deathSuccess = 0;
        state.deathFail = 0;
        document.querySelectorAll('.death-pip.success.active').forEach(() => state.deathSuccess++);
        document.querySelectorAll('.death-pip.fail.active').forEach(() => state.deathFail++);

        return state;
    }

    function showRestDiff(before, after, type) {
        const lang = getLangQoL();
        const changes = [];

        // HP
        const hpDiff = after.hp - before.hp;
        if (hpDiff > 0) changes.push(`HP +${hpDiff} (${before.hp} → ${after.hp})`);

        // Temp HP (cleared on long rest)
        if (before.temp > 0 && after.temp === 0 && type === 'long') {
            changes.push(lang === 'de' ? `Temp HP entfernt` : `Temp HP cleared`);
        }

        // Hit Dice
        const diceDiff = after.dice - before.dice;
        if (diceDiff > 0) changes.push(lang === 'de' ? `+${diceDiff} Trefferwürfel` : `+${diceDiff} Hit Dice`);

        // Exhaustion
        const exDiff = after.exhaustion - before.exhaustion;
        if (exDiff < 0) changes.push(lang === 'de' ? `Erschöpfung ${Math.abs(exDiff)} reduziert` : `Exhaustion reduced by ${Math.abs(exDiff)}`);

        // Spell slots
        let slotsRestored = 0;
        for (let i = 1; i <= 9; i++) {
            if (after.slots[i] !== undefined && before.slots[i] !== undefined) {
                slotsRestored += Math.max(0, after.slots[i] - before.slots[i]);
            }
        }
        if (slotsRestored > 0) {
            changes.push(lang === 'de' ? `${slotsRestored} Zauberplätze wiederhergestellt` : `${slotsRestored} spell slots restored`);
        }

        // Pact slots
        if (after.pact !== undefined && before.pact !== undefined) {
            const pactDiff = after.pact - before.pact;
            if (pactDiff > 0) changes.push(lang === 'de' ? `Pakt-Slots wiederhergestellt` : `Pact slots restored`);
        }

        // Death saves
        if (before.deathSuccess > 0 && after.deathSuccess === 0) {
            changes.push(lang === 'de' ? 'Todesrettungen zurückgesetzt' : 'Death saves reset');
        }

        if (changes.length === 0) return;

        showRestSummaryPopup(changes, type, lang);
    }

    function showRestSummaryPopup(changes, type, lang) {
        // Remove existing
        document.querySelector('.qol-rest-summary')?.remove();

        const title = type === 'short'
            ? (lang === 'de' ? 'Kurze Rast' : 'Short Rest')
            : (lang === 'de' ? 'Lange Rast' : 'Long Rest');

        const popup = document.createElement('div');
        popup.className = 'qol-rest-summary';
        popup.innerHTML = `
            <div class="qol-rest-summary-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${type === 'short'
                        ? '<path d="M12 2v10l4.5 2.6"/><circle cx="12" cy="12" r="10"/>'
                        : '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>'}
                </svg>
                <span>${title}</span>
            </div>
            <div class="qol-rest-summary-changes">
                ${changes.map(c => `<div class="qol-rest-change">${c}</div>`).join('')}
            </div>
        `;
        document.body.appendChild(popup);

        requestAnimationFrame(() => popup.classList.add('visible'));

        setTimeout(() => {
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 300);
        }, 4000);
    }


    /* ═══════════════════════════════════════════
       6. SCROLL-TO-TOP FAB
       ═══════════════════════════════════════════ */

    function initScrollFAB() {
        const fab = document.createElement('button');
        fab.className = 'qol-scroll-top';
        fab.title = getLangQoL() === 'de' ? 'Nach oben' : 'Scroll to top';
        fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
        document.body.appendChild(fab);

        fab.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', () => {
            fab.classList.toggle('visible', window.scrollY > 400);
        }, { passive: true });
    }


    /* ═══════════════════════════════════════════
       HELPERS
       ═══════════════════════════════════════════ */

    function getLangQoL() {
        if (typeof window.getLang === 'function') return window.getLang();
        return document.documentElement.lang || 'en';
    }

})();
