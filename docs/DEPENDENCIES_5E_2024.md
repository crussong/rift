# D&D 5E 2024 - Wert-Abhängigkeiten

> „RIFT weiß, was zusammenhängt – aber es entscheidet nichts ohne dich."

## Übersicht

Dieses Dokument erklärt, welche Werte auf dem Charakterbogen voneinander abhängen.
RIFT zeigt diese Zusammenhänge als Hinweise – die Berechnung liegt beim Spieler.

---

## Root-Werte (Grundwerte)

Diese Werte werden direkt eingetragen und sind die Basis für alles andere:

| Wert | Quelle |
|------|--------|
| **Ability Scores** | Würfelwurf / Point Buy / Standard Array |
| **Level** | Erfahrung im Spiel |
| **Proficiency Status** | Class, Background, Feats |
| **Spellcasting Ability** | Class (INT/WIS/CHA) |

---

## Abhängigkeits-Kette

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   LEVEL ──────────────────────► PROFICIENCY BONUS           │
│                                       │                     │
│                                       ▼                     │
│   ABILITY SCORE ──► ABILITY MODIFIER ─┼──► SAVING THROW     │
│        │                   │          │                     │
│        │                   │          └──► SKILLS           │
│        │                   │                                │
│        │                   ├──► Initiative (DEX)            │
│        │                   ├──► Max HP (CON)                │
│        │                   └──► Passive Perception (WIS)    │
│        │                                                    │
│        └──► SPELLCASTING ───────────► Spell Attack Bonus    │
│                                       Spell Save DC         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Berechnungsformeln

### 1. Ability Modifier
```
Modifier = (Ability Score - 10) ÷ 2  (abgerundet)
```

| Score | Modifier |
|-------|----------|
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-11 | +0 |
| 12-13 | +1 |
| 14-15 | +2 |
| 16-17 | +3 |
| 18-19 | +4 |
| 20 | +5 |

### 2. Proficiency Bonus (nach Level)

| Level | Proficiency Bonus |
|-------|-------------------|
| 1-4 | +2 |
| 5-8 | +3 |
| 9-12 | +4 |
| 13-16 | +5 |
| 17-20 | +6 |

### 3. Saving Throws
```
Saving Throw = Ability Modifier + (Proficiency Bonus wenn geübt)
```

### 4. Skills
```
Skill Bonus = Ability Modifier + (Proficiency Bonus wenn geübt)
```

**Skill-zu-Ability Zuordnung:**

| Ability | Skills |
|---------|--------|
| **STR** | Athletics |
| **DEX** | Acrobatics, Sleight of Hand, Stealth |
| **INT** | Arcana, History, Investigation, Nature, Religion |
| **WIS** | Animal Handling, Insight, Medicine, Perception, Survival |
| **CHA** | Deception, Intimidation, Performance, Persuasion |

### 5. Initiative
```
Initiative = DEX Modifier
```

### 6. Passive Perception
```
Passive Perception = 10 + WIS Modifier + (Proficiency wenn Perception geübt)
```

### 7. Armor Class (AC)
```
Keine Rüstung:    AC = 10 + DEX Modifier
Leichte Rüstung:  AC = Rüstung + DEX Modifier
Mittlere Rüstung: AC = Rüstung + DEX Modifier (max +2)
Schwere Rüstung:  AC = Rüstung (kein DEX)
+ Shield:         +2
```

### 8. Hit Points
```
Level 1:     HP = Hit Die Maximum + CON Modifier
Level 2+:    HP += Hit Die Wurf (oder Durchschnitt) + CON Modifier
```

| Class | Hit Die |
|-------|---------|
| Barbarian | d12 |
| Fighter, Paladin, Ranger | d10 |
| Bard, Cleric, Druid, Monk, Rogue, Warlock | d8 |
| Sorcerer, Wizard | d6 |

### 9. Spellcasting

```
Spell Save DC     = 8 + Proficiency Bonus + Spellcasting Ability Modifier
Spell Attack      = Proficiency Bonus + Spellcasting Ability Modifier
```

| Class | Spellcasting Ability |
|-------|---------------------|
| Bard, Paladin, Sorcerer, Warlock | CHA |
| Cleric, Druid, Ranger | WIS |
| Wizard, Artificer | INT |

### 10. Weapon Attacks

```
Melee Attack    = STR Modifier + Proficiency (wenn geübt)
Ranged Attack   = DEX Modifier + Proficiency (wenn geübt)
Finesse Weapon  = STR oder DEX (Spielerwahl) + Proficiency
```

```
Damage = Weapon Die + Ability Modifier (STR oder DEX)
```

---

## Zusammenfassung

Wenn du einen **Root-Wert** änderst, überprüfe alle abhängigen Felder:

| Änderung | Überprüfe |
|----------|-----------|
| Ability Score | Modifier, Saves, Skills, Initiative/HP/Passive |
| Level | Proficiency Bonus → alles mit Proficiency |
| Proficiency Checkbox | Betroffener Skill/Save |
| Spellcasting Ability | Spell Modifier, DC, Attack |

---

*RIFT v134 - Fantasy Classic 5E 2024*
