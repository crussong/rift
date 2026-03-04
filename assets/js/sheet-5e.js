// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const ABILITIES=['str','dex','con','int','wis','cha'];
const AB_DE={str:'STR',dex:'GES',con:'KON',int:'INT',wis:'WEI',cha:'CHA'};
const AB_FULL_DE={str:'Stärke',dex:'Geschicklichkeit',con:'Konstitution',int:'Intelligenz',wis:'Weisheit',cha:'Charisma'};
const AB_COLORS={str:'var(--str)',dex:'var(--dex)',con:'var(--con)',int:'var(--int)',wis:'var(--wis)',cha:'var(--cha)'};
const SKILLS=[
    {n:'Akrobatik',a:'dex'},{n:'Tierumgang',a:'wis'},{n:'Arkana',a:'int'},{n:'Athletik',a:'str'},
    {n:'Täuschung',a:'cha'},{n:'Geschichte',a:'int'},{n:'Einsicht',a:'wis'},{n:'Einschüchtern',a:'cha'},
    {n:'Nachforschung',a:'int'},{n:'Medizin',a:'wis'},{n:'Naturkunde',a:'int'},{n:'Wahrnehmung',a:'wis'},
    {n:'Auftreten',a:'cha'},{n:'Überzeugen',a:'cha'},{n:'Religion',a:'int'},{n:'Fingerfertigkeit',a:'dex'},
    {n:'Heimlichkeit',a:'dex'},{n:'Überleben',a:'wis'}
];
const CONDITIONS=['Betäubt','Blind','Bezaubert','Erschöpft','Festgesetzt','Gelähmt','Liegend','Taub','Unsichtbar','Verängstigt','Vergiftet','Versteinert','Bewusstlos'];
const XP_TABLE=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000,999999];

function defaultState(){return{
    name:'',level:1,species:'',class1:'',subclass:'',background:'',alignment:'',size:'Mittel',speed:30,
    classes:[{name:'',subclass:'',level:1,hitDie:10,hdUsed:0}],
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    saveProficiencies:{str:false,dex:false,con:false,int:false,wis:false,cha:false},
    skillProficiencies:{},skillExpertise:{},
    hp:{cur:10,max:10,temp:0},ac:10,hitDice:{type:10,used:0},
    inspiration:false,deathSaves:[0,0,0,0,0,0],exhaustion:0,xp:0,
    spellAbility:'',spellSlots:{1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0}},
    pactSlots:{max:0,used:0},concentrationSpell:'',
    conditions:{},attunement:[false,false,false],
    weapons:[],
    actions:[],
    spells:[],
    inventory:[],
    currency:{pp:0,gp:0,ep:0,sp:0,cp:0},
    features:{class:[],species:[],feats:[]},
    senses:{darkvision:'',resistances:'',immunities:'',vulnerabilities:''},
    props:{armor:'',weapons:'',tools:''},
    languages:'',
    movement:{walk:30,fly:0,swim:0,climb:0,burrow:0},
    resources:[],
    bio:{personality:'',ideals:'',bonds:'',flaws:'',backstory:'',appearance:'',notes:''},
    portrait:'',
    headerBg:'',
    buffs:[]
}}

// ═══════════════════════════════════════════════════════
// SVG ICONS (no emojis!)
// ═══════════════════════════════════════════════════════
const ICO_BASE = '/assets/icons/';
const WEAPON_ICO = ICO_BASE + 'dnd/weapon/';
const SPELL_ICO = ICO_BASE + 'spell/';
const DAMAGE_ICO = ICO_BASE + 'damage/';
const COMBAT_ICO = ICO_BASE + 'dnd/combat/';

function ico(file, path, cls) {
    path = path || WEAPON_ICO;
    return `<span class="ico ${cls||''}"><img src="${path}${file}.svg" onerror="this.style.display='none'"></span>`;
}

// Map German weapon names to icon filenames
function weaponIco(name) {
    if (!name) return ico('sword');
    const n = name.toLowerCase();
    if (n.includes('rapier')) return ico('rapier');
    if (n.includes('großaxt') || n.includes('streitaxt')) return ico('battleaxe');
    if (n.includes('handaxt')) return ico('handaxe');
    if (n.includes('armbrust')) return ico('crossbow');
    if (n.includes('langbogen') || n.includes('kurzbogen') || n.includes('bogen')) return ico('bow');
    if (n.includes('langschwert') || n.includes('kurzschwert') || n.includes('schwert')) return ico('sword');
    if (n.includes('dolch')) return ico('dagger');
    if (n.includes('speer') || n.includes('spieß') || n.includes('wurfspeer')) return ico('spear');
    if (n.includes('kampfstab') || n.includes('stab')) return ico('staff');
    if (n.includes('streitkolben') || n.includes('kolben')) return ico('mace');
    if (n.includes('hammer') || n.includes('kriegshammer')) return ico('hammer');
    if (n.includes('morgenstern')) return ico('morningstar');
    if (n.includes('hellebarde')) return ico('halberd');
    if (n.includes('glefe')) return ico('glaive');
    if (n.includes('lanze')) return ico('lance');
    if (n.includes('dreizack')) return ico('trident');
    if (n.includes('peitsche')) return ico('whip');
    if (n.includes('flegel')) return ico('flail');
    if (n.includes('keule')) return ico('club');
    if (n.includes('sichel')) return ico('sickle');
    if (n.includes('schleuder')) return ico('sling');
    if (n.includes('schlag') || n.includes('unbewaffnet')) return ico('strike');
    if (n.includes('pfeil') || n.includes('wurf')) return ico('arrow');
    return ico('sword');
}

function actionIcon(item) {
    if (item.type === 'melee' || item.sub?.includes('Nahkampf')) return ico('melee', COMBAT_ICO);
    if (item.type === 'ranged' || item.sub?.includes('Fernkampf')) return ico('ranged', COMBAT_ICO);
    if (item.name?.includes('Wind') || item.name?.includes('Heil')) return ico('bonus-action', COMBAT_ICO);
    if (item.name?.includes('stoß') || item.name?.includes('Blitz')) return ico('action', COMBAT_ICO);
    if (item.name?.includes('Gelegenheit')) return ico('reaction', COMBAT_ICO);
    return ico('action', COMBAT_ICO);
}

// Spell school → icon file (German abbreviation → English filename)
const SCHOOL_MAP = {
    'Abj.':'abjuration','Erkund.':'divination','Hervorruf.':'evocation',
    'Illusion':'illusion','Nekro.':'necromancy','Verwandl.':'transmutation',
    'Verzaub.':'enchantment','Beschw.':'conjuration',
    'Abjuration':'abjuration','Divination':'divination','Evocation':'evocation',
    'Necromancy':'necromancy','Transmutation':'transmutation',
    'Enchantment':'enchantment','Conjuration':'conjuration','Illusion':'illusion',
    'Abjura.':'abjuration','Divina.':'divination','Evocat.':'evocation',
    'Necrom.':'necromancy','Transm.':'transmutation',
    'Enchan.':'enchantment','Conjur.':'conjuration','Illusi.':'illusion'
};
function spellSchoolIco(school) {
    const file = SCHOOL_MAP[school] || school?.toLowerCase() || 'evocation';
    return `<img src="${SPELL_ICO}${file}.svg" class="spell-school-ico" onerror="this.style.display='none'">`;
}

function invIcon(cat) {
    if (cat === 'weapon') return ico('sword');
    if (cat === 'armor') return `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(180,180,200,.7)" stroke-width="1.5" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(180,180,200,.7)" stroke-width="1.5" width="20" height="20"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`;
}

let S=defaultState();
// CALCULATIONS
// ═══════════════════════════════════════════════════════
let C={};
function mod(v){return Math.floor((v-10)/2)}
function fmt(v){return v>=0?'+'+v:''+v}
function calc(){
    C={};
    C.mods={};C.saves={};C.skills=[];
    // Compute total level from classes
    if(S.classes&&S.classes.length){S.level=S.classes.reduce((s,c)=>s+c.level,0);S.class1=S.classes[0].name;S.subclass=S.classes[0].subclass||"";}
    C.profBonus=Math.ceil(S.level/4)+1;
    ABILITIES.forEach(a=>{
        C.mods[a]=mod(S.abilities[a]);
        C.saves[a]=C.mods[a]+(S.saveProficiencies[a]?C.profBonus:0);
    });
    SKILLS.forEach((sk,i)=>{
        let v=C.mods[sk.a];
        if(S.skillProficiencies[i])v+=C.profBonus;
        if(S.skillExpertise[i])v+=C.profBonus;
        C.skills.push({...sk,mod:v,prof:!!S.skillProficiencies[i],exp:!!S.skillExpertise[i],passive:10+v});
    });
    C.init=C.mods.dex;
    C.passivePerception=10+C.mods.wis+(S.skillProficiencies[11]?C.profBonus:0)+(S.skillExpertise[11]?C.profBonus:0);
    C.passiveInsight=10+C.mods.wis+(S.skillProficiencies[6]?C.profBonus:0)+(S.skillExpertise[6]?C.profBonus:0);
    C.passiveInvestigation=10+C.mods.int+(S.skillProficiencies[8]?C.profBonus:0)+(S.skillExpertise[8]?C.profBonus:0);
    let sa=S.spellAbility||'int';
    C.spellMod=C.mods[sa]+C.profBonus;
    C.spellDC=8+C.profBonus+C.mods[sa];
}

// ═══════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════
function render(){
    calc();
    renderAbilities();renderMeta();renderStats();renderHP();renderHD();renderHeaderBg();
    renderInsp();renderDeathSaves();renderExhaustion();renderXP();
    renderConditions();renderConcentration();renderActions();renderQA();renderBuffs();
    renderSkills();renderSaves();renderCharacter();renderInventory();
    renderSpells();renderFeatures();renderBio();renderNotes();renderAttunement();
}

function renderAbilities(){
    let left='',right='';
    ABILITIES.forEach((a,i)=>{
        let m=C.mods[a],sv=C.saves[a],prof=S.saveProficiencies[a];
        let h=`<div class="ab-hex" style="--c:${AB_COLORS[a]}"><div class="ab" onclick="rollDice('1d20',${m},'${AB_FULL_DE[a]}')">
            <div class="l">${AB_DE[a]}</div><div class="m">${fmt(m)}</div>
            <input class="e-num" value="${S.abilities[a]}" onchange="S.abilities.${a}=+this.value;render();save()" onclick="event.stopPropagation()">
            <div class="sv" onclick="event.stopPropagation();rollDice('1d20',${sv},'${AB_FULL_DE[a]} Rettung')" title="Rettungswurf">${prof?'<span class="dot"></span>':''}${fmt(sv)}</div></div></div>`;
        if(i<3)left+=h;else right+=h;
    });
    document.getElementById('abs-left').innerHTML=left;
    document.getElementById('abs-right').innerHTML=right;
}

function renderMeta(){
    document.getElementById('charName').value=S.name;
    document.getElementById('lvlBadge').textContent=S.level;
    let classBadges='';
    if(S.classes&&S.classes.length>1){
        classBadges=S.classes.map(c=>`<span class="badge badge-class"><b>${c.name}</b> ${c.level}</span>`).join('');
    } else {
        classBadges=`<span class="badge badge-class"><b>${S.class1||'—'}</b> ${S.level}</span><span class="badge">${S.subclass||'—'}</span>`;
    }
    document.getElementById('metaRow1').innerHTML=
        `<span class="badge">${S.species||'—'}</span>${classBadges}`;
    let moveStr=`${S.movement?S.movement.walk:S.speed||30} ft`;
    if(S.movement){
        if(S.movement.fly>0)moveStr+=` · Flug ${S.movement.fly} ft`;
        if(S.movement.swim>0)moveStr+=` · Schw. ${S.movement.swim} ft`;
    }
    document.getElementById('metaRow2').innerHTML=
        `<span class="badge">${S.size||'Mittel'} · ${moveStr}</span><span class="badge">${S.alignment||'—'}</span><span class="badge">${S.background||'—'}</span>`;
}

function renderStats(){
    document.getElementById('acVal').value=S.ac;
    document.getElementById('profVal').textContent=fmt(C.profBonus);
    document.getElementById('initVal').textContent=fmt(C.init);
    document.getElementById('ppVal').textContent=C.passivePerception;
    document.getElementById('piVal').textContent=C.passiveInsight;
    document.getElementById('pinvVal').textContent=C.passiveInvestigation;
}

// ═══════════════════════════════════════════════════════
// ORB SYSTEM (adapted from Worlds Apart)
// ═══════════════════════════════════════════════════════
function surfaceY(pct){ return 8 + (1 - Math.max(0,Math.min(1,pct))) * 105; }

