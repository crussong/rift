// ═══════════════════════════════════════════════════════════════
// RIFT DnD Database  —  Zentrale Datenbankschicht
// Zugriff für: Charakterbogen, Whiteboard, GM-Tools
//
// Dateien (assets/data/):
//   rift_db_spells.json   — 1.450 Zaubersprüche
//   rift_db_weapons.json  — 624  Waffen
//   rift_db_armors.json   — 1.159 Rüstungen
//   rift_db_items.json    — 3.235 Items
//
// API:
//   await RiftDB.ready           — Promise, resolved wenn alle Dateien geladen
//   await RiftDB.cat('spell')    — Lädt Kategorie lazy, gibt Einträge zurück
//   RiftDB.get(id)               — Entry by ID
//   RiftDB.find(opts)            — Suche: { q, category, level, school, rarity, class, limit }
//   RiftDB.spells(opts)          — Gefilterte Spells
//   RiftDB.weapons(opts)         — Gefilterte Waffen
//   RiftDB.armor(opts)           — Gefilterte Rüstungen
//   RiftDB.items(opts)           — Gefilterte Items
//   RiftDB.icon(id)              — { url, name, label } für Entry
//   RiftDB.spell(slug)           — Spell by slug
//   RiftDB.typeIcon(cat, type)   — Kanonisches Icon für Typ (leather, longsword, evocation…)
//   RiftDB.bestIcon(name, cat)   — Bestes Icon für Name + Kategorie
//   RiftDB.count                 — Anzahl geladener Einträge
// ═══════════════════════════════════════════════════════════════

