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
    'Enchantment':'enchantment','Conjuration':'conjuration','Illusion':'illusion'
};
function spellSchoolIco(school) {
    const file = SCHOOL_MAP[school] || school?.toLowerCase() || 'evocation';
    return `<img src="${SPELL_ICO}${file}.svg" class="spell-school-ico" onerror="this.style.display='none'">`;
}

function invIcon(cat) {
    if (cat === 'weapon') return ico('sword');
    if (cat === 'armor') return `<span class="ico"><img src="${ICO_BASE}dnd/hp/shield.svg" onerror="this.src='${WEAPON_ICO}sword.svg'"></span>`;
    return `<span class="ico"><img src="${ICO_BASE}dnd/util/gear.svg" onerror="this.style.display='none'"></span>`;
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
    renderSpells();renderFeatures();renderBio();renderAttunement();
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

function renderHP(){
    document.getElementById('hpCur').value=S.hp.cur;
    document.getElementById('hpMax').value=S.hp.max;
    document.getElementById('hpTemp').value=S.hp.temp||'';
    let pct=S.hp.max>0?Math.max(0,Math.min(100,(S.hp.cur/S.hp.max)*100)):0;
    let bar=document.getElementById('hpBar');
    bar.style.width=pct+'%';
    bar.style.background=pct>50?'linear-gradient(90deg,#1d6028,#40b050)':pct>25?'linear-gradient(90deg,#8a6d00,#d4a844)':'linear-gradient(90deg,#8a2020,#d04040)';
    if(S.classes&&S.classes.length>1){
        document.getElementById('hdLabel').textContent=S.classes.map(c=>c.level+'W'+c.hitDie).join(' + ')+' TW';
    } else {
        document.getElementById('hdLabel').textContent=S.level+'W'+(S.classes&&S.classes[0]?S.classes[0].hitDie:S.hitDice.type)+' TW';
    }
    // Portrait ring
    let p=document.getElementById('portrait');
    p.classList.remove('hp-full','hp-mid','hp-low','hp-crit','hp-dead');
    if(S.hp.cur<=0)p.classList.add('hp-dead');
    else if(pct<=25)p.classList.add('hp-crit');
    else if(pct<=50)p.classList.add('hp-low');
    else if(pct<=75)p.classList.add('hp-mid');
    else p.classList.add('hp-full');
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
    let pct=next>prev?((S.xp-prev)/(next-prev))*100:100;
    document.getElementById('xpBar').style.width=Math.min(100,Math.max(0,pct))+'%';
    document.getElementById('xpCur').value=S.xp;
    document.getElementById('xpNext').textContent=next>=999999?'MAX':next.toLocaleString('de');
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
    S.weapons.forEach(w=>{
        let aMod=C.mods[w.ability]||0;
        let atk=aMod+C.profBonus;
        groups.action.push({name:w.name,sub:(w.type==='melee'?'Nahkampf':'Fernkampf')+' · '+w.props,iconHtml:weaponIco(w.name),roll:fmt(atk),dmg:w.dmg+fmt(aMod),range:w.range,uses:null,pinned:w.pinned,atkMod:atk,dmgStr:w.dmg+'+'+aMod});
    });
    S.actions.forEach(a=>{
        let g=groups[a.type]||groups.other;
        let rollVal='';
        if(a.roll){
            if(a.roll.startsWith('+'))rollVal=fmt(C.mods[a.roll.slice(1)]+ C.profBonus);
            else rollVal=a.roll;
        }
        g.push({name:a.name,sub:a.sub,iconHtml:actionIcon(a),roll:rollVal,dmg:a.dmg,range:a.range,uses:a.uses,pinned:a.pinned});
    });
    let labels={action:{l:'Aktion',cls:'ag-a'},bonus:{l:'Bonusaktion',cls:'ag-b'},reaction:{l:'Reaktion',cls:'ag-r'},other:{l:'Andere',cls:'ag-o'}};
    let html='';
    ['action','bonus','reaction','other'].forEach(t=>{
        let items=groups[t];if(!items.length)return;
        let lb=labels[t];
        html+=`<div class="ag ${lb.cls}"><div class="agh" onclick="this.classList.toggle('collapsed');this.nextElementSibling.style.display=this.classList.contains('collapsed')?'none':''"><span>${lb.l}</span><span class="n">${items.length}</span><span class="chv">&#9662;</span></div>`;
        html+=`<table class="at"><colgroup><col class="c-nm"><col class="c-ut"><col class="c-wf"><col class="c-sd"><col class="c-rw"></colgroup><thead><tr><th>Name</th><th>Nutzen</th><th>Wurf</th><th>Schaden</th><th>Reichw.</th></tr></thead><tbody>`;
        items.forEach(it=>{
            html+=`<tr><td><div class="anm"><div class="ai">${it.iconHtml}</div><div><div class="atn">${it.name}</div><div class="ats">${it.sub}</div></div></div></td>`;
            html+=`<td>${it.uses?`<span class="ut" onclick="useCharge(this,event)" data-cur="${it.uses.cur}" data-max="${it.uses.max}">${it.uses.cur}/${it.uses.max}</span>`:'—'}</td>`;
            html+=`<td>${it.roll?`<button class="rb" onclick="rollDice('1d20',${parseInt(it.roll)||0},'${it.name}')">${it.roll}</button>`:'—'}</td>`;
            html+=`<td class="fm">${it.dmg||'—'}</td><td>${it.range||'—'}</td></tr>`;
        });
        html+=`</tbody></table></div>`;
    });
    document.getElementById('actionGroups').innerHTML=html;
}

function renderQA(){
    let pinned=[];
    S.weapons.forEach(w=>{
        if(!w.pinned)return;
        let atk=C.mods[w.ability]+C.profBonus;
        pinned.push({name:w.name,sub:(w.type==='melee'?'Nahkampf':'Fernkampf')+' · '+w.range,val:fmt(atk),iconHtml:weaponIco(w.name),mod:atk,label:w.name});
    });
    S.actions.forEach(a=>{
        if(!a.pinned)return;
        let val=a.uses?a.uses.cur+'/'+a.uses.max:(a.roll?fmt(C.mods[a.roll?.slice(1)]||0+C.profBonus):'');
        pinned.push({name:a.name,sub:a.sub,val:val,iconHtml:actionIcon(a),mod:0,label:a.name});
    });
    let h='';
    pinned.forEach(p=>{
        h+=`<div class="si" onclick="rollDice('1d20',${p.mod},'${p.label}')"><div class="si-i">${p.iconHtml}</div><div class="si-t"><div class="si-n">${p.name}</div><div class="si-s">${p.sub}</div></div><div class="si-v">${p.val}</div></div>`;
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
    let body='';let lastCat='';
    let catLabels={weapon:'Waffen',armor:'Rüstung',gear:'Ausrüstung'};
    let catColors={weapon:'var(--red)',armor:'var(--blu)',gear:'#d4860e'};
    let catIcons={armor:invIcon('armor'),gear:invIcon('gear')};
    ['weapon','armor','gear'].forEach(cat=>{
        let items=S.inventory.filter(it=>it.cat===cat);
        if(!items.length)return;
        body+=`<tr class="cat"><td colspan="5" style="color:${catColors[cat]}">${catLabels[cat]}</td></tr>`;
        items.forEach((it,idx)=>{
            let gi=S.inventory.indexOf(it);
            let wt=it.qty*it.wt;totalWt+=wt;
            let icon=cat==='weapon'?weaponIco(it.name):catIcons[cat];
            body+=`<tr><td>${it.equipped?'<span class="eq">'+icon+'</span>':icon}</td>
                <td style="text-align:left" class="${it.equipped?'eq':''}"><input class="e" value="${it.name}" onchange="S.inventory[${gi}].name=this.value;save()" style="font-weight:${it.equipped?700:400}"></td>
                <td><input class="e-num" value="${it.qty}" onchange="S.inventory[${gi}].qty=+this.value;renderInventory();save()" style="width:30px"></td>
                <td>${(wt).toFixed(wt%1?1:0)} lb</td>
                <td><span style="cursor:pointer;color:var(--t4);font-size:10px" onclick="S.inventory.splice(${gi},1);renderInventory();save()">&#10005;</span></td></tr>`;
        });
    });
    document.getElementById('invBody').innerHTML=body;
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
        levels[l].forEach((sp,i)=>{
            let gi=S.spells.indexOf(sp);
            let tags='';
            if(sp.conc)tags+='<span class="conc" title="Konzentration">K</span>';
            if(sp.ritual)tags+='<span class="rit" title="Ritual">R</span>';
            spH+=`<div class="spr" onclick="toggleSpellNote(${gi})"><div class="spc ${sp.prepared?'on':''}" onclick="event.stopPropagation();S.spells[${gi}].prepared=!S.spells[${gi}].prepared;renderSpells();save()"></div><div class="spsch">${spellSchoolIco(sp.school)}</div><div class="spn">${sp.name}</div><div class="spco">${sp.comp}</div><div class="spinf">${sp.info}${tags}</div><span style="cursor:pointer;color:var(--t4);font-size:10px;margin-left:4px" onclick="event.stopPropagation();S.spells.splice(${gi},1);renderSpells();save()">&#10005;</span></div>`;
            spH+=`<div class="sp-note ${sp._noteOpen?'vis':''}" id="spNote${gi}"><input class="e" value="${sp.notes||''}" placeholder="Notizen..." onclick="event.stopPropagation()" onchange="S.spells[${gi}].notes=this.value;save()"></div>`;
        });
    });
    document.getElementById('spellList').innerHTML=spH;
}

function renderFeatures(){
    let h='';
    S.features.class.forEach((f,i)=>{
        h+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span><span class="feat-src">${f.src}</span>${f.uses?`<span class="feat-u"><span class="ut">${f.uses.cur}/${f.uses.max}</span></span>`:''}</div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('classFeats').innerHTML=h;
    let sp='';
    S.features.species.forEach(f=>{
        sp+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span></div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('speciesFeats').innerHTML=sp;
    document.getElementById('speciesName').textContent=S.species;
    let ft='';
    S.features.feats.forEach(f=>{
        ft+=`<div class="feat"><div class="feat-h"><span class="feat-n">${f.name}</span></div><div class="feat-d">${f.desc}</div></div>`;
    });
    document.getElementById('featFeats').innerHTML=ft||'<div style="padding:14px;color:var(--t3);font-size:12px">Keine Talente gewählt</div>';
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
    ['wName','wDmg','wDmgType','wProps','wRange'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('weaponOverlay').classList.add('on');document.getElementById('wName').focus();
}
function confirmAddWeapon(){
    let name=document.getElementById('wName').value.trim();if(!name)return;
    S.weapons.push({
        name,type:document.getElementById('wType').value,ability:document.getElementById('wAbility').value,
        dmg:document.getElementById('wDmg').value||'1W4',dmgType:document.getElementById('wDmgType').value||'',
        props:document.getElementById('wProps').value||'',range:document.getElementById('wRange').value||'5 ft',pinned:false
    });
    document.getElementById('weaponOverlay').classList.remove('on');
    render();save();toast('Waffe hinzugefügt: '+name);
}
function openAddAction(){
    ['aName','aSub','aRoll','aDmg','aRange','aUsesCur','aUsesMax'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('actionOverlay').classList.add('on');document.getElementById('aName').focus();
}
function confirmAddAction(){
    let name=document.getElementById('aName').value.trim();if(!name)return;
    let usesCur=+document.getElementById('aUsesCur').value,usesMax=+document.getElementById('aUsesMax').value;
    let rest=document.getElementById('aUsesRest').value;
    S.actions.push({
        name,sub:document.getElementById('aSub').value||'',type:document.getElementById('aType').value,
        uses:usesMax>0?{cur:usesCur||usesMax,max:usesMax,rest:rest||'long'}:null,
        roll:document.getElementById('aRoll').value||'',dmg:document.getElementById('aDmg').value||'',
        range:document.getElementById('aRange').value||'',pinned:false
    });
    document.getElementById('actionOverlay').classList.remove('on');
    render();save();toast('Aktion hinzugefügt: '+name);
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
            RIFT.state.set('characters.' + _charId, { id: _charId, ...data });
        }, 200);
    }

    // Always save to CharacterStorage as cache/fallback
    if (_charId && typeof CharacterStorage !== 'undefined') {
        try { CharacterStorage.save(_charId, 'dnd5e', S); } catch (e) {}
    }

    // Also localStorage as final fallback
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

    // New character: use defaults
    if (isNew || !_charId) {
        S = defaultState();
        if (!_charId) {
            const uid = window.RIFT?.firebase?.getCurrentUser?.()?.uid;
            _charId = uid ? 'dnd5e_' + uid.slice(0, 8) + '_' + Date.now() : 'local_' + Date.now();
        }
        migrateState();
        applyPortrait();
        return;
    }

    // Try CharacterStorage first
    if (typeof CharacterStorage !== 'undefined') {
        try {
            const stored = CharacterStorage.getById(_charId);
            if (stored && stored.data) {
                S = stored.data;
                migrateState();
                applyPortrait();
                console.log('[5e] Loaded from CharacterStorage:', _charId);
                return;
            }
        } catch (e) {}
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

    // Push initial state after short delay
    setTimeout(() => {
        const data = JSON.parse(JSON.stringify(S));
        data.ruleset = 'dnd5e';
        data.updatedAt = Date.now();
        data.name = S.name || 'Unbenannt';
        data.ownerId = window.RIFT?.firebase?.getCurrentUser?.()?.uid || '';
        RIFT.state.set('characters.' + _charId, { id: _charId, ...data });
    }, 1500);

    // Listen for remote changes
    RIFT.state.on('riftlink:char:updated', (ev) => {
        if (!ev || ev.charId !== _charId) return;
        if (ev.origin === 'local') return;

        const remote = RIFT.state.get('characters.' + _charId);
        if (!remote) return;

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
                'alignment', 'size', 'level', 'portrait', 'headerBg',
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

function toast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2500)}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function initSheet() {
    load();
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