function createHPOrb(cur, max) {
    const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const s = surfaceY(pct);
    // Color shifts: green > 50%, orange 25-50%, red < 25%
    const C = pct > 0.5
        ? ['#3ddf80','#2ecc71','#22a854','#1a8a42','#146b34','#0d4a22','#072e15']
        : pct > 0.25
        ? ['#ffb347','#f97316','#e06010','#b54a08','#7a3005','#4a1c02','#281001']
        : ['#ff6b6b','#e04040','#c02828','#9a1818','#6a0808','#3a0404','#1c0202'];
    const glow = pct > 0.5 ? '#3ddf80' : pct > 0.25 ? '#f97316' : '#e04040';
    const hl   = pct > 0.5 ? '#a0ffc8' : pct > 0.25 ? '#ffd4a0' : '#ffaaaa';
    const bg   = pct > 0.5 ? '#050e08' : pct > 0.25 ? '#0e0602' : '#0e0202';
    const ring = pct > 0.5 ? '#0d2818' : pct > 0.25 ? '#2a1505' : '#2a0505';

    const L = [s,s+2,s+4,s+6,s+9,s+12,s+17];
    const A = [3,3,3,4,4,4,3];
    const D = [2,2.6,3.3,4,5,6.5,8];
    const O = [0.3,0.35,0.45,0.55,0.7,0.9,1];
    let waves = '';
    for(let i=6;i>=0;i--){
        const y=L[i],a=A[i],d=D[i];
        waves+=`<path fill="${C[i]}" opacity="${O[i]}"><animate attributeName="d" dur="${d}s" repeatCount="indefinite" values="M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y+a} ${25+i*5} ${y} Q${45+i*5} ${y-a} ${65+i*3} ${y} Q${85+i*2} ${y+a} ${105+i*3} ${y} Q${120+i} ${y-a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z"/></path>`;
    }
    const maxTxt = max > 0 ? cur : '0';
    return `<svg viewBox="0 0 120 120" width="84" height="84">
<defs>
<clipPath id="cHp"><circle cx="60" cy="60" r="52"/></clipPath>
<radialGradient id="gHp" cx="30%" cy="25%" r="60%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
</defs>
<circle cx="60" cy="60" r="56" fill="none" stroke="${ring}" stroke-width="1.5"/>
<circle cx="60" cy="60" r="55" fill="none" stroke="${ring}" stroke-width="3"/>
<circle cx="60" cy="60" r="52" fill="${bg}"/>
<g clip-path="url(#cHp)">
<g>${waves}</g>
<path fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round"><animate attributeName="d" dur="2.2s" repeatCount="indefinite" values="M9 ${s-3} Q18 ${s} 30 ${s} Q42 ${s-4} 54 ${s} Q66 ${s+4} 78 ${s} Q90 ${s-4} 102 ${s} Q114 ${s} 115 ${s-3};M9 ${s-3} Q18 ${s} 30 ${s} Q42 ${s+4} 54 ${s} Q66 ${s-4} 78 ${s} Q90 ${s+4} 102 ${s} Q114 ${s} 115 ${s-3};M9 ${s-3} Q18 ${s} 30 ${s} Q42 ${s-4} 54 ${s} Q66 ${s+4} 78 ${s} Q90 ${s-4} 102 ${s} Q114 ${s} 115 ${s-3}"/></path>
<circle r="2" fill="${hl}" opacity="0"><animate attributeName="cx" dur="4s" repeatCount="indefinite" values="35;37;34;35"/><animate attributeName="cy" dur="4s" repeatCount="indefinite" values="100;42;28;100"/><animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;0.3;0.1;0"/></circle>
<circle r="1.2" fill="${hl}" opacity="0"><animate attributeName="cx" dur="5.5s" repeatCount="indefinite" values="72;74;70;72"/><animate attributeName="cy" dur="5.5s" repeatCount="indefinite" values="105;45;32;105"/><animate attributeName="opacity" dur="5.5s" repeatCount="indefinite" values="0;0.22;0.06;0"/></circle>
<circle r="1.6" fill="${hl}" opacity="0"><animate attributeName="cx" dur="7s" repeatCount="indefinite" values="52;48;55;52"/><animate attributeName="cy" dur="7s" repeatCount="indefinite" values="110;38;24;110"/><animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="0;0.2;0.04;0"/></circle>
</g>
<circle cx="60" cy="60" r="52" fill="url(#gHp)"/>
<ellipse cx="42" cy="36" rx="10" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-25 42 36)"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text x="60" y="65" text-anchor="middle" fill="white" font-family="Cinzel,serif" font-size="22" font-weight="700" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.8))">${cur}</text>
</svg>`;
}

function createXPOrb(cur, max) {
    const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const s = surfaceY(pct);
    const C = ['#f5d06a','#d4a844','#b8881e','#8a6010','#5a3c06','#362202','#1a1001'];
    const glow = '#d4a844', hl = '#fde68a', bg = '#0a0803', ring = '#2a1f08';
    const uid = 'xp' + Date.now().toString(36).slice(-4);

    const L = [s,s+2,s+4,s+7,s+10,s+13,s+17];
    const D = [1,1.3,1.7,2.2,2.8,3.8,5];
    const O = [0.3,0.35,0.45,0.55,0.7,0.9,1];
    let waves = '';
    for(let i=6;i>=0;i--){
        const y=L[i],d=D[i],a=3+(i<3?1:0);
        waves+=`<path fill="${C[i]}" opacity="${O[i]}"><animate attributeName="d" dur="${d}s" repeatCount="indefinite" values="M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y+a} ${25+i*5} ${y} Q${45+i*5} ${y-a} ${65+i*3} ${y} Q${85+i*2} ${y+a} ${105+i*3} ${y} Q${120+i} ${y-a} 130 ${y} V130 H-10Z;M-10 ${y} Q${10+i*3} ${y-a} ${25+i*5} ${y} Q${45+i*5} ${y+a} ${65+i*3} ${y} Q${85+i*2} ${y-a} ${105+i*3} ${y} Q${120+i} ${y+a} 130 ${y} V130 H-10Z"/></path>`;
    }
    return `<svg viewBox="0 0 120 120" width="84" height="84">
<defs>
<clipPath id="c${uid}"><circle cx="60" cy="60" r="52"/></clipPath>
<radialGradient id="g${uid}" cx="30%" cy="25%" r="60%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>
<filter id="f${uid}"><feGaussianBlur stdDeviation="1.5"/></filter>
</defs>
<circle cx="60" cy="60" r="56" fill="none" stroke="${ring}" stroke-width="1.5"/>
<circle cx="60" cy="60" r="55" fill="none" stroke="${ring}" stroke-width="3" opacity="0.6"/>
<circle cx="60" cy="60" r="52" fill="${bg}"/>
<g clip-path="url(#c${uid})">
<ellipse cx="60" cy="100" rx="35" ry="18" fill="${glow}" opacity="0.06"><animate attributeName="rx" dur="1.4s" repeatCount="indefinite" values="35;44;35"/><animate attributeName="opacity" dur="1.4s" repeatCount="indefinite" values="0.06;0.12;0.06"/></ellipse>
<g>${waves}</g>
<path fill="none" stroke="${glow}" stroke-width="1.5" stroke-linecap="round" opacity="0.4"><animate attributeName="d" dur="1.4s" repeatCount="indefinite" values="M9 ${s-2} Q18 ${s+1} 30 ${s+1} Q42 ${s-3} 54 ${s+1} Q66 ${s+5} 78 ${s+1} Q90 ${s-3} 102 ${s+1} Q114 ${s+1} 115 ${s-2};M9 ${s-2} Q18 ${s+1} 30 ${s+1} Q42 ${s+5} 54 ${s+1} Q66 ${s-3} 78 ${s+1} Q90 ${s+5} 102 ${s+1} Q114 ${s+1} 115 ${s-2};M9 ${s-2} Q18 ${s+1} 30 ${s+1} Q42 ${s-3} 54 ${s+1} Q66 ${s+5} 78 ${s+1} Q90 ${s-3} 102 ${s+1} Q114 ${s+1} 115 ${s-2}"/></path>
<circle r="2.5" fill="${glow}"><animate attributeName="cx" dur="2.5s" repeatCount="indefinite" values="30;34;27;30"/><animate attributeName="cy" dur="2.5s" repeatCount="indefinite" values="102;52;40;102"/><animate attributeName="opacity" dur="2.5s" repeatCount="indefinite" values="0;0.9;0.2;0"/></circle>
<circle r="1.5" fill="${hl}"><animate attributeName="cx" dur="3.2s" repeatCount="indefinite" values="75;72;78;75"/><animate attributeName="cy" dur="3.2s" repeatCount="indefinite" values="108;55;40;108"/><animate attributeName="opacity" dur="3.2s" repeatCount="indefinite" values="0;0.7;0.1;0"/></circle>
<circle r="1.2" fill="${hl}"><animate attributeName="cx" dur="4.5s" repeatCount="indefinite" values="52;48;55;52"/><animate attributeName="cy" dur="4.5s" repeatCount="indefinite" values="100;48;34;100"/><animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" values="0;0.5;0.05;0"/></circle>
</g>
<circle cx="60" cy="60" r="52" fill="url(#g${uid})"/>
<ellipse cx="42" cy="36" rx="10" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-25 42 36)"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text x="60" y="65" text-anchor="middle" fill="${hl}" font-family="Cinzel,serif" font-size="18" font-weight="700" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.9))">${Math.round(pct*100)}%</text>
</svg>`;
}

function renderHP(){
    // Orb
    const orbEl = document.getElementById('hpOrb');
    if(orbEl) orbEl.innerHTML = createHPOrb(S.hp.cur, S.hp.max);
    // Sub-label
    const subEl = document.getElementById('hpOrbSub');
    if(subEl){
        const pct=S.hp.max>0?(S.hp.cur/S.hp.max)*100:0;
        const col=pct>50?'#3ddf80':pct>25?'#f97316':'#e04040';
        subEl.innerHTML=`<span style="color:${col};font-weight:700">${S.hp.cur}</span><span style="color:var(--t3)"> / ${S.hp.max}</span>${S.hp.temp?`<span style="color:#60a5fa;font-size:9px"> +${S.hp.temp}tmp</span>`:''}`;
    }
    // HD label
    if(S.classes&&S.classes.length>1){
        const hdEl=document.getElementById('hdLabel');if(hdEl)hdEl.textContent=S.classes.map(c=>c.level+'W'+c.hitDie).join(' + ')+' TW';
    } else {
        const hdEl=document.getElementById('hdLabel');if(hdEl)hdEl.textContent=S.level+'W'+(S.classes&&S.classes[0]?S.classes[0].hitDie:S.hitDice.type)+' TW';
    }
    // Portrait ring
    const pctP=S.hp.max>0?Math.max(0,Math.min(100,(S.hp.cur/S.hp.max)*100)):0;
    let p=document.getElementById('portrait');
    if(p){p.classList.remove('hp-full','hp-mid','hp-low','hp-crit','hp-dead');
    if(S.hp.cur<=0)p.classList.add('hp-dead');
    else if(pctP<=25)p.classList.add('hp-crit');
    else if(pctP<=50)p.classList.add('hp-low');
    else if(pctP<=75)p.classList.add('hp-mid');
    else p.classList.add('hp-full');}
}

function renderHD(){
    let h='';
    if(S.classes&&S.classes.length){
        S.classes.forEach((c,ci)=>{
            if(c.hdUsed===undefined)c.hdUsed=0;
            for(let i=0;i<c.level;i++){
                let used=i<c.hdUsed;
                h+=`<div class="hd-pip ${used?'':'u'}" onclick="toggleHDmc(${ci},${i})" title="W${c.hitDie} ${used?'Verbraucht':'Verfügbar'}"></div>`;
            }
            if(ci<S.classes.length-1)h+='<div class="hd-sep"></div>';
        });
    } else {
        for(let i=0;i<S.level;i++){
            let used=i<S.hitDice.used;
            h+=`<div class="hd-pip ${used?'':'u'}" onclick="toggleHDlegacy(${i})" title="${used?'Verbraucht':'Verfügbar'}"></div>`;
        }
    }
    document.getElementById('hdPips').innerHTML=h;
}

function renderInsp(){
    document.getElementById('inspChip').classList.toggle('on',S.inspiration);
}

function renderDeathSaves(){
    document.querySelectorAll('.ds-pip').forEach((p,i)=>{
        p.classList.toggle('on',!!S.deathSaves[i]);
    });
}

function renderExhaustion(){
    let h='';
    for(let i=0;i<6;i++) h+=`<div class="exh-pip ${i<S.exhaustion?'on':''}" onclick="S.exhaustion=${i<S.exhaustion?i:i+1};renderExhaustion();save()"></div>`;
    document.getElementById('exhPips').innerHTML=h;
}

function renderXP(){
    let next=XP_TABLE[S.level]||999999,prev=XP_TABLE[S.level-1]||0;
    let pct=next>prev?(S.xp-prev)/(next-prev):1;
    const orbEl=document.getElementById('xpOrb');
    if(orbEl) orbEl.innerHTML=createXPOrb(S.xp,next===999999?S.xp:next);
    const subEl=document.getElementById('xpOrbSub');
    if(subEl) subEl.innerHTML=`<span style="color:var(--gold);font-weight:700">${S.xp.toLocaleString('de')}</span><span style="color:var(--t3)"> / ${next>=999999?'MAX':next.toLocaleString('de')}</span>`;
    // Legacy input support (hidden but functional)
    const xpInp=document.getElementById('xpCur');if(xpInp)xpInp.value=S.xp;
}

function renderConditions(){
    let h='';
    CONDITIONS.forEach(c=>{
        h+=`<span class="cond ${S.conditions[c]?'on':''}" data-c="${c}" onclick="S.conditions['${c}']=!S.conditions['${c}'];this.classList.toggle('on');updatePortraitOverlay();save()">${c}</span>`;
    });
    document.getElementById('condBar').innerHTML=h;
    updatePortraitOverlay();
}
function updatePortraitOverlay(){
    let active=Object.values(S.conditions).some(v=>v);
    document.getElementById('portOverlay').classList.toggle('cond-active',active);
}

function renderConcentration(){
    let b=document.getElementById('concBanner');
    if(S.concentrationSpell){
        b.classList.add('on');
        document.getElementById('concSpell').textContent=S.concentrationSpell;
    }else b.classList.remove('on');
}

