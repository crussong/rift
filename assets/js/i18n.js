/**
 * RIFT - Internationalization Helper
 * Funktionen für Mehrsprachigkeit
 */

// Unterstützte Sprachen
const SUPPORTED_LANGUAGES = ['de', 'en'];
const DEFAULT_LANGUAGE = 'de';

// Aktuelle Sprache ermitteln
let currentLang = (function() {
    // 1. Aus localStorage
    const stored = localStorage.getItem('pnp_lang');
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
        return stored;
    }
    
    // 2. Aus Browser-Einstellung
    const browserLang = navigator.language?.slice(0, 2);
    if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
        return browserLang;
    }
    
    // 3. Fallback
    return DEFAULT_LANGUAGE;
})();

/**
 * Übersetzung holen
 * @param {string} key - Translation key (z.B. 'login.create_room')
 * @param {object} params - Platzhalter-Werte (z.B. {name: 'Max', max: 8})
 * @returns {string} Übersetzter Text
 * 
 * @example
 * t('login.create_room') // "Raum erstellen"
 * t('toast.player_joined', {name: 'Max'}) // "Max ist beigetreten"
 * t('login.error.room_full', {max: 8}) // "Raum ist voll (max. 8 Spieler)"
 */
function t(key, params = {}) {
    // Prüfen ob TRANSLATIONS existiert
    if (typeof TRANSLATIONS === 'undefined') {
        console.warn('[i18n] TRANSLATIONS not loaded');
        return key;
    }
    
    // Text holen: aktuelle Sprache → Fallback Deutsch → Key selbst
    let text = TRANSLATIONS[currentLang]?.[key] 
            || TRANSLATIONS[DEFAULT_LANGUAGE]?.[key] 
            || key;
    
    // Platzhalter ersetzen: {name} → echter Wert
    Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });
    
    return text;
}

/**
 * Sprache wechseln
 * @param {string} lang - Sprachcode ('de' oder 'en')
 */
function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        console.warn(`[i18n] Unsupported language: ${lang}`);
        return;
    }
    
    localStorage.setItem('pnp_lang', lang);
    currentLang = lang;
    
    // Seite neu laden für vollständige Übersetzung
    location.reload();
}

/**
 * Aktuelle Sprache holen
 * @returns {string} Aktueller Sprachcode
 */
function getLanguage() {
    return currentLang;
}

/**
 * Alle unterstützten Sprachen holen
 * @returns {array} Array von Sprachcodes
 */
function getSupportedLanguages() {
    return [...SUPPORTED_LANGUAGES];
}

/**
 * Alle Elemente mit data-i18n Attribut übersetzen
 * Wird automatisch bei DOMContentLoaded aufgerufen
 */
function translatePage() {
    // Text-Inhalte
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const paramsAttr = el.dataset.i18nParams;
        const params = paramsAttr ? JSON.parse(paramsAttr) : {};
        el.textContent = t(key, params);
    });
    
    // HTML-Inhalte (für Texte mit Formatierung)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.dataset.i18nHtml;
        const paramsAttr = el.dataset.i18nParams;
        const params = paramsAttr ? JSON.parse(paramsAttr) : {};
        el.innerHTML = t(key, params);
    });
    
    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    
    // Title-Attribute (Tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    
    // Aria-Labels (Barrierefreiheit)
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    
    // HTML lang-Attribut setzen
    document.documentElement.lang = currentLang;
}

/**
 * Sprach-Switcher HTML generieren
 * @param {string} style - 'dropdown' oder 'buttons'
 * @returns {string} HTML-String
 */
function createLanguageSwitcher(style = 'dropdown') {
    const languages = {
        de: { name: 'Deutsch', flag: '🇩🇪' },
        en: { name: 'English', flag: '🇬🇧' }
    };
    
    if (style === 'buttons') {
        return SUPPORTED_LANGUAGES.map(lang => `
            <button 
                class="lang-btn ${lang === currentLang ? 'active' : ''}" 
                onclick="setLanguage('${lang}')"
            >
                ${languages[lang].flag} ${languages[lang].name}
            </button>
        `).join('');
    }
    
    // Default: Dropdown
    return `
        <select onchange="setLanguage(this.value)" class="lang-select">
            ${SUPPORTED_LANGUAGES.map(lang => `
                <option value="${lang}" ${lang === currentLang ? 'selected' : ''}>
                    ${languages[lang].flag} ${languages[lang].name}
                </option>
            `).join('')}
        </select>
    `;
}

// Auto-translate wenn DOM geladen
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', translatePage);
} else {
    // DOM bereits geladen (z.B. bei dynamischem Laden)
    translatePage();
}

// Debug-Info in Konsole
console.log(`[i18n] Language: ${currentLang}`);
