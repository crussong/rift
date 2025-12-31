/**
 * PNP COMPANION - Utility Functions
 * Version: 2.1
 * 
 * Common utility functions used across modules.
 */

// ===== DOM UTILITIES =====

/**
 * Shorthand for querySelector
 * @param {string} selector 
 * @param {Element} context 
 * @returns {Element|null}
 */
function $(selector, context = document) {
    return context.querySelector(selector);
}

/**
 * Shorthand for querySelectorAll
 * @param {string} selector 
 * @param {Element} context 
 * @returns {NodeList}
 */
function $$(selector, context = document) {
    return context.querySelectorAll(selector);
}

/**
 * Create element with attributes and children
 * @param {string} tag 
 * @param {Object} attrs 
 * @param {...(string|Element)} children 
 * @returns {Element}
 */
function createElement(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(el.dataset, value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
            el.appendChild(child);
        }
    }
    
    return el;
}

/**
 * Remove all children from element
 * @param {Element} el 
 */
function clearElement(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}


// ===== STRING UTILITIES =====

/**
 * Escape HTML special characters
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Capitalize first letter
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate random string ID
 * @param {number} length 
 * @returns {string}
 */
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate UUID v4
 * @returns {string}
 */
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


// ===== NUMBER UTILITIES =====

/**
 * Clamp number between min and max
 * @param {number} num 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

/**
 * Random integer between min and max (inclusive)
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Round to decimal places
 * @param {number} num 
 * @param {number} decimals 
 * @returns {number}
 */
function roundTo(num, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}

/**
 * Format number with thousands separator
 * @param {number} num 
 * @param {string} separator 
 * @returns {string}
 */
function formatNumber(num, separator = '.') {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}


// ===== ARRAY UTILITIES =====

/**
 * Shuffle array (Fisher-Yates)
 * @param {Array} array 
 * @returns {Array}
 */
function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Get random item from array
 * @param {Array} array 
 * @returns {any}
 */
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Remove duplicates from array
 * @param {Array} array 
 * @returns {Array}
 */
function unique(array) {
    return [...new Set(array)];
}

/**
 * Group array by key
 * @param {Array} array 
 * @param {string|Function} key 
 * @returns {Object}
 */
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}


// ===== DATE UTILITIES =====

/**
 * Format date to German locale
 * @param {Date|number|string} date 
 * @param {Object} options 
 * @returns {string}
 */
function formatDate(date, options = {}) {
    const d = new Date(date);
    const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options
    };
    return d.toLocaleDateString('de-DE', defaultOptions);
}

/**
 * Format time to German locale
 * @param {Date|number|string} date 
 * @returns {string}
 */
function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format date and time
 * @param {Date|number|string} date 
 * @returns {string}
 */
function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Get relative time string (e.g., "vor 5 Minuten")
 * @param {Date|number|string} date 
 * @returns {string}
 */
function timeAgo(date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
    if (hours < 24) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
    if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
    
    return formatDate(date);
}


// ===== ASYNC UTILITIES =====

/**
 * Delay execution
 * @param {number} ms 
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}


// ===== STORAGE UTILITIES =====

/**
 * Safe localStorage get with JSON parse
 * @param {string} key 
 * @param {any} defaultValue 
 * @returns {any}
 */
function storageGet(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`[Storage] Error reading ${key}:`, e);
        return defaultValue;
    }
}

/**
 * Safe localStorage set with JSON stringify
 * @param {string} key 
 * @param {any} value 
 * @returns {boolean}
 */
function storageSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`[Storage] Error writing ${key}:`, e);
        return false;
    }
}

/**
 * Remove from localStorage
 * @param {string} key 
 */
function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error(`[Storage] Error removing ${key}:`, e);
    }
}


// ===== VALIDATION UTILITIES =====

/**
 * Check if value is empty (null, undefined, empty string, empty array/object)
 * @param {any} value 
 * @returns {boolean}
 */
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Check if value is a valid number
 * @param {any} value 
 * @returns {boolean}
 */
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a valid hex color
 * @param {string} value 
 * @returns {boolean}
 */
function isHexColor(value) {
    return /^#([0-9A-Fa-f]{3}){1,2}$/.test(value);
}


// ===== TOAST/NOTIFICATION =====

/**
 * Show toast notification
 * @param {string} message 
 * @param {string} type - 'info' | 'success' | 'error'
 * @param {number} duration 
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existing = document.getElementById('pnp-toast');
    if (existing) existing.remove();
    
    const toast = createElement('div', {
        id: 'pnp-toast',
        className: `toast toast-${type}`,
        role: 'alert'
    }, message);
    
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('active');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


// ===== COPY TO CLIPBOARD =====

/**
 * Copy text to clipboard
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // Fallback for older browsers
        const textarea = createElement('textarea', {
            style: { position: 'absolute', left: '-9999px' }
        }, text);
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        return true;
    } catch (e) {
        console.error('[Clipboard] Copy failed:', e);
        return false;
    }
}


// ===== CONSOLE LOG WITH PREFIX =====

/**
 * Create prefixed logger
 * @param {string} prefix 
 * @returns {Object}
 */
function createLogger(prefix) {
    return {
        log: (...args) => console.log(`[${prefix}]`, ...args),
        warn: (...args) => console.warn(`[${prefix}]`, ...args),
        error: (...args) => console.error(`[${prefix}]`, ...args),
        info: (...args) => console.info(`[${prefix}]`, ...args)
    };
}