function renderActions(){
    let groups={action:[],bonus:[],reaction:[],other:[]};
    // weapons first
    S.weapons.forEach((w,wi)=>{
        let aMod=C.mods[w.ability]||0;
        let atk=aMod+C.profBonus;
        groups.action.push({name:w.name,sub:(w.type==='melee'?'Nahkampf':'Fernkampf')+' · '+w.props,iconHtml:weaponIco(w.name),roll:fmt(atk),dmg:w.dmg+fmt(aMod),range:w.range,uses:null,pinned:w.pinned,atkMod:atk,dmgStr:w.dmg+'+'+aMod,_ctxType:'weapon',_ctxIdx:wi});
    });
    S.actions.forEach((a,ai)=>{
        let g=groups[a.type]||groups.other;
        let rollVal='';
        if(a.roll){
            if(a.roll.startsWith('+'))rollVal=fmt(C.mods[a.roll.slice(1)]+ C.profBonus);
            else rollVal=a.roll;
        }
        g.push({name:a.name,sub:a.sub,iconHtml:actionIcon(a),roll:rollVal,dmg:a.dmg,range:a.range,uses:a.uses,pinned:a.pinned,_ctxType:'action',_ctxIdx:ai});
    });
    let labels={action:{l:'Aktion',cls:'ag-a'},bonus:{l:'Bonusaktion',cls:'ag-b'},reaction:{l:'Reaktion',cls:'ag-r'},other:{l:'Andere',cls:'ag-o'}};
    let html='';
    ['action','bonus','reaction','other'].forEach(t=>{
        let items=groups[t];if(!items.length)return;
        let lb=labels[t];
        html+=`<div class="ag ${lb.cls}"><div class="agh" onclick="this.classList.toggle('collapsed');this.nextElementSibling.style.display=this.classList.contains('collapsed')?'none':''"><span>${lb.l}</span><span class="n">${items.length}</span><span class="chv">&#9662;</span></div>`;
        html+=`<table class="at"><colgroup><col class="c-nm"><col class="c-ut"><col class="c-wf"><col class="c-sd"><col class="c-rw"><col class="c-ctx"></colgroup><thead><tr><th class="th-nm">Name</th><th>Nutzen</th><th>Wurf</th><th>Schaden</th><th>Reichw.</th><th></th></tr></thead><tbody>`;
        items.forEach(it=>{
            html+=`<tr><td class="td-nm"><div class="anm"><div class="ai">${it.iconHtml}</div><div><div class="atn">${it.name}</div><div class="ats">${it.sub}</div></div></div></td>`;
            html+=`<td>${it.uses?`<span class="ut" onclick="useCharge(this,event)" data-cur="${it.uses.cur}" data-max="${it.uses.max}">${it.uses.cur}/${it.uses.max}</span>`:'—'}</td>`;
            html+=`<td>${it.roll?`<button class="rb" onclick="rollDice('1d20',${parseInt(it.roll)||0},'${it.name}')">${it.roll}</button>`:'—'}</td>`;
            html+=`<td class="fm">${it.dmg||'—'}</td><td>${it.range||'—'}</td>`;
            html+=`<td><div class="ctx-dot" onclick="openCtxMenu(event,'${it._ctxType}',${it._ctxIdx})">&#8942;</div></td></tr>`;
        });
        html+=`</tbody></table></div>`;
    });
    document.getElementById('actionGroups').innerHTML=html;
}

function renderQA(){
    let pinned=[];
    S.weapons.forEach((w,wi)=>{
        if(!w.pinned)return;
        let atk=C.mods[w.ability]+C.profBonus;
        pinned.push({name:w.name,sub:(w.type==='melee'?'Nahkampf':'Fernkampf')+' · '+w.range,val:fmt(atk),iconHtml:weaponIco(w.name),mod:atk,label:w.name,_ctxType:'weapon',_ctxIdx:wi});
    });
    S.actions.forEach((a,ai)=>{
        if(!a.pinned)return;
        let val=a.uses?a.uses.cur+'/'+a.uses.max:(a.roll?fmt(C.mods[a.roll?.slice(1)]||0+C.profBonus):'');
        pinned.push({name:a.name,sub:a.sub,val:val,iconHtml:actionIcon(a),mod:0,label:a.name,_ctxType:'action',_ctxIdx:ai});
    });
    let h='';
    pinned.forEach(p=>{
        h+=`<div class="si" onclick="rollDice('1d20',${p.mod},'${p.label}')"><div class="si-i">${p.iconHtml}</div><div class="si-t"><div class="si-n">${p.name}</div><div class="si-s">${p.sub}</div></div><div class="si-v">${p.val}</div><div class="ctx-dot" onclick="event.stopPropagation();openCtxMenu(event,'${p._ctxType}',${p._ctxIdx})">&#8942;</div></div>`;
    });
    document.getElementById('qaList').innerHTML=h;
    document.getElementById('qaCount').textContent=pinned.length;
}

function renderSkills(){
    let profCount=Object.keys(S.skillProficiencies).filter(k=>S.skillProficiencies[k]).length;
    document.getElementById('skillCount').textContent=`18 · ${profCount} geübt`;
    let h='';
    C.skills.forEach((sk,i)=>{
        let cls=sk.exp?'e':sk.prof?'p':'';
        h+=`<div class="sk" onclick="rollDice('1d20',${sk.mod},'${sk.n}')"><span class="skd ${cls}" onclick="event.stopPropagation();toggleSkillProf(${i})" title="Klick=Übung, Doppelklick=Expertise"></span><span class="ska">${AB_DE[sk.a].slice(0,3)}</span><span class="skn">${sk.n}</span><span class="skv">${fmt(sk.mod)}</span><span class="skp">${sk.passive}</span></div>`;
    });
    document.getElementById('skillList').innerHTML=h;
}

function renderSaves(){
    let h='';
    ABILITIES.forEach(a=>{
        h+=`<div class="rw" onclick="rollDice('1d20',${C.saves[a]},'${AB_FULL_DE[a]} Rettung')"><span class="dt ${S.saveProficiencies[a]?'p':''}" onclick="event.stopPropagation();S.saveProficiencies['${a}']=!S.saveProficiencies['${a}'];render();save()"></span><span class="nm">${AB_FULL_DE[a]}</span><span class="vl">${fmt(C.saves[a])}</span></div>`;
    });
    document.getElementById('saveList').innerHTML=h;
}

function renderCharacter(){
    // Classes
    let clH='';
    const HIT_DICE={Barbar:12,Kämpfer:10,Paladin:10,Waldläufer:10,Barde:8,Druide:8,Hexenmeister:8,Kleriker:8,Mönch:8,Schurke:8,Magier:6,Zauberer:6};
    if(S.classes&&S.classes.length){
        S.classes.forEach((c,i)=>{
            clH+=`<div class="cls-row">
                <span class="cls-name"><input class="e" value="${c.name}" onchange="S.classes[${i}].name=this.value;calc();render();save()"></span>
                <span class="cls-sub"><input class="e" value="${c.subclass||''}" placeholder="Unterklasse" onchange="S.classes[${i}].subclass=this.value;calc();render();save()"></span>
                <span class="cls-lvl">
                    <button class="lvl-btn" onclick="adjustClassLvl(${i},-1)">-</button>
                    <input class="e" style="width:28px;text-align:center;font-weight:700;font-size:14px" value="${c.level}" onchange="S.classes[${i}].level=Math.max(1,+this.value);calc();render();save()">
                    <button class="lvl-btn" onclick="adjustClassLvl(${i},1)">+</button>
                </span>
                <span class="cls-die">W${c.hitDie}</span>
                ${S.classes.length>1?`<span class="cls-del" onclick="S.classes.splice(${i},1);calc();render();save()">&times;</span>`:''}
            </div>`;
        });
    }
    document.getElementById('classBlock').innerHTML=clH;
    // Languages & Tools
    let lang=`<div class="tr"><span class="tl">Sprachen</span><span class="tv"><input class="e" value="${S.languages||'—'}" onchange="S.languages=this.value;save()"></span></div>`;
    lang+=`<div class="tr"><span class="tl">Werkzeuge</span><span class="tv"><input class="e" value="${S.props.tools||'—'}" onchange="S.props.tools=this.value;save()"></span></div>`;
    document.getElementById('langBlock').innerHTML=lang;
    // Movement
    let mv='';
    const mvLabels={walk:'Gehen',fly:'Fliegen',swim:'Schwimmen',climb:'Klettern',burrow:'Graben'};
    Object.entries(S.movement).forEach(([k,v])=>{
        mv+=`<div class="tr"><span class="tl">${mvLabels[k]}</span><span class="tv"><input class="e" style="width:50px;text-align:right" value="${v||0}" onchange="S.movement.${k}=+this.value;save()"> ft</span></div>`;
    });
    document.getElementById('moveBlock').innerHTML=mv;
    // Resources
    let rs='';
    S.resources.forEach((r,i)=>{
        let pips='';
        for(let p=0;p<r.max;p++){
            pips+=`<span class="res-pip ${p<r.cur?'on':''}" style="--rc:${r.color||'var(--gold)'}" onclick="toggleResource(${i},${p})"></span>`;
        }
        rs+=`<div class="res-row"><span class="res-name">${r.name}</span><span class="res-pips">${pips}</span><span class="res-rest">${r.rest==='short'?'KR':'LR'}</span><span class="res-del" onclick="S.resources.splice(${i},1);render();save()">&times;</span></div>`;
    });
    document.getElementById('resBlock').innerHTML=rs;
    let se='';
    Object.entries(S.senses).forEach(([k,v])=>{
        let labels={darkvision:'Dunkelsicht',resistances:'Resistenzen',immunities:'Immunität',vulnerabilities:'Verwundbar'};
        let color=k==='resistances'?'color:var(--grn)':k==='vulnerabilities'?'color:var(--red)':'';
        se+=`<div class="tr"><span class="tl">${labels[k]||k}</span><span class="tv"><input class="e" value="${v||'—'}" style="${color}" onchange="S.senses.${k}=this.value;save()"></span></div>`;
    });
    document.getElementById('senseBlock').innerHTML=se;
    let pr='';
    let classStr=S.classes&&S.classes.length?S.classes.map(c=>c.name+' '+c.level+(c.subclass?' ('+c.subclass+')':'')).join(' / '):(S.class1+' '+S.level);
    [['Klasse',classStr],['Spezies',S.species],['Hintergrund',S.background],['Rüstung',S.props.armor],['Waffen',S.props.weapons]].forEach(([l,v])=>{
        pr+=`<div class="tr"><span class="tl">${l}</span><span class="tv">${v}</span></div>`;
    });
    document.getElementById('propsBlock').innerHTML=pr;
}

function renderInventory(){
    let totalWt=0;
    const catLabels={weapon:'Waffen',armor:'Rüstung',gear:'Ausrüstung'};
    const catColors={weapon:'var(--red)',armor:'var(--blu)',gear:'#d4860e'};
    const catBorder={weapon:'var(--red)',armor:'var(--blu)',gear:'#d4860e'};
    const catBg={weapon:'rgba(208,64,64,.12)',armor:'rgba(64,144,224,.12)',gear:'rgba(212,134,14,.12)'};
    const catIcons={armor:invIcon('armor'),gear:invIcon('gear')};
    let html='';
    ['weapon','armor','gear'].forEach(cat=>{
        let items=S.inventory.filter(it=>it.cat===cat);
        if(!items.length)return;
        html+=`<div class="ag inv-ag" style="border-top:2px solid ${catBorder[cat]}">`;
        html+=`<div class="agh" style="background:linear-gradient(90deg,${catBg[cat]},transparent);color:${catColors[cat]}">`;
        html+=`<span>${catLabels[cat]}</span><span class="n" style="background:${catColors[cat]};color:#fff">${items.length}</span><span class="chv" onclick="this.closest('.agh').classList.toggle('collapsed');this.closest('.ag').querySelector('.inv-body').style.display=this.closest('.agh').classList.contains('collapsed')?'none':''" style="margin-left:auto;opacity:.4;font-size:10px;cursor:pointer">&#9662;</span></div>`;
        html+=`<div class="inv-body"><table class="at"><colgroup><col class="c-nm"><col style="width:90px"><col style="width:110px"><col style="width:36px"></colgroup>`;
        html+=`<thead><tr><th class="th-nm">Gegenstand</th><th>Anz.</th><th>Gew.</th><th></th></tr></thead><tbody>`;
        items.forEach((it)=>{
            let gi=S.inventory.indexOf(it);
            let wt=it.qty*it.wt;totalWt+=wt;
            let icon=cat==='weapon'?weaponIco(it.name):catIcons[cat];
            html+=`<tr class="${it.equipped?'inv-eq':''}">`;
            html+=`<td class="td-nm"><div class="anm"><div class="ai">${icon}</div><div><div class="atn"><input class="e" value="${it.name}" onchange="S.inventory[${gi}].name=this.value;save()"></div><div class="ats">${(it.wt||0)} lb/Stk</div></div></div></td>`;
            html+=`<td><input class="e-num" value="${it.qty}" onchange="S.inventory[${gi}].qty=+this.value;renderInventory();save()" style="width:50px;text-align:center"></td>`;
            html+=`<td style="color:var(--t2);font-size:12px">${(wt).toFixed(wt%1?1:0)} lb</td>`;
            html+=`<td><div class="ctx-dot" onclick="openCtxMenu(event,'inv',${gi})">&#8942;</div></td></tr>`;
        });
        html+=`</tbody></table></div></div>`;
    });
    document.getElementById('invBody').innerHTML=html;
    let unit=S.weightUnit||'lb';
    let factor=unit==='kg'?0.453592:1;
    let maxWt=S.abilities.str*15;
    let dispTotal=unit==='kg'?Math.round(totalWt*factor*10)/10:Math.round(totalWt);
    let dispMax=unit==='kg'?Math.round(maxWt*factor*10)/10:maxWt;
    document.getElementById('encBar').style.width=Math.min(100,(totalWt/maxWt)*100)+'%';
    document.getElementById('encBar').style.background=totalWt>maxWt?'var(--red)':totalWt>maxWt*.75?'var(--gold)':'var(--grn)';
    document.getElementById('encText').innerHTML=`<b style="color:var(--tx)">${dispTotal}</b> / ${dispMax} ${unit}`;
    document.getElementById('wtUnit').textContent=unit;
    let cur='';
    ['pp','gp','ep','sp','cp'].forEach(c=>{
        let labels={pp:'PM',gp:'GM',ep:'EM',sp:'SM',cp:'KM'};
        let colors={pp:'#b0b0c0',gp:'var(--gold)',ep:'#a0a0a0',sp:'#c0c0c0',cp:'#c08040'};
        cur+=`<div class="cur-item"><input value="${S.currency[c]||0}" style="color:${colors[c]}" onchange="S.currency.${c}=+this.value;renderInventory();save()"><label>${labels[c]}</label></div>`;
    });
    cur+=`<div class="cur-conv" onclick="convertCurrency()" title="Aufwechseln">&#8644;</div>`;
    cur+=`<div class="cur-total">${calcTotalGP()} GM</div>`;
    document.getElementById('curRow').innerHTML=cur;
}