// ── Kanonische Icons pro Typ (generiert, manuell anpassbar) ─────────────
const _TYPE_ICONS = {
  // Rüstungstyp
  armor: {
    'breastplate': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735361/xtgwadnhfmzvdorejewm.png','Chest_20','Dunkle Panzerrüstung'],
    'chain_mail': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772673765/tydctlyg2zhx5adod2ss.png','Mail8_Chest','Leder Metallbrust'],
    'chain_shirt': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735338/qp8fviiofrdajreplk2r.png','Chest_04_farmer','Dunkle Lederweste'],
    'gambeson': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735804/nrc3ayqi2687ibc0n6sg.png','BlueGambeson','Blauer Langer Waffenrock'],
    'half_plate': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772673810/fe5ckbe9jkcwmcglymus.png','Mail10_Chest','Dunkler Brustpanzer'],
    'hide': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735827/trpd1hcr4tnnry3su5sg.png','FurChest','Pelz Lederrüstung'],
    'leather': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735793/j2gwnnbbygfa9xxiqamn.png','BarbarianChest','Barbarenrüstung Pelz'],
    'light_cloth': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735813/xe6fnr6msncohcqy0fot.png','BrownShirt','Braunes Schnürhemd'],
    'plate': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735846/mllc8znn0ne3jjimtfev.png','KnightChest3','Dunkler Kürass'],
    'robe': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735886/mq0rltith4rc9wbzmwua.png','MonasticRobe','Mönchsrobe mit Gürtel'],
    'scale_mail': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772673695/myau1ulhsoz2fz6mhljb.png','Mail4_Chest','Roter Kettenpanzer'],
    'studded_leather': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735808/bvgswxctklxctu6rtrbf.png','Brigandine','Brigantine Körperpanzer'],
  },
  // Waffentyp
  weapon: {
    'arrow': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670007/i3wvpkjegw87dij34ddq.png','Arrow_05','Roter Jagdpfeil'],
    'battleaxe': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670026/upjnv6vi33chkcy1tnhq.png','Axe_04','Dunkle Kampfaxt'],
    'bolt': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735983/tfwkluvl6myhgtmta59q.png','Bolts','Vier Holzbolzen'],
    'chain_weapon': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735998/jvrnhqcofxa1afkkinzu.png','Chain4','Lederriemen Schlagstock'],
    'club': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736058/dalk7snp1dwerszpyeve.png','Stick2','Doppelend-Stab'],
    'crossbow_heavy': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670118/in0x0mnfdnul9hdybicw.png','Crossbow_06','Mehrfachbogen Armbrust'],
    'crossbow_light': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670119/aomhclgaec8tc47g0ibp.png','Crossbow_09','Dunkle Armbrust'],
    'dagger': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736024/lam5tkiur07lpu7zvh9b.png','OldDagger','Alter Dolch'],
    'greataxe': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670029/dhdja9gg5wtt4f1plsoa.png','Axe_08','Große Kriegsaxt'],
    'greatclub': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736002/c5xnpnpxrs3rtnkaguml.png','Club3','Gezackte Eisenkeule'],
    'greatsword': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736068/sqxp5q6roivzs5rozkqo.png','Sword6','Zweihänder Goldknauf'],
    'grimoire': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670068/gavfqsqlnuwqbweqhrat.png','Book_4','Auge Zauber-Buch'],
    'halberd': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736049/n5hcqjx11jydzzw452qm.png','Spear4Halberd','Hellebarde mit Flügelklinge'],
    'handaxe': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735974/gakmug9c8stj1dmnvmsf.png','AxeOld','Alte Holzaxt'],
    'javelin': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670638/upsimwwkckyuzhlrwv49.png','Spear_13','Einfacher Wurfspeer'],
    'lance': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736054/xm9woj8f6dbiqkhptunj.png','SpearTournamentRed','Rot-weiße Turnierlanze'],
    'lighthammer': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670511/djvfjpcgbosyeqxoeoio.png','Hammer_05','Holzfass Hammer'],
    'longbow': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735984/tatqhmpvfh4h422vef1n.png','Bow2','Langer Recurvebogen'],
    'longsword': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670763/ofpk5nkuea87ln6suic3.png','Sword_39','Goldenes Gladius'],
    'maul': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670517/gnjpasrgx8gh4hswhcqh.png','Hammer_11','Doppelkopf Steinhammer'],
    'misc_weapon': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735993/nq4gerl9rsjyf2t7qetw.png','Bullets','Beutel mit Kugeln'],
    'morningstar': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670546/b6sf5z1a9phczxzmnnmg.png','Hammer_43','Goldener Kreuzkolben'],
    'pike': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670638/eqzxzqoa9atk6zssuzvp.png','Spear_10','Schlichter Wurfspeer'],
    'quarterstaff': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670743/lsbesdcsvxbbdtbsf6lp.png','Staff_54','Bambus-Stab'],
    'quiver': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736034/b8x6rraircvmmnqmn0fh.png','Quiver3','Pelz Köcher leer'],
    'rapier': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736073/l9zuvmrme1fhek8wwccr.png','SwordRapier','Ornamentales Rapier'],
    'scimitar': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670763/hqro3ashe0qm1iydvpuk.png','Sword_41','Grüner Säbel'],
    'scythe': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736053/hsmrj0819ndhma5op5la.png','SpearScythe','Hölzerne Sense'],
    'shield': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670605/xnteg2zixxwtrtb7qqt1.png','shield_35','Roter Glasschild'],
    'shortbow': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735984/napdy8pspwy326i3bzz3.png','Bow','Einfacher Holzbogen'],
    'shortsword': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736026/hdpziuq3tsytlmotwage.png','OldSword','Altes Kurzschwert'],
    'sickle': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736041/h67imbdxxwr8depfiu6i.png','Sickle','Schwarze Sichel'],
    'spear': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670631/ooievvsuoqps6zsq26bp.png','Spear_05','Einfache Lanze'],
    'staff_arcane': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670725/rmoyeyynqdupqdig8b6k.png','staff_26','Ringkopf-Stab'],
    'trident': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670625/baqvstb612xixymwzz7p.png','Spear_03','Dreizinkige Forke'],
    'wand': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670724/bfwyp7us3a80er7sodqz.png','Wand','Geschwungener Holzstab'],
    'warhammer': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670506/dv5ka9ihpiuwr6yixxta.png','Hammer_01','Steinerner Kriegshammer'],
    'warpick': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735974/tna518r1sikfr8v1pkjv.png','AxePick','Spitzhacke Kriegsaxt'],
    'whip': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736088/iwknsdvl33tfoqyjij50.png','TheWhip','Schwarze Lederpeitsche'],
  },
  // Zauberschule
  spell_school: {
    'abjuration': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772739748/is1ya7oqiq8l3edablfa.png','shield1','Schild'],
    'conjuration': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772674643/bsrtigd4ifu8egfuvszs.png','Druideskill_49_golems','Nebelschritt'],
    'divination': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772674757/uwypsoobjpi9ouxnculv.png','Mageskill_27_clone','Magie erkennen'],
    'enchantment': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772676081/t4faxeuhsxbhu0picteg.png','DarkNet','Person bezaubern'],
    'evocation': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772674708/wk2yoxhrsbikrt7jv4fi.png','Engineerskill_45_fireElements','Feuerball'],
    'illusion': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772674746/rbgoakdlgd8pzqfuyfy1.png','Mageskill_18','Spiegelbild'],
    'necromancy': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772676090/l3yjd2kkubmyqk5raukq.png','DemonicFate','Tote beleben'],
    'transmutation': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772740482/nfyejxzx1bvz9d9caeqe.png','Skill_346','Polymorphose'],
  },
  // Item-Kategorie
  item_subcategory: {
    'ammunition': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737991/jwbzt7w2avxrgled04ut.png','Quest_117','Pfeil'],
    'arcane-foci': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737928/mzcnu7ynlfcydivoxxeq.png','Quest_58_ore','Kristall'],
    'armor': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738929/jg2aucaa2ux06jm9dwkt.png','Mining_44_ancientore','Adamantine Rüstung'],
    'consumable': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738395/drb0z4tq9f74eyz7lgxu.png','Alchemy_01_tea','Dampfende Teetasse'],
    'crafting': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738352/uvnujootfiv0xwl1k4yo.png','Blacksmith_01_stick','Grauer Metallbarren'],
    'dagger': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736024/lam5tkiur07lpu7zvh9b.png','OldDagger','Alter Dolch'],
    'druidic-foci': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737572/lnw7xi6mneu5aw71xpow.png','Honey','Misteleig'],
    'enchantment': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738691/jsnoua5ko8erarryou5n.png','Enchantment_01_big_magicdust','Lila Magiepulver Haufen'],
    'engineering': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738567/i3s2hdbgq7illzclcriw.png','Engineering_01_little_explosive','Kleine Sprengstoffstange'],
    'equipment-packs': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737775/xv5cijb58n9pjnxrnbd5.png','Res_168_BagAllres','Einbrecherpaket'],
    'food': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738647/mgxqcohgkuhv14iamaoo.png','Cooking_01_chicken','Rohes Hühnerbein'],
    'herbalism': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738606/ua2eotqmonewtcqjhkwg.png','Herbalism_01_Dill','Dill Kräuterzweig'],
    'holy-symbols': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738865/u1kakwgrwmbzki8n3clx.png','Jewelry_43_red_neck','Amulett'],
    'jewelry': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738830/fr3hvto3hvzdsghowaaf.png','Jewelry_01_orangecrystal','Orangefarbener Edelstein'],
    'kits': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738830/ayvwx24ts6a4no9k4wux.png','Jewelry_02_yellowcrystal','Kletterausrüstung'],
    'loot': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738289/ofaje5zuotirexaqpzij.png','Loot_01_coins','Silberne Münzen Haufen'],
    'mining': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738878/ptrfpauqeyla6mpurwwu.png','Mining_01_fragments_of_stones','Steinbruchstücke Fragmente'],
    'misc': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737431/x0ujdlbpndcowtsjufzc.png','Ash','Aschehaufen'],
    'mounts-and-vehicles': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738600/cbsc4yfgfzxlaljadsvx.png','Engineering_49_iron_plate','Tierfutter (1 Tag)'],
    'other': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737431/x0ujdlbpndcowtsjufzc.png','Ash','Diverses'],
    'potion': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738396/bwallopiuxravkpp5qsj.png','Alchemy_17_blue_potion','Zornige Dämpfe'],
    'quest': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738032/qt5hjergycn7pfktsbyp.png','Quest_01_explosion','Explosives Pulverfass'],
    'resources': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738382/fllwnl1lvvvfzf5gkrs6.png','materials_01_sticks','Rohe Äste Holz'],
    'ring': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738850/rc2ta2yh6ldx9dahezec.png','Jewelry_25_little_ring','Ring des Tierenflusses'],
    'rod': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738009/iksexfwpvgwdiez4m4mr.png','Quest_134_crystal','Stab of Absorption'],
    'scroll': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737912/gyeb9seenpugzkfiwh5n.png','Quest_40_scroll','Zauber Schriftrolle'],
    'skinning': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738943/sbvcwfqzmjmbso3fqfqc.png','skinning_01_piece_of_leather','Glattes Lederstück'],
    'staff': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738854/ifsb1hanjdwpjbzjph1f.png','Jewelry_29_threeknowledge_ring','Magierstab of Charming'],
    'standard-gear': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772737764/wtmjpztiyvogz8g51esx.png','Res_154_leg','Abakus'],
    'tailoring': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738992/f6qp5pqp7gtdndaykb9j.png','Tailoring_01_torn_cloth','Afrikakarte Holzform'],
    'tools': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738679/czsb7z1frvyhqz3mhhvg.png','Cooking_45_barbecue','Alchemistenwerkzeug'],
    'wand': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738009/iksexfwpvgwdiez4m4mr.png','Quest_134_crystal','Stab of Absorption'],
    'weapon': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738915/xwjxwd8khpemgwwi7cqj.png','Mining_26_forceps','Berserker Axt'],
    'weapon-(any-ammunition)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670007/i3wvpkjegw87dij34ddq.png','Arrow_05','Roter Jagdpfeil'],
    'weapon-(any-axe)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670026/upjnv6vi33chkcy1tnhq.png','Axe_04','Dunkle Kampfaxt'],
    'weapon-(any-axe-or-sword)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670763/ofpk5nkuea87ln6suic3.png','Sword_39','Goldenes Gladius'],
    'weapon-(arrow)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670007/i3wvpkjegw87dij34ddq.png','Arrow_05','Roter Jagdpfeil'],
    'weapon-(dagger)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772736024/lam5tkiur07lpu7zvh9b.png','OldDagger','Alter Dolch'],
    'weapon-(javelin)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772670638/upsimwwkckyuzhlrwv49.png','Spear_13','Einfacher Wurfspeer'],
    'weapon-(shortbow-or-longbow)': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772735984/tatqhmpvfh4h422vef1n.png','Bow2','Langer Recurvebogen'],
    'wondrous-item': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738865/u1kakwgrwmbzki8n3clx.png','Jewelry_43_red_neck','Amulett of the Planes'],
    'wondrous-items': ['https://res.cloudinary.com/dza4jgreq/image/upload/v1772738865/u1kakwgrwmbzki8n3clx.png','Jewelry_43_red_neck','Amulett of Health'],
  },
};

