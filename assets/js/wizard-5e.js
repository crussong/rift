/**
 * RIFT D&D 5e — Character Creation Wizard
 * 13-step guided character creation + HP Roll modal.
 * Outputs to S-format state (sheet-5e.js).
 *
 * Depends on: sheet-5e.js (S, defaultState, calc, render, save, migrateState)
 */
(function() {
'use strict';

// ===== DB LOADER =====
// Replaces hardcoded SRD_SPELLS and CLASS_FEATS with live JSON data
const WizardDB = {
    spells: null,
    feats: null,
    _loading: null,

    async load() {
        if (this.spells && this.feats) return;
        if (this._loading) return this._loading;
        this._loading = Promise.all([
            fetch('/assets/data/dnd/dnd-spells.json').then(r => r.json()),
            fetch('/assets/data/dnd/dnd-feats-2024.json').then(r => r.json())
        ]).then(([spells, feats]) => {
            this.spells = spells;
            this.feats  = feats;
        }).catch(err => {
            console.warn('[WizardDB] Fallback auf SRD_SPELLS_LEGACY:', err);
        });
        return this._loading;
    },

    getSpells(level, cls) {
        const src = this.spells || SRD_SPELLS_LEGACY;
        return src.filter(s => {
            const l = s.level ?? 0;
            const classes = s.classes || [];
            return l === level && classes.some(c =>
                c === cls || c.toLowerCase() === cls.toLowerCase()
            );
        }).map(s => this._norm(s));
    },

    _norm(s) {
        if (s._n) return s;
        return {
            _n: true,
            name:    s.name_en || s.name || '',
            level:   s.level ?? 0,
            school:  s.school || '',
            time:    s.casting_time || s.time || 'Action',
            range:   s.range || '',
            components: s.components || '',
            duration:   s.duration || '',
            conc:    s.concentration ?? s.conc ?? false,
            ritual:  s.ritual ?? false,
            classes: s.classes || [],
            description: s.description || '',
            damage:  s.damage || '\u2014',
            source:  s.source || '',
        };
    },

    getFeats() { return this.feats || []; }
};


// ═══════════════════════════════════════════════════════
// SHARED DATA CONSTANTS
// ═══════════════════════════════════════════════════════
const HIT_DICE = {
    'Barbarian': 12,
    'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
    'Artificer': 8, 'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8, 'Blood Hunter': 8,
    'Sorcerer': 6, 'Wizard': 6
};

const CLASS_SAVES = {
    'Barbarian': ['str','con'], 'Bard': ['dex','cha'], 'Cleric': ['wis','cha'],
    'Druid': ['int','wis'], 'Fighter': ['str','con'], 'Monk': ['str','dex'],
    'Paladin': ['wis','cha'], 'Ranger': ['str','dex'], 'Rogue': ['dex','int'],
    'Sorcerer': ['con','cha'], 'Warlock': ['wis','cha'], 'Wizard': ['int','wis'],
    'Artificer': ['con','int'], 'Blood Hunter': ['str','int']
};

const CLASS_SKILLS = {
    'Barbarian':  { count: 2, skills: ['animal','athletics','intimidation','nature','perception','survival'] },
    'Bard':       { count: 3, skills: ['athletics','acrobatics','sleight','stealth','arcana','history','investigation','nature','religion','animal','insight','medicine','perception','survival','deception','intimidation','performance','persuasion'] },
    'Cleric':     { count: 2, skills: ['history','insight','medicine','persuasion','religion'] },
    'Druid':      { count: 2, skills: ['arcana','animal','insight','medicine','nature','perception','religion','survival'] },
    'Fighter':    { count: 2, skills: ['acrobatics','animal','athletics','history','insight','intimidation','perception','survival'] },
    'Monk':       { count: 2, skills: ['acrobatics','athletics','history','insight','religion','stealth'] },
    'Paladin':    { count: 2, skills: ['athletics','insight','intimidation','medicine','persuasion','religion'] },
    'Ranger':     { count: 3, skills: ['animal','athletics','insight','investigation','nature','perception','stealth','survival'] },
    'Rogue':      { count: 4, skills: ['acrobatics','athletics','deception','insight','intimidation','investigation','perception','performance','persuasion','sleight','stealth'] },
    'Sorcerer':   { count: 2, skills: ['arcana','deception','insight','intimidation','persuasion','religion'] },
    'Warlock':    { count: 2, skills: ['arcana','deception','history','intimidation','investigation','nature','religion'] },
    'Wizard':     { count: 2, skills: ['arcana','history','insight','investigation','medicine','religion'] },
    'Artificer':  { count: 2, skills: ['arcana','history','investigation','medicine','nature','perception','sleight'] },
    'Blood Hunter': { count: 2, skills: ['acrobatics','arcana','athletics','history','insight','investigation','survival'] }
};

// Subclass options per class (2024 5E) - MUST BE BEFORE FUNCTIONS
const SUBCLASSES = {
    'Artificer': ['Alchemist', 'Armorer', 'Artillerist', 'Battle Smith'],
    'Barbarian': ['Path of the Berserker', 'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot'],
    'Bard': ['College of Dance', 'College of Glamour', 'College of Lore', 'College of the Moon', 'College of Valor'],
    'Cleric': ['Knowledge Domain', 'Life Domain', 'Light Domain', 'Trickery Domain', 'War Domain'],
    'Druid': ['Circle of the Land', 'Circle of the Moon', 'Circle of the Sea', 'Circle of Stars'],
    'Fighter': ['Banneret', 'Battle Master', 'Champion', 'Eldritch Knight', 'Psi Warrior'],
    'Monk': ['Warrior of Mercy', 'Warrior of Shadow', 'Warrior of the Elements', 'Warrior of the Open Hand'],
    'Paladin': ['Oath of Devotion', 'Oath of Glory', 'Oath of Redemption', 'Oath of the Ancients', 'Oath of Vengeance'],
    'Ranger': ['Beast Master', 'Fey Wanderer', 'Gloom Stalker', 'Hunter'],
    'Rogue': ['Arcane Trickster', 'Assassin', 'Mastermind', 'Swashbuckler', 'Thief'],
    'Sorcerer': ['Aberrant Mind', 'Clockwork Soul', 'Draconic Bloodline', 'Wild Magic'],
    'Warlock': ['The Archfey', 'The Celestial', 'The Fiend', 'The Great Old One'],
    'Wizard': ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']
};

// Character data - starts EMPTY

// ═══ SRD SPELL DATABASE ═══
const SRD_SPELLS_LEGACY = [
    // === CANTRIPS (Level 0) ===
    { name: 'Acid Splash', level: 0, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '1d6 acid', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Chill Touch', level: 0, school: 'Necromancy', time: 'Action', range: '120 ft', damage: '1d8 necrotic', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Dancing Lights', level: 0, school: 'Evocation', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Druidcraft', level: 0, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Druid'], conc: false, ritual: false },
    { name: 'Eldritch Blast', level: 0, school: 'Evocation', time: 'Action', range: '120 ft', damage: '1d10 force', classes: ['Warlock'], conc: false, ritual: false },
    { name: 'Fire Bolt', level: 0, school: 'Evocation', time: 'Action', range: '120 ft', damage: '1d10 fire', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Guidance', level: 0, school: 'Divination', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid'], conc: true, ritual: false },
    { name: 'Light', level: 0, school: 'Evocation', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Mage Hand', level: 0, school: 'Conjuration', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Mending', level: 0, school: 'Transmutation', time: '1 Minute', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Message', level: 0, school: 'Transmutation', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Minor Illusion', level: 0, school: 'Illusion', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Poison Spray', level: 0, school: 'Conjuration', time: 'Action', range: '10 ft', damage: '1d12 poison', classes: ['Druid', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Prestidigitation', level: 0, school: 'Transmutation', time: 'Action', range: '10 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Produce Flame', level: 0, school: 'Conjuration', time: 'Action', range: '30 ft', damage: '1d8 fire', classes: ['Druid'], conc: false, ritual: false },
    { name: 'Ray of Frost', level: 0, school: 'Evocation', time: 'Action', range: '60 ft', damage: '1d8 cold', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Resistance', level: 0, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid'], conc: true, ritual: false },
    { name: 'Sacred Flame', level: 0, school: 'Evocation', time: 'Action', range: '60 ft', damage: '1d8 radiant', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Shillelagh', level: 0, school: 'Transmutation', time: 'Bonus Action', range: 'Touch', damage: '1d8 bludgeoning', classes: ['Druid'], conc: false, ritual: false },
    { name: 'Shocking Grasp', level: 0, school: 'Evocation', time: 'Action', range: 'Touch', damage: '1d8 lightning', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Spare the Dying', level: 0, school: 'Necromancy', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Thaumaturgy', level: 0, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'True Strike', level: 0, school: 'Divination', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Vicious Mockery', level: 0, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '1d4 psychic', classes: ['Bard'], conc: false, ritual: false },
    
    // === 1ST LEVEL ===
    { name: 'Alarm', level: 1, school: 'Abjuration', time: '1 Minute', range: '30 ft', damage: '—', classes: ['Ranger', 'Wizard'], conc: false, ritual: true },
    { name: 'Animal Friendship', level: 1, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Druid', 'Ranger'], conc: false, ritual: false },
    { name: 'Bane', level: 1, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Cleric'], conc: true, ritual: false },
    { name: 'Bless', level: 1, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Cleric', 'Paladin'], conc: true, ritual: false },
    { name: 'Burning Hands', level: 1, school: 'Evocation', time: 'Action', range: 'Self (15 ft cone)', damage: '3d6 fire', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Charm Person', level: 1, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Color Spray', level: 1, school: 'Illusion', time: 'Action', range: 'Self (15 ft cone)', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Command', level: 1, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Cleric', 'Paladin'], conc: false, ritual: false },
    { name: 'Comprehend Languages', level: 1, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: true },
    { name: 'Cure Wounds', level: 1, school: 'Evocation', time: 'Action', range: 'Touch', damage: '1d8 healing', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'], conc: false, ritual: false },
    { name: 'Detect Evil and Good', level: 1, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Cleric', 'Paladin'], conc: true, ritual: false },
    { name: 'Detect Magic', level: 1, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Wizard'], conc: true, ritual: true },
    { name: 'Detect Poison and Disease', level: 1, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Cleric', 'Druid', 'Paladin', 'Ranger'], conc: true, ritual: true },
    { name: 'Disguise Self', level: 1, school: 'Illusion', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Divine Favor', level: 1, school: 'Evocation', time: 'Bonus Action', range: 'Self', damage: '+1d4 radiant', classes: ['Paladin'], conc: true, ritual: false },
    { name: 'Entangle', level: 1, school: 'Conjuration', time: 'Action', range: '90 ft', damage: '—', classes: ['Druid'], conc: true, ritual: false },
    { name: 'Expeditious Retreat', level: 1, school: 'Transmutation', time: 'Bonus Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Faerie Fire', level: 1, school: 'Evocation', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Druid'], conc: true, ritual: false },
    { name: 'False Life', level: 1, school: 'Necromancy', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Feather Fall', level: 1, school: 'Transmutation', time: 'Reaction', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Find Familiar', level: 1, school: 'Conjuration', time: '1 Hour', range: '10 ft', damage: '—', classes: ['Wizard'], conc: false, ritual: true },
    { name: 'Fog Cloud', level: 1, school: 'Conjuration', time: 'Action', range: '120 ft', damage: '—', classes: ['Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Goodberry', level: 1, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Druid', 'Ranger'], conc: false, ritual: false },
    { name: 'Grease', level: 1, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Wizard'], conc: false, ritual: false },
    { name: 'Guiding Bolt', level: 1, school: 'Evocation', time: 'Action', range: '120 ft', damage: '4d6 radiant', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Healing Word', level: 1, school: 'Evocation', time: 'Bonus Action', range: '60 ft', damage: '1d4 healing', classes: ['Bard', 'Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Hellish Rebuke', level: 1, school: 'Evocation', time: 'Reaction', range: '60 ft', damage: '2d10 fire', classes: ['Warlock'], conc: false, ritual: false },
    { name: 'Heroism', level: 1, school: 'Enchantment', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Paladin'], conc: true, ritual: false },
    { name: 'Hideous Laughter', level: 1, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Wizard'], conc: true, ritual: false },
    { name: "Hunter's Mark", level: 1, school: 'Divination', time: 'Bonus Action', range: '90 ft', damage: '+1d6', classes: ['Ranger'], conc: true, ritual: false },
    { name: 'Identify', level: 1, school: 'Divination', time: '1 Minute', range: 'Touch', damage: '—', classes: ['Bard', 'Wizard'], conc: false, ritual: true },
    { name: 'Inflict Wounds', level: 1, school: 'Necromancy', time: 'Action', range: 'Touch', damage: '3d10 necrotic', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Jump', level: 1, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Longstrider', level: 1, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Druid', 'Ranger', 'Wizard'], conc: false, ritual: false },
    { name: 'Mage Armor', level: 1, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Magic Missile', level: 1, school: 'Evocation', time: 'Action', range: '120 ft', damage: '3×1d4+1 force', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Protection from Evil and Good', level: 1, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Paladin', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Sanctuary', level: 1, school: 'Abjuration', time: 'Bonus Action', range: '30 ft', damage: '—', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Shield', level: 1, school: 'Abjuration', time: 'Reaction', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Shield of Faith', level: 1, school: 'Abjuration', time: 'Bonus Action', range: '60 ft', damage: '—', classes: ['Cleric', 'Paladin'], conc: true, ritual: false },
    { name: 'Silent Image', level: 1, school: 'Illusion', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Sleep', level: 1, school: 'Enchantment', time: 'Action', range: '90 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Speak with Animals', level: 1, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Druid', 'Ranger'], conc: false, ritual: true },
    { name: 'Thunderwave', level: 1, school: 'Evocation', time: 'Action', range: 'Self (15 ft cube)', damage: '2d8 thunder', classes: ['Bard', 'Druid', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Unseen Servant', level: 1, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Warlock', 'Wizard'], conc: false, ritual: true },

    // === 2ND LEVEL ===
    { name: 'Aid', level: 2, school: 'Abjuration', time: 'Action', range: '30 ft', damage: '—', classes: ['Cleric', 'Paladin'], conc: false, ritual: false },
    { name: 'Alter Self', level: 2, school: 'Transmutation', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Barkskin', level: 2, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Druid', 'Ranger'], conc: true, ritual: false },
    { name: 'Blindness/Deafness', level: 2, school: 'Necromancy', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Blur', level: 2, school: 'Illusion', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Calm Emotions', level: 2, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Cleric'], conc: true, ritual: false },
    { name: 'Darkness', level: 2, school: 'Evocation', time: 'Action', range: '60 ft', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Darkvision', level: 2, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Detect Thoughts', level: 2, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Enhance Ability', level: 2, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer'], conc: true, ritual: false },
    { name: 'Enlarge/Reduce', level: 2, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Flame Blade', level: 2, school: 'Evocation', time: 'Bonus Action', range: 'Self', damage: '3d6 fire', classes: ['Druid'], conc: true, ritual: false },
    { name: 'Flaming Sphere', level: 2, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '2d6 fire', classes: ['Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Gust of Wind', level: 2, school: 'Evocation', time: 'Action', range: 'Self (60 ft line)', damage: '—', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Heat Metal', level: 2, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '2d8 fire', classes: ['Bard', 'Druid'], conc: true, ritual: false },
    { name: 'Hold Person', level: 2, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Invisibility', level: 2, school: 'Illusion', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Knock', level: 2, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Lesser Restoration', level: 2, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'], conc: false, ritual: false },
    { name: 'Levitate', level: 2, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Magic Weapon', level: 2, school: 'Transmutation', time: 'Bonus Action', range: 'Touch', damage: '—', classes: ['Paladin', 'Wizard'], conc: true, ritual: false },
    { name: 'Mirror Image', level: 2, school: 'Illusion', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Misty Step', level: 2, school: 'Conjuration', time: 'Bonus Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Moonbeam', level: 2, school: 'Evocation', time: 'Action', range: '120 ft', damage: '2d10 radiant', classes: ['Druid'], conc: true, ritual: false },
    { name: 'Pass without Trace', level: 2, school: 'Abjuration', time: 'Action', range: 'Self', damage: '—', classes: ['Druid', 'Ranger'], conc: true, ritual: false },
    { name: 'Prayer of Healing', level: 2, school: 'Evocation', time: '10 Minutes', range: '30 ft', damage: '2d8 healing', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Protection from Poison', level: 2, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid', 'Paladin', 'Ranger'], conc: false, ritual: false },
    { name: 'Scorching Ray', level: 2, school: 'Evocation', time: 'Action', range: '120 ft', damage: '3×2d6 fire', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'See Invisibility', level: 2, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Shatter', level: 2, school: 'Evocation', time: 'Action', range: '60 ft', damage: '3d8 thunder', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Silence', level: 2, school: 'Illusion', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Cleric', 'Ranger'], conc: true, ritual: true },
    { name: 'Spider Climb', level: 2, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Spike Growth', level: 2, school: 'Transmutation', time: 'Action', range: '150 ft', damage: '2d4 piercing', classes: ['Druid', 'Ranger'], conc: true, ritual: false },
    { name: 'Spiritual Weapon', level: 2, school: 'Evocation', time: 'Bonus Action', range: '60 ft', damage: '1d8+mod force', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Suggestion', level: 2, school: 'Enchantment', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Web', level: 2, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Zone of Truth', level: 2, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Cleric', 'Paladin'], conc: false, ritual: false },

    // === 3RD LEVEL ===
    { name: 'Animate Dead', level: 3, school: 'Necromancy', time: '1 Minute', range: '10 ft', damage: '—', classes: ['Cleric', 'Wizard'], conc: false, ritual: false },
    { name: 'Beacon of Hope', level: 3, school: 'Abjuration', time: 'Action', range: '30 ft', damage: '—', classes: ['Cleric'], conc: true, ritual: false },
    { name: 'Bestow Curse', level: 3, school: 'Necromancy', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Wizard'], conc: true, ritual: false },
    { name: 'Blink', level: 3, school: 'Transmutation', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Call Lightning', level: 3, school: 'Conjuration', time: 'Action', range: '120 ft', damage: '3d10 lightning', classes: ['Druid'], conc: true, ritual: false },
    { name: 'Clairvoyance', level: 3, school: 'Divination', time: '10 Minutes', range: '1 mile', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Conjure Animals', level: 3, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Druid', 'Ranger'], conc: true, ritual: false },
    { name: 'Counterspell', level: 3, school: 'Abjuration', time: 'Reaction', range: '60 ft', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Daylight', level: 3, school: 'Evocation', time: 'Action', range: '60 ft', damage: '—', classes: ['Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer'], conc: false, ritual: false },
    { name: 'Dispel Magic', level: 3, school: 'Abjuration', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Fear', level: 3, school: 'Illusion', time: 'Action', range: 'Self (30 ft cone)', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Fireball', level: 3, school: 'Evocation', time: 'Action', range: '150 ft', damage: '8d6 fire', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Fly', level: 3, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Gaseous Form', level: 3, school: 'Transmutation', time: 'Action', range: 'Touch', damage: '—', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Haste', level: 3, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Hypnotic Pattern', level: 3, school: 'Illusion', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Lightning Bolt', level: 3, school: 'Evocation', time: 'Action', range: 'Self (100 ft line)', damage: '8d6 lightning', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Magic Circle', level: 3, school: 'Abjuration', time: '1 Minute', range: '10 ft', damage: '—', classes: ['Cleric', 'Paladin', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Major Image', level: 3, school: 'Illusion', time: 'Action', range: '120 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Mass Healing Word', level: 3, school: 'Evocation', time: 'Bonus Action', range: '60 ft', damage: '1d4 healing', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Protection from Energy', level: 3, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Remove Curse', level: 3, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Paladin', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Revivify', level: 3, school: 'Necromancy', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Paladin'], conc: false, ritual: false },
    { name: 'Sending', level: 3, school: 'Evocation', time: 'Action', range: 'Unlimited', damage: '—', classes: ['Bard', 'Cleric', 'Wizard'], conc: false, ritual: false },
    { name: 'Slow', level: 3, school: 'Transmutation', time: 'Action', range: '120 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Speak with Dead', level: 3, school: 'Necromancy', time: 'Action', range: '10 ft', damage: '—', classes: ['Bard', 'Cleric'], conc: false, ritual: false },
    { name: 'Spirit Guardians', level: 3, school: 'Conjuration', time: 'Action', range: 'Self (15 ft radius)', damage: '3d8 radiant', classes: ['Cleric'], conc: true, ritual: false },
    { name: 'Stinking Cloud', level: 3, school: 'Conjuration', time: 'Action', range: '90 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Tongues', level: 3, school: 'Divination', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Vampiric Touch', level: 3, school: 'Necromancy', time: 'Action', range: 'Self', damage: '3d6 necrotic', classes: ['Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Water Breathing', level: 3, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: false, ritual: true },
    { name: 'Water Walk', level: 3, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Cleric', 'Druid', 'Ranger', 'Sorcerer'], conc: false, ritual: true },

    // === 4TH LEVEL ===
    { name: 'Banishment', level: 4, school: 'Abjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Cleric', 'Paladin', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Blight', level: 4, school: 'Necromancy', time: 'Action', range: '30 ft', damage: '8d8 necrotic', classes: ['Druid', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Confusion', level: 4, school: 'Enchantment', time: 'Action', range: '90 ft', damage: '—', classes: ['Bard', 'Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Conjure Minor Elementals', level: 4, school: 'Conjuration', time: '1 Minute', range: '90 ft', damage: '—', classes: ['Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Control Water', level: 4, school: 'Transmutation', time: 'Action', range: '300 ft', damage: '—', classes: ['Cleric', 'Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Death Ward', level: 4, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Paladin'], conc: false, ritual: false },
    { name: 'Dimension Door', level: 4, school: 'Conjuration', time: 'Action', range: '500 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Dominate Beast', level: 4, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Druid', 'Sorcerer'], conc: true, ritual: false },
    { name: 'Fire Shield', level: 4, school: 'Evocation', time: 'Action', range: 'Self', damage: '2d8 fire/cold', classes: ['Wizard'], conc: false, ritual: false },
    { name: 'Freedom of Movement', level: 4, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Ranger'], conc: false, ritual: false },
    { name: 'Greater Invisibility', level: 4, school: 'Illusion', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Guardian of Faith', level: 4, school: 'Conjuration', time: 'Action', range: '30 ft', damage: '20 radiant', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Ice Storm', level: 4, school: 'Evocation', time: 'Action', range: '300 ft', damage: '2d8 bludgeoning + 4d6 cold', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Locate Creature', level: 4, school: 'Divination', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Wizard'], conc: true, ritual: false },
    { name: 'Phantasmal Killer', level: 4, school: 'Illusion', time: 'Action', range: '120 ft', damage: '4d10 psychic', classes: ['Wizard'], conc: true, ritual: false },
    { name: 'Polymorph', level: 4, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Stoneskin', level: 4, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Druid', 'Ranger', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Wall of Fire', level: 4, school: 'Evocation', time: 'Action', range: '120 ft', damage: '5d8 fire', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },

    // === 5TH LEVEL ===
    { name: 'Animate Objects', level: 5, school: 'Transmutation', time: 'Action', range: '120 ft', damage: 'varies', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Cloudkill', level: 5, school: 'Conjuration', time: 'Action', range: '120 ft', damage: '5d8 poison', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Commune', level: 5, school: 'Divination', time: '1 Minute', range: 'Self', damage: '—', classes: ['Cleric'], conc: false, ritual: true },
    { name: 'Cone of Cold', level: 5, school: 'Evocation', time: 'Action', range: 'Self (60 ft cone)', damage: '8d8 cold', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Conjure Elemental', level: 5, school: 'Conjuration', time: '1 Minute', range: '90 ft', damage: '—', classes: ['Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Dominate Person', level: 5, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Dream', level: 5, school: 'Illusion', time: '1 Minute', range: 'Special', damage: '—', classes: ['Bard', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Flame Strike', level: 5, school: 'Evocation', time: 'Action', range: '60 ft', damage: '4d6 fire + 4d6 radiant', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Greater Restoration', level: 5, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Hold Monster', level: 5, school: 'Enchantment', time: 'Action', range: '90 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Insect Plague', level: 5, school: 'Conjuration', time: 'Action', range: '300 ft', damage: '4d10 piercing', classes: ['Cleric', 'Druid', 'Sorcerer'], conc: true, ritual: false },
    { name: 'Mass Cure Wounds', level: 5, school: 'Evocation', time: 'Action', range: '60 ft', damage: '3d8 healing', classes: ['Bard', 'Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Raise Dead', level: 5, school: 'Necromancy', time: '1 Hour', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Paladin'], conc: false, ritual: false },
    { name: 'Scrying', level: 5, school: 'Divination', time: '10 Minutes', range: 'Self', damage: '—', classes: ['Bard', 'Cleric', 'Druid', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Telekinesis', level: 5, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Wall of Force', level: 5, school: 'Evocation', time: 'Action', range: '120 ft', damage: '—', classes: ['Wizard'], conc: true, ritual: false },
    { name: 'Wall of Stone', level: 5, school: 'Evocation', time: 'Action', range: '120 ft', damage: '—', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },

    // === 6TH LEVEL ===
    { name: 'Blade Barrier', level: 6, school: 'Evocation', time: 'Action', range: '90 ft', damage: '6d10 slashing', classes: ['Cleric'], conc: true, ritual: false },
    { name: 'Chain Lightning', level: 6, school: 'Evocation', time: 'Action', range: '150 ft', damage: '10d8 lightning', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Circle of Death', level: 6, school: 'Necromancy', time: 'Action', range: '150 ft', damage: '8d6 necrotic', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Disintegrate', level: 6, school: 'Transmutation', time: 'Action', range: '60 ft', damage: '10d6+40 force', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Eyebite', level: 6, school: 'Necromancy', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Heal', level: 6, school: 'Evocation', time: 'Action', range: '60 ft', damage: '70 healing', classes: ['Cleric', 'Druid'], conc: false, ritual: false },
    { name: "Heroes' Feast", level: 6, school: 'Conjuration', time: '10 Minutes', range: '30 ft', damage: '—', classes: ['Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Mass Suggestion', level: 6, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Sunbeam', level: 6, school: 'Evocation', time: 'Action', range: 'Self (60 ft line)', damage: '6d8 radiant', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'True Seeing', level: 6, school: 'Divination', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Wall of Ice', level: 6, school: 'Evocation', time: 'Action', range: '120 ft', damage: '10d6 cold', classes: ['Wizard'], conc: true, ritual: false },
    { name: 'Word of Recall', level: 6, school: 'Conjuration', time: 'Action', range: '5 ft', damage: '—', classes: ['Cleric'], conc: false, ritual: false },

    // === 7TH LEVEL ===
    { name: 'Conjure Celestial', level: 7, school: 'Conjuration', time: '1 Minute', range: '90 ft', damage: '—', classes: ['Cleric'], conc: true, ritual: false },
    { name: 'Delayed Blast Fireball', level: 7, school: 'Evocation', time: 'Action', range: '150 ft', damage: '12d6 fire', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Divine Word', level: 7, school: 'Evocation', time: 'Bonus Action', range: '30 ft', damage: 'varies', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Etherealness', level: 7, school: 'Transmutation', time: 'Action', range: 'Self', damage: '—', classes: ['Bard', 'Cleric', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Finger of Death', level: 7, school: 'Necromancy', time: 'Action', range: '60 ft', damage: '7d8+30 necrotic', classes: ['Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Fire Storm', level: 7, school: 'Evocation', time: 'Action', range: '150 ft', damage: '7d10 fire', classes: ['Cleric', 'Druid', 'Sorcerer'], conc: false, ritual: false },
    { name: 'Forcecage', level: 7, school: 'Evocation', time: 'Action', range: '100 ft', damage: '—', classes: ['Bard', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Plane Shift', level: 7, school: 'Conjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Prismatic Spray', level: 7, school: 'Evocation', time: 'Action', range: 'Self (60 ft cone)', damage: '10d6 varies', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Regenerate', level: 7, school: 'Transmutation', time: '1 Minute', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Resurrection', level: 7, school: 'Necromancy', time: '1 Hour', range: 'Touch', damage: '—', classes: ['Bard', 'Cleric'], conc: false, ritual: false },
    { name: 'Reverse Gravity', level: 7, school: 'Transmutation', time: 'Action', range: '100 ft', damage: '—', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Simulacrum', level: 7, school: 'Illusion', time: '12 Hours', range: 'Touch', damage: '—', classes: ['Wizard'], conc: false, ritual: false },
    { name: 'Symbol', level: 7, school: 'Abjuration', time: '1 Minute', range: 'Touch', damage: 'varies', classes: ['Bard', 'Cleric', 'Wizard'], conc: false, ritual: false },
    { name: 'Teleport', level: 7, school: 'Conjuration', time: 'Action', range: '10 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Wizard'], conc: false, ritual: false },

    // === 8TH LEVEL ===
    { name: 'Antimagic Field', level: 8, school: 'Abjuration', time: 'Action', range: 'Self (10 ft sphere)', damage: '—', classes: ['Cleric', 'Wizard'], conc: true, ritual: false },
    { name: 'Clone', level: 8, school: 'Necromancy', time: '1 Hour', range: 'Touch', damage: '—', classes: ['Wizard'], conc: false, ritual: false },
    { name: 'Control Weather', level: 8, school: 'Transmutation', time: '10 Minutes', range: 'Self (5 mile radius)', damage: '—', classes: ['Cleric', 'Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Dominate Monster', level: 8, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'Earthquake', level: 8, school: 'Evocation', time: 'Action', range: '500 ft', damage: 'varies', classes: ['Cleric', 'Druid', 'Sorcerer'], conc: true, ritual: false },
    { name: 'Feeblemind', level: 8, school: 'Enchantment', time: 'Action', range: '150 ft', damage: '4d6 psychic', classes: ['Bard', 'Druid', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Holy Aura', level: 8, school: 'Abjuration', time: 'Action', range: 'Self', damage: '—', classes: ['Cleric'], conc: true, ritual: false },
    { name: 'Incendiary Cloud', level: 8, school: 'Conjuration', time: 'Action', range: '150 ft', damage: '10d8 fire', classes: ['Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Maze', level: 8, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Wizard'], conc: true, ritual: false },
    { name: 'Mind Blank', level: 8, school: 'Abjuration', time: 'Action', range: 'Touch', damage: '—', classes: ['Bard', 'Wizard'], conc: false, ritual: false },
    { name: 'Power Word Stun', level: 8, school: 'Enchantment', time: 'Action', range: '60 ft', damage: '—', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Sunburst', level: 8, school: 'Evocation', time: 'Action', range: '150 ft', damage: '12d6 radiant', classes: ['Druid', 'Sorcerer', 'Wizard'], conc: false, ritual: false },

    // === 9TH LEVEL ===
    { name: 'Astral Projection', level: 9, school: 'Necromancy', time: '1 Hour', range: '10 ft', damage: '—', classes: ['Cleric', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Foresight', level: 9, school: 'Divination', time: '1 Minute', range: 'Touch', damage: '—', classes: ['Bard', 'Druid', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Gate', level: 9, school: 'Conjuration', time: 'Action', range: '60 ft', damage: '—', classes: ['Cleric', 'Sorcerer', 'Wizard'], conc: true, ritual: false },
    { name: 'Mass Heal', level: 9, school: 'Evocation', time: 'Action', range: '60 ft', damage: '700 healing', classes: ['Cleric'], conc: false, ritual: false },
    { name: 'Meteor Swarm', level: 9, school: 'Evocation', time: 'Action', range: '1 mile', damage: '40d6 fire+bludgeoning', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'Power Word Kill', level: 9, school: 'Enchantment', time: 'Action', range: '60 ft', damage: 'death', classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], conc: false, ritual: false },
    { name: 'Prismatic Wall', level: 9, school: 'Abjuration', time: 'Action', range: '60 ft', damage: 'varies', classes: ['Wizard'], conc: false, ritual: false },
    { name: 'Shapechange', level: 9, school: 'Transmutation', time: 'Action', range: 'Self', damage: '—', classes: ['Druid', 'Wizard'], conc: true, ritual: false },
    { name: 'Time Stop', level: 9, school: 'Transmutation', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false },
    { name: 'True Polymorph', level: 9, school: 'Transmutation', time: 'Action', range: '30 ft', damage: '—', classes: ['Bard', 'Warlock', 'Wizard'], conc: true, ritual: false },
    { name: 'True Resurrection', level: 9, school: 'Necromancy', time: '1 Hour', range: 'Touch', damage: '—', classes: ['Cleric', 'Druid'], conc: false, ritual: false },
    { name: 'Wish', level: 9, school: 'Conjuration', time: 'Action', range: 'Self', damage: '—', classes: ['Sorcerer', 'Wizard'], conc: false, ritual: false }
];

// ═══ SPECIES / CLASS / BACKGROUND DATA ═══
    const SPECIES_DATA = {
        'Human': { speed:'9 m (30 ft)', size:'Mittel', senses:'—', languages:'Gemeinsprache, eine weitere Sprache', resistances:'', traits:'Einfallsreich: +1 auf eine Fertigkeit deiner Wahl.\nVielseitig: Du erhältst die Inspiration bei jedem langen Rast.\nFertigkeitsvielfalt: Geübtheit in einer zusätzlichen Fertigkeit.' },
        'Elf': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Elfisch', resistances:'', traits:'Fey-Abstammung: Vorteil auf Rettungswürfe gegen Verzauberung.\nTrance: 4 Stunden meditativer Rast statt 8 Stunden Schlaf.\nScharfe Sinne: Geübtheit in Wahrnehmung.\nElfische Linie: Wähle Hochelf (Zaubertrick), Waldelf (Schneller, Maskierung) oder Drow (Überlegene Dunkelsicht, Drow-Magie).' },
        'Dwarf': { speed:'7,5 m (25 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Zwergisch', resistances:'Gift (Vorteil auf Rettungswürfe)', traits:'Zwergenresilienz: Vorteil auf Rettungswürfe gegen Gift, Resistenz gegen Giftschaden.\nWerkzeuggeübtheit: Schmiedewerkzeug, Brauerzubehör oder Maurerwerkzeug.\nSteinkundig: Doppelter Übungsbonus auf Geschichte-Würfe bei Steinarbeit.' },
        'Halfling': { speed:'7,5 m (25 ft)', size:'Klein', senses:'—', languages:'Gemeinsprache, Halblingisch', resistances:'', traits:'Glück: Bei einer 1 auf einem W20 darfst du neu würfeln.\nTapfer: Vorteil auf Rettungswürfe gegen Furcht.\nFlink: Du kannst dich durch den Raum größerer Kreaturen bewegen.' },
        'Dragonborn': { speed:'9 m (30 ft)', size:'Mittel', senses:'—', languages:'Gemeinsprache, Drakonisch', resistances:'Schadenstyp des gewählten Drachen', traits:'Odemwaffe: Kegelförmiger oder linearer Elementarangriff (2W6, steigt mit Stufe).\nSchadensresistenz: Resistenz gegen den Schadenstyp deiner Drachenart.\nDrachenart wählen: Schwarz (Säure), Blau (Blitz), Grün (Gift), Rot (Feuer), Weiß (Kälte) und weitere.' },
        'Tiefling': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Infernal', resistances:'Feuer', traits:'Höllische Resistenz: Resistenz gegen Feuerschaden.\nInfernales Erbe:\n• Stufe 1: Thaumaturgy (Zaubertrick)\n• Stufe 3: Höllischer Tadel (1x/lange Rast)\n• Stufe 5: Dunkelheit (1x/lange Rast)' },
        'Gnome': { speed:'7,5 m (25 ft)', size:'Klein', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Gnomisch', resistances:'', traits:'Gnomische Gerissenheit: Vorteil auf INT-, WIS- und CHA-Rettungswürfe gegen Magie.\nGnomische Linie: Wähle Felsengnom (Bastler, Geringfügige Illusion) oder Waldgnom (Natürlicher Illusionist, Mit Tieren sprechen).' },
        'Half-Elf': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Elfisch, eine weitere Sprache', resistances:'', traits:'Fey-Abstammung: Vorteil auf Rettungswürfe gegen Verzauberung.\nFertigkeitsvielfalt: Geübtheit in zwei Fertigkeiten deiner Wahl.\nVielseitig: Flexibel zwischen Welten der Elfen und Menschen.' },
        'Half-Orc': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Orkisch', resistances:'', traits:'Unbändige Ausdauer: 1x pro lange Rast, wenn du auf 0 HP fällst, stattdessen auf 1 HP.\nWilde Attacken: Bei einem kritischen Treffer mit Nahkampfwaffe — ein zusätzlicher Schadenswürfel.\nBedrohlich: Geübtheit in Einschüchtern.' },
        'Orc': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 36 m (120 ft)', languages:'Gemeinsprache, Orkisch', resistances:'', traits:'Adrenaline Rush: Bonus-Aktion Dash + temporäre HP = Übungsbonus (PB × pro lange Rast).\nUnbändige Ausdauer: 1x pro lange Rast auf 1 HP statt 0.\nKräftiger Bau: Zählst als eine Größe größer für Tragen/Schieben/Ziehen.' },
        'Aasimar': { speed:'9 m (30 ft)', size:'Mittel', senses:'Dunkelsicht 18 m (60 ft)', languages:'Gemeinsprache, Celestisch', resistances:'Nekrotisch, Strahlend', traits:'Heilende Hände: Aktion, Stufe × Trefferpunkte heilen (1x pro lange Rast).\nLichtträger: Light-Zaubertrick (CHA).\nHimmlische Offenbarung (ab Stufe 3 wählen):\n• Strahlendes Seele: Flügel + Strahlungsschaden\n• Nekrotischer Schleier: Furcht + nekrotischer Schaden\n• Himmlische Ausstrahlung: Bonus-Strahlungsschaden' },
        'Goliath': { speed:'9 m (30 ft)', size:'Mittel', senses:'—', languages:'Gemeinsprache, Riesisch', resistances:'', traits:'Steinausdauer: Reaktion, 1W12 + KON-Mod Schaden reduzieren (PB × pro lange Rast).\nGroße Statur: Tragkraft und Trage-/Schiebelast verdoppelt.\nRiesenerbe (wähle): Cloud (Nebelschritt), Fire (Feuerresistenz), Frost (Kälteresistenz), Hill (Rückstoß), Storm (Blitz-Resistenz).' }
    };
    
    // ===== CLASS STARTING DATA (Level 1) =====
    function getClassStart(d, strMod, dexMod) { return {
        'Barbarian': {
            armor: { light:true, medium:true, heavy:false, shields:true },
            weapons: { simple:true, martial:true },
            weaponsText: 'Alle einfachen und Kampfwaffen',
            startWeapons: [
                { name:'Großaxt', bonus:`+${strMod+2}`, damage:`1W12+${strMod}`, notes:'Schwer, Zweihand' },
                { name:'Wurfspeer (×4)', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'Wurfweite 9/36 m' }
            ],
            acType:'medium', startArmor:'Keine (Ungerüstete Verteidigung)',
            ac: 10 + dexMod + Math.floor(((d.con||10)-10)/2), shield:'',
            features:'WUTAUSBRUCH (Rage)\n2× pro lange Rast. Bonus-Aktion. Für 1 Minute:\n• +2 Schaden auf STR-Nahkampf\n• Resistenz gegen Hieb-/Stich-/Wuchtschaden\n• Vorteil auf STR-Prüfungen und -Rettungswürfe\n\nUNGERÜSTETE VERTEIDIGUNG\nOhne Rüstung: RK = 10 + GES-Mod + KON-Mod (Schild erlaubt)',
            resources: [{ name:'Wutausbrüche', current:'2', max:'2' }],
            tools: '—', spellcaster: false,
            equipment:'Großaxt, 4 Wurfspieße, Abenteurerpaket, Forschungsausrüstung',
            gold: 10
        },
        'Bard': {
            armor: { light:true, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen, Handarmbrusten, Langschwerter, Rapiere, Kurzschwerter',
            startWeapons: [
                { name:'Rapier', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Finesse' },
                { name:'Dolch', bonus:`+${dexMod+2}`, damage:`1W4+${dexMod}`, notes:'Finesse, Leicht, Wurf' }
            ],
            acType:'light', startArmor:'Lederrüstung',
            ac: 11 + dexMod, shield:'',
            features:'BARDISCHE INSPIRATION\nBonus-Aktion: Einem Verbündeten in 18 m einen 1W6-Inspirationswürfel geben (CHA-Mod × pro lange Rast). Der Verbündete kann den Würfel innerhalb von 10 Minuten auf einen Angriff, Fähigkeitenprüfung oder Rettungswurf addieren.\n\nZAUBERWIRKEN\nZauberfähigkeit: Charisma\n2 Zaubertricks, 4 bekannte Zauber, 2 Zauberplätze (1. Grad)\nMusikalisches Instrument als Fokus',
            resources: [{ name:'Bardische Inspiration', current: `${Math.max(1,Math.floor(((d.cha||10)-10)/2))}`, max: `${Math.max(1,Math.floor(((d.cha||10)-10)/2))}` }],
            tools: 'Drei Musikinstrumente deiner Wahl', spellcaster:'cha', cantrips:2, slots:{1:2},
            equipment:'Rapier, Dolch, Lederrüstung, Diplomatenpaket, Musikinstrument',
            gold: 10
        },
        'Cleric': {
            armor: { light:true, medium:true, heavy:false, shields:true },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen',
            startWeapons: [
                { name:'Streitkolben', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'—' }
            ],
            acType:'medium', startArmor:'Schuppenpanzer + Schild',
            ac: 14 + Math.min(dexMod, 2) + 2, shield:'+2',
            features:'ZAUBERWIRKEN\nZauberfähigkeit: Weisheit\n3 Zaubertricks, alle Kleriker-Zauber vorbereiten (WEI-Mod + Stufe)\n2 Zauberplätze (1. Grad)\nHeiliges Symbol als Fokus\n\nGÖTTLICHE DOMÄNE\nWähle deine Domäne auf Stufe 1. Bestimmt Bonus-Zauber und Channel Divinity.',
            resources: [],
            tools: '—', spellcaster:'wis', cantrips:3, slots:{1:2},
            equipment:'Streitkolben, Schuppenpanzer, Schild, Heiliges Symbol, Priesterpaket',
            gold: 10
        },
        'Druid': {
            armor: { light:true, medium:true, heavy:false, shields:true },
            weapons: { simple:true, martial:false },
            weaponsText: 'Keulen, Dolche, Wurfpfeile, Wurfspieße, Streitkolben, Kampfstäbe, Krummschwerter, Sicheln, Schleudern, Speere',
            startWeapons: [
                { name:'Kampfstab', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'Vielseitig (1W8)' }
            ],
            acType:'medium', startArmor:'Lederrüstung + Schild',
            ac: 11 + dexMod + 2, shield:'+2',
            features:'ZAUBERWIRKEN\nZauberfähigkeit: Weisheit\n2 Zaubertricks, alle Druiden-Zauber vorbereiten (WEI-Mod + Stufe)\n2 Zauberplätze (1. Grad)\nDruidischer Fokus (Stab, Mistelzweig, etc.)\n\nDRUIDISCH\nDu kennst die geheime Sprache der Druiden.',
            resources: [],
            tools: 'Kräuterkundeausrüstung', spellcaster:'wis', cantrips:2, slots:{1:2},
            equipment:'Kampfstab, Lederrüstung, Schild, Druidischer Fokus, Forschungspaket, Kräuterkundeausrüstung',
            gold: 10
        },
        'Fighter': {
            armor: { light:true, medium:true, heavy:true, shields:true },
            weapons: { simple:true, martial:true },
            weaponsText: 'Alle einfachen und Kampfwaffen',
            startWeapons: [
                { name:'Langschwert', bonus:`+${strMod+2}`, damage:`1W8+${strMod}`, notes:'Vielseitig (1W10)' },
                { name:'Handaxt (×2)', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'Leicht, Wurf 6/18 m' },
                { name:'Leichte Armbrust', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Mun., Laden, Zweihand, 24/96 m' }
            ],
            acType:'heavy', startArmor:'Kettenhemd + Schild',
            ac: 18, shield:'+2',
            features:'KAMPFSTIL\nWähle einen Kampfstil:\n• Verteidigung (+1 RK mit Rüstung)\n• Duellkampf (+2 Schaden mit einer Einhandwaffe)\n• Großwaffenkampf (1-2 bei Schadenswürfel → neu würfeln)\n• Schutz (Reaktion: Nachteil auf Angriff gegen Verbündeten)\n• Bogenschießen (+2 auf Fernkampfangriffe)\n\nZWEITER WIND\nBonus-Aktion: 1W10+Kämpfer-Stufe HP heilen (1x pro kurze/lange Rast)',
            resources: [{ name:'Zweiter Wind', current:'1', max:'1' }],
            tools: '—', spellcaster: false,
            equipment:'Kettenhemd, Schild, Langschwert, 2 Handäxte, Abenteurerpaket, Leichte Armbrust + 20 Bolzen',
            gold: 10
        },
        'Monk': {
            armor: { light:false, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen, Kurzschwerter',
            startWeapons: [
                { name:'Kampfstab', bonus:`+${dexMod+2}`, damage:`1W6+${dexMod}`, notes:'Mönchswaffe, Vielseitig' },
                { name:'Unbewaffneter Schlag', bonus:`+${dexMod+2}`, damage:`1W4+${dexMod}`, notes:'Bonus-Aktion (Martial Arts)' }
            ],
            acType:'none', startArmor:'Keine (Ungerüstete Verteidigung)',
            ac: 10 + dexMod + Math.floor(((d.wis||10)-10)/2), shield:'',
            features:'UNGERÜSTETE VERTEIDIGUNG\nOhne Rüstung: RK = 10 + GES-Mod + WEI-Mod\n\nMARTIAL ARTS\n• GES statt STR für Mönchswaffen\n• Unbewaffnete Schläge: 1W4 Schaden\n• Bonus-Aktion: Ein unbewaffneter Schlag nach Angriffsaktion\n• Mönchswaffen: Einfache Nahkampfwaffen + Kurzschwerter',
            resources: [],
            tools: 'Ein Handwerkzeug oder Musikinstrument', spellcaster: false,
            equipment:'Kampfstab, 10 Wurfpfeile, Abenteurerpaket',
            gold: 5
        },
        'Paladin': {
            armor: { light:true, medium:true, heavy:true, shields:true },
            weapons: { simple:true, martial:true },
            weaponsText: 'Alle einfachen und Kampfwaffen',
            startWeapons: [
                { name:'Langschwert', bonus:`+${strMod+2}`, damage:`1W8+${strMod}`, notes:'Vielseitig (1W10)' },
                { name:'Wurfspeer (×5)', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'Wurfweite 9/36 m' }
            ],
            acType:'heavy', startArmor:'Kettenhemd + Schild',
            ac: 18, shield:'+2',
            features:'GÖTTLICHES GESPÜR (Divine Sense)\nAktion: Bis Ende des nächsten Zuges — Standort von Himmlischen, Untoten oder Unholden in 18 m erkennen. CHA-Mod + 1 × pro lange Rast.\n\nHÄNDEAUFLEGEN (Lay on Hands)\nPool = Paladin-Stufe × 5 HP. Aktion: Beliebig viele HP heilen oder 5 HP ausgeben um Krankheit/Gift zu neutralisieren.',
            resources: [{ name:'Händeauflegen', current:'5', max:'5' }, { name:'Göttliches Gespür', current:`${Math.max(1,Math.floor(((d.cha||10)-10)/2))+1}`, max:`${Math.max(1,Math.floor(((d.cha||10)-10)/2))+1}` }],
            tools: '—', spellcaster: false,
            equipment:'Kettenhemd, Schild, Langschwert, 5 Wurfspieße, Heiliges Symbol, Priesterpaket',
            gold: 10
        },
        'Ranger': {
            armor: { light:true, medium:true, heavy:false, shields:true },
            weapons: { simple:true, martial:true },
            weaponsText: 'Alle einfachen und Kampfwaffen',
            startWeapons: [
                { name:'Langbogen', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Mun., Schwer, Zweihand, 45/180 m' },
                { name:'Kurzschwert (×2)', bonus:`+${dexMod+2}`, damage:`1W6+${dexMod}`, notes:'Finesse, Leicht' }
            ],
            acType:'medium', startArmor:'Schuppenpanzer',
            ac: 14 + Math.min(dexMod, 2), shield:'',
            features:'BEVORZUGTER FEIND\nVorteil auf Überlebens-Wurf zum Fährtenlesen und INT-Würfe für Wissen über gewählte Feindtypen.\n\nNATÜRLICHER ENTDECKER\nBevorzugtes Gelände: Vorteil auf INT- und WIS-Prüfungen dort, schwieriges Gelände behindert nicht, wachsam im Schlaf.\n\nZAUBERWIRKEN (ab Stufe 2)',
            resources: [],
            tools: '—', spellcaster: false,
            equipment:'Schuppenpanzer, 2 Kurzschwerter, Langbogen, 20 Pfeile, Abenteurerpaket',
            gold: 10
        },
        'Rogue': {
            armor: { light:true, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen, Handarmbrusten, Langschwerter, Rapiere, Kurzschwerter',
            startWeapons: [
                { name:'Rapier', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Finesse' },
                { name:'Kurzbogen', bonus:`+${dexMod+2}`, damage:`1W6+${dexMod}`, notes:'Mun., Zweihand, 24/96 m' },
                { name:'Dolch (×2)', bonus:`+${dexMod+2}`, damage:`1W4+${dexMod}`, notes:'Finesse, Leicht, Wurf' }
            ],
            acType:'light', startArmor:'Lederrüstung',
            ac: 11 + dexMod, shield:'',
            features:'EXPERTISE\nWähle 2 Fertigkeiten mit Geübtheit → doppelter Übungsbonus.\n\nHINTERHÄLTIGER ANGRIFF (Sneak Attack)\n1x pro Zug: +1W6 Schaden wenn Vorteil ODER Verbündeter in 1,5 m vom Ziel. Finesse- oder Fernkampfwaffe nötig.\n\nDIEBESKUNST (Cunning Action)\nBonus-Aktion: Dash, Disengage oder Hide.',
            resources: [],
            tools: 'Diebeswerkzeug', spellcaster: false,
            equipment:'Rapier, Kurzbogen, 20 Pfeile, 2 Dolche, Lederrüstung, Diebeswerkzeug, Einbrecherpaket',
            gold: 10
        },
        'Sorcerer': {
            armor: { light:false, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Dolche, Wurfpfeile, Schleudern, Kampfstäbe, Leichte Armbrusten',
            startWeapons: [
                { name:'Leichte Armbrust', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Mun., Laden, Zweihand, 24/96 m' },
                { name:'Dolch (×2)', bonus:`+${dexMod+2}`, damage:`1W4+${dexMod}`, notes:'Finesse, Leicht, Wurf' }
            ],
            acType:'none', startArmor:'Keine',
            ac: 10 + dexMod, shield:'',
            features:'ZAUBERWIRKEN\nZauberfähigkeit: Charisma\n4 Zaubertricks, 2 bekannte Zauber, 2 Zauberplätze (1. Grad)\nArkanischer Fokus oder Komponentenbeutel\n\nZAUBERURSPRUNG\nWähle deinen Ursprung auf Stufe 1. Bestimmt Bonus-Features und Bonus-Zauber.',
            resources: [],
            tools: '—', spellcaster:'cha', cantrips:4, slots:{1:2},
            equipment:'Leichte Armbrust, 20 Bolzen, 2 Dolche, Arkanischer Fokus, Abenteurerpaket',
            gold: 10
        },
        'Warlock': {
            armor: { light:true, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen',
            startWeapons: [
                { name:'Leichte Armbrust', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Mun., Laden, Zweihand, 24/96 m' },
                { name:'Dolch (×2)', bonus:`+${dexMod+2}`, damage:`1W4+${dexMod}`, notes:'Finesse, Leicht, Wurf' }
            ],
            acType:'light', startArmor:'Lederrüstung',
            ac: 11 + dexMod, shield:'',
            features:'PAKTMAGIE\nZauberfähigkeit: Charisma\n2 Zaubertricks, 2 bekannte Zauber\n1 Pakt-Zauberplatz (1. Grad) — wird bei kurzer Rast erneuert!\n\nJENSEITIGER PATRON\nWähle deinen Patron auf Stufe 1. Bestimmt erweiterte Zauberliste und Patron-Features.',
            resources: [],
            tools: '—', spellcaster:'cha', cantrips:2, pact:true, slots:{1:1},
            equipment:'Leichte Armbrust, 20 Bolzen, 2 Dolche, Lederrüstung, Arkanischer Fokus, Gelehrtenpaket',
            gold: 10
        },
        'Wizard': {
            armor: { light:false, medium:false, heavy:false, shields:false },
            weapons: { simple:true, martial:false },
            weaponsText: 'Dolche, Wurfpfeile, Schleudern, Kampfstäbe, Leichte Armbrusten',
            startWeapons: [
                { name:'Kampfstab', bonus:`+${strMod+2}`, damage:`1W6+${strMod}`, notes:'Vielseitig (1W8)' }
            ],
            acType:'none', startArmor:'Keine',
            ac: 10 + dexMod, shield:'',
            features:'ZAUBERWIRKEN\nZauberfähigkeit: Intelligenz\n3 Zaubertricks, 6 Zauber im Zauberbuch, 2 Zauberplätze (1. Grad)\nArkanischer Fokus oder Zauberbuch als Fokus\nZauber vorbereiten: INT-Mod + Stufe\n\nARKANE ERHOLUNG\n1x pro Tag bei kurzer Rast: Zauberplätze zurückgewinnen (max. Summe = halbe Magier-Stufe, aufgerundet)',
            resources: [{ name:'Arkane Erholung', current:'1', max:'1' }],
            tools: '—', spellcaster:'int', cantrips:3, slots:{1:2},
            equipment:'Kampfstab, Zauberbuch, Arkanischer Fokus, Gelehrtenpaket, Komponentenbeutel',
            gold: 10
        },
        'Artificer': {
            armor: { light:true, medium:true, heavy:false, shields:true },
            weapons: { simple:true, martial:false },
            weaponsText: 'Einfache Waffen, Feuerwaffen (optional)',
            startWeapons: [
                { name:'Leichte Armbrust', bonus:`+${dexMod+2}`, damage:`1W8+${dexMod}`, notes:'Mun., Laden, Zweihand' }
            ],
            acType:'medium', startArmor:'Beschlagenes Leder + Schild',
            ac: 12 + Math.min(dexMod, 2) + 2, shield:'+2',
            features:'MAGISCHES BASTELN\nLange Rast: Einfache magische Gegenstände erschaffen (Licht, Flamme, Musik, Geruch, etc.).\n\nZAUBERWIRKEN\nZauberfähigkeit: Intelligenz\n2 Zaubertricks, alle Konstrukteur-Zauber vorbereiten (INT-Mod + halbe Stufe)\nWerkzeuge als Zauberfokus',
            resources: [],
            tools: 'Diebeswerkzeug, Bastlerwerkzeug, ein weiteres Handwerkzeug', spellcaster:'int', cantrips:2, slots:{1:2},
            equipment:'Leichte Armbrust, 20 Bolzen, Beschlagenes Leder, Schild, Diebeswerkzeug, Bastlerwerkzeug, Dungeoneerpaket',
            gold: 10
        }
    }; }

    const BG_DATA = {
        'Soldier': { tools:'Spielset, Landfahrzeuge', languages:'—', gold:10, equipment:'Rangabzeichen, Trophäe eines gefallenen Feindes, Knochenspielset, Alltagskleidung', feature:'Militärischer Rang: Soldaten deiner ehemaligen Organisation erkennen dich an und gewähren dir Zugang zu Militäreinrichtungen.' },
        'Criminal': { tools:'Diebeswerkzeug, Spielset', languages:'—', gold:15, equipment:'Brechstange, dunkle Alltagskleidung mit Kapuze, Gürtel', feature:'Krimineller Kontakt: Du hast einen verlässlichen Kontakt in der kriminellen Unterwelt, der als Bote und Informant dient.' },
        'Sage': { tools:'—', languages:'Zwei Sprachen deiner Wahl', gold:10, equipment:'Tintenfass, Feder, kleines Messer, Brief mit unbeantworteter Frage, Alltagskleidung', feature:'Forscher: Wenn du etwas nicht weißt, weißt du oft, wo du die Information finden kannst.' },
        'Acolyte': { tools:'—', languages:'Zwei Sprachen deiner Wahl', gold:15, equipment:'Heiliges Symbol, Gebetsbuch, 5 Räucherstäbchen, Roben, Alltagskleidung', feature:'Zuflucht der Gläubigen: Du und deine Gefährten könnt in Tempeln und religiösen Gemeinschaften kostenlose Heilung und Unterkunft erhalten.' },
        'Noble': { tools:'Spielset', languages:'Eine Sprache deiner Wahl', gold:25, equipment:'Feine Kleidung, Siegelring, Stammbaum-Urkunde', feature:'Position des Privilegs: Aufgrund deines adeligen Geburtsrechts behandeln dich andere mit Respekt. Willkommen in der gehobenen Gesellschaft.' },
        'Folk Hero': { tools:'Ein Handwerkzeug, Landfahrzeuge', languages:'—', gold:10, equipment:'Handwerkzeug, Schaufel, Eisentopf, Alltagskleidung', feature:'Rustikale Gastfreundschaft: Einfache Leute helfen dir und verbergen dich, solange du sie nicht in Gefahr bringst.' },
        'Entertainer': { tools:'Verkleidungsausrüstung, ein Musikinstrument', languages:'—', gold:15, equipment:'Musikinstrument, Kostüm, Liebesbrief eines Bewunderers', feature:'Auf Wunsch des Publikums: Du findest immer einen Ort zum Auftreten und erhältst kostenlose Unterkunft und Verpflegung, solange du jeden Abend auftrittst.' },
        'Hermit': { tools:'Kräuterkundeausrüstung', languages:'Eine Sprache deiner Wahl', gold:5, equipment:'Schriftrolle mit Notizen/Gebeten, Winterdecke, Kräuterkundeausrüstung, Alltagskleidung', feature:'Entdeckung: Die stille Abgeschiedenheit hat dir eine einzigartige Einsicht beschert — eine bedeutende Wahrheit über das Universum, die Götter oder eine mächtige Kraft.' }
    };

// ═══════════════════════════════════════════════════════
// HP CALCULATION
// ═══════════════════════════════════════════════════════
function calcSuggestedHP(className, level, conScore) {
    const die = HIT_DICE[className];
    if (!die || !level || level < 1) return null;
    const conMod = Math.floor((conScore - 10) / 2);
    const avg = Math.floor(die / 2) + 1;
    const level1 = die + conMod;
    const restLevels = (level - 1) * (avg + conMod);
    return { total: Math.max(1, level1 + restLevels), die, conMod, avg, level };
}

let _hpAutoSet = false;

function updateSuggestedHP() {
    const hint = document.getElementById('hpSuggest');
    if (!hint) return;
    const className = document.getElementById('charClass')?.value;
    const level = parseInt(document.getElementById('level')?.value) || 1;
    const conScore = parseInt(document.getElementById('con')?.value) || 10;
    const result = calcSuggestedHP(className, level, conScore);
    if (!result) { hint.style.display = 'none'; return; }
    const lang = getLang();
    const dStr = lang === 'de' ? `W${result.die}` : `d${result.die}`;
    const conStr = result.conMod >= 0 ? `+${result.conMod}` : `${result.conMod}`;
    hint.innerHTML = `<span>${lang === 'de' ? 'Vorschlag' : 'Suggested'}: <strong>${result.total}</strong></span><div class="hp-suggest-formula">${result.level}${dStr}${conStr}/Lvl</div>`;
    hint.style.display = 'block';
    const hpMax = document.getElementById('hpMax');
    const hpCurrent = document.getElementById('hpCurrent');
    if (hpMax && (!hpMax.value || _hpAutoSet)) {
        hpMax.value = result.total;
        _hpAutoSet = true;
        save();
    }
    updateHitDiceFields(className, level, result.die);
}

function updateHitDiceFields(className, level, die) {
    const hdCurrent = document.getElementById('hdCurrent');
    const hdMax = document.getElementById('hdMax');
    if (!hdCurrent || !hdMax || !die) return;
    const lang = getLang();
    const dStr = lang === 'de' ? `${level}W${die}` : `${level}d${die}`;
    if (!hdMax.value || hdMax.value === hdCurrent.value) {
        hdMax.value = dStr;
        hdCurrent.value = dStr;
    }
}

function onHpMaxInput() { _hpAutoSet = false; }

function applyHpSuggestion() {
    const className = document.getElementById('charClass')?.value;
    const level = parseInt(document.getElementById('level')?.value) || 1;
    const conScore = parseInt(document.getElementById('con')?.value) || 10;
    const result = calcSuggestedHP(className, level, conScore);
    if (!result) return;
    S.hp.max = result.total; S.hp.cur = result.total;
    _hpAutoSet = true;
    save();
    const lang = getLang();
    toast(lang === 'de' ? `HP auf ${result.total} gesetzt` : `HP set to ${result.total}`);
}

// ===== HP ROLL MODAL =====
let _hpRollData = [];

function openHpRollModal() {
    const className = document.getElementById('charClass')?.value;
    const level = parseInt(document.getElementById('level')?.value) || 1;
    const conScore = parseInt(document.getElementById('con')?.value) || 10;
    const die = HIT_DICE[className];
    if (!die) { toast('Bitte zuerst eine Klasse wählen'); return; }
    const conMod = Math.floor((conScore - 10) / 2);
    const avg = Math.floor(die / 2) + 1;
    const lang = getLang();
    const dStr = lang === 'de' ? `W${die}` : `d${die}`;
    document.getElementById('hpRollTitle').textContent = 'HP Berechnen';
    document.getElementById('hpRollSubtitle').textContent = `${className} - ${dStr} | CON ${conMod >= 0 ? '+' : ''}${conMod}`;
    _hpRollData = [];
    for (let i = 1; i <= level; i++) {
        const isLvl1 = i === 1;
        const baseVal = isLvl1 ? die : avg;
        _hpRollData.push({ level: i, dieRoll: baseVal, conMod, total: Math.max(1, baseVal + conMod), isAvg: !isLvl1, rolled: false });
    }
    renderHpRollLevels(die, lang);
    document.getElementById('hpRollOverlay').classList.add('active');
}

function renderHpRollLevels(die, lang) {
    const container = document.getElementById('hpRollLevels');
    const dStr = lang === 'de' ? `W${die}` : `d${die}`;
    container.innerHTML = _hpRollData.map((d, i) => {
        const conStr = d.conMod >= 0 ? `+${d.conMod}` : `${d.conMod}`;
        if (d.level === 1) {
            return `<div class="hp-roll-level level-1"><span class="hp-roll-lvl-num">1</span><span class="hp-roll-lvl-val">${d.total}</span><span class="hp-roll-lvl-detail">Max ${dStr} (${d.dieRoll}) ${conStr} CON</span><span style="font-size:9px;color:var(--md-on-surface-variant);opacity:0.5">Fest</span></div>`;
        }
        const btnLabel = d.rolled ? `Gewürfelt: ${d.dieRoll}` : 'Würfeln';
        const avgLabel = d.isAvg && !d.rolled ? ` (Durchschn. ${Math.floor(die/2)+1})` : '';
        return `<div class="hp-roll-level"><span class="hp-roll-lvl-num">${d.level}</span><span class="hp-roll-lvl-val">${d.total}</span><span class="hp-roll-lvl-detail">${d.rolled ? d.dieRoll : Math.floor(die/2)+1} ${conStr} CON${avgLabel}</span><button class="hp-roll-lvl-btn${d.rolled ? ' rolled' : ''}" onclick="rollHpLevel(${i}, ${die})">${btnLabel}</button></div>`;
    }).join('');
    document.getElementById('hpRollTotal').textContent = Math.max(1, _hpRollData.reduce((s, d) => s + d.total, 0));
}

function rollHpLevel(index, die) {
    if (index === 0) return;
    const roll = Math.floor(Math.random() * die) + 1;
    _hpRollData[index].dieRoll = roll;
    _hpRollData[index].total = Math.max(1, roll + _hpRollData[index].conMod);
    _hpRollData[index].isAvg = false;
    _hpRollData[index].rolled = true;
    renderHpRollLevels(die, getLang());
}

function applyHpRoll() {
    const totalHP = Math.max(1, _hpRollData.reduce((s, d) => s + d.total, 0));
    S.hp.max = totalHP; S.hp.cur = totalHP; render();
    _hpAutoSet = false;
    save();
    closeHpRollModal();
    toast(`HP auf ${totalHP} gesetzt`);
}

function closeHpRollModal() {
    document.getElementById('hpRollOverlay').classList.remove('active');
}


// ═══════════════════════════════════════════════════════
// WIZARD STATE
// ═══════════════════════════════════════════════════════
let wizardScrollY = 0;
let wizardStep = 1;
let wizardData = {
    name: '',
    level: 1,
    species: '',
    class: '',
    background: '',
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
};
let templates = []; // Wird später initialisiert

// SRD_TERMS_DE dictionary removed - language fixed
const SRD_TERMS_DE = {};

function getLang() { return "de"; }
function term(en) { return (typeof TERM_DE !== "undefined" && TERM_DE[en]) || en; }

const TERM_DE = {
    // Species
    'Human': 'Mensch', 'Elf': 'Elf', 'Dwarf': 'Zwerg', 'Halfling': 'Halbling',
    'Dragonborn': 'Drakonischblütiger', 'Tiefling': 'Tiefling', 'Gnome': 'Gnom',
    'Half-Orc': 'Halbork', 'Half-Elf': 'Halbelf', 'Orc': 'Ork', 'Aasimar': 'Aasimar', 'Goliath': 'Goliath',
    // Abilities
    'Strength': 'Stärke', 'Dexterity': 'Geschicklichkeit', 'Constitution': 'Konstitution',
    'Intelligence': 'Intelligenz', 'Wisdom': 'Weisheit', 'Charisma': 'Charisma',
    // Skills
    'Athletics': 'Athletik', 'Acrobatics': 'Akrobatik', 'Sleight of Hand': 'Fingerfertigkeit',
    'Stealth': 'Heimlichkeit', 'Arcana': 'Arkane Kunde', 'History': 'Geschichte',
    'Investigation': 'Nachforschungen', 'Nature': 'Naturkunde', 'Religion': 'Religion',
    'Animal Handling': 'Umgang mit Tieren', 'Insight': 'Motiv erkennen', 'Medicine': 'Heilkunde',
    'Perception': 'Wahrnehmung', 'Survival': 'Überleben', 'Deception': 'Täuschung',
    'Intimidation': 'Einschüchtern', 'Performance': 'Auftreten', 'Persuasion': 'Überreden',
    // UI Elements
    'Score': 'Wert', 'Saving Throw': 'Rettungswurf', 'Proficiency': 'Übung', 'Expertise': 'Expertise',
    'Weapons': 'Waffen', 'Weapon': 'Waffe', 'Cantrip': 'Zaubertrick', 'Cantrips': 'Zaubertricks',
    'Spell': 'Zauber', 'Spells': 'Zauber', 'Casting Time': 'Zauberzeit', 'Components': 'Komponenten', 'Unnamed Cantrip': 'Unbenannter Zaubertrick',
    'Select Subclass': 'Unterklasse wählen', 'Custom / Other': 'Eigene / Andere',
    'Passive Perception': 'Passive Wahrnehmung', 'Passive Perc.': 'Passiv Wahr.',
    'Passive Inv.': 'Passiv Unters.', 'Passive Ins.': 'Passiv Eins.',
    'Prof. Bonus': 'Übungsbonus', 'Heroic Insp.': 'Held. Insp.',
    'Ability Score': 'Attributswert', 'by Level': 'nach Stufe',
    // Subclasses - Barbarian
    'Path of the Berserker': 'Pfad des Berserkers', 'Path of the Wild Heart': 'Pfad des Wilden Herzens',
    'Path of the World Tree': 'Pfad des Weltenbaums', 'Path of the Zealot': 'Pfad des Zeloten',
    // Subclasses - Bard
    'College of Dance': 'Kolleg des Tanzes', 'College of Glamour': 'Kolleg des Glamours',
    'College of Lore': 'Kolleg der Kunde', 'College of the Moon': 'Kolleg des Mondes', 'College of Valor': 'Kolleg der Tapferkeit',
    // Subclasses - Cleric
    'Knowledge Domain': 'Domäne des Wissens', 'Life Domain': 'Domäne des Lebens',
    'Light Domain': 'Domäne des Lichts', 'Trickery Domain': 'Domäne der Täuschung', 'War Domain': 'Domäne des Krieges',
    // Subclasses - Druid
    'Circle of the Land': 'Kreis des Landes', 'Circle of the Moon': 'Kreis des Mondes',
    'Circle of the Sea': 'Kreis des Meeres', 'Circle of Stars': 'Kreis der Sterne',
    // Subclasses - Fighter
    'Banneret': 'Bannerherr', 'Battle Master': 'Kampfmeister', 'Champion': 'Champion',
    'Eldritch Knight': 'Eldritch-Ritter', 'Psi Warrior': 'Psi-Krieger',
    // Subclasses - Monk
    'Warrior of Mercy': 'Krieger der Gnade', 'Warrior of Shadow': 'Krieger des Schattens',
    'Warrior of the Elements': 'Krieger der Elemente', 'Warrior of the Open Hand': 'Krieger der Offenen Hand',
    // Subclasses - Paladin
    'Oath of Devotion': 'Eid der Hingabe', 'Oath of Glory': 'Eid des Ruhms',
    'Oath of Redemption': 'Eid der Erlösung', 'Oath of the Ancients': 'Eid der Alten', 'Oath of Vengeance': 'Eid der Rache',
    // Subclasses - Ranger
    'Beast Master': 'Tiermeister', 'Fey Wanderer': 'Feenwanderer', 'Gloom Stalker': 'Düsterjäger', 'Hunter': 'Jäger',
    // Subclasses - Rogue
    'Arcane Trickster': 'Arkaner Trickser', 'Assassin': 'Assassine', 'Mastermind': 'Meisterdenker',
    'Swashbuckler': 'Swashbuckler', 'Thief': 'Dieb',
    // Subclasses - Sorcerer
    'Aberrant Mind': 'Aberranter Geist', 'Clockwork Soul': 'Uhrwerk-Seele',
    'Draconic Bloodline': 'Drakonisches Blut', 'Wild Magic': 'Wilde Magie',
    // Subclasses - Warlock
    'The Archfey': 'Der Erz-Fey', 'The Celestial': 'Der Himmlische',
    'The Fiend': 'Der Unhold', 'The Great Old One': 'Der Große Alte',
    // Subclasses - Wizard
    'Abjuration': 'Bannmagie', 'Conjuration': 'Beschwörung', 'Divination': 'Wahrsagerei',
    'Enchantment': 'Verzauberung', 'Evocation': 'Hervorrufung', 'Illusion': 'Illusion',
    'Necromancy': 'Nekromantie', 'Transmutation': 'Verwandlung',
    // Subclasses - Artificer
    'Alchemist': 'Alchemist', 'Armorer': 'Rüstungsschmied', 'Artillerist': 'Artillerist', 'Battle Smith': 'Kampfschmied',
    // Weapon properties
    'Light': 'Leicht', 'Finesse': 'Finesse', 'Two-Handed': 'Zweihändig', 'Versatile': 'Vielseitig',
    'Thrown': 'Wurfwaffe', 'Reach': 'Reichweite', 'Heavy': 'Schwer', 'Loading': 'Laden',
    'Ammunition': 'Munition', 'Special': 'Spezial',
    // Damage types
    'bludgeoning': 'Wucht', 'piercing': 'Stich', 'slashing': 'Hieb',
    'fire': 'Feuer', 'cold': 'Kälte', 'lightning': 'Blitz', 'thunder': 'Donner',
    'acid': 'Säure', 'poison': 'Gift', 'necrotic': 'Nekrotisch', 'radiant': 'Strahlend',
    'psychic': 'Psychisch', 'force': 'Energie'
};
function term(en) { return TERM_DE[en] || en; }

// ═══════════════════════════════════════════════════════
// WIZARD FUNCTIONS
// ═══════════════════════════════════════════════════════
function openWizard() {
    wizardStep = 1;
    WizardDB.load(); // preload DB in background
    wizardData.name = '';
    wizardData.level = 1;
    wizardData.species = '';
    wizardData.class = '';
    wizardData.background = '';
    wizardData.selectedSkills = [];
    wizardData.selectedCantrips = [];
    wizardData.selectedSpells = [];
    wizardData.alignment = '';
    wizardData.physAge = ''; wizardData.physHeight = ''; wizardData.physEyes = '';
    wizardData.physHair = ''; wizardData.physSkin = ''; wizardData.physWeight = '';
    wizardData.appearance = '';
    wizardData.portraitData = null;
    wizardData.selectedFeats = [];
    wizardData.selectedEquipPackage = null;
    wizardData.str = 10; wizardData.dex = 10; wizardData.con = 10;
    wizardData.int = 10; wizardData.wis = 10; wizardData.cha = 10;
    document.getElementById('wizardName').value = '';
    document.getElementById('wizardLevel').value = 1;
    ['wizardStr','wizardDex','wizardCon','wizardInt','wizardWis','wizardCha'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = 10;
    });
    document.querySelectorAll('.wizard-option').forEach(o => o.classList.remove('selected'));
    const diceResult = document.getElementById('wizardDiceResult');
    if (diceResult) { diceResult.style.display = 'none'; diceResult.innerHTML = ''; }
    wizardRollsLeft = 3;
    const rollBtn = document.getElementById('wizardRollBtn');
    if (rollBtn) { rollBtn.textContent = '4W6 Würfeln (3)'; rollBtn.disabled = false; rollBtn.style.opacity = ''; rollBtn.style.cursor = ''; }
    const trail = document.getElementById('wizardTrail');
    if (trail) trail.innerHTML = '';
    const preview = document.getElementById('wizardNamePreview');
    if (preview) preview.classList.add('empty');
    const previewText = document.getElementById('wizardNamePreviewText');
    if (previewText) previewText.textContent = '...';
    updateWizardStep();
    document.getElementById('wizardModal').classList.add('active');
    wizardScrollY = window.scrollY;
    document.body.style.top = `-${wizardScrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('wizard-open');
}

function closeWizard() {
    document.getElementById('wizardModal').classList.remove('active');
    document.body.classList.remove('wizard-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, wizardScrollY);
}

let lastWizardStep = 1;

// Species icon map
const SPECIES_ICON = { 'Human':'/assets/img/species/human.svg','Elf':'/assets/img/species/elf.svg','Dwarf':'/assets/img/species/dwarf.svg','Halfling':'/assets/img/species/halfling.svg','Dragonborn':'/assets/img/species/dragonborn.svg','Tiefling':'/assets/img/species/tiefling.svg','Gnome':'/assets/img/species/gnome.svg','Half-Elf':'/assets/img/species/half-elf.svg','Half-Orc':'/assets/img/species/half-orc.svg','Orc':'/assets/img/species/orc.svg','Aasimar':'/assets/img/species/aasimar.svg','Goliath':'/assets/img/species/goliath.svg' };
const CLASS_ICON = { 'Barbarian':'/assets/icons/dnd/class/barbarian.svg','Bard':'/assets/icons/dnd/class/bard.svg','Cleric':'/assets/icons/dnd/class/cleric.svg','Druid':'/assets/icons/dnd/class/druid.svg','Fighter':'/assets/icons/dnd/class/fighter.svg','Monk':'/assets/icons/dnd/class/monk.svg','Paladin':'/assets/icons/dnd/class/paladin.svg','Ranger':'/assets/icons/dnd/class/ranger.svg','Rogue':'/assets/icons/dnd/class/rogue.svg','Sorcerer':'/assets/icons/dnd/class/sorcerer.svg','Warlock':'/assets/icons/dnd/class/warlock.svg','Wizard':'/assets/icons/dnd/class/wizard.svg' };
const BG_ICON = { 'Acolyte':'/assets/img/background/acolyte.svg','Criminal':'/assets/img/background/criminal.svg','Entertainer':'/assets/img/background/entertainer.svg','Folk Hero':'/assets/img/background/folk_hero.svg','Hermit':'/assets/img/background/hermit.svg','Noble':'/assets/img/background/noble.svg','Sage':'/assets/img/background/sage.svg','Soldier':'/assets/img/background/fighter.svg' };

// Primary stat per class
const CLASS_PRIMARY = { 'Barbarian':'str','Bard':'cha','Cleric':'wis','Druid':'wis','Fighter':'str','Monk':'dex','Paladin':'str','Ranger':'dex','Rogue':'dex','Sorcerer':'cha','Warlock':'cha','Wizard':'int' };

function updateWizardStep() {
    const direction = wizardStep > lastWizardStep ? 'right' : 'left';
    lastWizardStep = wizardStep;
    
    document.querySelectorAll('.wizard-step').forEach(s => {
        s.classList.remove('active', 'slide-in-right', 'slide-in-left');
    });
    const activeStep = document.querySelector(`.wizard-step[data-step="${wizardStep}"]`);
    activeStep.classList.add('active', `slide-in-${direction}`);
    
    document.querySelectorAll('.wizard-progress-step').forEach(s => {
        const step = parseInt(s.dataset.step);
        s.classList.remove('done', 'active');
        if (step < wizardStep) s.classList.add('done');
        if (step === wizardStep) s.classList.add('active');
    });
    
    document.getElementById('wizardBack').style.display = wizardStep > 1 ? '' : 'none';
    const lang = getLang();
    document.getElementById('wizardNext').textContent = wizardStep === 13
        ? (lang === 'de' ? 'Charakter erstellen' : 'Create Character')
        : (lang === 'de' ? 'Weiter' : 'Next');
    
    if (wizardStep === 4) populateWizardSubclass();
    if (wizardStep === 6 && wizardData.alignment) {
        document.querySelectorAll('.wizard-align-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.align === wizardData.alignment);
        });
    }
    if (wizardStep === 7) populateWizardAppearance();
    if (wizardStep === 8) updateWizardPrimaryStat();
    if (wizardStep === 9) { WizardDB.load().then(() => { populateWizardProficiencies(); populateWizardFeats(); }); }
    if (wizardStep === 10) populateWizardEquipment();
    if (wizardStep === 11) { WizardDB.load().then(() => populateWizardSpells()); }
    if (wizardStep === 13) populateWizardSummary();
    
    updateWizardTrail();
}

function updateWizardTrail() {
    const trail = document.getElementById('wizardTrail');
    if (!trail) return;
    let chips = '';
    const d = wizardData;
    if (d.name) chips += `<div class="wizard-trail-chip">${d.name}</div>`;
    if (d.species) chips += `<div class="wizard-trail-chip"><img src="${SPECIES_ICON[d.species] || ''}" alt="">${term(d.species)}</div>`;
    if (d.class) chips += `<div class="wizard-trail-chip"><img src="${CLASS_ICON[d.class] || ''}" alt="">${term(d.class)}</div>`;
    if (d.background) chips += `<div class="wizard-trail-chip"><img src="${BG_ICON[d.background] || ''}" alt="">${term(d.background)}</div>`;
    trail.innerHTML = chips;
}

function updateWizardNamePreview() {
    const name = document.getElementById('wizardName').value;
    const preview = document.getElementById('wizardNamePreview');
    const text = document.getElementById('wizardNamePreviewText');
    if (!preview || !text) return;
    text.textContent = name || '...';
    preview.classList.toggle('empty', !name);
}

function filterWizardClasses(role) {
    document.querySelectorAll('.wizard-role-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('#wizardClassOptions .wizard-option').forEach(opt => {
        if (role === 'all') { opt.style.display = ''; }
        else { opt.style.display = opt.dataset.role === role ? '' : 'none'; }
    });
}

function updateWizardPrimaryStat() {
    const primary = CLASS_PRIMARY[wizardData.class];
    const ids = ['wizardStr','wizardDex','wizardCon','wizardInt','wizardWis','wizardCha'];
    const abs = ['str','dex','con','int','wis','cha'];
    ids.forEach((id, i) => {
        const item = document.getElementById(id)?.closest('.wizard-ability-item');
        if (!item) return;
        item.classList.remove('primary-stat');
        const badge = item.querySelector('.wizard-ability-primary-badge');
        if (badge) badge.remove();
        if (abs[i] === primary) {
            item.classList.add('primary-stat');
            const b = document.createElement('div');
            b.className = 'wizard-ability-primary-badge';
            b.textContent = 'Primär';
            item.insertBefore(b, item.firstChild);
        }
    });
}

// ===== STEP 6: Appearance & Alignment =====
const ALIGNMENT_DESC = {
    'Rechtschaffen Gut':'Beschützer-Typ: Folgt einem Ehrenkodex und kämpft für das Wohl aller. Hält Versprechen, schützt die Schwachen.',
    'Neutral Gut':'Der klassische Held: Tut das Richtige, ohne sich an starre Regeln zu binden. Hilft, weil es richtig ist.',
    'Chaotisch Gut':'Der Rebell: Bricht Gesetze, wenn sie ungerecht sind. Freiheit und Güte über Ordnung.',
    'Rechtschaffen Neutral':'Richter-Typ: Das Gesetz ist das Gesetz. Pflicht und Ordnung über persönliche Vorlieben.',
    'Neutral':'Pragmatiker: Handelt nach der Situation. Weder gut noch böse, weder chaotisch noch ordentlich.',
    'Chaotisch Neutral':'Freigeist: Folgt nur den eigenen Launen. Unberechenbar, aber nicht bösartig.',
    'Rechtschaffen Böse':'Tyrann: Nutzt Regeln und Systeme für eigene Macht. Berechnend und manipulativ.',
    'Neutral Böse':'Söldner: Tut alles für den eigenen Vorteil. Kein Gewissen, aber auch kein sinnloses Chaos.',
    'Chaotisch Böse':'Zerstörer: Chaos und Grausamkeit als Selbstzweck. Schwer als Spielercharakter geeignet.'
};

function updateAlignmentDesc() {
    const val = document.getElementById('wizardAlignment')?.value;
    const desc = document.getElementById('wizardAlignmentDesc');
    if (desc) desc.textContent = ALIGNMENT_DESC[val] || '';
}

function selectWizardAlignment(el) {
    document.querySelectorAll('.wizard-align-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    wizardData.alignment = el.dataset.align;
    // Show selected indicator
    
    
}

// Height/Weight/Age as RANGES per species (min, max, step)
const SPECIES_RANGES = {
    'Human':      { age:[18,100,1], height:[150,200,1], weight:[50,120,1] },
    'Elf':        { age:[100,750,5], height:[145,190,1], weight:[45,80,1] },
    'Dwarf':      { age:[50,350,5], height:[120,150,1], weight:[55,90,1] },
    'Halfling':   { age:[20,150,1], height:[90,110,1], weight:[15,25,1] },
    'Gnome':      { age:[40,500,5], height:[90,120,1], weight:[18,30,1] },
    'Half-Elf':   { age:[20,180,1], height:[150,195,1], weight:[50,100,1] },
    'Half-Orc':   { age:[14,80,1], height:[170,220,1], weight:[75,140,1] },
    'Dragonborn': { age:[15,80,1], height:[180,230,1], weight:[100,160,1] },
    'Tiefling':   { age:[18,120,1], height:[145,190,1], weight:[50,90,1] },
    'Orc':        { age:[12,50,1], height:[175,205,1], weight:[90,140,1] },
    'Aasimar':    { age:[20,180,1], height:[150,200,1], weight:[50,110,1] },
    'Goliath':    { age:[18,100,1], height:[200,250,1], weight:[120,200,1] }
};

const SPECIES_PHYS = {
    'Human':     { eyes:['Braun','Blau','Grün','Grau','Haselnuss','Bernstein'], hair:['Schwarz','Dunkelbraun','Braun','Hellbraun','Blond','Rotblond','Rot','Grau','Weiß'], skin:['Sehr hell','Hell','Mittel','Olive','Bronze','Braun','Dunkelbraun'] },
    'Elf':       { eyes:['Bernstein','Blau','Grün','Gold','Silber','Violett','Türkis'], hair:['Silber','Gold','Platin','Schwarz','Kupfer','Weiß','Blau-Schwarz','Mondweiß'], skin:['Alabaster','Blass','Elfenbein','Bronze','Kupfer','Bläulich','Obsidian (Drow)'] },
    'Dwarf':     { eyes:['Braun','Dunkelbraun','Bernstein','Grau','Blau','Schwarz'], hair:['Rot','Kupferrot','Braun','Schwarz','Grau','Weiß','Dunkelbraun','Rostrot'], skin:['Hell','Braun','Dunkelbraun','Grau','Rötlich','Erdfarben'] },
    'Halfling':  { eyes:['Braun','Grün','Haselnuss','Blau','Bernstein'], hair:['Braun','Sandy','Lockig Rot','Schwarz','Kastanie','Kupfer'], skin:['Hell','Warm','Gebräunt','Blass','Pfirsich'] },
    'Dragonborn':{ eyes:['Rot','Gold','Grün','Blau','Weiß','Bernstein','Schwarz','Orange','Silber'], hair:['— (keine)','Hornkamm','Stacheln','Kurze Hörner'], skin:['Rote Schuppen','Blaue Schuppen','Grüne Schuppen','Schwarze Schuppen','Weiße Schuppen','Goldene Schuppen','Silberne Schuppen','Bronze-Schuppen','Kupfer-Schuppen','Messing-Schuppen'] },
    'Tiefling':  { eyes:['Gold (einfarbig)','Silber (einfarbig)','Rot (einfarbig)','Schwarz (einfarbig)','Weiß (einfarbig)','Kupfer (einfarbig)','Violett (einfarbig)'], hair:['Schwarz','Dunkelrot','Dunkelblau','Dunkelviolett','Kastanie','Burgunder','Weiß'], skin:['Rot','Karmesinrot','Violett','Blau','Lavendel','Menschlich-Hell','Menschlich-Dunkel'] },
    'Gnome':     { eyes:['Blau','Grün','Braun','Funkelnd-Grün','Leuchtend-Blau','Bernstein'], hair:['Weiß','Blond','Braun','Rot','Orange','Grün','Silber-Weiß'], skin:['Dunkelbraun','Holzig','Blass','Rötlich','Nussbraun','Erdfarben'] },
    'Half-Elf':  { eyes:['Braun','Blau','Grün','Bernstein','Violett','Silber','Haselnuss'], hair:['Schwarz','Braun','Blond','Silber','Kupfer','Rot','Weiß-Silber'], skin:['Blass','Hell','Warm','Bronze','Olive','Elfenbein'] },
    'Half-Orc':  { eyes:['Braun','Grau','Rot','Bernstein','Grün','Gelb'], hair:['Schwarz','Dunkelbraun','Grau','Kein Haar'], skin:['Grünlich','Gräulich','Grünlich-Braun','Grau','Oliv-Grün'] },
    'Orc':       { eyes:['Rot','Braun','Bernstein','Grau','Gelb','Schwarz'], hair:['Schwarz','Braun','Grau','Kein Haar','Dunkelrot'], skin:['Grau','Grün','Dunkelgrün','Braun-Grün','Grau-Braun'] },
    'Aasimar':   { eyes:['Gold (leuchtend)','Silber (leuchtend)','Weiß (leuchtend)','Topaz','Opal','Pupillenlos-Weiß'], hair:['Silber','Gold','Weiß','Schwarz','Kupfer','Platin'], skin:['Leuchtend-Hell','Golden','Silbrig','Blass','Bronze','Warm-Braun'] },
    'Goliath':   { eyes:['Blau','Grau','Braun','Grün','Schwarz'], hair:['Schwarz','Dunkelbraun','— (kahl)','Weiß','Grau'], skin:['Steingrau','Braun-Grau','Grau-Blau','Felsbraun','Schiefergrau','Granit'] }
};

function generateRangeOptions(min, max, step, unit) {
    const opts = [];
    for (let v = min; v <= max; v += step) opts.push(v);
    return opts.map(v => `${v} ${unit}`);
}

function populateWizardAppearance() {
    const spec = wizardData.species || 'Human';
    const phys = SPECIES_PHYS[spec] || SPECIES_PHYS['Human'];
    const ranges = SPECIES_RANGES[spec] || SPECIES_RANGES['Human'];
    
    // Build range-based options
    const ageOpts = generateRangeOptions(ranges.age[0], ranges.age[1], ranges.age[2], 'Jahre');
    const heightOpts = generateRangeOptions(ranges.height[0], ranges.height[1], ranges.height[2], 'cm');
    const weightOpts = generateRangeOptions(ranges.weight[0], ranges.weight[1], ranges.weight[2], 'kg');
    
    const fieldsMap = {
        'Age': ageOpts, 'Height': heightOpts, 'Weight': weightOpts,
        'Eyes': phys.eyes || [], 'Hair': phys.hair || [], 'Skin': phys.skin || []
    };
    
    Object.entries(fieldsMap).forEach(([field, options]) => {
        const sel = document.getElementById('wizardPhys' + field);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">— Wählen —</option>';
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            if (opt === current) o.selected = true;
            sel.appendChild(o);
        });
    });
}

// ===== STEP 9: Spells & Cantrips =====
const CLASS_FEATS_LEGACY = {
    'Barbarian': [
        { name:'Großwaffenmeister', desc:'Schwere Waffe: -5 Angriff, +10 Schaden' },
        { name:'Zäher Kerl', desc:'+2 KON (max 20), Trefferwürfel heilen min. 2×KON-Mod' },
        { name:'Sentinel', desc:'Reaktion: Angriff wenn Feind Verbündeten angreift' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' }
    ],
    'Bard': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration, Schilde-Zauber' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag: Würfe wiederholen' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Schauspieler', desc:'+1 CHA, perfekte Mimik, Vorteil auf Täuschung' }
    ],
    'Cleric': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Zäher Kerl', desc:'+2 KON, bessere Trefferwürfel-Heilung' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag: Würfe wiederholen' }
    ],
    'Druid': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Sentinel', desc:'Reaktion: Angriff wenn Feind Verbündeten angreift' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' }
    ],
    'Fighter': [
        { name:'Großwaffenmeister', desc:'Schwere Waffe: -5 Angriff, +10 Schaden' },
        { name:'Scharfschütze', desc:'Fernkampf: -5 Angriff, +10 Schaden' },
        { name:'Sentinel', desc:'Reaktion: Angriff wenn Feind Verbündeten angreift' },
        { name:'Schildmeister', desc:'Bonus-Aktion: Schild-Stoß, +1 RK als Reaktion' }
    ],
    'Monk': [
        { name:'Mobil', desc:'+10ft Bewegung, kein Gelegenheitsangriff nach Nahkampf' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Zäher Kerl', desc:'+2 KON, bessere Trefferwürfel-Heilung' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' }
    ],
    'Paladin': [
        { name:'Großwaffenmeister', desc:'Schwere Waffe: -5 Angriff, +10 Schaden' },
        { name:'Sentinel', desc:'Reaktion: Angriff wenn Feind Verbündeten angreift' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Zäher Kerl', desc:'+2 KON, bessere Trefferwürfel-Heilung' }
    ],
    'Ranger': [
        { name:'Scharfschütze', desc:'Fernkampf: -5 Angriff, +10 Schaden' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' }
    ],
    'Rogue': [
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Mobil', desc:'+10ft Bewegung, kein Gelegenheitsangriff nach Nahkampf' },
        { name:'Scharfschütze', desc:'Fernkampf: -5 Angriff, +10 Schaden' }
    ],
    'Sorcerer': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Metamagie-Adept', desc:'2 zusätzliche Zauberpunkte, 2 Metamagie-Optionen' }
    ],
    'Warlock': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Schauspieler', desc:'+1 CHA, perfekte Mimik' }
    ],
    'Wizard': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Zäher Kerl', desc:'+2 KON, bessere Trefferwürfel-Heilung' }
    ],
    'Artificer': [
        { name:'Kriegszauberer', desc:'Vorteil auf KON-Rettung für Konzentration' },
        { name:'Glück', desc:'3 Glückspunkte pro Tag' },
        { name:'Zäher Kerl', desc:'+2 KON, bessere Trefferwürfel-Heilung' },
        { name:'Wachsam', desc:'+5 Initiative, kein Überraschungs-Nachteil' }
    ]
};

// ===== STEP 9: Equipment Choice =====
// Each class gets 2-3 complete starting packages
function getEquipPackages(cls, strMod, dexMod) {
    const prof = Math.max(Math.floor(((wizardData.level||1)-1)/4)+2, 2);
    const sm = strMod + prof;
    const dm = dexMod + prof;
    const P = {
    'Barbarian': [
        { id:'A', label:'Großaxt & Wurfspieße', desc:'Schwerer Nahkampf mit Fernkampf-Option',
          tip:'Empfohlen für Anfänger. 1W12 ist der höchste einzelne Schadenswürfel im Spiel. Wurfspieße geben dir Fernkampf-Optionen wenn du nicht in Nahkampfreichweite bist. Barbarische Verteidigung (10+GES+KON) wird mit guten Werten überraschend stark.',
          weapons:[{name:'Großaxt',bonus:`+${sm}`,damage:`1W12+${strMod}`,notes:'Schwer, Zweihand'},{name:'Wurfspieß (×4)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Wurf 9/36 m'}],
          armor:'Keine (Barbarische Verteidigung)', ac:10+dexMod+Math.floor(((wizardData.con||10)-10)/2), shield:'',
          equipment:'Großaxt, 4 Wurfspieße, Abenteurerpaket' },
        { id:'B', label:'Zweihand & Handäxte', desc:'Vielseitig mit Wurfwaffen',
          tip:'2W6 hat einen höheren Durchschnitt (7) als 1W12 (6.5) und weniger Schwankung — du triffst konstanter hart. Handäxte sind Wurfwaffen UND Nahkampfwaffen, sehr flexibel. Gut wenn du gerne planst statt auf Glück zu setzen.',
          weapons:[{name:'Zweihandschwert',bonus:`+${sm}`,damage:`2W6+${strMod}`,notes:'Schwer, Zweihand'},{name:'Handaxt (×2)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Leicht, Wurf 6/18 m'}],
          armor:'Keine (Barbarische Verteidigung)', ac:10+dexMod+Math.floor(((wizardData.con||10)-10)/2), shield:'',
          equipment:'Zweihandschwert, 2 Handäxte, Abenteurerpaket' }
    ],
    'Bard': [
        { id:'A', label:'Rapier & Dolch', desc:'Eleganter Fechter',
          tip:'Empfohlen. Der Rapier ist die beste Finesse-Einhandwaffe (1W8). Als Barde castest du hauptsächlich Zauber, aber wenn ein Feind in Nahkampfreichweite kommt, hast du eine solide Antwort. Der Dolch ist Notfall-Backup und Wurfoption.',
          weapons:[{name:'Rapier',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Finesse'},{name:'Dolch',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Rapier, Dolch, Lederrüstung, Diplomatenpaket, Laute' },
        { id:'B', label:'Langschwert & Dolch', desc:'Kampforientierter Barde',
          tip:'Nur wenn du STR statt GES fokussierst — ungewöhnlich für einen Barden. Das Langschwert nutzt STR, nicht GES. Die meisten Barden fahren mit Paket A besser, da GES auch Initiative und häufige Rettungswürfe verbessert.',
          weapons:[{name:'Langschwert',bonus:`+${sm}`,damage:`1W8+${strMod}`,notes:'Vielseitig (1W10)'},{name:'Dolch',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Langschwert, Dolch, Lederrüstung, Unterhaltungspaket, Laute' }
    ],
    'Cleric': [
        { id:'A', label:'Streitkolben & Schild (Kettenhemd)', desc:'Schwer gepanzert, klassischer Kleriker',
          tip:'Empfohlen für Anfänger. RK 18 macht dich zum zweitbesten Tank nach dem Fighter. Du stehst vorne, heilst die Gruppe, und wirst dabei kaum getroffen. Die Armbrust ist für Runden wo du keinen Zauber brauchst.',
          weapons:[{name:'Streitkolben',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:''},{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'}],
          armor:'Kettenhemd + Schild', ac:18, shield:'+2',
          equipment:'Kettenhemd, Schild, Streitkolben, Leichte Armbrust, 20 Bolzen, Heiliges Symbol, Priesterpaket' },
        { id:'B', label:'Kriegshammer & Schild (Schuppenpanzer)', desc:'Mittlere Rüstung, vielseitig',
          tip:'Etwas weniger RK (16 statt 18), aber der Kriegshammer kann mit zwei Händen geführt werden (1W10 statt 1W6). Gut wenn du lieber Schaden machst als RK zu maximieren. Der Schuppenpanzer gibt Nachteil auf Heimlichkeit — für die meisten Kleriker egal.',
          weapons:[{name:'Kriegshammer',bonus:`+${sm}`,damage:`1W8+${strMod}`,notes:'Vielseitig (1W10)'},{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'}],
          armor:'Schuppenpanzer + Schild', ac:16, shield:'+2',
          equipment:'Schuppenpanzer, Schild, Kriegshammer, Leichte Armbrust, 20 Bolzen, Heiliges Symbol, Priesterpaket' }
    ],
    'Druid': [
        { id:'A', label:'Kampfstab & Schild', desc:'Klassischer Druide mit Schutz',
          tip:'Empfohlen. Der Kampfstab dient auch als Druidischer Fokus. Schild gibt +2 RK. Druiden kämpfen selten im Nahkampf — du nutzt Wildform oder Zauber. Der Stab ist für Notfälle.',
          weapons:[{name:'Kampfstab',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Vielseitig (1W8)'}],
          armor:'Lederrüstung + Schild', ac:13+dexMod, shield:'+2',
          equipment:'Kampfstab, Lederrüstung, Schild, Druidischer Fokus, Forschungspaket, Kräuterkundeausrüstung' },
        { id:'B', label:'Krummsäbel & Schild', desc:'Kampforientierter Druide',
          tip:'Finesse-Waffe, nutzt GES statt STR. Gut wenn du hohe GES hast und gelegentlich zuschlagen willst. Der Unterschied zum Kampfstab ist minimal — nimm was dir thematisch besser gefällt.',
          weapons:[{name:'Krummsäbel',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'}],
          armor:'Lederrüstung + Schild', ac:13+dexMod, shield:'+2',
          equipment:'Krummsäbel, Lederrüstung, Schild, Druidischer Fokus, Forschungspaket, Kräuterkundeausrüstung' }
    ],
    'Fighter': [
        { id:'A', label:'Langschwert & Schild (Kettenhemd)', desc:'Klassischer Tank — hohe RK',
          tip:'Empfohlen für Anfänger. RK 18 ist das Maximum auf Stufe 1. Die meisten Monster brauchen 15+ um dich zu treffen. Fehler in der Positionierung werden verziehen. Langschwert + Armbrust deckt Nah- und Fernkampf ab.',
          weapons:[{name:'Langschwert',bonus:`+${sm}`,damage:`1W8+${strMod}`,notes:'Vielseitig (1W10)'},{name:'Handaxt (×2)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Leicht, Wurf 6/18 m'},{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'}],
          armor:'Kettenhemd + Schild', ac:18, shield:'+2',
          equipment:'Kettenhemd, Schild, Langschwert, 2 Handäxte, Leichte Armbrust, 20 Bolzen, Abenteurerpaket' },
        { id:'B', label:'Zweihandschwert (Kettenhemd)', desc:'Maximaler Schaden, kein Schild',
          tip:'2W6 Schaden (Ø 7) statt 1W8 (Ø 4.5) — 50% mehr Schaden pro Treffer. Aber 2 RK weniger bedeutet ~10% häufiger getroffen. Gut wenn jemand anders tankt oder Kämpfe schnell vorbei sein sollen.',
          weapons:[{name:'Zweihandschwert',bonus:`+${sm}`,damage:`2W6+${strMod}`,notes:'Schwer, Zweihand'},{name:'Handaxt (×2)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Leicht, Wurf 6/18 m'}],
          armor:'Kettenhemd', ac:16, shield:'',
          equipment:'Kettenhemd, Zweihandschwert, 2 Handäxte, Abenteurerpaket' },
        { id:'C', label:'Langbogen (Lederrüstung)', desc:'Geschicklichkeits-Kämpfer, Fernkampf',
          tip:'GES-basierter Fighter — ungewöhnlich aber effektiv. 45m Reichweite hält dich aus Gefahr. Braucht einen Tank im Team (Paladin, Barbarian). Niedrige RK ist riskant wenn Feinde zu dir kommen. Kampfstil Bogenschießen (+2) empfohlen.',
          weapons:[{name:'Langbogen',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Schwer, Zweihand, 45/180 m'},{name:'Kurzschwert (×2)',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Lederrüstung, Langbogen, 20 Pfeile, 2 Kurzschwerter, Abenteurerpaket' }
    ],
    'Monk': [
        { id:'A', label:'Kurzschwert & Wurfpfeile', desc:'Standard-Mönch',
          tip:'Empfohlen. Das Kurzschwert nutzt GES (Finesse) und ist deine stärkste Waffe bis Kampfkunst-Würfel aufholen. Wurfpfeile für Fernkampf. Mönche brauchen keine Rüstung — Mönchsverteidigung (10+GES+WEI) skaliert mit deinen Hauptattributen.',
          weapons:[{name:'Kurzschwert',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'},{name:'Wurfpfeil (×10)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Wurf 6/18 m'}],
          armor:'Keine (Mönchsverteidigung)', ac:10+dexMod+Math.floor(((wizardData.wis||10)-10)/2), shield:'',
          equipment:'Kurzschwert, 10 Wurfpfeile, Abenteurerpaket' },
        { id:'B', label:'Kampfstab & Wurfpfeile', desc:'Vielseitig mit höherem Schaden',
          tip:'Der Kampfstab kann als Mönchswaffe mit GES genutzt werden und hat Vielseitig (1W8 zweihändig). Leicht mehr Schaden als das Kurzschwert, aber du kannst keinen Bonus-Angriff mit einer Leichten Waffe machen. Gut ab Stufe 2 wenn Kampfkunst das übernimmt.',
          weapons:[{name:'Kampfstab',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Vielseitig (1W8)'},{name:'Wurfpfeil (×10)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Wurf 6/18 m'}],
          armor:'Keine (Mönchsverteidigung)', ac:10+dexMod+Math.floor(((wizardData.wis||10)-10)/2), shield:'',
          equipment:'Kampfstab, 10 Wurfpfeile, Dungeoneerpaket' }
    ],
    'Paladin': [
        { id:'A', label:'Langschwert & Schild (Kettenhemd)', desc:'Klassischer Paladin — Tank',
          tip:'Empfohlen. RK 18 + Göttliche Heilung + Handauflegen macht dich quasi unzerstörbar auf Stufe 1. Wurfspieße für Fernkampf. Paladine stehen vorne und beschützen die Gruppe — diese Ausrüstung unterstützt das perfekt.',
          weapons:[{name:'Langschwert',bonus:`+${sm}`,damage:`1W8+${strMod}`,notes:'Vielseitig (1W10)'},{name:'Wurfspieß (×5)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Wurf 9/36 m'}],
          armor:'Kettenhemd + Schild', ac:18, shield:'+2',
          equipment:'Kettenhemd, Schild, Langschwert, 5 Wurfspieße, Heiliges Symbol, Priesterpaket' },
        { id:'B', label:'Zweihand-Paladin (Kettenhemd)', desc:'Göttlicher Vergelter — mehr Schaden',
          tip:'Göttliches Niederstrecken + 2W6 Basisschaden = massive Burst-Schaden-Kombination. Du opferst 2 RK für deutlich mehr Offensivkraft. Funktioniert besonders gut wenn ein anderer Charakter (Kleriker, Fighter) die Tank-Rolle übernimmt.',
          weapons:[{name:'Zweihandschwert',bonus:`+${sm}`,damage:`2W6+${strMod}`,notes:'Schwer, Zweihand'},{name:'Wurfspieß (×5)',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Wurf 9/36 m'}],
          armor:'Kettenhemd', ac:16, shield:'',
          equipment:'Kettenhemd, Zweihandschwert, 5 Wurfspieße, Heiliges Symbol, Priesterpaket' }
    ],
    'Ranger': [
        { id:'A', label:'Langbogen & Kurzschwerter (Schuppenpanzer)', desc:'Klassischer Waldläufer',
          tip:'Empfohlen. Beste Balance aus Schutz und Angriff. Schuppenpanzer gibt solide RK, Langbogen hält Distanz, Kurzschwerter für Nahkampf. Nachteil auf Heimlichkeit durch Schuppenpanzer ist der Nachteil — aber RK ist wichtiger für Überleben.',
          weapons:[{name:'Langbogen',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Schwer, Zweihand, 45/180 m'},{name:'Kurzschwert (×2)',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'}],
          armor:'Schuppenpanzer', ac:Math.min(14+dexMod,16), shield:'',
          equipment:'Schuppenpanzer, 2 Kurzschwerter, Langbogen, 20 Pfeile, Abenteurerpaket' },
        { id:'B', label:'Langbogen & Kurzschwerter (Leder)', desc:'Beweglicher Waldläufer',
          tip:'Weniger RK, aber kein Nachteil auf Heimlichkeit. Perfekt wenn deine Gruppe viel schleicht oder du einen Erkundungs-fokussierten Charakter spielst. Bei GES 16+ ist der RK-Unterschied zum Schuppenpanzer nur 1 Punkt.',
          weapons:[{name:'Langbogen',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Schwer, Zweihand, 45/180 m'},{name:'Kurzschwert (×2)',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Lederrüstung, 2 Kurzschwerter, Langbogen, 20 Pfeile, Abenteurerpaket' }
    ],
    'Rogue': [
        { id:'A', label:'Rapier & Kurzbogen', desc:'Finesse-Schurke mit Fernkampf',
          tip:'Empfohlen. Der Rapier ist die stärkste Finesse-Waffe (1W8 + Hinterhältiger Angriff). Kurzbogen für sicheren Fernkampf — Schurken sind fragil und wollen nicht im Zentrum des Kampfes stehen. Dolche als Notfall und Wurfoption.',
          weapons:[{name:'Rapier',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Finesse'},{name:'Kurzbogen',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Mun., Zweihand, 24/96 m'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Rapier, Kurzbogen, 20 Pfeile, 2 Dolche, Lederrüstung, Diebeswerkzeug, Einbrecherpaket' },
        { id:'B', label:'Kurzschwerter & Dolche', desc:'Doppelklingen-Schurke',
          tip:'Zwei Kurzschwerter ermöglichen Bonus-Angriff mit der Zweithand (ohne GES-Mod auf Schaden). Gibt dir zwei Chancen pro Runde, Hinterhältigen Angriff auszulösen. Kein Fernkampf — riskanter, aber offensiv stärker wenn du im Nahkampf bleibst.',
          weapons:[{name:'Kurzschwert',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'},{name:'Kurzschwert',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'2 Kurzschwerter, 2 Dolche, Lederrüstung, Diebeswerkzeug, Dungeoneerpaket' }
    ],
    'Sorcerer': [
        { id:'A', label:'Leichte Armbrust & Dolche', desc:'Standard-Zauberer mit Fernkampf',
          tip:'Empfohlen. Die Armbrust ist dein Backup wenn Zauberplätze aufgebraucht sind — auf Stufe 1 passiert das schnell (nur 2 Plätze). 1W8 Schaden ist besser als die meisten Zaubertricks. Dolche als letzte Notlösung.',
          weapons:[{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Keine', ac:10+dexMod, shield:'',
          equipment:'Leichte Armbrust, 20 Bolzen, 2 Dolche, Arkanischer Fokus, Dungeoneerpaket' },
        { id:'B', label:'Kampfstab & Dolche', desc:'Nahkampf-Zauberer',
          tip:'Nur sinnvoll wenn du vorhast, hauptsächlich Zaubertricks (Feuerblitz etc.) zu nutzen und der Kampfstab rein thematisch ist. Die Armbrust aus Paket A ist fast immer die bessere Waffe. Nimm das hier nur für Rollenspiel-Gründe.',
          weapons:[{name:'Kampfstab',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Vielseitig (1W8)'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Keine', ac:10+dexMod, shield:'',
          equipment:'Kampfstab, 2 Dolche, Arkanischer Fokus, Abenteurerpaket' }
    ],
    'Warlock': [
        { id:'A', label:'Leichte Armbrust & Dolche', desc:'Fernkampf-Hexenmeister',
          tip:'Empfohlen. Warlocks haben Schauriger Strahl als Haupt-Zaubertrick, aber die Armbrust ist gutes Backup. Lederrüstung gibt Basis-Schutz. Warlocks sind Fernkämpfer — halte Abstand und nutze Eldritch Blast.',
          weapons:[{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Leichte Armbrust, 20 Bolzen, 2 Dolche, Lederrüstung, Arkanischer Fokus, Gelehrtenpaket' },
        { id:'B', label:'Kurzschwerter & Dolche', desc:'Paktklingen-Hexenmeister',
          tip:'Nur für Pakt der Klinge (Stufe 3). Auf Stufe 1 bist du damit ein schlechter Nahkämpfer. Ab Stufe 3 ersetzt die Paktwaffe eh alles. Paket A ist auf Stufe 1 fast immer besser — sei geduldig.',
          weapons:[{name:'Kurzschwert',bonus:`+${dm}`,damage:`1W6+${dexMod}`,notes:'Finesse, Leicht'},{name:'Dolch (×2)',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Lederrüstung', ac:11+dexMod, shield:'',
          equipment:'Kurzschwert, 2 Dolche, Lederrüstung, Arkanischer Fokus, Dungeoneerpaket' }
    ],
    'Wizard': [
        { id:'A', label:'Kampfstab & Gelehrtenpaket', desc:'Standard-Magier',
          tip:'Empfohlen. Der Kampfstab kann als Arkanischer Fokus dienen und macht 1W6/1W8 Schaden im Notfall. Das Gelehrtenpaket enthält Tinte und Papier — wichtig für Magier, die neue Zauber in ihr Buch kopieren wollen.',
          weapons:[{name:'Kampfstab',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Vielseitig (1W8)'}],
          armor:'Keine', ac:10+dexMod, shield:'',
          equipment:'Kampfstab, Arkanischer Fokus, Gelehrtenpaket, Zauberbuch' },
        { id:'B', label:'Dolch & Abenteurerpaket', desc:'Leichtfüßiger Magier',
          tip:'Der Dolch hat Finesse (nutzt GES) und kann geworfen werden. Der Komponentenbeutel ersetzt den Fokus. Das Abenteurerpaket ist universeller. Nimm das wenn du keinen Kampfstab-Magier spielen willst — mechanisch kaum Unterschied.',
          weapons:[{name:'Dolch',bonus:`+${dm}`,damage:`1W4+${dexMod}`,notes:'Finesse, Leicht, Wurf 6/18 m'}],
          armor:'Keine', ac:10+dexMod, shield:'',
          equipment:'Dolch, Komponentenbeutel, Abenteurerpaket, Zauberbuch' }
    ],
    'Artificer': [
        { id:'A', label:'Armbrust & Schild', desc:'Standard-Konstrukteur',
          tip:'Empfohlen. Beschlagenes Leder + Schild gibt solide RK. Die Armbrust ist effektiv mit INT-Fokus (du benutzt eh hauptsächlich Zauber und Infusionen). Diebes- und Bastlerwerkzeug brauchst du für Klassen-Features.',
          weapons:[{name:'Leichte Armbrust',bonus:`+${dm}`,damage:`1W8+${dexMod}`,notes:'Mun., Laden, Zweihand, 24/96 m'}],
          armor:'Beschlagenes Leder + Schild', ac:14+Math.min(dexMod,2), shield:'+2',
          equipment:'Leichte Armbrust, 20 Bolzen, Beschlagenes Leder, Schild, Diebeswerkzeug, Bastlerwerkzeug, Dungeoneerpaket' },
        { id:'B', label:'Kampfstab & Schild', desc:'Nahkampf-Konstrukteur',
          tip:'Für Artificer die gerne vorne stehen — besonders mit der Unterklasse Kampfschmied (ab Stufe 3). Gleiche RK wie Paket A, aber Nahkampf statt Fernkampf. Der Kampfstab kann später mit Infusionen verstärkt werden.',
          weapons:[{name:'Kampfstab',bonus:`+${sm}`,damage:`1W6+${strMod}`,notes:'Vielseitig (1W8)'}],
          armor:'Beschlagenes Leder + Schild', ac:14+Math.min(dexMod,2), shield:'+2',
          equipment:'Kampfstab, Beschlagenes Leder, Schild, Diebeswerkzeug, Bastlerwerkzeug, Dungeoneerpaket' }
    ]
    };
    return P[cls] || [];
}

function populateWizardEquipment() {
    const cls = wizardData.class || '';
    const strMod = Math.floor(((wizardData.str||10)-10)/2);
    const dexMod = Math.floor(((wizardData.dex||10)-10)/2);
    const packages = getEquipPackages(cls, strMod, dexMod);
    const container = document.getElementById('wizardEquipPackages');
    if (!container) return;
    
    if (!packages.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px 0;opacity:0.5;">Keine Ausrüstungspakete für diese Klasse.</div>';
        return;
    }
    
    const selected = wizardData.selectedEquipPackage || packages[0].id;
    
    // Weapon name → icon mapping
    const wIco = (name) => {
        const n = name.toLowerCase();
        if (n.includes('schwert') || n.includes('rapier')) return 'sword';
        if (n.includes('bogen') || n.includes('langbogen')) return 'bow';
        if (n.includes('armbrust')) return 'crossbow';
        if (n.includes('axt') || n.includes('handaxt')) return 'handaxe';
        if (n.includes('großaxt') || n.includes('streitaxt')) return 'battleaxe';
        if (n.includes('dolch')) return 'dagger';
        if (n.includes('spieß') || n.includes('speer') || n.includes('wurfspeer')) return 'spear';
        if (n.includes('stab') || n.includes('kampfstab')) return 'staff';
        if (n.includes('kolben') || n.includes('streitkolben')) return 'mace';
        if (n.includes('hammer')) return 'hammer';
        if (n.includes('pfeil') || n.includes('wurf')) return 'arrow';
        if (n.includes('schlag') || n.includes('unbewaffnet')) return 'strike';
        return 'sword';
    };
    
    container.innerHTML = packages.map(pkg => {
        const isSel = pkg.id === selected;
        const weaponLines = pkg.weapons.map(w => 
            `<div class="wizard-equip-weapon"><img src="/assets/icons/dnd/weapon/${wIco(w.name)}.svg" style="width:14px;height:14px;filter:brightness(0) invert(1);opacity:0.6;" onerror="this.style.display='none'"><span class="weq-name">${w.name}</span><span class="weq-stats">${w.bonus} / ${w.damage}</span></div>`
        ).join('');
        
        return `<div class="wizard-equip-package${isSel ? ' selected' : ''}" data-pkg="${pkg.id}" onclick="selectEquipPackage('${pkg.id}')">
            <div class="wizard-equip-pkg-header">
                <div class="wizard-equip-pkg-radio">${isSel ? '<div class="radio-fill"></div>' : ''}</div>
                <div style="flex:1;">
                    <div class="wizard-equip-pkg-label">${pkg.label}</div>
                    <div class="wizard-equip-pkg-desc">${pkg.desc}</div>
                </div>
                ${pkg.tip ? `<div class="wizard-equip-tip" onclick="event.stopPropagation();toggleEquipTip(this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div class="wizard-equip-tip-bubble">${pkg.tip}</div>
                </div>` : ''}
                <div class="wizard-equip-pkg-ac">
                    <div style="font-size:18px;font-weight:800;color:var(--md-primary);">${pkg.ac}</div>
                    <div style="font-size:8px;text-transform:uppercase;opacity:0.5;">RK</div>
                </div>
            </div>
            <div class="wizard-equip-pkg-weapons">${weaponLines}</div>
            <div class="wizard-equip-pkg-armor">${pkg.armor}</div>
            <div class="wizard-equip-pkg-gear">${pkg.equipment}</div>
        </div>`;
    }).join('');
    
    // Auto-select first if none selected
    if (!wizardData.selectedEquipPackage) wizardData.selectedEquipPackage = packages[0].id;
}

function selectEquipPackage(id) {
    wizardData.selectedEquipPackage = id;
    document.querySelectorAll('.wizard-equip-package').forEach(el => {
        const isSel = el.dataset.pkg === id;
        el.classList.toggle('selected', isSel);
        const radio = el.querySelector('.wizard-equip-pkg-radio');
        if (radio) radio.innerHTML = isSel ? '<div class="radio-fill"></div>' : '';
    });
}

function toggleEquipTip(el) {
    const bubble = el.querySelector('.wizard-equip-tip-bubble');
    if (!bubble) return;
    const isOpen = bubble.classList.contains('show');
    // Close all other tips
    document.querySelectorAll('.wizard-equip-tip-bubble.show').forEach(b => b.classList.remove('show'));
    if (!isOpen) bubble.classList.add('show');
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.wizard-equip-tip')) {
        document.querySelectorAll('.wizard-equip-tip-bubble.show').forEach(b => b.classList.remove('show'));
    }
});

function populateWizardFeats() {
    const grid = document.getElementById('wizardFeatGrid');
    if (!grid) return;

    const allFeats = WizardDB.getFeats();
    if (!allFeats.length) {
        grid.innerHTML = '<div style="text-align:center;padding:30px 0;opacity:0.5">Feats werden geladen…</div>';
        return;
    }

    // General feats + feats whose prerequisite doesn't hard-require another class
    const displayFeats = allFeats.filter(f => {
        const cat = (f.category || '').toLowerCase();
        return cat === 'general' || cat === 'fighting style' || cat === 'epic boon' || !f.category;
    });

    grid.innerHTML = displayFeats.map(f => {
        const sel = (wizardData.selectedFeats || []).includes(f.name_en) ? ' selected' : '';
        const prereq = f.prerequisite ? `<span style="font-size:10px;opacity:0.5;margin-left:4px;">(${f.prerequisite})</span>` : '';
        const desc = (f.description || '').slice(0, 120) + ((f.description || '').length > 120 ? '…' : '');
        const catBadge = f.category ? `<span style="font-size:9px;text-transform:uppercase;opacity:0.5;letter-spacing:1px;">${f.category}</span>` : '';
        return `<div class="wizard-spell-item${sel}" data-feat="${f.name_en}" onclick="toggleWizardFeat(this)" title="${(f.description||'').replace(/"/g,"'")}">
            <div class="wizard-spell-item-name">${f.name_en}${prereq}</div>
            <div style="display:flex;flex-direction:column;gap:2px;flex:2;">
                ${catBadge}
                <div class="wizard-spell-item-info">${desc}</div>
            </div>
        </div>`;
    }).join('');
}

function toggleWizardFeat(el) {
    el.classList.toggle('selected');
}

// Damage type → CSS filter for SVG coloring
const DAMAGE_FILTERS = {
    'acid':      'brightness(0) saturate(100%) invert(75%) sepia(60%) saturate(500%) hue-rotate(50deg)',     // green
    'cold':      'brightness(0) saturate(100%) invert(70%) sepia(40%) saturate(400%) hue-rotate(180deg)',    // ice blue
    'fire':      'brightness(0) saturate(100%) invert(50%) sepia(90%) saturate(600%) hue-rotate(0deg)',      // red-orange
    'force':     'brightness(0) saturate(100%) invert(60%) sepia(50%) saturate(300%) hue-rotate(220deg)',    // purple-blue
    'lightning': 'brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(500%) hue-rotate(15deg)',     // yellow
    'necrotic':  'brightness(0) saturate(100%) invert(30%) sepia(80%) saturate(200%) hue-rotate(260deg)',    // dark purple
    'poison':    'brightness(0) saturate(100%) invert(60%) sepia(70%) saturate(500%) hue-rotate(80deg)',     // sickly green
    'psychic':   'brightness(0) saturate(100%) invert(50%) sepia(60%) saturate(400%) hue-rotate(250deg)',    // magenta-purple
    'radiant':   'brightness(0) saturate(100%) invert(90%) sepia(50%) saturate(500%) hue-rotate(20deg)',     // gold-white
    'thunder':   'brightness(0) saturate(100%) invert(65%) sepia(30%) saturate(300%) hue-rotate(200deg)',    // steel blue
    'bludgeoning':'brightness(0) saturate(100%) invert(60%) sepia(10%) saturate(100%) hue-rotate(0deg)',     // grey
    'piercing':  'brightness(0) saturate(100%) invert(60%) sepia(10%) saturate(100%) hue-rotate(0deg)',      // grey
    'slashing':  'brightness(0) saturate(100%) invert(60%) sepia(10%) saturate(100%) hue-rotate(0deg)'       // grey
};

// Spell school → color for icons
const SCHOOL_COLORS = {
    'Abjuration':    '#4fc3f7', // blue
    'Conjuration':   '#ffd54f', // yellow
    'Divination':    '#b0bec5', // silver
    'Enchantment':   '#f48fb1', // pink
    'Evocation':     '#ff7043', // red-orange
    'Illusion':      '#ce93d8', // violet
    'Necromancy':    '#66bb6a', // dark green
    'Transmutation': '#aed581'  // green
};

const CLASS_CANTRIPS = { 'Bard':2, 'Cleric':3, 'Druid':2, 'Sorcerer':4, 'Warlock':2, 'Wizard':3, 'Artificer':2 };
const CLASS_SPELLS_KNOWN = { 'Bard':4, 'Sorcerer':2, 'Warlock':2 };
// Cleric/Druid/Wizard prepare: mod+level, we'll show all available and let them pick
const CLASS_PREPARED = ['Cleric','Druid','Wizard','Artificer'];

function populateWizardSpells() {
    const cls = wizardData.class || '';
    const cantripCount = CLASS_CANTRIPS[cls] || 0;
    const spellsKnown = CLASS_SPELLS_KNOWN[cls] || 0;
    const isPrepared = CLASS_PREPARED.includes(cls);
    const lang = getLang();
    
    const cantripSec = document.getElementById('wizardCantripsSection');
    const spellSec = document.getElementById('wizardSpellsSection');
    const noSpells = document.getElementById('wizardNoSpells');
    const spellInfo = document.getElementById('wizardSpellsInfo');
    
    if (!cantripCount && !spellsKnown && !isPrepared) {
        cantripSec.style.display = 'none';
        spellSec.style.display = 'none';
        noSpells.style.display = 'block';
        spellInfo.textContent = cls ? `${term(cls)} erhält auf Stufe 1 keine Zauber.` : 'Wähle erst eine Klasse.';
        return;
    }
    noSpells.style.display = 'none';
    
    // Cantrips
    if (cantripCount > 0) {
        cantripSec.style.display = 'block';
        document.getElementById('wizardCantripCounter').textContent = `(Wähle ${cantripCount})`;
        const cantrips = WizardDB.getSpells(0, cls);
        const grid = document.getElementById('wizardCantripGrid');
        grid.innerHTML = cantrips.map(s => {
            const name = lang === 'de' ? (SPELLS_DE[s.name] || s.name) : s.name;
            const sel = (wizardData.selectedCantrips || []).includes(s.name) ? ' selected' : '';
            const dmgType = s.damage !== '—' ? (s.damage.split(' ')[1] || '') : '';
            const dmgColor = DAMAGE_FILTERS[dmgType] || '';
            const dmgIcon = dmgType ? `<img src="/assets/icons/damage/${dmgType}.svg" style="width:14px;height:14px;${dmgColor ? 'filter:' + dmgColor : 'filter:brightness(0) invert(1);opacity:0.5;'}" onerror="this.style.display='none'">` : '';
            const schoolColor = SCHOOL_COLORS[s.school] || '#999';
            const schoolIcon = `<img src="/assets/icons/spell/${s.school.toLowerCase()}.svg" style="width:16px;height:16px;" onerror="this.style.display='none'">`;
            const tooltip = `${s.school} • ${s.time} • ${s.range}${s.damage !== '—' ? ' • ' + s.damage : ''}${s.conc ? ' • Konzentration' : ''}`;
            return `<div class="wizard-spell-item${sel}" data-spell="${s.name}" onclick="toggleWizardSpell(this,'cantrip',${cantripCount})" title="${tooltip}">
                <div class="wizard-spell-school-icon" style="color:${schoolColor}">${schoolIcon}</div>
                ${dmgIcon ? `<div class="wizard-spell-dmg-icon">${dmgIcon}</div>` : ''}
                <div class="wizard-spell-item-name">${name}</div>
                <div class="wizard-spell-item-info">${s.damage !== '—' ? s.damage : s.range}</div>
                <div class="wizard-spell-item-school" style="color:${schoolColor}">${s.school}</div>
            </div>`;
        }).join('');
        spellInfo.textContent = `Wähle ${cantripCount} Zaubertricks` + (spellsKnown || isPrepared ? ' und deine Zauber.' : '.');
    } else {
        cantripSec.style.display = 'none';
    }
    
    // Spells level 1
    const level1 = WizardDB.getSpells(1, cls);
    if (level1.length > 0 && (spellsKnown || isPrepared)) {
        spellSec.style.display = 'block';
        let maxSpells = spellsKnown;
        if (isPrepared) {
            const spellMod = CLASS_PRIMARY[cls] === 'int' ? Math.floor(((wizardData.int||10)-10)/2) : 
                             CLASS_PRIMARY[cls] === 'wis' ? Math.floor(((wizardData.wis||10)-10)/2) :
                             Math.floor(((wizardData.cha||10)-10)/2);
            maxSpells = Math.max(1, spellMod + (wizardData.level || 1));
            document.getElementById('wizardSpellCounter').textContent = `(Bereite ${maxSpells} vor)`;
        } else {
            document.getElementById('wizardSpellCounter').textContent = `(Wähle ${maxSpells})`;
        }
        const grid = document.getElementById('wizardSpellGrid');
        grid.innerHTML = level1.map(s => {
            const name = lang === 'de' ? (SPELLS_DE[s.name] || s.name) : s.name;
            const sel = (wizardData.selectedSpells || []).includes(s.name) ? ' selected' : '';
            const concTag = s.conc ? ' <span style="color:#f59e0b;font-size:9px;">K</span>' : '';
            const ritualTag = s.ritual ? ' <span style="color:#d4a844;font-size:9px;">R</span>' : '';
            const dmgType = s.damage !== '—' ? (s.damage.split(' ')[1] || '') : '';
            const dmgColor = DAMAGE_FILTERS[dmgType] || '';
            const dmgIcon = dmgType ? `<img src="/assets/icons/damage/${dmgType}.svg" style="width:14px;height:14px;${dmgColor ? 'filter:' + dmgColor : 'filter:brightness(0) invert(1);opacity:0.5;'}" onerror="this.style.display='none'">` : '';
            const schoolColor = SCHOOL_COLORS[s.school] || '#999';
            const schoolIcon = `<img src="/assets/icons/spell/${s.school.toLowerCase()}.svg" style="width:16px;height:16px;" onerror="this.style.display='none'">`;
            const tooltip = `${s.school} • ${s.time} • ${s.range}${s.damage !== '—' ? ' • ' + s.damage : ''}${s.conc ? ' • Konzentration' : ''}${s.ritual ? ' • Ritual' : ''}`;
            return `<div class="wizard-spell-item${sel}" data-spell="${s.name}" onclick="toggleWizardSpell(this,'spell',${maxSpells})" title="${tooltip}">
                <div class="wizard-spell-school-icon" style="color:${schoolColor}">${schoolIcon}</div>
                ${dmgIcon ? `<div class="wizard-spell-dmg-icon">${dmgIcon}</div>` : ''}
                <div class="wizard-spell-item-name">${name}${concTag}${ritualTag}</div>
                <div class="wizard-spell-item-info">${s.damage !== '—' ? s.damage : s.time}</div>
                <div class="wizard-spell-item-school" style="color:${schoolColor}">${s.school}</div>
            </div>`;
        }).join('');
    } else {
        spellSec.style.display = 'none';
    }
}

function toggleWizardSpell(el, type, max) {
    const grid = el.parentElement;
    const selected = grid.querySelectorAll('.wizard-spell-item.selected');
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
    } else if (selected.length < max) {
        el.classList.add('selected');
    }
    // Update counter
    const countEl = type === 'cantrip' ? document.getElementById('wizardCantripCounter') : document.getElementById('wizardSpellCounter');
    const current = grid.querySelectorAll('.wizard-spell-item.selected').length;
    const label = type === 'cantrip' ? 'Wähle' : (CLASS_PREPARED.includes(wizardData.class) ? 'Bereite' : 'Wähle');
    countEl.textContent = `(${current}/${max})`;
}

// ===== STEP 10: Portrait =====
function handleWizardPortraitUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        wizardData.portraitData = e.target.result;
        const preview = document.getElementById('wizardPortraitPreview');
        preview.style.display = 'block';
        preview.innerHTML = `<img src="${e.target.result}" style="width:100px;height:100px;object-fit:cover;border-radius:12px;border:2px solid var(--md-primary);">
            <div style="font-size:10px;margin-top:4px;color:var(--md-primary);">Portrait ausgewählt</div>`;
    };
    reader.readAsDataURL(file);
}

function wizardNext() {
    if (wizardStep === 1) {
        wizardData.name = document.getElementById('wizardName').value;
        wizardData.level = parseInt(document.getElementById('wizardLevel').value) || 1;
        if (!wizardData.name.trim()) { toast('Bitte gib einen Namen ein'); return; }
    } else if (wizardStep === 2) {
        if (!wizardData.species) { toast('Bitte waehle eine Spezies'); return; }
    } else if (wizardStep === 3) {
        if (!wizardData.class) { toast('Bitte waehle eine Klasse'); return; }
    } else if (wizardStep === 5) {
        if (!wizardData.background) { toast('Bitte waehle einen Hintergrund'); return; }
    } else if (wizardStep === 7) {
        // Alignment already saved via card click in step 6
        wizardData.physAge = document.getElementById('wizardPhysAge').value;
        wizardData.physHeight = document.getElementById('wizardPhysHeight').value;
        wizardData.physEyes = document.getElementById('wizardPhysEyes').value;
        wizardData.physHair = document.getElementById('wizardPhysHair').value;
        wizardData.physSkin = document.getElementById('wizardPhysSkin').value;
        wizardData.physWeight = document.getElementById('wizardPhysWeight').value;
        wizardData.appearance = document.getElementById('wizardAppearance').value;
    } else if (wizardStep === 8) {
        wizardData.str = parseInt(document.getElementById('wizardStr').value) || 10;
        wizardData.dex = parseInt(document.getElementById('wizardDex').value) || 10;
        wizardData.con = parseInt(document.getElementById('wizardCon').value) || 10;
        wizardData.int = parseInt(document.getElementById('wizardInt').value) || 10;
        wizardData.wis = parseInt(document.getElementById('wizardWis').value) || 10;
        wizardData.cha = parseInt(document.getElementById('wizardCha').value) || 10;
    } else if (wizardStep === 9) {
        wizardData.selectedSkills = [];
        document.querySelectorAll('#wizardSkillGrid .wizard-skill-item.selected').forEach(el => {
            wizardData.selectedSkills.push(el.dataset.skill);
        });
        wizardData.selectedFeats = [];
        document.querySelectorAll('#wizardFeatGrid .wizard-spell-item.selected').forEach(el => {
            wizardData.selectedFeats.push(el.dataset.feat);
        });
    } else if (wizardStep === 11) {
        wizardData.selectedCantrips = [];
        document.querySelectorAll('#wizardCantripGrid .wizard-spell-item.selected').forEach(el => {
            wizardData.selectedCantrips.push(el.dataset.spell);
        });
        wizardData.selectedSpells = [];
        document.querySelectorAll('#wizardSpellGrid .wizard-spell-item.selected').forEach(el => {
            wizardData.selectedSpells.push(el.dataset.spell);
        });
    } else if (wizardStep === 13) {
        closeWizard();
        try {
            applyWizardData();
        } catch(e) {
            console.error('[5e Wizard] Error applying wizard data:', e);
            toast('Fehler beim Erstellen: ' + e.message);
        }
        return;
    }
    if (wizardStep < 13) { wizardStep++; updateWizardStep(); }
}

function wizardPrev() {
    if (wizardStep > 1) { wizardStep--; updateWizardStep(); }
}

function selectWizardOption(element, type) {
    const parent = element.parentElement;
    parent.querySelectorAll('.wizard-option').forEach(o => o.classList.remove('selected'));
    element.classList.add('selected');
    wizardData[type] = element.dataset.value;
    console.log('[5e Wizard] Selected:', type, '=', element.dataset.value);
    updateWizardTrail();
}

function applyStandardArray() {
    document.getElementById('wizardStr').value = 15;
    document.getElementById('wizardDex').value = 14;
    document.getElementById('wizardCon').value = 13;
    document.getElementById('wizardInt').value = 12;
    document.getElementById('wizardWis').value = 10;
    document.getElementById('wizardCha').value = 8;
}

let wizardRollsLeft = 3;

function rollAllAbilities() {
    if (wizardRollsLeft <= 0) return;
    wizardRollsLeft--;
    
    const btn = document.getElementById('wizardRollBtn');
    if (btn) {
        if (wizardRollsLeft > 0) {
            btn.textContent = `4W6 Würfeln (${wizardRollsLeft})`;
        } else {
            btn.textContent = '4W6 — keine Würfe übrig';
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
        }
    }
    const abNames = ['STR','GES','KON','INT','WEI','CHA'];
    const abIds = ['wizardStr','wizardDex','wizardCon','wizardInt','wizardWis','wizardCha'];
    const results = [];
    
    abIds.forEach((id, i) => {
        const rolls = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a, b) => a - b);
        const dropped = rolls[0];
        const kept = rolls.slice(1);
        const total = kept.reduce((s, v) => s + v, 0);
        document.getElementById(id).value = total;
        results.push({ name: abNames[i], rolls, dropped, total });
    });
    
    // Show animated dice breakdown
    const container = document.getElementById('wizardDiceResult');
    if (container) {
        container.style.display = 'block';
        container.innerHTML = `<div style="font-size:10px;color:var(--md-on-surface-variant);text-align:center;margin-bottom:8px;">4W6 je Attribut — <span style="color:#ef4444;text-decoration:line-through;">niedrigster</span> gestrichen</div>
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">${results.map(r => {
            const diceHtml = r.rolls.map((v, i) => 
                i === 0 ? `<span class="dropped">${v}</span>` : `<span>${v}</span>`
            ).join('');
            return `<div class="wizard-dice-ability">
                <div class="wizard-dice-rolls">${diceHtml}</div>
                <div class="wizard-dice-total">${r.total}</div>
                <div style="font-size:9px;color:var(--md-on-surface-variant)">${r.name}</div>
            </div>`;
        }).join('')}</div>`;
    }
}

// ===== WIZARD STEP 6: Proficiencies =====
// ===== WIZARD STEP 4: Subclass =====
const SUBCLASS_INFO = {
    // Artificer
    'Alchemist': { icon: '⚗️', desc: 'Elixiere brauen, Heilung und Schaden durch Alchemie.' },
    'Armorer': { icon: '🛡️', desc: 'Magische Rüstung erschaffen, die im Nahkampf oder als Tank schützt.' },
    'Artillerist': { icon: '💥', desc: 'Magische Kanonen beschwören für Fern-Schaden oder Schutzschilde.' },
    'Battle Smith': { icon: '🤖', desc: 'Stählerner Verteidiger als Begleiter, INT für Waffen nutzen.' },
    // Barbarian
    'Path of the Berserker': { icon: '😤', desc: 'Rücksichtslose Wut mit Raserei — extra Angriff, aber Erschöpfung.' },
    'Path of the Wild Heart': { icon: '🐺', desc: 'Tierische Totemkräfte: Bär (Resistenz), Adler (Mobilität), Wolf (Team).' },
    'Path of the World Tree': { icon: '🌳', desc: 'Verbindung zum Weltenbaum, Verbündete teleportieren und schützen.' },
    'Path of the Zealot': { icon: '⚡', desc: 'Göttliche Wut, Bonusschaden, und extrem schwer dauerhaft zu töten.' },
    // Bard
    'College of Dance': { icon: '💃', desc: 'Tanz als Kampfkunst, Bonusbewegung und Ausweichen.' },
    'College of Glamour': { icon: '✨', desc: 'Fey-Magie, Verbündeten temp. HP und Repositionierung geben.' },
    'College of Lore': { icon: '📖', desc: 'Zusätzliche Fertigkeiten, gegnerische Würfe reduzieren.' },
    'College of the Moon': { icon: '🌙', desc: 'Mondmagie, Nahkampf-Heiltanz und mächtige Nebelzauber.' },
    'College of Valor': { icon: '⚔️', desc: 'Kampfbarde mit mittlerer Rüstung und extra Angriff.' },
    // Cleric
    'Knowledge Domain': { icon: '📚', desc: 'Wissensdomäne: Sprachen, Expertise in INT-Fertigkeiten.' },
    'Life Domain': { icon: '❤️', desc: 'Bester Heiler im Spiel. Schwere Rüstung, verstärkte Heilzauber.' },
    'Light Domain': { icon: '☀️', desc: 'Feuer- und Strahlungsschaden, Schutzreaktion gegen Angriffe.' },
    'Trickery Domain': { icon: '🎭', desc: 'Illusions-Kleriker: Unsichtbarkeit, Doppelgänger, Täuschung.' },
    'War Domain': { icon: '⚔️', desc: 'Kriegsdomäne: Bonus-Angriffe, schwere Rüstung, Kampffokus.' },
    // Druid
    'Circle of the Land': { icon: '🌍', desc: 'Mehr Zauber basierend auf gewähltem Gelände, Zauberplatz-Erholung.' },
    'Circle of the Moon': { icon: '🐻', desc: 'Stärkste Wildgestalt — sich in mächtigere Tiere verwandeln.' },
    'Circle of the Sea': { icon: '🌊', desc: 'Wasser- und Sturmkräfte, Bonus-Blitzangriffe.' },
    'Circle of Stars': { icon: '⭐', desc: 'Sternenkarten: Heilung, Schaden oder Konzentrations-Boost.' },
    // Fighter
    'Banneret': { icon: '🏴', desc: 'Anführer auf dem Schlachtfeld, Verbündete heilen und inspirieren.' },
    'Battle Master': { icon: '🎯', desc: 'Taktische Manöver: Entwaffnen, Riposte, Präzision. Sehr vielseitig.' },
    'Champion': { icon: '💪', desc: 'Einfach aber effektiv: erweiterter kritischer Trefferbereich.' },
    'Eldritch Knight': { icon: '🔮', desc: 'Kämpfer mit Magie — Schild, Absorb Elements, Waffe beschwören.' },
    'Psi Warrior': { icon: '🧠', desc: 'Psionische Kräfte: telekinetische Schläge, Schutzfeld, Sprung.' },
    // Monk
    'Warrior of Mercy': { icon: '🤲', desc: 'Heilende Hände und tödliche Berührung, Nekrotischer Schaden.' },
    'Warrior of Shadow': { icon: '🌑', desc: 'Schattenmagie: Dunkelheit, Teleportation, Unsichtbarkeit.' },
    'Warrior of the Elements': { icon: '🔥', desc: 'Elementar-Ki: Feuer, Eis, Blitz und Donner als Fern-/Nahkampf.' },
    'Warrior of the Open Hand': { icon: '✋', desc: 'Klassischer Mönch: Gegner zurückstoßen, heilen, tödliche Vibration.' },
    // Paladin
    'Oath of Devotion': { icon: '🙏', desc: 'Klassischer Paladin: Heilige Waffe, Schutz vor Bösem.' },
    'Oath of Glory': { icon: '🏆', desc: 'Athletischer Paladin: Geschwindigkeitsboost, Team-Ausdauer.' },
    'Oath of Redemption': { icon: '☮️', desc: 'Pazifistischer Paladin: Schaden umleiten, Feinde überzeugen.' },
    'Oath of the Ancients': { icon: '🌿', desc: 'Fey-Paladin: Magieresistenz-Aura, Pflanzen binden Feinde.' },
    'Oath of Vengeance': { icon: '🗡️', desc: 'Jäger-Paladin: Vorteil auf einen Feind, Teleport-Verfolgung.' },
    // Ranger
    'Beast Master': { icon: '🐾', desc: 'Tierbegleiter der im Kampf und Erkundung hilft.' },
    'Fey Wanderer': { icon: '🧚', desc: 'Fey-Magie, CHA-Boost auf WEI-Prüfungen, Psycho-Schaden.' },
    'Gloom Stalker': { icon: '🌑', desc: 'Dunkelheits-Jäger: Unsichtbar in Finsternis, extra Erstrundenangriff.' },
    'Hunter': { icon: '🏹', desc: 'Vielseitiger Jäger: extra Schaden, Multiangriff, Verteidigung.' },
    // Rogue
    'Arcane Trickster': { icon: '🃏', desc: 'Magischer Schurke: Illusion, Verzauberung, Mage Hand Tricks.' },
    'Assassin': { icon: '🗡️', desc: 'Tödliche Überraschungen: Auto-Krit bei überraschten Gegnern.' },
    'Mastermind': { icon: '🧠', desc: 'Taktiker: Helfen als Bonus-Aktion, Identitäten fälschen.' },
    'Swashbuckler': { icon: '🤺', desc: 'Duellant: Nahkampf-Schurke ohne Verbündete, freies Ausweichen.' },
    'Thief': { icon: '🗝️', desc: 'Schnelle Hände, Klettern, Gegenstände als Bonus-Aktion nutzen.' },
    // Sorcerer
    'Aberrant Mind': { icon: '👁️', desc: 'Psionische Zauber, subtiles Wirken ohne Komponenten.' },
    'Clockwork Soul': { icon: '⚙️', desc: 'Ordnungs-Magie: Würfe neutralisieren, Schutz-Bubble.' },
    'Draconic Bloodline': { icon: '🐲', desc: 'Drachenblut: extra HP, Elementar-Resistenz, Flügel auf Stufe 14.' },
    'Wild Magic': { icon: '🎲', desc: 'Chaos-Magie: Zufällige wilde Effekte, Vorteil verschenken.' },
    // Warlock
    'The Archfey': { icon: '🧚', desc: 'Fey-Patron: Verzauberung, Furcht, Teleportation.' },
    'The Celestial': { icon: '😇', desc: 'Himmlischer Patron: Heilung, Feuer/Strahlung, Untote bannen.' },
    'The Fiend': { icon: '😈', desc: 'Teufelspakt: temp. HP bei Kills, Feuer-Schaden, Glück manipulieren.' },
    'The Great Old One': { icon: '🐙', desc: 'Eldritch-Horror: Telepathie, Gedankenkontrolle, Wahnsinn.' },
    // Wizard
    'Abjuration': { icon: '🛡️', desc: 'Schutzmagie: Arkaner Schild absorbiert Schaden.' },
    'Conjuration': { icon: '🌀', desc: 'Beschwörung: Objekte/Kreaturen herbeirufen, Teleportation.' },
    'Divination': { icon: '🔮', desc: 'Weissagung: Würfel vorherbestimmen mit Portent — extrem mächtig.' },
    'Enchantment': { icon: '💫', desc: 'Verzauberung: Gedanken kontrollieren, Charme, Betäubung.' },
    'Evocation': { icon: '💥', desc: 'Evokation: Fireball, Lightning Bolt — maximaler Schaden, Verbündete schützen.' },
    'Illusion': { icon: '🌫️', desc: 'Illusion: Täuschende Bilder, Unsichtbarkeit, Trugbilder real machen.' },
    'Necromancy': { icon: '💀', desc: 'Nekromantie: Untote erheben, HP stehlen, Tod manipulieren.' },
    'Transmutation': { icon: '⚗️', desc: 'Transmutation: Materie verwandeln, Polymorphie, Stein der Weisen.' }
};

function populateWizardSubclass() {
    const className = wizardData.class || '';
    const subs = SUBCLASSES[className] || [];
    const container = document.getElementById('wizardSubclassInfo');
    
    if (!subs.length) {
        container.innerHTML = '<div class="wizard-section-explain">Wähle zuerst eine Klasse in Schritt 3, um die verfügbaren Unterklassen zu sehen.</div>';
        return;
    }
    
    const classDE = term(className);
    let html = `<div class="wizard-section-explain">
        <strong>Ab Stufe 3</strong> wählt dein ${classDE} eine Unterklasse. Diese Spezialisierung verleiht dir einzigartige Fähigkeiten, neue Zauber oder Kampftechniken, die deine Klasse erweitern und deinen Spielstil definieren.<br><br>
        Auf <strong>Stufe 1</strong> ist noch keine Unterklasse aktiv — du kannst dich in Ruhe entscheiden, während du deinen Charakter kennenlernst. Hier eine Vorschau, was deinem <strong>${classDE}</strong> zur Verfügung steht:
    </div>`;
    
    html += '<div class="wizard-subclass-preview-grid">';
    html += subs.map(sub => {
        const info = SUBCLASS_INFO[sub] || { icon: '⚔️', desc: sub };
        return `<div class="wizard-subclass-preview">
            <div class="wizard-subclass-preview-icon">${info.icon}</div>
            <div class="wizard-subclass-preview-body">
                <div class="wizard-subclass-preview-name">${sub}</div>
                <div class="wizard-subclass-preview-desc">${info.desc}</div>
            </div>
        </div>`;
    }).join('');
    html += '</div>';
    
    container.innerHTML = html;
}

// Skill descriptions for tooltips — Wieso, wann, durch wen
const SKILL_DESC = {
    athletics: 'STR-Fertigkeit. Klettern, Springen, Schwimmen, Ringen. Der GM fordert einen Wurf wenn du körperliche Kraft einsetzen musst — eine Klippe erklimmen, einen Gegner festhalten oder gegen Strömung schwimmen.',
    acrobatics: 'GES-Fertigkeit. Balance halten, Stürze abfangen, akrobatische Manöver. Wird geprüft wenn du über glattes Eis läufst, auf einem Seil balancierst oder dich aus einem Griff windest.',
    sleight: 'GES-Fertigkeit. Taschendiebstahl, Objekte unbemerkt verstecken oder manipulieren. Nützlich wenn du einem Wachmann etwas zustecken oder eine Falle heimlich entschärfen willst.',
    stealth: 'GES-Fertigkeit. Ungesehen und ungehört bleiben. Wird gegen die Wahrnehmung von Gegnern geprüft. Essenziell für Überraschungsangriffe, Spionage und Infiltration.',
    arcana: 'INT-Fertigkeit. Wissen über Magie, Zauber, magische Gegenstände und Traditionen. Der GM fragt danach wenn du eine Rune identifizieren, einen Zauber erkennen oder magische Phänomene verstehen willst.',
    history: 'INT-Fertigkeit. Wissen über historische Ereignisse, Königreiche, Kriege und Persönlichkeiten. Hilfreich um Hinweise in Ruinen zu deuten oder die Geschichte eines Artefakts zu kennen.',
    investigation: 'INT-Fertigkeit. Logisches Schlussfolgern, Hinweise finden, Rätsel lösen. Unterscheidet sich von Wahrnehmung: Investigation ist aktives Suchen und Analysieren, nicht passives Bemerken.',
    nature: 'INT-Fertigkeit. Wissen über Flora, Fauna, Wetter und natürliche Zyklen. Wird geprüft wenn du eine Pflanze identifizieren, Tierverhalten deuten oder das Wetter vorhersagen willst.',
    religion: 'INT-Fertigkeit. Wissen über Götter, Glaubensrichtungen, Riten und Untote. Hilfreich bei heiligen Symbolen, göttlichen Artefakten oder um Untote zu identifizieren.',
    animal: 'WEI-Fertigkeit. Tiere beruhigen, ihre Absichten lesen, domestizierte Tiere kontrollieren. Wird geprüft wenn du ein wildes Tier besänftigen oder ein Reittier in einer Gefahrensituation kontrollieren willst.',
    insight: 'WEI-Fertigkeit. Lügen erkennen, Emotionen lesen, wahre Absichten durchschauen. Wird gegen Täuschung des Gegenübers geprüft. Unverzichtbar in sozialen Situationen und Verhandlungen.',
    medicine: 'WEI-Fertigkeit. Verwundete stabilisieren, Krankheiten diagnostizieren, Gift erkennen. Wird geprüft um einen sterbenden Verbündeten zu stabilisieren oder die Todesursache zu bestimmen.',
    perception: 'WEI-Fertigkeit. Die wichtigste Fertigkeit im Spiel. Dinge bemerken: Geräusche, versteckte Türen, heranschleichende Feinde. Dein Passiv-Wert bestimmt was du automatisch bemerkst.',
    survival: 'WEI-Fertigkeit. Fährten lesen, jagen, navigieren, Unterkünfte bauen. Wird geprüft wenn du in der Wildnis überleben, Wild aufspüren oder dich in unbekanntem Gelände orientieren willst.',
    deception: 'CHA-Fertigkeit. Lügen, Verkleidungen, falsche Identitäten, Irreführung. Wird gegen die Motiv-Erkennen-Fertigkeit des Gegenübers geprüft. Nützlich für Betrug, Ablenkung und Spionage.',
    intimidation: 'CHA-Fertigkeit. Einschüchtern durch Drohungen, Körpersprache oder Worte. Wird geprüft wenn du jemanden durch Furcht zur Kooperation zwingen willst — im Verhör, Kampf oder auf der Straße.',
    performance: 'CHA-Fertigkeit. Musik, Tanz, Schauspiel, Geschichtenerzählen. Wird geprüft wenn du ein Publikum unterhalten, für Ablenkung sorgen oder als Barde dein Handwerk ausüben willst.',
    persuasion: 'CHA-Fertigkeit. Diplomatisch überzeugen, verhandeln, Verbündete gewinnen. Im Gegensatz zu Einschüchtern und Täuschung basiert Überreden auf ehrlicher Überzeugungskraft und Charisma.'
};

function populateWizardProficiencies() {
    const lang = getLang();
    const className = wizardData.class || '';
    const saves = CLASS_SAVES[className] || [];
    const skillInfo = CLASS_SKILLS[className] || { count: 2, skills: [] };
    const abNames = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
    const abFull = { str:'Stärke', dex:'Geschicklichkeit', con:'Konstitution', int:'Intelligenz', wis:'Weisheit', cha:'Charisma' };
    
    // Save explanation
    const saveGrid = document.getElementById('wizardSaveGrid');
    const saveExplain = saves.length > 0
        ? `<strong>Rettungswürfe</strong> sind Reaktionen auf Bedrohungen — Gift widerstehen (KON), einem Feuerball ausweichen (GES) oder einer Verzauberung trotzen (WEI). Deine Klasse <strong>${term(className)}</strong> beherrscht <strong>${saves.map(s => abFull[s]).join('</strong> und <strong>')}</strong> und erhält darauf deinen Übungsbonus. Diese Auswahl ist klassengebunden und nicht veränderbar.`
        : 'Wähle zuerst eine Klasse, um die Rettungswürfe zu sehen.';
    
    saveGrid.innerHTML = `<div class="wizard-section-explain">${saveExplain}</div>` + Object.keys(abNames).map(ab => {
        const isProf = saves.includes(ab);
        return `<div class="wizard-save-badge${isProf ? ' proficient' : ''}" title="${abFull[ab]}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${abNames[ab]}${isProf ? ' <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>`;
    }).join('');

    const SKILL_AB = { athletics:'str', acrobatics:'dex', sleight:'dex', stealth:'dex', arcana:'int', history:'int', investigation:'int', nature:'int', religion:'int', animal:'wis', insight:'wis', medicine:'wis', perception:'wis', survival:'wis', deception:'cha', intimidation:'cha', performance:'cha', persuasion:'cha' };
    const skillNamesDe = { athletics:'Athletik', acrobatics:'Akrobatik', sleight:'Fingerfertigkeit', stealth:'Heimlichkeit', arcana:'Arkane Kunde', history:'Geschichte', investigation:'Nachforschungen', nature:'Naturkunde', religion:'Religion', animal:'Umgang mit Tieren', insight:'Motiv erkennen', medicine:'Heilkunde', perception:'Wahrnehmung', survival:'Überleben', deception:'Täuschung', intimidation:'Einschüchtern', performance:'Auftreten', persuasion:'Überreden' };
    const sNames = lang === 'de' ? skillNamesDe : SKILL_NAMES;
    
    // Skill explanation
    const skillExplain = skillInfo.skills.length > 0
        ? `<strong>Fertigkeiten</strong> bestimmen, worin dein Charakter besonders gut ist. Der Spielleiter fordert Fertigkeitsprüfungen wenn du etwas versuchst, dessen Ausgang unsicher ist — z.B. eine Wand hochklettern (Athletik) oder eine Lüge durchschauen (Motiv erkennen). <strong>${term(className)}</strong> darf <strong>${skillInfo.count}</strong> aus der Klassenliste wählen. Hover über eine Fertigkeit für Details.`
        : 'Wähle zuerst eine Klasse.';
    
    const grid = document.getElementById('wizardSkillGrid');
    const prev = wizardData.selectedSkills || [];
    grid.innerHTML = `<div class="wizard-section-explain" style="grid-column:1/-1">${skillExplain}</div>` + skillInfo.skills.map(sk => {
        const isSelected = prev.includes(sk);
        return `<div class="wizard-skill-item${isSelected ? ' selected' : ''}" data-skill="${sk}" onclick="toggleWizardSkill(this)" title="${SKILL_DESC[sk] || ''}">
            <div class="wizard-skill-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
            <span>${sNames[sk] || sk}</span>
            <span class="wizard-skill-ability">${abNames[SKILL_AB[sk]] || ''}</span>
        </div>`;
    }).join('');
    updateWizardSkillCounter(skillInfo.count);
}

function toggleWizardSkill(el) {
    el.classList.toggle('selected');
    const className = wizardData.class || '';
    const skillInfo = CLASS_SKILLS[className] || { count: 2 };
    updateWizardSkillCounter(skillInfo.count);
}

function updateWizardSkillCounter(maxCount) {
    const selected = document.querySelectorAll('#wizardSkillGrid .wizard-skill-item.selected').length;
    const counter = document.getElementById('wizardSkillCounter');
    const isOver = selected > maxCount;
    counter.innerHTML = `<span class="${isOver ? 'over' : ''}">${selected} / ${maxCount}</span> ausgewählt`;
    document.querySelectorAll('#wizardSkillGrid .wizard-skill-item').forEach(el => {
        if (!el.classList.contains('selected')) el.classList.toggle('disabled', selected >= maxCount);
    });
}

// ===== WIZARD STEP 7: Summary =====
function populateWizardSummary() {
    const lang = getLang();
    const d = wizardData;
    const className = d.class || '?';
    const level = d.level || 1;
    const conMod = Math.floor(((d.con || 10) - 10) / 2);
    const dexMod = Math.floor(((d.dex || 10) - 10) / 2);
    const die = HIT_DICE[className] || 8;
    const profBonus = Math.floor((level - 1) / 4) + 2;
    const hp = calcSuggestedHP(className, level, d.con || 10);
    const hpTotal = hp ? hp.total : die + conMod;
    const ac = 10 + dexMod;
    const initMod = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;
    const dStr = lang === 'de' ? `W${die}` : `d${die}`;
    const abNames = lang === 'de' ? { str:'STR', dex:'GES', con:'KON', int:'INT', wis:'WEI', cha:'CHA' } : { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' };
    const abilities = ['str','dex','con','int','wis','cha'];
    const saves = CLASS_SAVES[className] || [];
    const saveNames = abilities.filter(a => saves.includes(a)).map(a => abNames[a]);
    const skillNamesDe = { athletics:'Athletik', acrobatics:'Akrobatik', sleight:'Fingerfertigkeit', stealth:'Heimlichkeit', arcana:'Arkane Kunde', history:'Geschichte', investigation:'Nachforschungen', nature:'Naturkunde', religion:'Religion', animal:'Umgang mit Tieren', insight:'Motiv erkennen', medicine:'Heilkunde', perception:'Wahrnehmung', survival:'Überleben', deception:'Täuschung', intimidation:'Einschüchtern', performance:'Auftreten', persuasion:'Überreden' };
    const sNames = lang === 'de' ? skillNamesDe : SKILL_NAMES;
    const selectedSkills = (d.selectedSkills || []).map(s => sNames[s] || s);
    
    const speciesIcon = SPECIES_ICON[d.species] || '';
    const classIcon = CLASS_ICON[d.class] || '';

    document.getElementById('wizardSummary').innerHTML = `
        <div class="wizard-summary-card">
            ${speciesIcon ? `<div class="wizard-summary-card-bg"><img src="${speciesIcon}" alt=""></div>` : ''}
            <div class="wizard-summary-card-top">
                ${classIcon ? `<div class="wizard-summary-card-icon"><img src="${classIcon}" alt=""></div>` : ''}
                <div>
                    <div class="wizard-summary-card-name">${d.name || 'Namenlos'}</div>
                    <div class="wizard-summary-card-meta">${d.species ? term(d.species) : '?'} ${term(className)} Stufe ${level} &middot; ${d.background ? term(d.background) : '?'}${d.alignment ? ' &middot; ' + d.alignment : ''}</div>
                </div>
            </div>
            <div class="wizard-summary-card-body">
                <div class="wizard-summary-card-stats">
                    <div class="wizard-summary-card-stat"><div class="wizard-summary-card-stat-val">${hpTotal}</div><div class="wizard-summary-card-stat-lbl">HP</div></div>
                    <div class="wizard-summary-card-stat"><div class="wizard-summary-card-stat-val">${ac}</div><div class="wizard-summary-card-stat-lbl">RK</div></div>
                    <div class="wizard-summary-card-stat"><div class="wizard-summary-card-stat-val">${initMod}</div><div class="wizard-summary-card-stat-lbl">Initiative</div></div>
                    <div class="wizard-summary-card-stat"><div class="wizard-summary-card-stat-val">+${profBonus}</div><div class="wizard-summary-card-stat-lbl">Übung</div></div>
                </div>
                <div class="wizard-summary-card-abilities">
                    ${abilities.map(ab => {
                        const score = d[ab] || 10;
                        const mod = Math.floor((score - 10) / 2);
                        const primary = CLASS_PRIMARY[className] === ab ? ' style="border:1px solid rgba(191,155,48,0.3)"' : '';
                        return `<div class="wizard-summary-card-ab"${primary}><div class="wizard-summary-card-ab-name">${abNames[ab]}</div><div class="wizard-summary-card-ab-score">${score}</div><div class="wizard-summary-card-ab-mod">${mod >= 0 ? '+' : ''}${mod}</div></div>`;
                    }).join('')}
                </div>
                <div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Rettungswürfe</div>
                    <div class="wizard-summary-card-section-val">${saveNames.join(', ') || '—'}</div>
                </div>
                <div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Fertigkeiten (${selectedSkills.length})</div>
                    <div class="wizard-summary-card-section-val">${selectedSkills.join(', ') || '—'}</div>
                </div>
                <div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Trefferwürfel</div>
                    <div class="wizard-summary-card-section-val">${level}${dStr}</div>
                </div>
                ${(d.selectedCantrips && d.selectedCantrips.length > 0) ? `<div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Zaubertricks (${d.selectedCantrips.length})</div>
                    <div class="wizard-summary-card-section-val">${d.selectedCantrips.map(s => SPELLS_DE[s] || s).join(', ')}</div>
                </div>` : ''}
                ${(d.selectedSpells && d.selectedSpells.length > 0) ? `<div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Zauber Grad 1 (${d.selectedSpells.length})</div>
                    <div class="wizard-summary-card-section-val">${d.selectedSpells.map(s => SPELLS_DE[s] || s).join(', ')}</div>
                </div>` : ''}
                ${(d.selectedFeats && d.selectedFeats.length > 0) ? `<div class="wizard-summary-card-section">
                    <div class="wizard-summary-card-section-title">Talente (vorgemerkt)</div>
                    <div class="wizard-summary-card-section-val">${d.selectedFeats.join(', ')}</div>
                </div>` : ''}
                ${d.selectedEquipPackage ? (() => {
                    const sm = Math.floor(((d.str||10)-10)/2);
                    const dm = Math.floor(((d.dex||10)-10)/2);
                    const pkgs = getEquipPackages(className, sm, dm);
                    const pkg = pkgs.find(p => p.id === d.selectedEquipPackage);
                    return pkg ? `<div class="wizard-summary-card-section">
                        <div class="wizard-summary-card-section-title">Ausrüstung: ${pkg.label}</div>
                        <div class="wizard-summary-card-section-val">RK ${pkg.ac} • ${pkg.weapons.map(w=>w.name).join(', ')}</div>
                    </div>` : '';
                })() : ''}
            </div>
        </div>
    `;
}


// ═══════════════════════════════════════════════════════
// WIZARD TOOLTIPS
// ═══════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('wizardModal').classList.contains('active')) {
        closeWizard();
    }
});

// ===== WIZARD TOOLTIP SYSTEM =====
const WIZARD_TOOLTIPS = {
    // Species
    'Human': { title: 'Mensch', text: 'Vielseitig und anpassungsfähig. Keine spezifischen Boni in 5e (2024) — dafür flexibel bei Attributs-Boni.', detail: '<strong>Bonus:</strong> +2/+1 auf beliebige Attribute (oder +1 auf drei)<br><strong>Spezial:</strong> 1 zusätzliche Fertigkeit, 1 zusätzliches Talent (Stufe 1)' },
    'Elf': { title: 'Elf', text: 'Anmutige Wesen mit langer Lebensspanne und natürlicher Magie.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Vorteil gegen Verzauberung<br><strong>Spezial:</strong> Trance (4h statt 8h Schlaf), Wahrnehmungs-Geübtheit' },
    'Dwarf': { title: 'Zwerg', text: 'Robuste und widerstandsfähige Bergbewohner mit Steinkenntnis.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Giftresistenz (Vorteil + halber Schaden)<br><strong>Spezial:</strong> Werkzeug-Geübtheit, Tempo nicht durch schwere Rüstung verringert' },
    'Halfling': { title: 'Halbling', text: 'Kleine aber mutige Wesen mit unglaublichem Glück.', detail: '<strong>Bonus:</strong> Glückspilz (1er neu würfeln), Mutig (Vorteil vs. Furcht)<br><strong>Spezial:</strong> Durch Kreaturen mittlerer Größe hindurchbewegen' },
    'Dragonborn': { title: 'Drakonischblütiger', text: 'Stolze Nachfahren der Drachen mit elementarem Odem.', detail: '<strong>Bonus:</strong> Odemwaffe (Schadensart wählen), Schadensresistenz<br><strong>Spezial:</strong> Odem skaliert mit Stufe, 15ft Kegel oder 30ft Linie' },
    'Tiefling': { title: 'Tiefling', text: 'Wesen mit infernalischem Erbe und angeborener Magie.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Feuerresistenz<br><strong>Spezial:</strong> Infernalisches Vermächtnis (Thaumaturgie, Hellish Rebuke, Darkness)' },
    'Gnome': { title: 'Gnom', text: 'Erfinderische und neugierige Wesen mit natürlicher Magieresistenz.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Gnomische Gerissenheit (Vorteil vs. Magie-Saves INT/WIS/CHA)<br><strong>Spezial:</strong> Klein, aber mit mächtigem Geist' },
    'Half-Elf': { title: 'Halbelf', text: 'Vielseitige Mischung aus menschlicher Anpassungsfähigkeit und elfischer Anmut.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Fey-Abstammung (Vorteil gegen Verzauberung)<br><strong>Spezial:</strong> 2 zusätzliche Fertigkeiten frei wählbar, flexible Attributs-Boni' },
    'Half-Orc': { title: 'Halbork', text: 'Starke und zähe Krieger mit orkischem Erbe.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Unbändige Ausdauer (1x auf 1 HP statt 0)<br><strong>Spezial:</strong> Wilde Attacken (+1 Schadenswürfel bei Kritischem Treffer)' },
    'Orc': { title: 'Ork', text: 'Kraftvolle Krieger mit unermüdlichem Kampfgeist.', detail: '<strong>Bonus:</strong> Dunkelsicht 120ft, Adrenaline Rush (Bonus-Aktion Dash + temp. HP)<br><strong>Spezial:</strong> Unbändige Ausdauer (1x auf 1 HP statt 0), Geübtheit in Einschüchtern' },
    'Aasimar': { title: 'Aasimar', text: 'Von himmlischen Wesen gesegnete Sterbliche mit heiliger Kraft.', detail: '<strong>Bonus:</strong> Dunkelsicht 60ft, Heilende Hände (Stufe × HP heilen, 1x pro Rast)<br><strong>Spezial:</strong> Himmlische Offenbarung ab Stufe 3 (Strahlendes Seele, Nekrotischer Schleier oder Himmlische Flügel)' },
    'Goliath': { title: 'Goliath', text: 'Mächtige Nachfahren der Riesen mit übernatürlicher Ausdauer.', detail: '<strong>Bonus:</strong> Große Statur (Tragkraft verdoppelt), Steinausdauer (1W12 Schaden reduzieren, PB × pro Rast)<br><strong>Spezial:</strong> Riesiges Erbe — wählbar: Cloud, Fire, Frost, Hill oder Storm Giant Kraft' },
    // Classes
    'Fighter': { title: 'Kämpfer', text: 'Meister jeder Waffe und Rüstung. Vielseitigste Kampfklasse.', detail: '<strong>Trefferwürfel:</strong> W10 | <strong>Saves:</strong> STR, KON<br><strong>Rüstung:</strong> Alle + Schilde<br><strong>Spezial:</strong> Kampfstil, Zweiter Wind, Aktionsstoß' },
    'Wizard': { title: 'Magier', text: 'Arkaner Gelehrter mit dem größten Zauberrepertoire.', detail: '<strong>Trefferwürfel:</strong> W6 | <strong>Saves:</strong> INT, WEI<br><strong>Rüstung:</strong> Keine<br><strong>Spezial:</strong> Zauberbuch, Arkane Erholung, mächtigste Zauber im Spiel' },
    'Rogue': { title: 'Schurke', text: 'Geschickter Spezialist mit tödlichem Hinterhältigen Angriff.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> GES, INT<br><strong>Rüstung:</strong> Leichte Rüstung<br><strong>Spezial:</strong> Hinterhältiger Angriff, Expertise (4 Skills), Geschickte Aktion' },
    'Cleric': { title: 'Kleriker', text: 'Göttlicher Zauberwirker und Heiler in schwerer Rüstung.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> WEI, CHA<br><strong>Rüstung:</strong> Leicht, Mittel, Schilde<br><strong>Spezial:</strong> Göttliche Domäne, Kanalisation, volle Heilerliste' },
    'Barbarian': { title: 'Barbar', text: 'Ungezähmter Krieger der durch Wut unaufhaltsam wird.', detail: '<strong>Trefferwürfel:</strong> W12 | <strong>Saves:</strong> STR, KON<br><strong>Rüstung:</strong> Leicht, Mittel, Schilde<br><strong>Spezial:</strong> Wut (Resistenz + Bonusschaden), Rücksichtsloser Angriff' },
    'Bard': { title: 'Barde', text: 'Musikalischer Magier der das Team mit Inspiration stärkt.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> GES, CHA<br><strong>Rüstung:</strong> Leichte Rüstung<br><strong>Spezial:</strong> Bardische Inspiration, Jack of All Trades, volle Zauberliste' },
    'Paladin': { title: 'Paladin', text: 'Heiliger Ritter mit göttlicher Magie und schwerer Rüstung.', detail: '<strong>Trefferwürfel:</strong> W10 | <strong>Saves:</strong> WEI, CHA<br><strong>Rüstung:</strong> Alle + Schilde<br><strong>Spezial:</strong> Göttliches Strafgericht, Handauflegen, Aura des Schutzes' },
    'Ranger': { title: 'Waldläufer', text: 'Jäger und Fährtenleser mit Naturmagie.', detail: '<strong>Trefferwürfel:</strong> W10 | <strong>Saves:</strong> STR, GES<br><strong>Rüstung:</strong> Leicht, Mittel, Schilde<br><strong>Spezial:</strong> Bevorzugter Feind, Natürlicher Entdecker, Jägersinne' },
    'Sorcerer': { title: 'Zauberer', text: 'Angeborene Magie die durch Metamagie angepasst wird.', detail: '<strong>Trefferwürfel:</strong> W6 | <strong>Saves:</strong> KON, CHA<br><strong>Rüstung:</strong> Keine<br><strong>Spezial:</strong> Zauberpunkte, Metamagie (Zauber modifizieren)' },
    'Warlock': { title: 'Hexenmeister', text: 'Paktmagier mit mächtigem Eldritch Blast.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> WEI, CHA<br><strong>Rüstung:</strong> Leichte Rüstung<br><strong>Spezial:</strong> Pakt-Magie (kurze Rast), Eldritch Blast, Anrufungen' },
    'Druid': { title: 'Druide', text: 'Naturmagier der sich in Tiere verwandeln kann.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> INT, WEI<br><strong>Rüstung:</strong> Leicht, Mittel, Schilde (kein Metall)<br><strong>Spezial:</strong> Wildgestalt, volle Zauberliste, Naturmagie' },
    'Monk': { title: 'Mönch', text: 'Kampfkünstler der Ki für übernatürliche Fähigkeiten nutzt.', detail: '<strong>Trefferwürfel:</strong> W8 | <strong>Saves:</strong> STR, GES<br><strong>Rüstung:</strong> Keine (WEI + GES = RK)<br><strong>Spezial:</strong> Kampfkunst, Ki-Punkte, Flurry of Blows, schnelle Bewegung' },
    // Backgrounds
    'Soldier': { title: 'Soldat', text: 'Erfahrener Krieger mit militärischer Ausbildung.', detail: '<strong>Fertigkeiten:</strong> Athletik, Einschüchtern<br><strong>Werkzeug:</strong> Spielset, Landfahrzeuge<br><strong>Feature:</strong> Militärischer Rang' },
    'Criminal': { title: 'Krimineller', text: 'Gesetzloser mit Kontakten in die Unterwelt.', detail: '<strong>Fertigkeiten:</strong> Täuschung, Heimlichkeit<br><strong>Werkzeug:</strong> Diebeswerkzeug, Spielset<br><strong>Feature:</strong> Krimineller Kontakt' },
    'Sage': { title: 'Gelehrter', text: 'Forscher und Buchgelehrter mit breitem Wissen.', detail: '<strong>Fertigkeiten:</strong> Arkane Kunde, Geschichte<br><strong>Sprachen:</strong> 2 beliebige<br><strong>Feature:</strong> Forscher (Wissensquellen finden)' },
    'Acolyte': { title: 'Akolyt', text: 'Tempeldiener mit religiöser Ausbildung.', detail: '<strong>Fertigkeiten:</strong> Motiv erkennen, Religion<br><strong>Sprachen:</strong> 2 beliebige<br><strong>Feature:</strong> Zuflucht der Gläubigen (Tempel-Unterkunft)' },
    'Noble': { title: 'Adliger', text: 'Wohlhabender Erbe mit höfischem Einfluss.', detail: '<strong>Fertigkeiten:</strong> Geschichte, Überreden<br><strong>Werkzeug:</strong> Spielset<br><strong>Feature:</strong> Position des Privilegs' },
    'Folk Hero': { title: 'Volksheld', text: 'Held des einfachen Volkes.', detail: '<strong>Fertigkeiten:</strong> Umgang mit Tieren, Überleben<br><strong>Werkzeug:</strong> Handwerkszeug, Landfahrzeuge<br><strong>Feature:</strong> Rustikale Gastfreundschaft' },
    'Entertainer': { title: 'Unterhalter', text: 'Künstler und Performer mit Bühnentalent.', detail: '<strong>Fertigkeiten:</strong> Akrobatik, Auftreten<br><strong>Werkzeug:</strong> Verkleidungsset, Musikinstrument<br><strong>Feature:</strong> Von der Volksgunst' },
    'Hermit': { title: 'Einsiedler', text: 'Zurückgezogener Mystiker mit einer Entdeckung.', detail: '<strong>Fertigkeiten:</strong> Heilkunde, Religion<br><strong>Werkzeug:</strong> Kräuterkundeausrüstung<br><strong>Feature:</strong> Entdeckung (einzigartiges Wissen)' }
};

// Tooltip event delegation
(function() {
    const tt = document.getElementById('wizardTooltip');
    if (!tt) return;
    const modal = document.querySelector('#wizardModal .wizard-modal');
    
    modal.addEventListener('mouseover', function(e) {
        const opt = e.target.closest('.wizard-option');
        if (!opt) return;
        const val = opt.dataset.value;
        let data = WIZARD_TOOLTIPS[val];
        const subData = typeof SUBCLASS_INFO !== 'undefined' && SUBCLASS_INFO[val];
        if (!data && !subData) return;
        
        if (data) {
            document.getElementById('wizardTooltipTitle').textContent = data.title;
            document.getElementById('wizardTooltipText').textContent = data.text;
            document.getElementById('wizardTooltipDetail').innerHTML = data.detail;
        } else {
            document.getElementById('wizardTooltipTitle').textContent = val;
            document.getElementById('wizardTooltipText').textContent = subData.desc;
            document.getElementById('wizardTooltipDetail').innerHTML = '';
        }
        
        const rect = opt.getBoundingClientRect();
        let left = rect.right + 12;
        let top = rect.top;
        // Keep within viewport
        if (left + 280 > window.innerWidth) left = rect.left - 292;
        if (top + 160 > window.innerHeight) top = window.innerHeight - 170;
        if (top < 10) top = 10;
        
        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
        tt.classList.add('visible');
    });
    
    modal.addEventListener('mouseout', function(e) {
        const opt = e.target.closest('.wizard-option');
        if (!opt) return;
        // Check if moving to child
        const related = e.relatedTarget;
        if (related && opt.contains(related)) return;
        tt.classList.remove('visible');
    });
})();


// ═══ SPELL TRANSLATIONS (DE) ═══
const SPELLS_DE = {
    'Acid Splash': 'Säurespritzer',
    'Aid': 'Beistand',
    'Alarm': 'Alarm',
    'Alter Self': 'Gestalt verändern',
    'Animal Friendship': 'Tierfreundschaft',
    'Animate Dead': 'Tote beleben',
    'Animate Objects': 'Gegenstände beleben',
    'Antimagic Field': 'Antimagisches Feld',
    'Astral Projection': 'Astrale Projektion',
    'Bane': 'Verderben',
    'Banishment': 'Verbannung',
    'Barkskin': 'Rindenhaut',
    'Beacon of Hope': 'Leuchtfeuer der Hoffnung',
    'Bestow Curse': 'Fluch',
    'Blade Barrier': 'Klingenbarriere',
    'Bless': 'Segnen',
    'Blight': 'Dürre',
    'Blindness/Deafness': 'Blindheit/Taubheit',
    'Blink': 'Flimmern',
    'Blur': 'Verschwimmen',
    'Burning Hands': 'Brennende Hände',
    'Call Lightning': 'Blitze herbeirufen',
    'Calm Emotions': 'Gefühle besänftigen',
    'Chain Lightning': 'Kugelblitz',
    'Charm Person': 'Person bezaubern',
    'Chill Touch': 'Kalte Hand',
    'Circle of Death': 'Todeskreis',
    'Clairvoyance': 'Hellsehen',
    'Clone': 'Klon',
    'Cloudkill': 'Todeswolke',
    'Color Spray': 'Sprühende Farben',
    'Command': 'Befehl',
    'Commune': 'Heiliges Gespräch',
    'Comprehend Languages': 'Sprachen verstehen',
    'Cone of Cold': 'Kältekegel',
    'Confusion': 'Verwirrung',
    'Conjure Animals': 'Tiere beschwören',
    'Conjure Celestial': 'Celestische Wesen beschwören',
    'Conjure Elemental': 'Elementar beschwören',
    'Conjure Minor Elementals': 'Schwache Elementare beschwören',
    'Control Water': 'Wasser kontrollieren',
    'Control Weather': 'Wetterkontrolle',
    'Counterspell': 'Gegenzauber',
    'Cure Wounds': 'Wunden heilen',
    'Dancing Lights': 'Tanzende Lichter',
    'Darkness': 'Dunkelheit',
    'Darkvision': 'Dunkelsicht',
    'Daylight': 'Tageslicht',
    'Death Ward': 'Todesschutz',
    'Delayed Blast Fireball': 'Spätzündender Feuerball',
    'Detect Evil and Good': 'Gutes und Böses entdecken',
    'Detect Magic': 'Magie entdecken',
    'Detect Poison and Disease': 'Gift und Krankheit entdecken',
    'Detect Thoughts': 'Gedanken wahrnehmen',
    'Dimension Door': 'Dimensionstür',
    'Disguise Self': 'Selbstverkleidung',
    'Disintegrate': 'Auflösung',
    'Dispel Magic': 'Magie bannen',
    'Divine Favor': 'Göttliche Gunst',
    'Divine Word': 'Göttliches Wort',
    'Dominate Beast': 'Tier beherrschen',
    'Dominate Monster': 'Monster beherrschen',
    'Dominate Person': 'Person beherrschen',
    'Dream': 'Traum',
    'Druidcraft': 'Druidenkunst',
    'Earthquake': 'Erdbeben',
    'Eldritch Blast': 'Schauriger Strahl',
    'Enhance Ability': 'Attribut verbessern',
    'Enlarge/Reduce': 'Vergrössern/Verkleinern',
    'Entangle': 'Verstricken',
    'Etherealness': 'Ätherische Gestalten',
    'Expeditious Retreat': 'Rascher Rückzug',
    'Eyebite': 'Böser Blick',
    'Faerie Fire': 'Feenfeuer',
    'False Life': 'Falsches Leben',
    'Fear': 'Furcht',
    'Feather Fall': 'Federfall',
    'Feeblemind': 'Schwachsinn',
    'Find Familiar': 'Vertrauten finden',
    'Finger of Death': 'Finger des Todes',
    'Fire Bolt': 'Feuerpfeil',
    'Fire Shield': 'Feuerschild',
    'Fire Storm': 'Feuersturm',
    'Fireball': 'Feuerball',
    'Flame Blade': 'Flammenklinge',
    'Flame Strike': 'Flammenschlag',
    'Flaming Sphere': 'Flammenkugel',
    'Fly': 'Fliegen',
    'Fog Cloud': 'Nebelwolke',
    'Forcecage': 'Energiekäfig',
    'Foresight': 'Voraussicht',
    'Freedom of Movement': 'Bewegungsfreiheit',
    'Gaseous Form': 'Gasförmige Gestalt',
    'Gate': 'Tor',
    'Goodberry': 'Gute Beeren',
    'Grease': 'Schmieren',
    'Greater Invisibility': 'Mächtige Unsichtbarkeit',
    'Greater Restoration': 'Vollständige Genesung',
    'Guardian of Faith': 'Hüter des Glaubens',
    'Guidance': 'Göttliche Führung',
    'Guiding Bolt': 'Lenkendes Geschoss',
    'Gust of Wind': 'Windstoss',
    'Haste': 'Hast',
    'Heal': 'Heilung',
    'Healing Word': 'Heilendes Wort',
    'Heat Metal': 'Metall erhitzen',
    'Hellish Rebuke': 'Höllischer Tadel',
    "Heroes' Feast": 'Heldenmahl',
    'Heroism': 'Heldenmut',
    'Hideous Laughter': 'Fürchterlicher Lachanfall',
    'Hold Monster': 'Monster festhalten',
    'Hold Person': 'Person festhalten',
    'Holy Aura': 'Heilige Aura',
    "Hunter's Mark": 'Zeichen des Jägers',
    'Hypnotic Pattern': 'Hypnotisches Muster',
    'Ice Storm': 'Eissturm',
    'Identify': 'Identifizieren',
    'Incendiary Cloud': 'Flammende Wolke',
    'Inflict Wounds': 'Wunden verursachen',
    'Insect Plague': 'Insektenplage',
    'Invisibility': 'Unsichtbarkeit',
    'Jump': 'Springen',
    'Knock': 'Klopfen',
    'Lesser Restoration': 'Schwache Genesung',
    'Levitate': 'Schweben',
    'Light': 'Licht',
    'Lightning Bolt': 'Blitz',
    'Locate Creature': 'Kreatur aufspüren',
    'Longstrider': 'Lange Schritte',
    'Mage Armor': 'Magierrüstung',
    'Mage Hand': 'Magierhand',
    'Magic Circle': 'Schutzkreis',
    'Magic Missile': 'Magisches Geschoss',
    'Magic Weapon': 'Magische Waffe',
    'Major Image': 'Mächtiges Trugbild',
    'Mass Cure Wounds': 'Massen-Wunden Heilen',
    'Mass Heal': 'Massen-Heilung',
    'Mass Healing Word': 'Massen-Heilendes Wort',
    'Mass Suggestion': 'Massen-Einflüsterung',
    'Maze': 'Irrgarten',
    'Mending': 'Ausbessern',
    'Message': 'Botschaft',
    'Meteor Swarm': 'Meteoritenschwarm',
    'Mind Blank': 'Gedankenleere',
    'Minor Illusion': 'Einfache Illusion',
    'Mirror Image': 'Spiegelbilder',
    'Misty Step': 'Nebelschritt',
    'Moonbeam': 'Mondstrahl',
    'Pass without Trace': 'Spurloses gehen',
    'Phantasmal Killer': 'Tödliches Phantom',
    'Plane Shift': 'Ebenenwechsel',
    'Poison Spray': 'Gift versprühen',
    'Polymorph': 'Verwandlung',
    'Power Word Kill': 'Wort der Macht: Tod',
    'Power Word Stun': 'Wort der Macht: Betäubung',
    'Prayer of Healing': 'Gebet der Heilung',
    'Prestidigitation': 'Taschenspielerei',
    'Prismatic Spray': 'Regenbogenspiel',
    'Prismatic Wall': 'Regenbogenwand',
    'Produce Flame': 'Flammen erzeugen',
    'Protection from Energy': 'Schutz vor Energie',
    'Protection from Evil and Good': 'Schutz vor Gut und Böse',
    'Protection from Poison': 'Schutz vor Gift',
    'Raise Dead': 'Tote erwecken',
    'Ray of Frost': 'Kältestrahl',
    'Regenerate': 'Regeneration',
    'Remove Curse': 'Fluch brechen',
    'Resistance': 'Resistenz',
    'Resurrection': 'Auferstehung',
    'Reverse Gravity': 'Schwerkraft umkehren',
    'Revivify': 'Wiederbeleben',
    'Sacred Flame': 'Heilige Flamme',
    'Sanctuary': 'Heiligtum',
    'Scorching Ray': 'Sengender Strahl',
    'Scrying': 'Ausspähung',
    'See Invisibility': 'Unsichtbares Sehen',
    'Sending': 'Verständigung',
    'Shapechange': 'Gestaltwandel',
    'Shatter': 'Zerbersten',
    'Shield': 'Schild',
    'Shield of Faith': 'Schild des Glaubens',
    'Shillelagh': 'Shillelagh',
    'Shocking Grasp': 'Schockgriff',
    'Silence': 'Stille',
    'Silent Image': 'Lautloses Trugbild',
    'Simulacrum': 'Simulakrum',
    'Sleep': 'Schlaf',
    'Slow': 'Verlangsamen',
    'Spare the Dying': 'Verschonung der Toten',
    'Speak with Animals': 'Mit Tieren sprechen',
    'Speak with Dead': 'Mit Toten sprechen',
    'Spider Climb': 'Spinnenklettern',
    'Spike Growth': 'Dornenwuchs',
    'Spirit Guardians': 'Schutzgeister',
    'Spiritual Weapon': 'Waffe des Glaubens',
    'Stinking Cloud': 'Stinkende Wolke',
    'Stoneskin': 'Steinhaut',
    'Suggestion': 'Einflüsterung',
    'Sunbeam': 'Sonnenstrahl',
    'Sunburst': 'Sonnenfeuer',
    'Symbol': 'Symbol',
    'Telekinesis': 'Telekinese',
    'Teleport': 'Teleportieren',
    'Thaumaturgy': 'Thaumaturgie',
    'Thunderwave': 'Donnerwoge',
    'Time Stop': 'Zeitstop',
    'Tongues': 'Zungen',
    'True Polymorph': 'Wahre Verwandlung',
    'True Resurrection': 'Wahre Auferstehung',
    'True Seeing': 'Wahrer Blick',
    'True Strike': 'Zielsicherer Schlag',
    'Unseen Servant': 'Unsichtbarer Diener',
    'Vampiric Touch': 'Vampirgriff',
    'Vicious Mockery': 'Gehässiger Spott',
    'Wall of Fire': 'Feuerwand',
    'Wall of Force': 'Energiewand',
    'Wall of Ice': 'Eiswand',
    'Wall of Stone': 'Steinwand',
    'Water Breathing': 'Wasser atmen',
    'Water Walk': 'Auf Wasser gehen',
    'Web': 'Spinnennetz',
    'Wish': 'Wunsch',
    'Word of Recall': 'Rückruf',
    'Zone of Truth': 'Zone der Wahrheit'
};


// ═══════════════════════════════════════════════════════
// APPLY WIZARD DATA -> V3 S-FORMAT
// Replaces the old DOM-based version.
// Writes directly to the global S state object.
// ═══════════════════════════════════════════════════════

function applyWizardData() {
    const d = wizardData;
    console.log('[5e Wizard] Applying wizard data:', JSON.stringify({
        name: d.name, class: d.class, species: d.species, background: d.background,
        str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha,
        skills: d.selectedSkills?.length, cantrips: d.selectedCantrips?.length,
        spells: d.selectedSpells?.length, equipPkg: d.selectedEquipPackage
    }));
    const cls = d.class || '';
    const spec = d.species || '';
    const bg = d.background || '';
    const level = d.level || 1;
    const dexMod = Math.floor(((d.dex || 10) - 10) / 2);
    const strMod = Math.floor(((d.str || 10) - 10) / 2);
    const conMod = Math.floor(((d.con || 10) - 10) / 2);
    const wisMod = Math.floor(((d.wis || 10) - 10) / 2);
    const chaMod = Math.floor(((d.cha || 10) - 10) / 2);
    const intMod = Math.floor(((d.int || 10) - 10) / 2);

    // Start fresh
    S = defaultState();

    // ===== BASICS =====
    S.name = d.name || 'Neuer Charakter';
    S.level = level;
    S.species = term(spec) || 'Mensch';
    S.class1 = term(cls) || 'Kaempfer';
    S.subclass = '';
    S.background = term(bg) || '';

    // ===== ABILITIES =====
    S.abilities = { str: d.str || 10, dex: d.dex || 10, con: d.con || 10, int: d.int || 10, wis: d.wis || 10, cha: d.cha || 10 };

    // ===== CLASSES (multi-class array) =====
    const die = HIT_DICE[cls] || 10;
    S.classes = [{ name: term(cls) || 'Kaempfer', subclass: '', level: level, hitDie: die, hdUsed: 0 }];
    S.hitDice = { type: die, used: 0 };

    // ===== SAVE PROFICIENCIES =====
    const saves = CLASS_SAVES[cls] || [];
    S.saveProficiencies = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
    saves.forEach(ab => { S.saveProficiencies[ab] = true; });

    // ===== SKILL PROFICIENCIES =====
    S.skillProficiencies = {};
    S.skillExpertise = {};
    const SKILL_ORDER = ['athletics','acrobatics','sleight','stealth','arcana','history','investigation','nature','religion','animal','insight','medicine','perception','survival','deception','intimidation','performance','persuasion'];
    const selectedSkills = d.selectedSkills || [];
    selectedSkills.forEach(sk => {
        const idx = SKILL_ORDER.indexOf(sk);
        if (idx >= 0) S.skillProficiencies[idx] = true;
    });

    // ===== HP =====
    const hp = calcSuggestedHP(cls, level, d.con || 10);
    S.hp = { cur: hp ? hp.total : (die + conMod), max: hp ? hp.total : (die + conMod), temp: 0 };

    // ===== SPECIES DATA =====
    const sData = SPECIES_DATA[spec];
    if (sData) {
        // Parse speed number from string like "9 m (30 ft)"
        const speedMatch = sData.speed.match(/(\d+)\s*ft/);
        S.speed = speedMatch ? parseInt(speedMatch[1]) : 30;
        S.movement = { walk: S.speed, fly: 0, swim: 0, climb: 0, burrow: 0 };
        S.size = sData.size || 'Mittel';

        // Senses
        S.senses = { darkvision: '', resistances: '', immunities: '', vulnerabilities: '' };
        if (sData.senses && sData.senses !== '\u2014') S.senses.darkvision = sData.senses;
        if (sData.resistances) S.senses.resistances = sData.resistances;

        // Species features
        S.features.species = [];
        if (sData.traits) {
            sData.traits.split('\n').forEach(line => {
                const match = line.match(/^([^:]+):\s*(.+)/);
                if (match) {
                    S.features.species.push({ name: match[1].trim(), desc: match[2].trim() });
                } else if (line.trim()) {
                    S.features.species.push({ name: line.trim(), desc: '' });
                }
            });
        }

        // Immunities
        const SPECIES_IMMUNE = { 'Elf':'Magischer Schlaf', 'Half-Elf':'Magischer Schlaf' };
        if (SPECIES_IMMUNE[spec]) S.senses.immunities = SPECIES_IMMUNE[spec];

        // Languages
        S.languages = sData.languages || 'Gemeinsprache';
    }

    // ===== CLASS DATA =====
    const CLASS_START = getClassStart(d, strMod, dexMod);
    let cData = CLASS_START[cls] ? { ...CLASS_START[cls] } : null;
    console.log('[5e Wizard] Class lookup:', cls, '| cData:', cData ? 'found' : 'NULL', '| Available:', Object.keys(CLASS_START).join(','));

    // Override with selected equipment package
    if (cData && d.selectedEquipPackage) {
        const pkgs = getEquipPackages(cls, strMod, dexMod);
        const pkg = pkgs.find(p => p.id === d.selectedEquipPackage);
        if (pkg) {
            cData.startWeapons = pkg.weapons;
            cData.ac = pkg.ac;
            cData.shield = pkg.shield || '';
            cData.equipment = pkg.equipment;
        }
    }

    if (cData) {
        // AC
        S.ac = cData.ac || 10;

        // Weapons (format)
        S.weapons = (cData.startWeapons || []).map(w => ({
            name: w.name,
            type: (w.notes && w.notes.match(/\d+\/\d+ m|Mun/)) ? 'ranged' : 'melee',
            ability: (w.notes && w.notes.match(/Finesse/i)) ? 'dex' : (w.notes && w.notes.match(/Mun/)) ? 'dex' : 'str',
            dmg: (w.damage || '').replace(/\+\d+$/, ''),
            dmgType: 'Hieb',
            props: w.notes || '',
            range: w.notes && w.notes.match(/(\d+[\/\d]* (?:m|ft))/)?.[1] || '5 ft',
            pinned: true
        }));

        // Properties / proficiencies
        let armorParts = [];
        if (cData.armor.light) armorParts.push('Leichte');
        if (cData.armor.medium) armorParts.push('Mittlere');
        if (cData.armor.heavy) armorParts.push('Schwere');
        if (cData.armor.shields) armorParts.push('Schilde');
        S.props = {
            armor: armorParts.join(', ') || 'Keine',
            weapons: cData.weaponsText || '',
            tools: cData.tools || '\u2014'
        };

        // Class features (format)
        S.features.class = [];
        if (cData.features) {
            // Parse feature blocks separated by double newlines
            cData.features.split('\n\n').forEach(block => {
                const featureLines = block.split('\n');
                const fname = featureLines[0].replace(/[\(\)]/g, '').trim();
                const fdesc = featureLines.slice(1).join(' ').trim();
                S.features.class.push({ name: fname, src: term(cls) + ' ' + level, desc: fdesc, uses: null });
            });
        }

        // Class resources (format)
        S.resources = [];
        if (cData.resources && cData.resources.length > 0) {
            cData.resources.forEach(r => {
                S.resources.push({
                    name: r.name,
                    cur: parseInt(r.current) || 0,
                    max: parseInt(r.max) || 0,
                    rest: 'short',
                    color: '#e0a030'
                });
            });
        }

        // Spellcasting
        if (cData.spellcaster) {
            S.spellAbility = cData.spellcaster;
        }

        // Spell slots
        if (cData.slots) {
            for (let slotLvl = 1; slotLvl <= 9; slotLvl++) {
                S.spellSlots[slotLvl] = { max: cData.slots[slotLvl] || 0, used: 0 };
            }
        }

        // Pact slots (Warlock)
        if (cData.pact) {
            S.pactSlots = { max: 1, used: 0 };
            // Warlock uses pact, not regular slots
            for (let slotLvl = 1; slotLvl <= 9; slotLvl++) {
                S.spellSlots[slotLvl] = { max: 0, used: 0 };
            }
        }

        // Equipment text and gold
        let equipText = cData.equipment || '';
        let toolsText = cData.tools || '\u2014';
        let totalGold = cData.gold || 10;

        // ===== BACKGROUND DATA =====
        const bData = BG_DATA[bg];
        if (bData) {
            if (bData.tools && bData.tools !== '\u2014') {
                toolsText = toolsText === '\u2014' ? bData.tools : toolsText + ', ' + bData.tools;
            }
            totalGold += (bData.gold || 0);
            equipText += '\n\n\u2014 Hintergrund \u2014\n' + bData.equipment;

            // Background feature
            S.features.class.push({ name: term(bg), src: 'Hintergrund', desc: bData.feature, uses: null });

            // Merge languages
            if (bData.languages && bData.languages !== '\u2014') {
                S.languages = (S.languages || '') + ', ' + bData.languages;
            }
        }

        S.props.tools = toolsText;

        // Currency
        S.currency = { pp: 0, gp: totalGold, ep: 0, sp: 0, cp: 0 };

        // Inventory from equipment
        S.inventory = [];
        // Add weapons to inventory
        S.weapons.forEach(w => {
            const qty = w.name.match(/\(×(\d+)\)/);
            S.inventory.push({ name: w.name.replace(/\s*\(×\d+\)/, ''), cat: 'weapon', qty: qty ? parseInt(qty[1]) : 1, wt: 3, equipped: true });
        });
        // Add armor to inventory
        const armorWt = {'Kettenhemd':55,'Schuppenpanzer':45,'Lederrüstung':10,'Beschlagenes Leder':13,'Kettenrüstung':40,'Plattenrüstung':65};
        const armorStr = cData.startArmor || cData.equipment || '';
        Object.keys(armorWt).forEach(a => {
            if (armorStr.includes(a) || (equipText && equipText.includes(a))) {
                S.inventory.push({ name: a, cat: 'armor', qty: 1, wt: armorWt[a], equipped: true });
            }
        });
        if (cData.shield === '+2' || armorStr.includes('Schild')) {
            S.inventory.push({ name: 'Schild', cat: 'armor', qty: 1, wt: 6, equipped: true });
        }
        // Standard gear from equipment text
        const gearMap = {'Fackel':{wt:1,qty:5},'Seil (50 ft)':{wt:10,qty:1},'Rationen':{wt:2,qty:8},'Heiltrank':{wt:.5,qty:2},'Bolzen':{wt:1,qty:1},'Pfeile':{wt:1,qty:1}};
        Object.keys(gearMap).forEach(g => {
            if (equipText && equipText.toLowerCase().includes(g.toLowerCase())) {
                S.inventory.push({ name: g, cat: 'gear', qty: gearMap[g].qty, wt: gearMap[g].wt, equipped: false });
            }
        });
        // Add tool proficiencies as items
        if (toolsText && toolsText !== '\u2014') {
            toolsText.split(',').forEach(t => {
                t = t.trim();
                if (t && t !== '\u2014') S.inventory.push({ name: t, cat: 'gear', qty: 1, wt: 8, equipped: false });
            });
        }
    }

    // ===== ALIGNMENT =====
    S.alignment = d.alignment || '';

    // ===== APPEARANCE =====
    S.bio = S.bio || {};
    const appearance = [];
    if (d.physAge) appearance.push('Alter: ' + d.physAge);
    if (d.physHeight) appearance.push('Groesse: ' + d.physHeight);
    if (d.physWeight) appearance.push('Gewicht: ' + d.physWeight);
    if (d.physEyes) appearance.push('Augen: ' + d.physEyes);
    if (d.physHair) appearance.push('Haare: ' + d.physHair);
    if (d.physSkin) appearance.push('Haut: ' + d.physSkin);
    S.bio.appearance = appearance.join('\n');
    if (d.appearance) S.bio.appearance += '\n' + d.appearance;
    S.bio.personality = '';
    S.bio.ideals = '';
    S.bio.bonds = '';
    S.bio.flaws = '';
    S.bio.backstory = '';
    S.bio.notes = '';

    // ===== XP BY LEVEL =====
    const XP_TABLE = { 1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000, 9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000, 15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000 };
    S.xp = XP_TABLE[level] || 0;

    // ===== EXHAUSTION =====
    S.exhaustion = 0;
    S.conditions = {};
    S.deathSaves = [0,0,0,0,0,0];
    S.inspiration = false;
    S.attunement = [false, false, false];

    // ===== CANTRIPS & SPELLS =====
    S.spells = [];
    const selectedCantrips = d.selectedCantrips || [];
    const selectedSpellsList = d.selectedSpells || [];

    selectedCantrips.forEach(srdName => {
        const _rawSpell = (WizardDB.spells || SRD_SPELLS_LEGACY).find(s => (s.name_en || s.name) === srdName);
        const spell = _rawSpell ? WizardDB._norm(_rawSpell) : null;
        if (!spell) return;
        const name = SPELLS_DE[spell.name] || spell.name;
        S.spells.push({
            name: name, level: 0, school: spell.school.substring(0, 6) + '.',
            comp: 'V, G', info: spell.range + (spell.damage !== '\u2014' ? ' \u00b7 ' + spell.damage : ''),
            prepared: true, conc: spell.conc || false
        });
    });

    selectedSpellsList.forEach(srdName => {
        const _rawSpell = (WizardDB.spells || SRD_SPELLS_LEGACY).find(s => (s.name_en || s.name) === srdName);
        const spell = _rawSpell ? WizardDB._norm(_rawSpell) : null;
        if (!spell) return;
        const name = SPELLS_DE[spell.name] || spell.name;
        S.spells.push({
            name: name, level: spell.level, school: spell.school.substring(0, 6) + '.',
            comp: 'V, G', info: spell.range + (spell.damage !== '\u2014' ? ' \u00b7 ' + spell.damage : ''),
            prepared: true, conc: spell.conc || false,
            ritual: spell.ritual || false,
            notes: ''
        });
    });

    // ===== FEATS (suggestions) =====
    S.features.feats = [];
    const selectedFeats = d.selectedFeats || [];
    if (selectedFeats.length > 0) {
        selectedFeats.forEach(fn => {
            const allFeats = WizardDB.getFeats();
            const f = allFeats.find(x => (x.name_en || x.name) === fn);
            S.features.feats.push({
                name: f ? (f.name_en || f.name) : fn,
                desc: f ? (f.description || '').slice(0, 200) : '',
                note: 'Vorgemerkt ab Stufe 4'
            });
        });
    }

    // ===== PORTRAIT =====
    if (d.portraitData) {
        S.portrait = d.portraitData;
    }

    // ===== ACTIONS (class-specific) =====
    S.actions = [];
    
    // Standard actions every class gets
    S.actions.push({
        name:'Gelegenheitsangriff', sub:'Reaktion', type:'reaction',
        uses:null, roll:'+str', dmg:S.weapons.length>0?S.weapons[0].dmg:'1W4', range:'5 ft', pinned:true
    });
    
    // Class-specific actions
    const classActions = {
        'Barbarian': [
            {name:'Wutausbruch',sub:'Klasse',type:'bonus',uses:{cur:2,max:2,rest:'long'},roll:'',dmg:'',range:'Selbst',pinned:true}
        ],
        'Bard': [
            {name:'Bardische Inspiration',sub:'Bonusaktion',type:'bonus',uses:{cur:Math.max(1,chaMod),max:Math.max(1,chaMod),rest:'long'},roll:'',dmg:'1W6',range:'18 m',pinned:true}
        ],
        'Cleric': [],
        'Druid': [],
        'Fighter': [
            {name:'Zweiter Wind',sub:'Kurze Rast',type:'bonus',uses:{cur:1,max:1,rest:'short'},roll:'',dmg:`1W10+${level}`,range:'Selbst',pinned:true},
            {name:'Aktionsstoß',sub:'Lange Rast',type:'bonus',uses:{cur:level>=17?2:1,max:level>=17?2:1,rest:'long'},roll:'',dmg:'',range:'Selbst',pinned:level>=2}
        ],
        'Monk': [
            {name:'Flurry of Blows',sub:'Ki',type:'bonus',uses:{cur:level,max:level,rest:'short'},roll:'',dmg:'2x 1W4+'+dexMod,range:'5 ft',pinned:true}
        ],
        'Paladin': [
            {name:'Handauflegen',sub:'Lange Rast',type:'action',uses:{cur:level*5,max:level*5,rest:'long'},roll:'',dmg:'',range:'Berühr.',pinned:true},
            {name:'Göttliches Niederstr.',sub:'Klasse',type:'action',uses:null,roll:'',dmg:'+2W8 Str.',range:'Nahkampf',pinned:true}
        ],
        'Ranger': [],
        'Rogue': [
            {name:'Hinterhältiger Angriff',sub:'1x/Zug',type:'action',uses:null,roll:'',dmg:`+${Math.ceil(level/2)}W6`,range:'5 ft/Fernk.',pinned:true}
        ],
        'Sorcerer': [],
        'Warlock': [],
        'Wizard': [],
        'Artificer': []
    };
    
    if (classActions[cls]) {
        classActions[cls].forEach(a => {
            // Only add level-appropriate actions
            if (a.name === 'Aktionsstoß' && level < 2) return;
            S.actions.push(a);
        });
    }

    // Buffs
    S.buffs = [];

    // ===== FINAL: RENDER =====
    migrateState();
    calc();
    render();
    save();

    console.log('[5e Wizard] Character created:', S.name, 'Level', S.level, term(cls));
    console.log('[5e Wizard] Applied data:', {
        class1: S.class1, species: S.species, background: S.background,
        abilities: S.abilities, ac: S.ac, hp: S.hp,
        weapons: S.weapons?.length, actions: S.actions?.length,
        spells: S.spells?.length, features: S.features?.class?.length,
        inventory: S.inventory?.length
    });
    toast(S.name + ' erstellt!');
}

// ═══════════════════════════════════════════════════════
// AUTO-OPEN WIZARD
// ═══════════════════════════════════════════════════════

// Open wizard on ?new=true or if character is fresh default
function checkAutoOpenWizard() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
        setTimeout(openWizard, 500);
        return;
    }
    // Auto-open if character is blank (empty defaultState)
    if (typeof S !== 'undefined' && (!S.name || S.name === '') && (!S.class1 || S.class1 === '')) {
        setTimeout(openWizard, 600);
    }
}

// Hook into sheet init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAutoOpenWizard);
} else {
    setTimeout(checkAutoOpenWizard, 600);
}

// Expose functions globally for onclick handlers in HTML
window.openWizard = openWizard;
window.closeWizard = closeWizard;
window.wizardNext = wizardNext;
window.wizardPrev = wizardPrev;
window.selectWizardOption = selectWizardOption;
window.selectWizardAlignment = selectWizardAlignment;
window.filterWizardClasses = filterWizardClasses;
window.applyStandardArray = applyStandardArray;
window.rollAllAbilities = rollAllAbilities;
window.handleWizardPortraitUpload = handleWizardPortraitUpload;
window.updateWizardNamePreview = updateWizardNamePreview;
window.calcSuggestedHP = calcSuggestedHP;
window.openHpRollModal = openHpRollModal;
window.closeHpRollModal = closeHpRollModal;
window.applyHpRoll = applyHpRoll;
window.toggleWizardSpell = toggleWizardSpell;
window.toggleWizardFeat = toggleWizardFeat;
window.toggleWizardSkill = toggleWizardSkill;
window.selectEquipPackage = selectEquipPackage;
window.toggleEquipTip = toggleEquipTip;
window.closeTemplates = typeof closeTemplates === 'function' ? closeTemplates : function(){};

})(); // End IIFE
