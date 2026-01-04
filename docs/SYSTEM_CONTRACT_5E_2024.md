# RIFT Character Sheet – System Contract
## 5th Edition Fantasy Roleplaying Rules Implementation

**Version:** 185  
**Stand:** Januar 2026  
**Kompatibilität:** SRD 5.1 (Creative Commons Attribution 4.0)

---

## 1. Design-Philosophie

> **"Wir rechnen, was eindeutig ist. Du entscheidest, was spielrelevant ist."**

Der Charakterbogen folgt dem Prinzip der **kontrollierten Automatik**:

| Kategorie | Verhalten | Begründung |
|-----------|-----------|------------|
| **Deterministische Werte** | Automatisch | Keine Spielerentscheidung, rein mathematisch |
| **Entscheidungsbasierte Werte** | Spieler setzt Checkbox → System rechnet | Spieler kontrolliert die Entscheidung, nicht die Mathematik |
| **Situative Werte** | Manuell | Abhängig von Spielsituation, Equipment, Buffs |

---

## 2. Automatisch berechnete Werte (System-Wahrheit)

Diese Werte werden **immer** automatisch berechnet. Der Spieler kann sie nicht manuell überschreiben.

### 2.1 Proficiency Bonus

```
Proficiency Bonus = ⌊(Level - 1) / 4⌋ + 2
```

| Level | Prof. Bonus |
|-------|-------------|
| 1–4   | +2          |
| 5–8   | +3          |
| 9–12  | +4          |
| 13–16 | +5          |
| 17–20 | +6          |

**Trigger:** `Level` ändert sich  
**Abhängige Werte:** Spell Save DC, Spell Attack, alle Skills, alle Saves, Passive Scores

### 2.2 Ability Modifier

```
Ability Modifier = ⌊(Ability Score - 10) / 2⌋
```

| Score | Modifier |
|-------|----------|
| 1     | -5       |
| 2–3   | -4       |
| 4–5   | -3       |
| 6–7   | -2       |
| 8–9   | -1       |
| 10–11 | +0       |
| 12–13 | +1       |
| 14–15 | +2       |
| 16–17 | +3       |
| 18–19 | +4       |
| 20–21 | +5       |
| 22–23 | +6       |
| 24–25 | +7       |
| 26–27 | +8       |
| 28–29 | +9       |
| 30    | +10      |

**Trigger:** `Ability Score` ändert sich  
**Abhängige Werte:** Saving Throw (dieser Ability), Skills (dieser Ability), Initiative (DEX), Passive Scores (WIS/INT)

### 2.3 Initiative

```
Initiative = DEX Modifier
```

**Trigger:** `DEX Score` ändert sich  
**Hinweis:** Feat-Boni werden aktuell nicht automatisch addiert

### 2.4 Passive Scores

```
Passive Perception   = 10 + WIS Modifier + Proficiency (wenn Perception ☑) + Proficiency (wenn Expertise ☑)
Passive Investigation = 10 + INT Modifier + Proficiency (wenn Investigation ☑) + Proficiency (wenn Expertise ☑)
Passive Insight      = 10 + WIS Modifier + Proficiency (wenn Insight ☑) + Proficiency (wenn Expertise ☑)
```

**Trigger:** Ability Score ändert sich, Proficiency-Checkbox ändert sich, Expertise-Checkbox ändert sich

---

## 3. Kontrolliert berechnete Werte (Spieler entscheidet, System rechnet)

Der Spieler trifft die Entscheidung (Checkbox), das System führt die Berechnung aus.

### 3.1 Saving Throws

```
Saving Throw = Ability Modifier + Proficiency Bonus (wenn Proficient ☑)
```

| Checkbox | Formel |
|----------|--------|
| ☐ (nicht proficient) | Ability Mod |
| ☑ (proficient) | Ability Mod + Prof Bonus |

**Spieler-Kontrolle:** Proficiency-Checkbox (P) pro Saving Throw  
**Trigger:** Ability Score, Level, P-Checkbox

### 3.2 Skill Bonuses

```
Skill Bonus = Ability Modifier + Proficiency (wenn ☑) + Proficiency (wenn Expertise ☑)
```

| Checkboxen | Formel |
|------------|--------|
| ☐ P, ☐ E | Ability Mod |
| ☑ P, ☐ E | Ability Mod + Prof Bonus |
| ☑ P, ☑ E | Ability Mod + Prof Bonus + Prof Bonus (= 2× Prof) |

**Spieler-Kontrolle:** 
- Proficiency-Checkbox (P) – aktiviert Grundbonus
- Expertise-Checkbox (E) – nur aktivierbar wenn P gesetzt, verdoppelt Prof

**Skill → Ability Zuordnung:**

| Ability | Skills |
|---------|--------|
| STR | Athletics |
| DEX | Acrobatics, Sleight of Hand, Stealth |
| INT | Arcana, History, Investigation, Nature, Religion |
| WIS | Animal Handling, Insight, Medicine, Perception, Survival |
| CHA | Deception, Intimidation, Performance, Persuasion |

---

## 4. Spellcasting (Automatisch)