const RiftDB = (() => {

  const BASE = '/assets/data/';
  const FILES = {
    spell:  BASE + 'rift_db_spells.json',
    weapon: BASE + 'rift_db_weapons.json',
    armor:  BASE + 'rift_db_armors.json',
    item:   BASE + 'rift_db_items.json',
  };

  const _cats  = { spell: null, weapon: null, armor: null, item: null };
  const _byId  = {};
  let   _all   = null;
  let   _resolve = null;

  const ready = new Promise(res => { _resolve = res; });

  // ── Loader ────────────────────────────────────────────────────────────────

  async function _loadCat(cat) {
    if (_cats[cat]) return _cats[cat];
    try {
      const r = await fetch(FILES[cat]);
      const j = await r.json();
      const entries = j.entries || [];
      _cats[cat] = entries;
      for (const e of entries) _byId[e.id] = e;
      return entries;
    } catch (err) {
      console.error(`[RiftDB] Laden fehlgeschlagen (${cat}):`, err);
      _cats[cat] = [];
      return [];
    }
  }

  async function _loadAll() {
    await Promise.all(Object.keys(FILES).map(_loadCat));
    _all = [
      ...(_cats.spell  || []),
      ...(_cats.weapon || []),
      ...(_cats.armor  || []),
      ...(_cats.item   || []),
    ];
    _resolve(_all);
  }
  _loadAll();

  // ── Interne Helpers ───────────────────────────────────────────────────────

  function _pool()    { return _all || []; }
  function _getCat(c) { return _cats[c] || []; }

  function _normalize(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ß/g, 'ss');
  }

  function _matches(e, opts = {}) {
    if (opts.id       && e.id !== opts.id)                                  return false;
    if (opts.category && e.category !== opts.category)                      return false;
    if (opts.school   && e.school !== opts.school)                          return false;
    if (opts.level    !== undefined && e.level !== opts.level)              return false;
    if (opts.rarity   && e.rarity !== opts.rarity)                         return false;
    if (opts.class) {
      const cls = e.classes || [];
      if (!cls.some(c => c.toLowerCase().includes(opts.class.toLowerCase()))) return false;
    }
    if (opts.q) {
      const q   = _normalize(opts.q);
      const hay = _normalize(
        [e.name_de, e.name_en, e.icon_label, e.desc, e.subcategory_de, e.slug]
          .filter(Boolean).join(' ')
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function _bestMatch(cat, name) {
    if (!name || !_all) return null;
    const pool = cat ? _getCat(cat) : _pool();
    const norm = _normalize(name);
    let hit = pool.find(e => _normalize(e.name_de) === norm || _normalize(e.name_en || '') === norm);
    if (hit) return hit;
    hit = pool.find(e =>
      _normalize(e.name_de).includes(norm) || norm.includes(_normalize(e.name_de))
    );
    if (hit) return hit;
    const words = norm.split(/\s+/).filter(w => w.length > 2).sort((a, b) => b.length - a.length);
    for (const w of words) {
      hit = pool.find(e =>
        _normalize(e.name_de).includes(w) || _normalize(e.name_en || '').includes(w)
      );
      if (hit) return hit;
    }
    return null;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    ready,

    /** Lädt eine Kategorie lazy und gibt ihre Einträge zurück. */
    async cat(cat) {
      return _loadCat(cat);
    },

    /** Entry by ID. Gibt null zurück wenn nicht gefunden. */
    get(id) {
      return _byId[id] || null;
    },

    /** Flexible Suche. opts: { q, category, school, level, rarity, class, limit } */
    find(opts = {}) {
      return _pool().filter(e => _matches(e, opts)).slice(0, opts.limit || 100);
    },

    /** Spells. opts: { q, school, level, class, concentration, ritual, damage_type, limit } */
    spells(opts = {}) {
      let res = _getCat('spell').filter(e => _matches(e, { ...opts, category: 'spell' }));
      if (opts.concentration !== undefined) res = res.filter(e => e.concentration === opts.concentration);
      if (opts.ritual        !== undefined) res = res.filter(e => e.ritual        === opts.ritual);
      if (opts.damage_type)                 res = res.filter(e => e.damage_type   === opts.damage_type);
      return res.slice(0, opts.limit || 500);
    },

    /** Waffen. opts: { q, rarity, weapon_type, limit } */
    weapons(opts = {}) {
      let res = _getCat('weapon').filter(e => _matches(e, { ...opts, category: 'weapon' }));
      if (opts.weapon_type) res = res.filter(e => e.weapon_type === opts.weapon_type);
      return res.slice(0, opts.limit || 500);
    },

    /** Rüstungen. opts: { q, armor_type, armor_slot, rarity, limit } */
    armor(opts = {}) {
      let res = _getCat('armor').filter(e => _matches(e, { ...opts, category: 'armor' }));
      if (opts.armor_type) res = res.filter(e => e.armor_type === opts.armor_type);
      if (opts.armor_slot) res = res.filter(e => e.armor_slot === opts.armor_slot);
      return res.slice(0, opts.limit || 500);
    },

    /** Items. opts: { q, subcategory, rarity, limit } */
    items(opts = {}) {
      let res = _getCat('item').filter(e => _matches(e, { ...opts, category: 'item' }));
      if (opts.subcategory) res = res.filter(e => e.subcategory_de === opts.subcategory);
      return res.slice(0, opts.limit || 500);
    },

    /** Icon-Daten für Entry-ID. Gibt { url, name, label } oder null zurück. */
    icon(id) {
      const e = this.get(id);
      if (!e || !e.icon_url) return null;
      return { url: e.icon_url, name: e.icon_name || '', label: e.icon_label || '' };
    },

    /** Spell by slug (z. B. 'fireball'). */
    spell(slug) {
      return _getCat('spell').find(e => e.slug === slug) || null;
    },

    /** Anzahl geladener Einträge gesamt. */
    get count() { return _all ? _all.length : 0; },


    /** Kanonisches Typ-Icon für Rüstungs-/Waffen-/Spell-/Item-Typ.
     *  category: 'armor' | 'weapon' | 'spell' | 'item'
     *  type:     z. B. 'leather', 'longsword', 'evocation', 'potion'
     *  Gibt { url, name, label } oder null zurück.
     */
    typeIcon(category, type) {
      if (!type) return null;
      let section = null;
      if (category === 'armor')  section = _TYPE_ICONS.armor[type] || null;
      if (category === 'weapon') section = _TYPE_ICONS.weapon[type] || null;
      if (category === 'spell')  section = _TYPE_ICONS.spell_school[type] || null;
      if (category === 'item')   section = _TYPE_ICONS.item_subcategory[type] || null;
      if (!section) return null;
      return { url: section[0], name: section[1], label: section[2] };
    },

    /** Bestes Icon für Name + optionale Kategorie. Gibt icon_url oder null zurück. */
    bestIcon(name, category) {
      return _bestMatch(category || null, name)?.icon_url || null;
    },
  };
})();
