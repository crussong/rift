# RIFT Item System — Worlds Apart

## Architektur-Übersicht

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN: Item-Katalog (Vorlagen)                              │
│  Firestore: admin/itemCatalog/worldsapart/items/{itemId}     │
│  Firestore: admin/itemCatalog/worldsapart/affixes/{affixId}  │
└──────────────┬───────────────────────────────────────────────┘
               │ GM erstellt Vorlagen
               ▼
┌──────────────────────────────────────────────────────────────┐
│  ITEM-INSTANZEN (In Inventaren)                              │
│  rooms/{roomCode}/characters/{charId} → inventory.items[]    │
│  rooms/{roomCode}/entities/{entityId} → inventory[]          │
│  "Entity" = NPC, Gegner, Truhe, Händler, Schrank            │
└──────────┬──────────┬──────────┬─────────────────────────────┘
           │          │          │
           ▼          ▼          ▼
       Spieler-     Handel-    Loot-
       Inventar     UI         UI
```

## 1. Firebase Datenmodell

### Item-Vorlage (Admin-Katalog)
```
admin/itemCatalog/worldsapart/items/{itemId}
{
  id:          "iron_sword_01",
  name:        "Eisenschwert",
  type:        "weapon",        // weapon|armor|potion|quest|gem|misc|armorPiece
  subType:     "sword",         // sword|axe|mace|bow|staff|dagger|helmet|chest|...
  slot:        "mainHand",      // mainHand|offHand|head|chest|legs|feet|ring|amulet|back|belt
  rarity:      "common",        // common|uncommon|rare|epic|legendary|unique
  icon:        "sword_iron",    // Asset-Referenz
  image:       "",              // Optional: Cloudinary-URL
  description: "Ein einfaches Schwert aus Eisen.",
  flavorText:  "Geschmiedet in der Schmiede von Kaldur.",
  
  stats: {
    damage:    "2d6+2",
    speed:     1.2,
    armor:     0,
    critChance: 5,
    critDamage: 150
  },
  
  value:       50,              // Goldwert
  weight:      3.5,             // kg
  stackable:   false,
  maxStack:    1,
  durability:  100,             // 0 = unzerstörbar
  
  requirements: {
    level:     0,
    kraft:     0,
    geschick:  0,
    class:     []               // Leer = alle Klassen
  },
  
  effects: [
    { type: "buff", stat: "kraft", value: 2, duration: 0 },
    { type: "onHit", effect: "bleed", chance: 10, damage: "1d4", rounds: 3 }
  ],
  
  flags: {
    questItem:  false,
    soulbound:  false,
    unique:     false,
    consumable: false,
    tradeable:  true
  },
  
  tags:        ["melee", "iron", "starter"],
  createdAt:   Timestamp,
  updatedAt:   Timestamp
}
```

### Affix-Vorlage (für Randomizer)
```
admin/itemCatalog/worldsapart/affixes/{affixId}
{
  id:          "flaming",
  name:        "Flammend",
  type:        "prefix",        // prefix|suffix
  rarity:      "rare",
  namePattern: "Flammendes {item}",   // Prefix: "Flammendes Schwert"
  
  applicableTo: ["weapon"],     // Welche Item-Typen
  
  statMods: {
    damage:    "+1d4 Feuer",
    critChance: 3
  },
  
  valueMod:    1.5,             // Multiplikator auf Grundwert
  tier:        2                // 1-5, bestimmt Drop-Wahrscheinlichkeit
}
```

### Item-Instanz (in Inventaren)
```
// Eingebettet in charData.inventory.items[] oder entity.inventory[]
{
  instanceId:  "inst_a7x9k2",       // Eindeutig
  baseItemId:  "iron_sword_01",     // Referenz auf Katalog
  displayName: "Flammendes Eisenschwert der Stärke",
  
  affixes:     ["flaming", "of_strength"],
  quantity:    1,
  
  durability:  { current: 87, max: 100 },
  
  // Berechnete finale Stats (bei Erstellung cached)
  finalStats: {
    damage:    "2d6+2 + 1d4 Feuer",
    speed:     1.2,
    armor:     0,
    critChance: 8,
    critDamage: 150,
    kraft:     2
  },
  
  finalValue:  112,
  source:      "loot",          // loot|trade|quest|crafted|gm
  acquiredAt:  Timestamp
}
```

### Entity-Inventar (NPCs, Gegner, Truhen)
```
rooms/{roomCode}/entities/{entityId}
{
  id:          "goblin_chief_01",
  type:        "enemy",         // enemy|npc|container|merchant
  name:        "Goblin-Häuptling",
  portrait:    "",
  
  // Für Händler
  merchant: {
    buyMultiplier:  0.5,        // Kauft für 50% des Werts
    sellMultiplier: 1.2,        // Verkauft für 120%
    restockInterval: "longRest"
  },
  
  inventory: [
    { instanceId: "inst_...", baseItemId: "...", quantity: 1, ... },
    { instanceId: "inst_...", baseItemId: "...", quantity: 3, ... }
  ],
  
  gold: 150,
  
  // Whiteboard-Referenz
  tokenId:     "token_abc123",
  
  createdAt:   Timestamp
}
```

## 2. Item-Typen & Sub-Typen

| Type        | SubTypes                                           | Slot          |
|-------------|-----------------------------------------------------|---------------|
| weapon      | sword, axe, mace, bow, crossbow, staff, dagger, spear, wand, greatsword | mainHand/offHand |
| armor       | plate, leather, cloth, chain                        | chest         |
| armorPiece  | helmet, gloves, boots, shoulders, belt, shield      | head/feet/... |
| potion      | health, resource, buff, resist                      | —             |
| quest       | key, letter, artifact, fragment                     | —             |
| gem         | diamond, ruby, emerald, sapphire, amethyst          | —             |
| misc        | material, junk, food, tool, book                    | —             |

## 3. Raritäten-System

| Rarity     | Farbe     | Affix-Slots | Wert-Multi | Drop-Gewicht |
|------------|-----------|-------------|------------|--------------|
| common     | #9ca3af   | 0           | 1.0x       | 50%          |
| uncommon   | #22c55e   | 1           | 1.5x       | 25%          |
| rare       | #3b82f6   | 1-2         | 2.5x       | 15%          |
| epic       | #a855f7   | 2           | 5.0x       | 8%           |
| legendary  | #f59e0b   | 2-3         | 10.0x      | 2%           |
| unique     | #ef4444   | Fest        | —          | GM-only      |

## 4. Randomizer-Logik

```javascript
generateItem(baseItemId, targetRarity) {
  1. Lade Base-Item aus Katalog
  2. Bestimme Rarity (gewichtet oder targetRarity)
  3. Wähle Affixe basierend auf Rarity-Slots
  4. Generiere displayName: "{Prefix} {BaseName} {Suffix}"
  5. Berechne finalStats (Base + alle Affix-Mods)
  6. Berechne finalValue (BaseValue × Rarity × Affix-Multiplier)
  7. Erstelle instanceId
  8. Return Item-Instanz
}
```

## 5. Interaktions-Flows

### Loot (Gegner getötet)
```
Whiteboard: Gegner-Token → Tod-Animation → Loot-Icon erscheint
→ Spieler klickt Loot-Icon
→ Loot-Modal öffnet (Entity-Inventar)
→ Spieler wählt Items → "Aufheben"
→ Items wandern in Spieler-Inventar
→ RiftLink sync
```

### Handel (NPC / Spieler)
```
Whiteboard: NPC-Token → Klick → "Handeln"
→ Trade-Modal: Links = NPC-Inventar, Rechts = Spieler-Inventar
→ Drag & Drop oder Klick zum Handeln
→ Gold-Berechnung automatisch
→ Bestätigung → Items tauschen
→ RiftLink sync
```

### Truhe/Schrank
```
Whiteboard: Container-Token → Klick → "Öffnen"
→ Container-Inventar-Modal
→ Items entnehmen oder hineinlegen
→ RiftLink sync (andere Spieler sehen Änderungen)
```

## 6. Implementierungs-Reihenfolge

### Phase 1: Fundament ✦ JETZT
- [x] Datenmodell definiert
- [ ] Admin Item-Katalog (CRUD für Vorlagen)
- [ ] Admin Affix-Katalog
- [ ] Item-Randomizer-Engine

### Phase 2: Spieler-Integration
- [ ] Inventar-UI im Charakterbogen (Items statt leeres Grid)
- [ ] Equipment-Slots mit Item-Referenzen
- [ ] Item-Tooltip-System
- [ ] Quickbar mit Consumables

### Phase 3: Whiteboard-Integration
- [ ] Entity-System (NPCs, Gegner, Truhen als Whiteboard-Tokens)
- [ ] Interaktions-Menü bei Token-Klick
- [ ] Loot-Modal
- [ ] Container-Modal

### Phase 4: Handel & Economy
- [ ] Händler-NPC-System
- [ ] Trade-UI (2-Panel mit Gold)
- [ ] Spieler-zu-Spieler-Handel
- [ ] GM kann Items direkt vergeben

### Phase 5: Polish
- [ ] Item-Set-Boni
- [ ] Durability-System
- [ ] Crafting (optional)
- [ ] Enchanting (optional)