### 4.1 Spellcasting Modifier

```
Spellcasting Modifier = Modifier der gewählten Spellcasting Ability
```

**Spieler-Kontrolle:** Dropdown-Auswahl (INT / WIS / CHA)

### 4.2 Spell Save DC

```
Spell Save DC = 8 + Proficiency Bonus + Spellcasting Modifier
```

**Anzeige:** Wert + Breakdown-Hint (z.B. "8 + 3 + +4 (CHA)")

### 4.3 Spell Attack Bonus

```
Spell Attack = Proficiency Bonus + Spellcasting Modifier
```

**Anzeige:** Wert mit Vorzeichen + Breakdown-Hint

---

## 5. Manuelle Werte (Spieler-Kontrolle)

Diese Werte werden **nicht** automatisch berechnet, da sie von Spielsituation, Equipment oder Entscheidungen abhängen.

| Feld | Grund |
|------|-------|
| **Armor Class (AC)** | Abhängig von Rüstung, Schild, DEX-Cap, Spells, Features |
| **Hit Points (Current/Max/Temp)** | Abhängig von Würfelwürfen, Spielsituation |
| **Hit Dice** | Abhängig von Klasse, Multiclassing |
| **Speed** | Abhängig von Species, Spells, Conditions |
| **Spell Slots (Total/Expended)** | Abhängig von Klasse, Level, Multiclassing |
| **Pact Slots** | Klassespezifisch, eigene Progression |
| **Weapons (Bonus/Damage)** | Abhängig von Waffe, Enchantments, Features |
| **Class Resources** | Klassespezifisch (Ki, Sorcery Points, etc.) |
| **Exhaustion** | Spielsituation |
| **Death Saves** | Spielsituation |

---

## 6. Berechnungs-Kaskade

```
                    ┌─────────────────────────────────────┐
                    │              LEVEL                   │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         PROFICIENCY BONUS           │
                    │      = ⌊(Level-1)/4⌋ + 2            │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  SPELL SAVE DC  │       │  SPELL ATTACK   │       │  SKILL BONUSES  │
│  = 8+Prof+Mod   │       │  = Prof+Mod     │       │  (wenn P/E ☑)   │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
                                                             ▼
                                                   ┌─────────────────┐
                                                   │ PASSIVE SCORES  │
                                                   │ (Perc/Inv/Ins)  │
                                                   └─────────────────┘


                    ┌─────────────────────────────────────┐
                    │           ABILITY SCORE             │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         ABILITY MODIFIER            │
                    │      = ⌊(Score-10)/2⌋              │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  SAVING THROW   │       │     SKILLS      │       │   INITIATIVE    │
│  (dieser Attr.) │       │ (dieser Attr.)  │       │   (nur DEX)     │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 7. Daten-Persistenz

### 7.1 Gespeicherte Werte (LocalStorage)

```javascript
{
  header: { name, species, charClass, level, xp, background, subclass },
  stats: { speed, size, heroicInsp },
  abilities: { str, dex, con, int, wis, cha },
  savesProf: { str, dex, con, int, wis, cha },      // nur Checkboxen
  skillsProf: { athletics, acrobatics, ... },       // nur Checkboxen
  skillsExp: { athletics, acrobatics, ... },        // nur Checkboxen
  combat: { ac, shield, hpCurrent, hpMax, ... },
  // ... weitere
}
```

### 7.2 Nicht gespeicherte Werte (werden bei Load neu berechnet)

- Proficiency Bonus
- Initiative
- Passive Scores
- Skill Bonuses
- Saving Throw Bonuses
- Ability Modifiers
- Spell Save DC
- Spell Attack

**Grund:** Diese Werte sind deterministisch und werden aus den gespeicherten Werten abgeleitet.

---

## 8. Lizenz & Kompatibilität

Dieser Charakterbogen ist kompatibel mit dem **System Reference Document 5.1 (SRD 5.1)**.

Die Spielregeln im SRD 5.1 sind unter der **Creative Commons Attribution 4.0 International License (CC BY 4.0)** veröffentlicht.

### Attribution

> This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

### Was das bedeutet:

- ✅ Mechaniken und Regeln dürfen verwendet werden
- ✅ Kompatibilität darf ausgewiesen werden
- ✅ Attribution muss erfolgen (siehe oben)
- ❌ Keine geschützten Marken verwenden außer für Kompatibilitätshinweise
- ❌ Kein Product Identity Content (Setting-spezifische Namen, Orte, etc.)

---

## 9. Versionshistorie

| Version | Änderung |
|---------|----------|
| v185 | Kontrollierte Automatik implementiert |
| v184 | GP Farbe angepasst |
| v183 | Equipment UX verbessert |
| v182 | Portrait Nebel, Heroic Pulse |
| v180 | Pact Slots dimmen wenn nicht Warlock |
| v178 | Spellcasting Block vervollständigt |
| v176 | Abilities Grid Redesign |

---

## 10. Signatur

```
RIFT Character Sheet System Contract
5th Edition SRD 5.1 Compatible
Implementiert: Januar 2026
Lizenz: CC BY 4.0 (für SRD-Inhalte)
```