function renderSpells(){
    let slotH='';
    for(let l=1;l<=9;l++){
        let sl=S.spellSlots[l];if(!sl||!sl.max)continue;
        let pips='';
        for(let i=0;i<sl.max;i++) pips+=`<div class="pip ${i<sl.used?'u':''}" onclick="toggleSlot(${l},${i})"></div>`;
        slotH+=`<div class="sg"><div class="sg-l">Grad ${l}</div><div class="pips">${pips}</div></div>`;
    }
    let sa=S.spellAbility||'int';
    slotH+=`<div class="spell-meta">Attribut <b style="color:${AB_COLORS[sa]}">${AB_DE[sa]}</b> · SG <b>${C.spellDC}</b> · Angriff <b>${fmt(C.spellMod)}</b></div>`;
    document.getElementById('slotBar').innerHTML=slotH;
    // Pact Slots
    let pactH='';
    if(S.pactSlots.max>0){
        let pp='';
        for(let i=0;i<S.pactSlots.max;i++) pp+=`<div class="pact-pip ${i<(S.pactSlots.max-S.pactSlots.used)?'on':''}" onclick="togglePactSlot(${i})"></div>`;
        pactH=`<div class="pact-row"><span class="l">Pakt-Plätze</span><span class="pact-info">(kurze Rast)</span><span class="pips">${pp}</span></div>`;
    }
    document.getElementById('pactRow').innerHTML=pactH;

    let levels={};
    S.spells.forEach(sp=>{if(!levels[sp.level])levels[sp.level]=[];levels[sp.level].push(sp)});
    let spH='';
    Object.keys(levels).sort((a,b)=>a-b).forEach(l=>{
        let lbl=+l===0?'Zaubertricks':`Grad ${l}`;
        let sl=S.spellSlots[l];
        let cnt=+l===0?levels[l].length+' bekannt':(sl?sl.max+' Plätze · '+levels[l].filter(s=>s.prepared).length+' vorb.':'');
        spH+=`<div class="lvl-h">${lbl} <span>${cnt}</span></div>`;
        spH+=`<table class="at"><colgroup><col class="c-nm"><col style="width:60px"><col style="width:80px"><col style="width:110px"><col style="width:130px"><col style="width:36px"></colgroup><thead><tr><th class="th-nm">Zauber</th><th>Vorb.</th><th>Komp.</th><th>Info</th><th>Tags</th><th></th></tr></thead><tbody>`;
        levels[l].forEach((sp,i)=>{
            let gi=S.spells.indexOf(sp);
            let tags='';
            if(sp.conc)tags+='<span class="conc" title="Konzentration">K</span>';
            if(sp.ritual)tags+='<span class="rit" title="Ritual">R</span>';
            spH+=`<tr><td class="td-nm"><div class="anm"><div class="ai">${spellSchoolIco(sp.school)}</div><div><div class="atn">${sp.name}</div><div class="ats">${sp.school}</div></div></div></td>`;
            spH+=`<td><div class="spc ${sp.prepared?'on':''}" onclick="event.stopPropagation();S.spells[${gi}].prepared=!S.spells[${gi}].prepared;renderSpells();save()" title="Vorbereitet"></div></td>`;
            spH+=`<td style="font-size:11px;color:var(--t3)">${sp.comp||'—'}</td>`;
            spH+=`<td style="font-size:12px;color:var(--t2)">${sp.info||'—'}</td>`;
            spH+=`<td>${tags}</td>`;
            spH+=`<td><div class="ctx-dot" onclick="event.stopPropagation();openCtxMenu(event,'spell',${gi})">&#8942;</div></td></tr>`;
            spH+=`<tr class="sp-note-row ${sp._noteOpen?'vis':''}"><td colspan="6" style="padding:0"><div class="sp-note ${sp._noteOpen?'vis':''}" id="spNote${gi}"><input class="e" value="${sp.notes||''}" placeholder="Notizen..." onclick="event.stopPropagation()" onchange="S.spells[${gi}].notes=this.value;save()"></div></td></tr>`;
        });
        spH+=`</tbody></table>`;
    });
    document.getElementById('spellList').innerHTML=spH;
}

function renderFeatures(){
    let h='';
    S.features.class.forEach((f,i)=>{
        h+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span><span class="feat-src">${f.src||''}</span>${f.uses?`<span class="feat-u"><span class="ut">${f.uses.cur}/${f.uses.max}</span></span>`:''}<div class="ctx-dot" onclick="event.stopPropagation();openCtxMenu(event,'feature-class',${i})">&#8942;</div></div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('classFeats').innerHTML=h;
    let sp='';
    S.features.species.forEach((f,i)=>{
        sp+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span><div class="ctx-dot" onclick="event.stopPropagation();openCtxMenu(event,'feature-species',${i})">&#8942;</div></div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('speciesFeats').innerHTML=sp;
    document.getElementById('speciesName').textContent=S.species;
    let ft='';
    S.features.feats.forEach((f,i)=>{
        ft+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span><div class="ctx-dot" onclick="event.stopPropagation();openCtxMenu(event,'feature-feat',${i})">&#8942;</div></div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('featFeats').innerHTML=ft||'<div style="padding:14px;color:var(--t3);font-size:12px">Keine Talente gewählt</div>';
}

function renderNotes(){
    let n=S.notes||{};
    ['Quests','NPCs','Places','Session','Misc'].forEach(k=>{
        let el=document.getElementById('notes'+k);
        if(el)el.value=n[k.toLowerCase()]||'';
    });
}

function renderBio(){
    let fields=[['Persönlichkeit','personality'],['Ideale','ideals'],['Bindungen','bonds'],['Schwächen','flaws'],['Hintergrundgeschichte','backstory','f'],['Erscheinung','appearance'],['Notizen','notes']];
    let h='';
    fields.forEach(([l,k,cls])=>{
        h+=`<div class="bc ${cls||''}"><div class="bh">${l}</div><div class="bb"><textarea onchange="S.bio.${k}=this.value;save()">${S.bio[k]||''}</textarea></div></div>`;
    });
    document.getElementById('bioGrid').innerHTML=h;
}

function renderAttunement(){
    let h='';
    S.attunement.forEach((on,i)=>{
        h+=`<div class="att-pip ${on?'on':''}" onclick="S.attunement[${i}]=!S.attunement[${i}];renderAttunement();save()"></div>`;
    });
    document.getElementById('attSlots').innerHTML=h;
}

// ═══════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════
function sw(id){document.querySelectorAll('.tb').forEach(t=>t.classList.remove('on'));document.querySelectorAll('.pnl').forEach(p=>p.classList.remove('on'));event.target.closest('.tb').classList.add('on');document.getElementById('p-'+id).classList.add('on')}

function toggleDS(el,i){S.deathSaves[i]=S.deathSaves[i]?0:1;el.classList.toggle('on');save()}
function toggleHDmc(ci,i){let c=S.classes[ci];if(i<c.hdUsed)c.hdUsed=i;else c.hdUsed=i+1;renderHD();save()}
function toggleHDlegacy(i){if(i<S.hitDice.used)S.hitDice.used=i;else S.hitDice.used=i+1;renderHD();save()}
function toggleSlot(l,i){let sl=S.spellSlots[l];if(i<sl.used)sl.used=i;else sl.used=i+1;renderSpells();save()}
function toggleSkillProf(i){if(S.skillExpertise[i]){delete S.skillExpertise[i];delete S.skillProficiencies[i]}else if(S.skillProficiencies[i]){S.skillExpertise[i]=true}else{S.skillProficiencies[i]=true}render();save()}

function useCharge(el,ev){ev.stopPropagation();let c=+el.dataset.cur,m=+el.dataset.max;if(c>0){el.dataset.cur=c-1;el.textContent=(c-1)+'/'+m}save()}

function endConcentration(){S.concentrationSpell='';renderConcentration();save()}

function addItem(){S.inventory.push({name:'Neuer Gegenstand',cat:'gear',qty:1,wt:1,equipped:false});renderInventory();save()}
function calcTotalGP(){let c=S.currency;return((c.pp||0)*10+(c.gp||0)+(c.ep||0)*0.5+(c.sp||0)*0.1+(c.cp||0)*0.01).toFixed(1)}
function convertCurrency(){
    let total=(S.currency.pp||0)*1000+(S.currency.gp||0)*100+(S.currency.ep||0)*50+(S.currency.sp||0)*10+(S.currency.cp||0);
    S.currency.pp=Math.floor(total/1000);total%=1000;
    S.currency.gp=Math.floor(total/100);total%=100;
    S.currency.ep=0;
    S.currency.sp=Math.floor(total/10);total%=10;
    S.currency.cp=total;
    renderInventory();save();toast('Münzen aufgewechselt');
}
function toggleWeightUnit(){
    S.weightUnit=S.weightUnit==='kg'?'lb':'kg';
    renderInventory();save();
}
function addSpell(){S.spells.push({name:'Neuer Zauber',level:1,school:'?',comp:'V',info:'—',prepared:false,conc:false,ritual:false,notes:''});renderSpells();save()}
function toggleSpellNote(gi){S.spells[gi]._noteOpen=!S.spells[gi]._noteOpen;renderSpells()}
function addFeature(type){
    if(type==='class')S.features.class.push({name:'Neues Merkmal',src:'Klasse ?',desc:'Beschreibung...',uses:null});
    else S.features.feats.push({name:'Neues Talent',desc:'Beschreibung...'});
    renderFeatures();save();
}

// ═══════════════════════════════════════════════════════
// DICE
// ═══════════════════════════════════════════════════════
let diceState={};
function rollDice(dice,mod,label){
    diceState={dice,mod,label};
    document.getElementById('diceTitle').textContent=label;
    document.getElementById('diceSub').textContent=dice+' '+fmt(mod)+(S.exhaustion?' (Ersch. -'+(S.exhaustion*2)+')':'');
    document.getElementById('diceResult').textContent='—';
    document.getElementById('diceResult').className='dice-result';
    document.getElementById('diceDetail').textContent='';
    document.getElementById('diceOverlay').classList.add('on');
}
function reroll(mode){
    let m=diceState.mod-(S.exhaustion*2);
    let r1=Math.floor(Math.random()*20)+1;
    let r2=Math.floor(Math.random()*20)+1;
    let nat,total,detail;
    if(mode==='adv'){nat=Math.max(r1,r2);detail=`${r1}, ${r2} → ${nat} ${fmt(m)}`}
    else if(mode==='dis'){nat=Math.min(r1,r2);detail=`${r1}, ${r2} → ${nat} ${fmt(m)}`}
    else{nat=r1;detail=`${nat} ${fmt(m)}`}
    total=nat+m;
    let el=document.getElementById('diceResult');
    el.textContent=total;
    el.className='dice-result'+(nat===20?' crit':nat===1?' fail':'');
    document.getElementById('diceDetail').textContent=detail+(nat===20?' — Kritisch!':nat===1?' — Patzer!':'');
}
function closeDice(){document.getElementById('diceOverlay').classList.remove('on')}

// ═══════════════════════════════════════════════════════
// REST SYSTEM
// ═══════════════════════════════════════════════════════
function shortRest(){
    S.actions.forEach(a=>{if(a.uses&&a.uses.rest==='short')a.uses.cur=a.uses.max});
    S.pactSlots.used=0;
    if(S.resources)S.resources.forEach(r=>{if(r.rest==='short')r.cur=r.max});
    toast('Kurze Rast — Uses zurückgesetzt');
    render();save();
}
function longRest(){
    S.hp.cur=S.hp.max;S.hp.temp=0;
    // Recover hit dice (multiclass)
    let hdRecovery=Math.max(1,Math.floor(S.level/2));
    if(S.classes&&S.classes.length){
        S.classes.forEach(c=>{
            let recover=Math.min(c.hdUsed||0,Math.ceil(hdRecovery*(c.level/S.level)));
            c.hdUsed=Math.max(0,(c.hdUsed||0)-Math.max(1,recover));
        });
    } else {
        S.hitDice.used=Math.max(0,S.hitDice.used-hdRecovery);
    }
    S.actions.forEach(a=>{if(a.uses)a.uses.cur=a.uses.max});
    S.features.class.forEach(f=>{if(f.uses)f.uses.cur=f.uses.max});
    for(let l=1;l<=9;l++)if(S.spellSlots[l])S.spellSlots[l].used=0;
    S.pactSlots.used=0;
    if(S.resources)S.resources.forEach(r=>r.cur=r.max);
    S.deathSaves=[0,0,0,0,0,0];
    if(S.exhaustion>0)S.exhaustion--;
    S.concentrationSpell='';
    toast('Lange Rast — Alles zurückgesetzt');
    render();save();
}

function toggleResource(ri,pi){
    let r=S.resources[ri];
    if(pi<r.cur)r.cur=pi;else r.cur=pi+1;
    render();save();
}
function addResource(){
    let name=prompt('Ressource Name:');if(!name)return;
    let max=+prompt('Max Aufladungen:',4)||4;
    let rest=confirm('Kurze Rast? (OK=Kurze, Abbrechen=Lange)')?'short':'long';
    S.resources.push({name,cur:max,max,rest,color:'var(--gold)'});
    render();save();toast('Ressource hinzugefügt: '+name);
}
function addClass(){
    let name=prompt('Klassenname:');if(!name)return;
    const HIT_DICE={Barbar:12,Kämpfer:10,Paladin:10,Waldläufer:10,Barde:8,Druide:8,Hexenmeister:8,Kleriker:8,Mönch:8,Schurke:8,Magier:6,Zauberer:6};
    let hitDie=HIT_DICE[name]||8;
    S.classes.push({name,subclass:'',level:1,hitDie,hdUsed:0});
    calc();render();save();toast('Klasse hinzugefügt: '+name+' (W'+hitDie+')');
}
function adjustClassLvl(ci,delta){
    S.classes[ci].level=Math.max(1,S.classes[ci].level+delta);
    calc();render();save();
}
function togglePactSlot(i){
    let avail=S.pactSlots.max-S.pactSlots.used;
    if(i<avail)S.pactSlots.used=S.pactSlots.max-i;
    else S.pactSlots.used=S.pactSlots.max-(i+1);
    render();save();
}

// ═══════════════════════════════════════════════════════
// BUFFS / EFFECTS
// ═══════════════════════════════════════════════════════
function renderBuffs(){
    if(!S.buffs)S.buffs=[];
    let h='';
    S.buffs.forEach((b,i)=>{
        let cls=b.type==='neg'?'buff-neg':b.type==='neu'?'buff-neu':'buff-pos';
        let dur=b.duration>0?`<span class="dur">${b.duration}R</span>`:'';
        h+=`<div class="buff ${cls}" title="${b.note||''}">${b.name} ${dur}<span class="bx" onclick="event.stopPropagation();removeBuff(${i})">&#10005;</span></div>`;
    });
    h+=`<div class="buff-add" onclick="openAddBuff()">+ Effekt</div>`;
    document.getElementById('buffBar').innerHTML=h;
}
function removeBuff(i){S.buffs.splice(i,1);renderBuffs();save()}
function openAddBuff(){
    document.getElementById('bName').value='';document.getElementById('bDur').value='';document.getElementById('bNote').value='';
    document.getElementById('buffOverlay').classList.add('on');document.getElementById('bName').focus();
}
function confirmAddBuff(){
    let name=document.getElementById('bName').value.trim();if(!name)return;
    S.buffs.push({name,type:document.getElementById('bType').value,duration:+document.getElementById('bDur').value||0,note:document.getElementById('bNote').value});
    document.getElementById('buffOverlay').classList.remove('on');
    renderBuffs();save();toast('Effekt hinzugefügt: '+name);
}

// ═══════════════════════════════════════════════════════
// HP MODAL (Damage/Heal)
// ═══════════════════════════════════════════════════════
let hpMode='dmg';
function openHPModal(mode){
    hpMode=mode;
    document.getElementById('hpModalTitle').textContent=mode==='dmg'?'Schaden':'Heilung';
    document.getElementById('hpModalTitle').style.color=mode==='dmg'?'var(--red)':'var(--grn)';
    document.getElementById('hpDelta').value='';
    document.getElementById('hpOverlay').classList.add('on');
    setTimeout(()=>document.getElementById('hpDelta').focus(),50);
}
function applyHP(){
    let delta=+document.getElementById('hpDelta').value;if(!delta||delta<0)return;
    if(hpMode==='dmg'){
        // damage temp HP first
        if(S.hp.temp>0){
            let absorbed=Math.min(S.hp.temp,delta);
            S.hp.temp-=absorbed;delta-=absorbed;
        }
        S.hp.cur=Math.max(0,S.hp.cur-delta);
        showHPDelta(-delta-( +document.getElementById('hpDelta').value-delta),'var(--red)');
    }else{
        S.hp.cur=Math.min(S.hp.max,S.hp.cur+delta);
        showHPDelta(+delta,'var(--grn)');
    }
    document.getElementById('hpOverlay').classList.remove('on');
    renderHP();save();
}
function showHPDelta(val,color){
    let el=document.createElement('div');
    el.className='hp-delta';
    el.textContent=(val>0?'+':'')+val;
    el.style.color=color;
    let rect=document.getElementById('hpCur').getBoundingClientRect();
    el.style.left=rect.left+rect.width/2+'px';el.style.top=rect.top-10+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),800);
}

// ═══════════════════════════════════════════════════════
// ADD WEAPON / ACTION
// ═══════════════════════════════════════════════════════
function openAddWeapon(){
    delete window._editWeaponIdx;
    ['wName','wDmg','wDmgType','wProps','wRange'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('weaponOverlay').classList.add('on');document.getElementById('wName').focus();
}
function confirmAddWeapon(){
    let name=document.getElementById('wName').value.trim();if(!name)return;
    const data = {
        name,type:document.getElementById('wType').value,ability:document.getElementById('wAbility').value,
        dmg:document.getElementById('wDmg').value||'1W4',dmgType:document.getElementById('wDmgType').value||'',
        props:document.getElementById('wProps').value||'',range:document.getElementById('wRange').value||'5 ft',pinned:false
    };
    if (typeof window._editWeaponIdx === 'number') {
        data.pinned = S.weapons[window._editWeaponIdx].pinned;
        S.weapons[window._editWeaponIdx] = data;
        delete window._editWeaponIdx;
        toast('Waffe aktualisiert: '+name);
    } else {
        S.weapons.push(data);
        toast('Waffe hinzugefuegt: '+name);
    }
    document.getElementById('weaponOverlay').classList.remove('on');
    render();save();
}
function openAddAction(){
    delete window._editActionIdx;
    ['aName','aSub','aRoll','aDmg','aRange','aUsesCur','aUsesMax'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('actionOverlay').classList.add('on');document.getElementById('aName').focus();
}
function confirmAddAction(){
    let name=document.getElementById('aName').value.trim();if(!name)return;
    let usesCur=+document.getElementById('aUsesCur').value,usesMax=+document.getElementById('aUsesMax').value;
    let rest=document.getElementById('aUsesRest').value;
    const data = {
        name,sub:document.getElementById('aSub').value||'',type:document.getElementById('aType').value,
        uses:usesMax>0?{cur:usesCur||usesMax,max:usesMax,rest:rest||'long'}:null,
        roll:document.getElementById('aRoll').value||'',dmg:document.getElementById('aDmg').value||'',
        range:document.getElementById('aRange').value||'',pinned:false
    };
    if (typeof window._editActionIdx === 'number') {
        data.pinned = S.actions[window._editActionIdx].pinned;
        S.actions[window._editActionIdx] = data;
        delete window._editActionIdx;
        toast('Aktion aktualisiert: '+name);
    } else {
        S.actions.push(data);
        toast('Aktion hinzugefuegt: '+name);
    }
    document.getElementById('actionOverlay').classList.remove('on');
    render();save();
}

// ═══════════════════════════════════════════════════════
// PORTRAIT
// ═══════════════════════════════════════════════════════
function uploadPortrait(input){
    if(!input.files[0])return;
    let reader=new FileReader();
    reader.onload=function(e){
        let img=new Image();
        img.onload=function(){
            let c=document.createElement('canvas'),ctx=c.getContext('2d');
            let s=Math.min(img.width,img.height);
            c.width=200;c.height=200;
            ctx.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,200,200);
            S.portrait=c.toDataURL('image/jpeg',.8);
            document.getElementById('portImg').src=S.portrait;
            document.getElementById('portImg').style.display='';
            document.getElementById('portPlaceholder').style.display='none';
            save();
        };
        img.src=e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
}

function uploadBG(input){
    if(!input.files[0])return;
    let reader=new FileReader();
    reader.onload=function(e){
        let img=new Image();
        img.onload=function(){
            let c=document.createElement('canvas'),ctx=c.getContext('2d');
            let ratio=Math.max(1200/img.width,300/img.height);
            c.width=Math.round(img.width*ratio);c.height=Math.round(img.height*ratio);
            ctx.drawImage(img,0,0,c.width,c.height);
            S.headerBg=c.toDataURL('image/jpeg',.7);
            renderHeaderBg();save();
        };
        img.src=e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
}

function renderHeaderBg(){
    let el=document.getElementById('idBg');
    if(S.headerBg){
        el.style.backgroundImage='url('+S.headerBg+')';
        el.classList.add('on');
    }else{
        el.classList.remove('on');
    }
}

// ═══════════════════════════════════════════════════════
// SAVE / LOAD / EXPORT / IMPORT
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// RIFT INTEGRATION — Save / Load / RiftLink Bridge
// ═══════════════════════════════════════════════════════

let _charId = null;
let _roomCode = null;
let _riftLinkActive = false;
let _applyingRemote = false;
let _saveTimer = null;
let _lastLocalSave = 0;

/**
 * State migration: ensures old saves get new fields
 */
function migrateState() {
    if (!S.languages) S.languages = '';
    if (!S.movement) S.movement = { walk: S.speed || 30, fly: 0, swim: 0, climb: 0, burrow: 0 };
    if (!S.resources) S.resources = [];
    if (!S.headerBg) S.headerBg = '';
    if (!S.classes) S.classes = [{
        name: S.class1 || 'Kämpfer', subclass: S.subclass || '',
        level: S.level || 1, hitDie: S.hitDice ? S.hitDice.type : 10,
        hdUsed: S.hitDice ? S.hitDice.used : 0
    }];
    if (!S.weightUnit) S.weightUnit = 'lb';
    if (S.currency && S.currency.pp === undefined) { S.currency.pp = 0; S.currency.ep = 0; }
    if (!S.buffs) S.buffs = [];
}

/**
 * Apply portrait from state
 */
function applyPortrait() {
    if (S.portrait) {
        const img = document.getElementById('portImg');
        const ph = document.getElementById('portPlaceholder');
        if (img) { img.src = S.portrait; img.style.display = ''; }
        if (ph) ph.style.display = 'none';
    }
}

/**
 * Save — dual mode: RiftLink (room) or CharacterStorage (standalone)
 */
function save() {
    if (_applyingRemote) return; // Don't save during remote apply

    if (_riftLinkActive && _charId && window.RIFT && RIFT.state) {
        // Debounced RiftLink save
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
            const data = JSON.parse(JSON.stringify(S));
            data.ruleset = 'dnd5e';
            data.updatedAt = Date.now();
            data.name = S.name || 'Unbenannt';
            data.ownerId = window.RIFT?.firebase?.getCurrentUser?.()?.uid || '';
            // Strip portrait from RTDB write (Base64 exceeds 1MB limit)
            delete data.portrait;
            _lastLocalSave = Date.now();
            try {
                RIFT.state.set('characters.' + _charId, { id: _charId, ...data });
            } catch (e) {
                console.warn('[5e] RiftLink write failed:', e.message);
            }
        }, 200);
    }

    // Save to CharacterStorage (correct object format)
    if (typeof CharacterStorage !== 'undefined') {
        try {
            const charObj = {
                id: _charId || null,
                ruleset: 'dnd5e',
                name: S.name || 'Unbenannt',
                level: S.level || 1,
                portrait: S.portrait || '',
                data: JSON.parse(JSON.stringify(S))
            };
            const saved = CharacterStorage.save(charObj);
            if (saved && saved.id) {
                if (!_charId || _charId !== saved.id) {
                    _charId = saved.id;
                    console.log('[5e] CharacterStorage assigned new ID:', _charId);
                }
                // Update URL to reflect charId (remove ?new=true)
                const url = new URL(window.location);
                if (url.searchParams.get('new') || !url.searchParams.get('id') || url.searchParams.get('id') !== _charId) {
                    url.searchParams.delete('new');
                    url.searchParams.set('id', _charId);
                    if (_roomCode) url.searchParams.set('room', _roomCode);
                    window.history.replaceState({}, '', url.pathname + url.search);
                }
            }
        } catch (e) { console.warn('[5e] CharacterStorage save error:', e); }
    }

    // localStorage as final fallback
    try { localStorage.setItem('rift-5e', JSON.stringify(S)); } catch (e) {}
}

/**
 * Load character data from best available source
 */
function load() {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('id');
    const paramRoom = params.get('room');
    const isNew = params.get('new') === 'true';

    _charId = paramId || null;
    _roomCode = paramRoom || localStorage.getItem('rift_current_room');
    if (_roomCode) _roomCode = _roomCode.replace(/-/g, '').toUpperCase();

    // New character: use defaults, generate ID, update URL
    if (isNew || !_charId) {
        S = defaultState();
        if (!_charId) {
            const uid = window.RIFT?.firebase?.getCurrentUser?.()?.uid;
            _charId = uid ? 'dnd5e_' + uid.slice(0, 8) + '_' + Date.now() : 'local_' + Date.now();
        }
        migrateState();
        applyPortrait();
        // Don't update URL here — save() will do it after first save
        return;
    }

    // Try CharacterStorage first
    if (typeof CharacterStorage !== 'undefined') {
        try {
            const stored = CharacterStorage.getById(_charId);
            if (stored) {
                // CharacterStorage wraps state in .data
                S = stored.data || stored;
                migrateState();
                applyPortrait();
                console.log('[5e] Loaded from CharacterStorage:', _charId);
                return;
            }
        } catch (e) { console.warn('[5e] CharacterStorage load error:', e); }
    }

    // Fallback: localStorage
    try {
        const d = localStorage.getItem('rift-5e');
        if (d) {
            S = JSON.parse(d);
            migrateState();
            applyPortrait();
            console.log('[5e] Loaded from localStorage');
            return;
        }
    } catch (e) {}

    // Nothing found: defaults
    S = defaultState();
    migrateState();
}

/**
 * RiftLink bridge — connect if in room context
 */
function initRiftLink() {
    if (!window.RIFT || !RIFT.link || !RIFT.state) {
        console.log('[5e] RiftLink not available, offline mode');
        return;
    }
    if (!_roomCode) {
        console.log('[5e] No room code, offline mode');
        return;
    }
    if (!_charId) {
        console.warn('[5e] No character ID for RiftLink');
        return;
    }

    // Connect
    RIFT.link.watchChar(_charId, _roomCode);
    _riftLinkActive = true;
    console.log('[5e] RiftLink connected:', _charId, 'in', _roomCode);

    // Do NOT push initial state here — save() handles all writes.
    // Pushing here would send empty defaultState before wizard completes.

    // Listen for remote changes
    RIFT.state.on('riftlink:char:updated', (ev) => {
        if (!ev || ev.charId !== _charId) return;
        if (ev.origin === 'local') return;

        // Echo guard: ignore remote updates within 3s of our own save
        if (Date.now() - _lastLocalSave < 3000) {
            console.log('[5e] Ignoring remote echo (within 3s of local save)');
            return;
        }

        const remote = RIFT.state.get('characters.' + _charId);
        if (!remote) return;

        // Guard: don't overwrite filled local state with empty remote data
        if ((!remote.abilities || !remote.abilities.str || remote.abilities.str === 10) && S.abilities && S.abilities.str !== 10) {
            console.warn('[5e] Ignoring empty remote state — local data preserved');
            return;
        }

        _applyingRemote = true;
        try {
            // Merge remote into local state
            const keys = ['hp', 'ac', 'abilities', 'conditions', 'inspiration',
                'exhaustion', 'deathSaves', 'spellSlots', 'pactSlots',
                'concentrationSpell', 'buffs', 'xp', 'resources',
                'weapons', 'actions', 'spells', 'inventory', 'currency',
                'features', 'senses', 'movement', 'languages', 'classes',
                'attunement', 'bio', 'props', 'skillProficiencies',
                'skillExpertise', 'saveProficiencies', 'hitDice',
                'name', 'species', 'class1', 'subclass', 'background',
                'alignment', 'size', 'level', 'headerBg',
                'spellAbility', 'weightUnit'];

            for (const key of keys) {
                if (remote[key] !== undefined) {
                    S[key] = JSON.parse(JSON.stringify(remote[key]));
                }
            }

            migrateState();
            applyPortrait();
            render();
            console.log('[5e] Applied remote update:', ev.fields?.join(', '));
        } finally {
            _applyingRemote = false;
        }
    });
}

// ═══════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════
let _ctxTarget = null; // {type:'weapon'|'action'|'inv', index:number}

function openCtxMenu(e, type, index) {
    e.preventDefault();
    e.stopPropagation();
    _ctxTarget = { type, index };
    const menu = document.getElementById('ctxMenu');

    // Configure visible items based on type
    menu.querySelectorAll('.ctx-item').forEach(el => el.style.display = '');
    const equipItem = menu.querySelector('[data-action="equip"]');
    const pinItem = menu.querySelector('[data-action="pin"]');

    if (type === 'weapon') {
        const w = S.weapons[index];
        equipItem.style.display = 'none'; // weapons don't have equip toggle here
        document.getElementById('ctxPinLabel').textContent = w.pinned ? 'Aus Quick Actions entfernen' : 'Zu Quick Actions';
    } else if (type === 'inv') {
        const it = S.inventory[index];
        document.getElementById('ctxEquipLabel').textContent = it.equipped ? 'Ablegen' : 'Anlegen';
        pinItem.style.display = 'none';
    } else if (type === 'action') {
        const a = S.actions[index];
        equipItem.style.display = 'none';
        document.getElementById('ctxPinLabel').textContent = a.pinned ? 'Aus Quick Actions entfernen' : 'Zu Quick Actions';
    } else if (type === 'spell') {
        equipItem.style.display = 'none';
        pinItem.style.display = 'none';
    } else if (type === 'feature-class' || type === 'feature-species' || type === 'feature-feat') {
        equipItem.style.display = 'none';
        pinItem.style.display = 'none';
        menu.querySelector('[data-action="duplicate"]').style.display = 'none';
    }

    // Position
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;
    menu.classList.add('on');
    const mRect = menu.getBoundingClientRect();
    if (left + mRect.width > window.innerWidth - 8) left = window.innerWidth - mRect.width - 8;
    if (top + mRect.height > window.innerHeight - 8) top = rect.top - mRect.height - 4;
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
}

function closeCtxMenu() {
    document.getElementById('ctxMenu').classList.remove('on');
    _ctxTarget = null;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-menu') && !e.target.closest('.ctx-dot')) closeCtxMenu();
});

document.getElementById('ctxMenu').addEventListener('click', (e) => {
    const item = e.target.closest('.ctx-item');
    if (!item || !_ctxTarget) return;
    const action = item.dataset.action;
    const { type, index } = _ctxTarget;
    closeCtxMenu();

    if (action === 'view') {
        if (type === 'weapon') viewWeapon(index);
        else if (type === 'inv') viewInventoryItem(index);
        else if (type === 'action') viewAction(index);
        else if (type === 'spell') viewSpell(index);
        else if (type === 'feature-class') viewFeature('class', index);
        else if (type === 'feature-species') viewFeature('species', index);
        else if (type === 'feature-feat') viewFeature('feats', index);
    } else if (action === 'edit') {
        if (type === 'weapon') editWeapon(index);
        else if (type === 'inv') editInventoryItem(index);
        else if (type === 'action') editAction(index);
        else if (type === 'spell') viewSpell(index);
        else if (type === 'feature-class') viewFeature('class', index);
        else if (type === 'feature-species') viewFeature('species', index);
        else if (type === 'feature-feat') viewFeature('feats', index);
    } else if (action === 'equip') {
        if (type === 'inv') { S.inventory[index].equipped = !S.inventory[index].equipped; renderInventory(); save(); }
    } else if (action === 'pin') {
        if (type === 'weapon') { S.weapons[index].pinned = !S.weapons[index].pinned; render(); save(); }
        else if (type === 'action') { S.actions[index].pinned = !S.actions[index].pinned; render(); save(); }
    } else if (action === 'duplicate') {
        if (type === 'weapon') { S.weapons.push(JSON.parse(JSON.stringify(S.weapons[index]))); render(); save(); toast('Waffe dupliziert'); }
        else if (type === 'inv') { S.inventory.push(JSON.parse(JSON.stringify(S.inventory[index]))); renderInventory(); save(); toast('Item dupliziert'); }
        else if (type === 'action') { S.actions.push(JSON.parse(JSON.stringify(S.actions[index]))); render(); save(); toast('Aktion dupliziert'); }
        else if (type === 'spell') { S.spells.push(JSON.parse(JSON.stringify(S.spells[index]))); renderSpells(); save(); toast('Zauber dupliziert'); }
    } else if (action === 'delete') {
        if (type === 'weapon') { const n = S.weapons[index].name; S.weapons.splice(index, 1); render(); save(); toast(n + ' entfernt'); }
        else if (type === 'inv') { const n = S.inventory[index].name; S.inventory.splice(index, 1); renderInventory(); save(); toast(n + ' entfernt'); }
        else if (type === 'action') { const n = S.actions[index].name; S.actions.splice(index, 1); render(); save(); toast(n + ' entfernt'); }
        else if (type === 'spell') { const n = S.spells[index].name; S.spells.splice(index, 1); renderSpells(); save(); toast(n + ' entfernt'); }
        else if (type === 'feature-class') { const n = S.features.class[index].name; S.features.class.splice(index, 1); renderFeatures(); save(); toast(n + ' entfernt'); }
        else if (type === 'feature-species') { const n = S.features.species[index].name; S.features.species.splice(index, 1); renderFeatures(); save(); toast(n + ' entfernt'); }
        else if (type === 'feature-feat') { const n = S.features.feats[index].name; S.features.feats.splice(index, 1); renderFeatures(); save(); toast(n + ' entfernt'); }
    }
});

// ═══════════════════════════════════════════════════════
// VIEW MODAL
// ═══════════════════════════════════════════════════════
function openViewModal(html) {
    document.getElementById('viewModal').innerHTML = html;
    document.getElementById('viewOverlay').classList.add('on');
}
function closeViewModal() { document.getElementById('viewOverlay').classList.remove('on'); }

function viewWeapon(i) {
    const w = S.weapons[i];
    if (!w) return;
    const aMod = C.mods[w.ability] || 0;
    const atk = aMod + C.profBonus;
    const dmgTotal = w.dmg + (aMod >= 0 ? '+' : '') + aMod;
    const rarityColors = {common:'#9ca3af',uncommon:'#4ade80',rare:'#60a5fa','very-rare':'#c084fc',legendary:'#fbbf24',artifact:'#f97316'};
    const rarity = w.rarity || 'common';
    const rarityColor = rarityColors[rarity] || '#9ca3af';

    // Weapon properties for checkbox grid
    const ALL_PROPS = ['Adamantin','Munition','Finesse','Schwer','Leicht','Laden','Magisch','Reichweite','Wurfwaffe','Versilbert','Spezial','Zweihand','Vielseitig'];
    const curProps = (w.props || '').split(',').map(p => p.trim().toLowerCase());

    openViewModal(`
        <div class="vm-side">
            <div class="vm-art">${weaponIco(w.name)}</div>
            <div class="vm-rarity">
                <select onchange="S.weapons[${i}].rarity=this.value;save()" style="color:${rarityColor}">
                    <option value="common" ${rarity==='common'?'selected':''}>Gewoehnlich</option>
                    <option value="uncommon" ${rarity==='uncommon'?'selected':''} style="color:#4ade80">Ungewoehnlich</option>
                    <option value="rare" ${rarity==='rare'?'selected':''} style="color:#60a5fa">Selten</option>
                    <option value="very-rare" ${rarity==='very-rare'?'selected':''} style="color:#c084fc">Sehr Selten</option>
                    <option value="legendary" ${rarity==='legendary'?'selected':''} style="color:#fbbf24">Legendaer</option>
                    <option value="artifact" ${rarity==='artifact'?'selected':''} style="color:#f97316">Artefakt</option>
                </select>
            </div>
            <label class="vm-toggle"><input type="checkbox" ${w.pinned?'checked':''} onchange="S.weapons[${i}].pinned=this.checked;render();save()"> Quick Action</label>
            <div class="vm-sep"></div>
            <div class="vm-stat-label">Aktion</div>
            <div class="vm-pills">
                <span class="vm-pill hl">Aktion</span>
                <span class="vm-pill">${w.type==='melee'?'Nahkampf':'Fernkampf'}</span>
                <span class="vm-pill">${w.range}</span>
            </div>
            <div class="vm-stat-label">Angriff / Schaden</div>
            <div class="vm-pills">
                <span class="vm-pill hl">+${atk} Treffer</span>
                <span class="vm-pill">${dmgTotal} ${w.dmgType||''}</span>
            </div>
            <div class="vm-stat-label">Eigenschaften</div>
            <div class="vm-pills">
                ${w.props ? w.props.split(',').map(p => '<span class="vm-pill">'+p.trim()+'</span>').join('') : '<span class="vm-pill" style="color:var(--t4)">Keine</span>'}
            </div>
        </div>
        <div class="vm-main">
            <div class="vm-head">
                <div class="vm-head-info">
                    <div class="vm-type"><span class="vm-type-dot" style="background:${rarityColor}"></span> Waffe</div>
                    <div class="vm-title-row">
                        <div class="vm-title"><input value="${w.name}" onchange="S.weapons[${i}].name=this.value;render();save()"></div>
                    </div>
                    <div class="vm-subtitle">Waffe, ${w.type==='melee'?'Einfache Nahkampfwaffe':'Fernkampfwaffe'}, +${atk} Treffer</div>
                    <div class="vm-meta">
                        <span>&#9876; <b>${w.dmg}</b> ${w.dmgType||''}</span>
                        <span>&#9881; <b>${w.range}</b></span>
                        <span>&#9733; <b>${AB_DE[w.ability]}</b></span>
                    </div>
                </div>
                <div class="vm-close" onclick="closeViewModal()">&#10005;</div>
            </div>
            <div class="vm-tabs">
                <div class="vm-tab on" onclick="vmTab(this,0)">Beschreibung</div>
                <div class="vm-tab" onclick="vmTab(this,1)">Details</div>
                <div class="vm-tab" onclick="vmTab(this,2)">Aktivitaeten</div>
                <div class="vm-tab" onclick="vmTab(this,3)">Effekte</div>
            </div>
            <div class="vm-content">
                <!-- Tab 0: Description -->
                <div class="vm-panel" data-panel="0">
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Beschreibung <span class="vm-desc-edit" onclick="vmEditDesc(${i},'description')">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmDescText">${w.description || ''}</div>
                    </div>
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Chat-Beschreibung <span class="vm-desc-edit" onclick="vmEditDesc(${i},'chatDesc')">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmChatDesc">${w.chatDesc || ''}</div>
                    </div>
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Notizen <span class="vm-desc-edit" onclick="vmEditDesc(${i},'notes')">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmNotes">${w.notes || ''}</div>
                    </div>
                </div>
                <!-- Tab 1: Details -->
                <div class="vm-panel" data-panel="1" style="display:none">
                    <div class="vm-field"><label>Gewicht</label><input type="number" value="${w.weight||0}" onchange="S.weapons[${i}].weight=+this.value;save()" style="width:60px;flex:none"> <select class="vm-unit" onchange="S.weapons[${i}].weightUnit=this.value;save()"><option>lb</option><option>kg</option></select></div>
                    <div class="vm-field"><label>Preis</label><input type="number" value="${w.price||0}" onchange="S.weapons[${i}].price=+this.value;save()" style="width:60px;flex:none"> <select class="vm-unit" onchange="S.weapons[${i}].priceUnit=this.value;save()"><option value="gp">GM</option><option value="sp">SM</option><option value="cp">KM</option></select></div>
                    <div class="vm-section-head">Waffendetails</div>
                    <div class="vm-field"><label>Waffentyp</label>
                        <select onchange="S.weapons[${i}].weaponType=this.value;save()">
                            <option value="simple-melee" ${(w.weaponType||'')==='simple-melee'?'selected':''}>Einfache Nahkampf</option>
                            <option value="simple-ranged" ${(w.weaponType||'')==='simple-ranged'?'selected':''}>Einfache Fernkampf</option>
                            <option value="martial-melee" ${(w.weaponType||'')==='martial-melee'?'selected':''}>Kampf Nahkampf</option>
                            <option value="martial-ranged" ${(w.weaponType||'')==='martial-ranged'?'selected':''}>Kampf Fernkampf</option>
                        </select>
                    </div>
                    <div class="vm-field"><label>Basiswaffe</label><input value="${w.baseWeapon||w.name}" onchange="S.weapons[${i}].baseWeapon=this.value;save()"></div>
                    <div class="vm-field"><label>Attribut</label>
                        <select onchange="S.weapons[${i}].ability=this.value;render();save()">
                            ${ABILITIES.map(a=>'<option value="'+a+'" '+(w.ability===a?'selected':'')+'>'+AB_FULL_DE[a]+'</option>').join('')}
                        </select>
                    </div>
                    <div class="vm-field"><label>Schaden</label><input value="${w.dmg}" onchange="S.weapons[${i}].dmg=this.value;render();save()" style="width:60px;flex:none"> <input value="${w.dmgType||''}" placeholder="Schadensart" onchange="S.weapons[${i}].dmgType=this.value;save()"></div>
                    <div class="vm-field"><label>Reichweite</label><input value="${w.range}" onchange="S.weapons[${i}].range=this.value;render();save()"></div>
                    <div class="vm-field"><label>Kampftyp</label>
                        <select onchange="S.weapons[${i}].type=this.value;render();save()">
                            <option value="melee" ${w.type==='melee'?'selected':''}>Nahkampf</option>
                            <option value="ranged" ${w.type==='ranged'?'selected':''}>Fernkampf</option>
                        </select>
                    </div>
                    <div class="vm-section-head">Waffeneigenschaften</div>
                    <div class="vm-checks">
                        ${ALL_PROPS.map(p => {
                            const checked = curProps.includes(p.toLowerCase()) ? 'checked' : '';
                            return '<label class="vm-check"><input type="checkbox" '+checked+' onchange="vmToggleProp('+i+',\''+p+'\',this.checked)"> '+p+'</label>';
                        }).join('')}
                    </div>
                </div>
                <!-- Tab 2: Activities -->
                <div class="vm-panel" data-panel="2" style="display:none">
                    <div class="vm-fx-group">
                        <div class="vm-fx-head temp">Angriff <span class="vm-fx-count">1</span></div>
                        <div style="padding:8px 0">
                            <div class="vm-field"><label>Wurf</label><span style="color:var(--grn);font-weight:700">+${atk}</span></div>
                            <div class="vm-field"><label>Schaden</label><span style="font-weight:600">${dmgTotal} ${w.dmgType||''}</span></div>
                            <div class="vm-field"><label>Typ</label><span>${w.type==='melee'?'Nahkampf':'Fernkampf'}</span></div>
                            <div class="vm-field"><label>Reichweite</label><span>${w.range}</span></div>
                        </div>
                    </div>
                </div>
                <!-- Tab 3: Effects -->
                <div class="vm-panel" data-panel="3" style="display:none">
                    <!-- rendered by vmRenderEffects() after modal opens -->
                </div>
            </div>
        </div>
    `);
    vmRenderEffects(i);
}

function vmTab(el, idx) {
    el.parentElement.querySelectorAll('.vm-tab').forEach(t => t.classList.remove('on'));
    el.classList.add('on');
    el.closest('.vm-main').querySelectorAll('.vm-panel').forEach(p => p.style.display = 'none');
    el.closest('.vm-main').querySelector('.vm-panel[data-panel="'+idx+'"]').style.display = '';
}

function vmToggleProp(weaponIdx, prop, checked) {
    const w = S.weapons[weaponIdx];
    let props = (w.props || '').split(',').map(p => p.trim()).filter(p => p);
    if (checked && !props.includes(prop)) props.push(prop);
    else props = props.filter(p => p.toLowerCase() !== prop.toLowerCase());
    w.props = props.join(', ');
    render(); save();
}

function vmEditDesc(weaponIdx, field) {
    const w = S.weapons[weaponIdx];
    const current = w[field] || '';
    const container = document.getElementById(field === 'description' ? 'vmDescText' : field === 'chatDesc' ? 'vmChatDesc' : 'vmNotes');
    if (!container) return;
    container.innerHTML = '<textarea style="width:100%;min-height:60px;background:var(--sf);border:1px solid var(--gold);border-radius:6px;padding:8px;color:var(--tx);font-size:12px;font-family:inherit;resize:vertical" onblur="S.weapons['+weaponIdx+'].'+field+'=this.value;this.parentElement.textContent=this.value;save()">'+current+'</textarea>';
    container.querySelector('textarea').focus();
}

function viewInventoryItem(i) {
    const it = S.inventory[i];
    if (!it) return;
    const catLabel = {weapon:'Waffe',armor:'Ruestung',gear:'Ausruestung'}[it.cat] || it.cat;
    const catColor = {weapon:'var(--red)',armor:'var(--blu)',gear:'#d4860e'}[it.cat] || 'var(--t3)';
    const icon = it.cat === 'weapon' ? weaponIco(it.name) : (it.cat === 'armor' ? invIcon('armor') : invIcon('gear'));
    const rarity = it.rarity || 'common';
    const rarityColors = {common:'#9ca3af',uncommon:'#4ade80',rare:'#60a5fa','very-rare':'#c084fc',legendary:'#fbbf24',artifact:'#f97316'};

    openViewModal(`
        <div class="vm-side">
            <div class="vm-art">${icon}</div>
            <div class="vm-rarity">
                <select onchange="S.inventory[${i}].rarity=this.value;save()" style="color:${rarityColors[rarity]||'#9ca3af'}">
                    <option value="common" ${rarity==='common'?'selected':''}>Gewoehnlich</option>
                    <option value="uncommon" ${rarity==='uncommon'?'selected':''} style="color:#4ade80">Ungewoehnlich</option>
                    <option value="rare" ${rarity==='rare'?'selected':''} style="color:#60a5fa">Selten</option>
                    <option value="very-rare" ${rarity==='very-rare'?'selected':''} style="color:#c084fc">Sehr Selten</option>
                    <option value="legendary" ${rarity==='legendary'?'selected':''} style="color:#fbbf24">Legendaer</option>
                </select>
            </div>
            <label class="vm-toggle"><input type="checkbox" ${it.equipped?'checked':''} onchange="S.inventory[${i}].equipped=this.checked;renderInventory();save()"> Angelegt</label>
            <label class="vm-toggle"><input type="checkbox" ${it.attuned?'checked':''} onchange="S.inventory[${i}].attuned=this.checked;save()"> Eingestimmt</label>
            <label class="vm-toggle"><input type="checkbox" ${it.identified!==false?'checked':''} onchange="S.inventory[${i}].identified=this.checked;save()"> Identifiziert</label>
        </div>
        <div class="vm-main">
            <div class="vm-head">
                <div class="vm-head-info">
                    <div class="vm-type"><span class="vm-type-dot" style="background:${catColor}"></span> ${catLabel}</div>
                    <div class="vm-title-row"><div class="vm-title"><input value="${it.name}" onchange="S.inventory[${i}].name=this.value;renderInventory();save()"></div></div>
                    <div class="vm-meta">
                        <span>&#9878; <b>${it.qty}</b>x</span>
                        <span>&#9881; <b>${(it.qty*it.wt).toFixed(1)}</b> lb</span>
                        ${it.equipped?'<span style="color:var(--grn)">&#10003; Angelegt</span>':''}
                    </div>
                </div>
                <div class="vm-close" onclick="closeViewModal()">&#10005;</div>
            </div>
            <div class="vm-tabs">
                <div class="vm-tab on" onclick="vmTab(this,0)">Beschreibung</div>
                <div class="vm-tab" onclick="vmTab(this,1)">Details</div>
            </div>
            <div class="vm-content">
                <div class="vm-panel" data-panel="0">
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Beschreibung</div>
                        <div class="vm-desc-text">${it.description || ''}</div>
                    </div>
                </div>
                <div class="vm-panel" data-panel="1" style="display:none">
                    <div class="vm-field"><label>Anzahl</label><input type="number" value="${it.qty}" min="0" onchange="S.inventory[${i}].qty=+this.value;renderInventory();save()"></div>
                    <div class="vm-field"><label>Gewicht</label><input type="number" value="${it.wt}" step="0.1" onchange="S.inventory[${i}].wt=+this.value;renderInventory();save()"> <span style="color:var(--t3);font-size:11px">lb/Stueck</span></div>
                    <div class="vm-field"><label>Kategorie</label>
                        <select onchange="S.inventory[${i}].cat=this.value;renderInventory();save()">
                            <option value="weapon" ${it.cat==='weapon'?'selected':''}>Waffe</option>
                            <option value="armor" ${it.cat==='armor'?'selected':''}>Ruestung</option>
                            <option value="gear" ${it.cat==='gear'?'selected':''}>Ausruestung</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function viewAction(i) {
    const a = S.actions[i];
    if (!a) return;
    const typeLabel = {action:'Aktion',bonus:'Bonusaktion',reaction:'Reaktion',other:'Andere'}[a.type] || a.type;
    const typeColor = {action:'var(--red)',bonus:'var(--gold)',reaction:'#c084fc',other:'var(--t3)'}[a.type] || 'var(--t3)';

    openViewModal(`
        <div class="vm-side">
            <div class="vm-art">${actionIcon(a)}</div>
            <label class="vm-toggle"><input type="checkbox" ${a.pinned?'checked':''} onchange="S.actions[${i}].pinned=this.checked;render();save()"> Quick Action</label>
            <div class="vm-sep"></div>
            <div class="vm-stat-label">Typ</div>
            <div class="vm-pills">
                <span class="vm-pill hl">${typeLabel}</span>
            </div>
            ${a.uses ? '<div class="vm-stat-label">Nutzen</div><div class="vm-pills"><span class="vm-pill hl">'+a.uses.cur+'/'+a.uses.max+'</span><span class="vm-pill">'+(a.uses.rest==='short'?'Kurze Rast':'Lange Rast')+'</span></div>' : ''}
        </div>
        <div class="vm-main">
            <div class="vm-head">
                <div class="vm-head-info">
                    <div class="vm-type"><span class="vm-type-dot" style="background:${typeColor}"></span> ${typeLabel}</div>
                    <div class="vm-title-row"><div class="vm-title"><input value="${a.name}" onchange="S.actions[${i}].name=this.value;render();save()"></div></div>
                    <div class="vm-subtitle">${a.sub || ''}</div>
                    <div class="vm-meta">
                        ${a.roll?'<span>&#9876; <b>'+a.roll+'</b></span>':''}
                        ${a.dmg?'<span>&#9881; <b>'+a.dmg+'</b></span>':''}
                        ${a.range?'<span>&#8634; <b>'+a.range+'</b></span>':''}
                    </div>
                </div>
                <div class="vm-close" onclick="closeViewModal()">&#10005;</div>
            </div>
            <div class="vm-tabs">
                <div class="vm-tab on" onclick="vmTab(this,0)">Details</div>
            </div>
            <div class="vm-content">
                <div class="vm-panel" data-panel="0">
                    <div class="vm-field"><label>Name</label><input value="${a.name}" onchange="S.actions[${i}].name=this.value;render();save()"></div>
                    <div class="vm-field"><label>Beschreibung</label><input value="${a.sub||''}" onchange="S.actions[${i}].sub=this.value;render();save()"></div>
                    <div class="vm-field"><label>Typ</label>
                        <select onchange="S.actions[${i}].type=this.value;render();save()">
                            <option value="action" ${a.type==='action'?'selected':''}>Aktion</option>
                            <option value="bonus" ${a.type==='bonus'?'selected':''}>Bonusaktion</option>
                            <option value="reaction" ${a.type==='reaction'?'selected':''}>Reaktion</option>
                            <option value="other" ${a.type==='other'?'selected':''}>Andere</option>
                        </select>
                    </div>
                    <div class="vm-field"><label>Wurf</label><input value="${a.roll||''}" onchange="S.actions[${i}].roll=this.value;render();save()"></div>
                    <div class="vm-field"><label>Schaden</label><input value="${a.dmg||''}" onchange="S.actions[${i}].dmg=this.value;render();save()"></div>
                    <div class="vm-field"><label>Reichweite</label><input value="${a.range||''}" onchange="S.actions[${i}].range=this.value;render();save()"></div>
                    ${a.uses ? `
                    <div class="vm-section-head">Nutzungen</div>
                    <div class="vm-field"><label>Aktuell</label><input type="number" value="${a.uses.cur}" onchange="S.actions[${i}].uses.cur=+this.value;render();save()"></div>
                    <div class="vm-field"><label>Maximum</label><input type="number" value="${a.uses.max}" onchange="S.actions[${i}].uses.max=+this.value;render();save()"></div>
                    <div class="vm-field"><label>Erholung</label>
                        <select onchange="S.actions[${i}].uses.rest=this.value;save()">
                            <option value="short" ${a.uses.rest==='short'?'selected':''}>Kurze Rast</option>
                            <option value="long" ${a.uses.rest==='long'?'selected':''}>Lange Rast</option>
                        </select>
                    </div>` : ''}
                </div>
            </div>
        </div>
    `);
}

// ═══════════════════════════════════════════════════════
// VIEW SPELL
// ═══════════════════════════════════════════════════════
function viewSpell(i) {
    const sp = S.spells[i];
    if (!sp) return;
    const levelLabel = +sp.level === 0 ? 'Zaubertrick' : `Grad ${sp.level}`;
    const schoolFull = {
        'Abj.':'Abjuration','Erkund.':'Divination','Hervorruf.':'Evokation',
        'Illusion':'Illusion','Nekro.':'Nekromantie','Verwandl.':'Transmutation',
        'Verzaub.':'Verzauberung','Beschw.':'Beschwörung',
        'Abjuration':'Abjuration','Divination':'Divination','Evocation':'Evokation',
        'Necromancy':'Nekromantie','Transmutation':'Transmutation',
        'Enchantment':'Verzauberung','Conjuration':'Beschwörung'
    }[sp.school] || sp.school || '?';
    const schoolColors = {
        'Abj.':'#60a5fa','Abjuration':'#60a5fa',
        'Erkund.':'#c084fc','Divination':'#c084fc',
        'Hervorruf.':'var(--red)','Evocation':'var(--red)',
        'Illusion':'#f472b6','Nekro.':'#94a3b8','Necromancy':'#94a3b8',
        'Verwandl.':'var(--grn)','Transmutation':'var(--grn)',
        'Verzaub.':'var(--gold)','Enchantment':'var(--gold)',
        'Beschw.':'#fb923c','Conjuration':'#fb923c'
    };
    const schoolColor = schoolColors[sp.school] || 'var(--t2)';

    const compParts = (sp.comp || '').split(',').map(c => c.trim()).filter(Boolean);
    const compIcons = compParts.map(c => {
        if (c === 'V') return `<span class="vm-pill" title="Verbal"><img src="/assets/icons/dnd/spell/vocal.svg" style="width:11px;height:11px;filter:brightness(0) invert(1);vertical-align:middle;margin-right:3px">V</span>`;
        if (c === 'G') return `<span class="vm-pill" title="Gestisch"><img src="/assets/icons/dnd/spell/somatic.svg" style="width:11px;height:11px;filter:brightness(0) invert(1);vertical-align:middle;margin-right:3px">G</span>`;
        if (c === 'M') return `<span class="vm-pill" title="Material"><img src="/assets/icons/dnd/spell/material.svg" style="width:11px;height:11px;filter:brightness(0) invert(1);vertical-align:middle;margin-right:3px">M</span>`;
        return `<span class="vm-pill">${c}</span>`;
    }).join('');

    // Parse info field for display (format: "Range · DiceOrDur")
    const infoParts = (sp.info || '').split('·').map(p => p.trim());

    openViewModal(`
        <div class="vm-side">
            <div class="vm-art" style="display:flex;align-items:center;justify-content:center;width:100%;height:100px">
                <img src="/assets/icons/dnd/spell/${(SCHOOL_MAP[sp.school] || sp.school?.toLowerCase() || 'evocation')}.svg"
                     style="width:64px;height:64px;filter:brightness(0) invert(1);opacity:.7"
                     onerror="this.style.display='none'">
            </div>
            <div style="text-align:center;font-size:11px;color:${schoolColor};font-weight:600;margin-bottom:8px">${schoolFull}</div>
            <label class="vm-toggle"><input type="checkbox" ${sp.prepared?'checked':''} onchange="S.spells[${i}].prepared=this.checked;renderSpells();save()"> Vorbereitet</label>
            <label class="vm-toggle"><input type="checkbox" ${sp.conc?'checked':''} onchange="S.spells[${i}].conc=this.checked;save()"> Konzentration</label>
            <label class="vm-toggle"><input type="checkbox" ${sp.ritual?'checked':''} onchange="S.spells[${i}].ritual=this.checked;save()"> Ritual</label>
            <div class="vm-sep"></div>
            <div class="vm-stat-label">Grad / Schule</div>
            <div class="vm-pills">
                <span class="vm-pill hl" style="color:${schoolColor}">${levelLabel}</span>
                <span class="vm-pill">${schoolFull}</span>
            </div>
            <div class="vm-stat-label">Komponenten</div>
            <div class="vm-pills">${compIcons || '<span class="vm-pill" style="color:var(--t4)">Keine</span>'}</div>
            ${infoParts[0] ? `<div class="vm-stat-label">Reichweite</div><div class="vm-pills"><span class="vm-pill">${infoParts[0]}</span></div>` : ''}
            ${infoParts[1] ? `<div class="vm-stat-label">Effekt / Dauer</div><div class="vm-pills"><span class="vm-pill">${infoParts[1]}</span></div>` : ''}
        </div>
        <div class="vm-main">
            <div class="vm-head">
                <div class="vm-head-info">
                    <div class="vm-type"><span class="vm-type-dot" style="background:${schoolColor}"></span> ${levelLabel} · ${schoolFull}</div>
                    <div class="vm-title-row">
                        <div class="vm-title"><input value="${sp.name}" onchange="S.spells[${i}].name=this.value;renderSpells();save()"></div>
                    </div>
                    <div class="vm-meta">
                        ${sp.comp ? '<span>' + sp.comp + '</span>' : ''}
                        ${sp.info ? '<span>' + sp.info + '</span>' : ''}
                        ${sp.conc ? '<span style="color:#f97316">Konz.</span>' : ''}
                        ${sp.ritual ? '<span style="color:var(--gold)">Ritual</span>' : ''}
                    </div>
                </div>
                <div class="vm-close" onclick="closeViewModal()">&#10005;</div>
            </div>
            <div class="vm-tabs">
                <div class="vm-tab on" onclick="vmTab(this,0)">Beschreibung</div>
                <div class="vm-tab" onclick="vmTab(this,1)">Details</div>
            </div>
            <div class="vm-content">
                <!-- Tab 0: Beschreibung -->
                <div class="vm-panel" data-panel="0">
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Beschreibung <span class="vm-desc-edit" onclick="vmEditSpellDesc(${i},'desc')">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmSpellDesc">${sp.desc || '<span style="color:var(--t4)">Keine Beschreibung</span>'}</div>
                    </div>
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Notizen <span class="vm-desc-edit" onclick="vmEditSpellDesc(${i},'notes')">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmSpellNotes">${sp.notes || ''}</div>
                    </div>
                </div>
                <!-- Tab 1: Details -->
                <div class="vm-panel" data-panel="1" style="display:none">
                    <div class="vm-field"><label>Name</label><input value="${sp.name}" onchange="S.spells[${i}].name=this.value;renderSpells();save()"></div>
                    <div class="vm-field"><label>Grad</label>
                        <select onchange="S.spells[${i}].level=+this.value;renderSpells();save()">
                            <option value="0" ${+sp.level===0?'selected':''}>Zaubertrick</option>
                            ${[1,2,3,4,5,6,7,8,9].map(l=>`<option value="${l}" ${+sp.level===l?'selected':''}>Grad ${l}</option>`).join('')}
                        </select>
                    </div>
                    <div class="vm-field"><label>Schule</label>
                        <select onchange="S.spells[${i}].school=this.value;renderSpells();save()">
                            ${['Abj.','Beschw.','Erkund.','Hervorruf.','Illusion','Nekro.','Verwandl.','Verzaub.'].map(s=>`<option value="${s}" ${sp.school===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="vm-field"><label>Komponenten</label><input value="${sp.comp||''}" placeholder="V, G, M" onchange="S.spells[${i}].comp=this.value;renderSpells();save()"></div>
                    <div class="vm-field"><label>Reichweite / Info</label><input value="${sp.info||''}" placeholder="60 ft · 3W6" onchange="S.spells[${i}].info=this.value;renderSpells();save()"></div>
                    <div class="vm-field"><label>Hochgestuft</label><input value="${sp.upcast||''}" placeholder="Bei höherem Grad..." onchange="S.spells[${i}].upcast=this.value;save()"></div>
                </div>
            </div>
        </div>
    `);
}

function vmEditSpellDesc(spellIdx, field) {
    const sp = S.spells[spellIdx];
    const current = sp[field] || '';
    const elId = field === 'desc' ? 'vmSpellDesc' : 'vmSpellNotes';
    const container = document.getElementById(elId);
    if (!container) return;
    container.innerHTML = `<textarea style="width:100%;min-height:80px;background:var(--sf);border:1px solid var(--gold);border-radius:6px;padding:8px;color:var(--tx);font-size:12px;font-family:inherit;resize:vertical" onblur="S.spells[${spellIdx}].${field}=this.value;this.parentElement.innerHTML=this.value||'';save()">${current}</textarea>`;
    container.querySelector('textarea').focus();
}

// ═══════════════════════════════════════════════════════
// VIEW FEATURE
// ═══════════════════════════════════════════════════════
function viewFeature(cat, i) {
    const arr = S.features[cat];
    const f = arr ? arr[i] : null;
    if (!f) return;
    const catLabel = {class:'Klassenme rkmal',species:'SpeziesMerkmal',feats:'Talent'}[cat] || 'Merkmal';
    const catColor = {class:'var(--gold)',species:'var(--grn)',feats:'#c084fc'}[cat] || 'var(--t2)';

    openViewModal(`
        <div class="vm-side">
            <div class="vm-art" style="display:flex;align-items:center;justify-content:center;width:100%;height:80px">
                <img src="/assets/icons/dnd/attribute/skillcheck.svg"
                     style="width:48px;height:48px;filter:brightness(0) invert(1);opacity:.5"
                     onerror="this.style.display='none'">
            </div>
            <div class="vm-sep"></div>
            <div class="vm-stat-label">Typ</div>
            <div class="vm-pills"><span class="vm-pill hl" style="color:${catColor}">${catLabel}</span></div>
            ${f.src ? `<div class="vm-stat-label">Quelle</div><div class="vm-pills"><span class="vm-pill">${f.src}</span></div>` : ''}
            ${f.uses ? `
            <div class="vm-stat-label">Nutzungen</div>
            <div class="vm-pills">
                <span class="vm-pill hl">${f.uses.cur}/${f.uses.max}</span>
                <span class="vm-pill">${f.uses.rest==='short'?'K. Rast':'L. Rast'}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px">
                <button class="vm-use-btn" onclick="if(S.features['${cat}'][${i}].uses.cur>0){S.features['${cat}'][${i}].uses.cur--;renderFeatures();save();document.querySelector('.vm-use-cur').textContent=S.features['${cat}'][${i}].uses.cur}" style="flex:1;padding:4px;background:var(--sf);border:1px solid var(--b2);border-radius:4px;color:var(--tx);cursor:pointer;font-size:11px">- Nutzen</button>
                <button class="vm-use-btn" onclick="const u=S.features['${cat}'][${i}].uses;if(u.cur<u.max){u.cur++;renderFeatures();save();document.querySelector('.vm-use-cur').textContent=u.cur}" style="flex:1;padding:4px;background:var(--sf);border:1px solid var(--b2);border-radius:4px;color:var(--tx);cursor:pointer;font-size:11px">+ Nutzen</button>
            </div>` : ''}
        </div>
        <div class="vm-main">
            <div class="vm-head">
                <div class="vm-head-info">
                    <div class="vm-type"><span class="vm-type-dot" style="background:${catColor}"></span> ${catLabel}${f.src ? ' · ' + f.src : ''}</div>
                    <div class="vm-title-row">
                        <div class="vm-title"><input value="${f.name}" onchange="S.features['${cat}'][${i}].name=this.value;renderFeatures();save()"></div>
                    </div>
                </div>
                <div class="vm-close" onclick="closeViewModal()">&#10005;</div>
            </div>
            <div class="vm-tabs">
                <div class="vm-tab on" onclick="vmTab(this,0)">Beschreibung</div>
                <div class="vm-tab" onclick="vmTab(this,1)">Details</div>
            </div>
            <div class="vm-content">
                <!-- Tab 0 -->
                <div class="vm-panel" data-panel="0">
                    <div class="vm-desc-block">
                        <div class="vm-desc-head">Beschreibung <span class="vm-desc-edit" onclick="vmEditFeatureDesc('${cat}',${i})">&#9998;</span></div>
                        <div class="vm-desc-text" id="vmFeatDesc">${f.desc || '<span style="color:var(--t4)">Keine Beschreibung</span>'}</div>
                    </div>
                </div>
                <!-- Tab 1: Details -->
                <div class="vm-panel" data-panel="1" style="display:none">
                    <div class="vm-field"><label>Name</label><input value="${f.name}" onchange="S.features['${cat}'][${i}].name=this.value;renderFeatures();save()"></div>
                    ${cat === 'class' ? `<div class="vm-field"><label>Quelle</label><input value="${f.src||''}" placeholder="Klasse Lvl X" onchange="S.features['${cat}'][${i}].src=this.value;renderFeatures();save()"></div>` : ''}
                    ${f.uses ? `
                    <div class="vm-section-head">Nutzungen</div>
                    <div class="vm-field"><label>Aktuell</label><input type="number" value="${f.uses.cur}" min="0" onchange="S.features['${cat}'][${i}].uses.cur=+this.value;renderFeatures();save()"></div>
                    <div class="vm-field"><label>Maximum</label><input type="number" value="${f.uses.max}" min="1" onchange="S.features['${cat}'][${i}].uses.max=+this.value;renderFeatures();save()"></div>
                    <div class="vm-field"><label>Erholung</label>
                        <select onchange="S.features['${cat}'][${i}].uses.rest=this.value;save()">
                            <option value="short" ${f.uses.rest==='short'?'selected':''}>Kurze Rast</option>
                            <option value="long" ${(f.uses.rest==='long'||!f.uses.rest)?'selected':''}>Lange Rast</option>
                        </select>
                    </div>` : `
                    <div class="vm-field" style="align-items:flex-start">
                        <label style="padding-top:2px">Nutzungen</label>
                        <button onclick="S.features['${cat}'][${i}].uses={cur:1,max:1,rest:'long'};renderFeatures();save();viewFeature('${cat}',${i})" style="padding:4px 10px;background:var(--sf);border:1px solid var(--b2);border-radius:4px;color:var(--tx);cursor:pointer;font-size:11px">+ Nutzungen hinzufügen</button>
                    </div>`}
                </div>
            </div>
        </div>
    `);
}

function vmEditFeatureDesc(cat, i) {
    const f = S.features[cat][i];
    const current = f.desc || '';
    const container = document.getElementById('vmFeatDesc');
    if (!container) return;
    container.innerHTML = `<textarea style="width:100%;min-height:100px;background:var(--sf);border:1px solid var(--gold);border-radius:6px;padding:8px;color:var(--tx);font-size:12px;font-family:inherit;resize:vertical" onblur="S.features['${cat}'][${i}].desc=this.value;this.parentElement.innerHTML=this.value||'';renderFeatures();save()">${current}</textarea>`;
    container.querySelector('textarea').focus();
}

// ═══════════════════════════════════════════════════════
// EFFEKTE TAB (funktional)
// ═══════════════════════════════════════════════════════
function vmRenderEffects(weaponIdx) {
    const w = S.weapons[weaponIdx];
    if (!w.effects) w.effects = {temp:[],passive:[],inactive:[]};
    const cats = [{key:'temp',label:'Temporäre Effekte',cls:'temp'},{key:'passive',label:'Passive Effekte',cls:'pass'},{key:'inactive',label:'Inaktive Effekte',cls:'inact'}];
    const panel = document.querySelector('.vm-panel[data-panel="3"]');
    if (!panel) return;
    let html = '';
    cats.forEach(({key,label,cls}) => {
        const effects = w.effects[key] || [];
        html += `<div class="vm-fx-group">
            <div class="vm-fx-head ${cls}">${label} <span class="vm-fx-count">${effects.length}</span>
                <span class="vm-fx-add" onclick="vmAddEffect(${weaponIdx},'${key}')" style="cursor:pointer;margin-left:auto;color:var(--gold);font-weight:700;padding:0 4px">+</span>
            </div>`;
        effects.forEach((fx, fi) => {
            html += `<div class="vm-fx-item" style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--b1)">
                <input value="${fx.name||''}" placeholder="Effektname..." onchange="S.weapons[${weaponIdx}].effects['${key}'][${fi}].name=this.value;save()"
                    style="flex:1;background:transparent;border:none;border-bottom:1px solid var(--b2);color:var(--tx);font-size:12px;padding:2px 0">
                <input value="${fx.value||''}" placeholder="Wert (z.B. +1 RK)" onchange="S.weapons[${weaponIdx}].effects['${key}'][${fi}].value=this.value;save()"
                    style="width:90px;background:transparent;border:none;border-bottom:1px solid var(--b2);color:var(--t2);font-size:11px;padding:2px 0">
                <span onclick="S.weapons[${weaponIdx}].effects['${key}'].splice(${fi},1);vmRenderEffects(${weaponIdx});save()"
                    style="cursor:pointer;color:var(--t4);font-size:11px;padding:2px 4px;flex-shrink:0" title="Entfernen">&#10005;</span>
            </div>`;
        });
        if (effects.length === 0) {
            html += `<div style="padding:10px 12px;color:var(--t4);font-size:11px;font-style:italic">Keine Effekte</div>`;
        }
        html += `</div>`;
    });
    panel.innerHTML = html;
}

function vmAddEffect(weaponIdx, cat) {
    const w = S.weapons[weaponIdx];
    if (!w.effects) w.effects = {temp:[],passive:[],inactive:[]};
    if (!w.effects[cat]) w.effects[cat] = [];
    w.effects[cat].push({name:'',value:''});
    save();
    vmRenderEffects(weaponIdx);
}

// Edit stubs — view modal is fully editable, so edit just opens view
function editWeapon(i) { viewWeapon(i); }
function editInventoryItem(i) { viewInventoryItem(i); }
function editAction(i) { viewAction(i); }

function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2500)}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function initSheet() {
    load();
    calc();
    render();
    initRiftLink();
    console.log('[5e] Sheet initialized', _charId ? '(char: ' + _charId + ')' : '(new)');
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSheet);
} else {
    initSheet();
}
