/**
 * RIFT - Unified Layout Components
 * Single source of truth for TopNav, MegaNav, Dock, and Footer
 * All pages use these components for consistent UI
 */

// ============================================================
// UNIFIED TOPNAV (Header with Logo, Search, Party, User)
// ============================================================
function createUnifiedTopnav() {
    const userData = getUserData();
    const roomCode = getRoomCode();
    const rawRoomCode = localStorage.getItem('rift_current_room') || '---';
    
    return `
    <header class="topnav">
        <div class="topnav__inner">
            <!-- Logo -->
            <a href="index.html" class="topnav__logo">
                <img src="assets/img/logo_rift.png" alt="RIFT">
            </a>
            
            <!-- Search -->
            <div class="topnav__search" id="searchContainer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" placeholder="Suchen..." id="searchInput">
                <div class="topnav__search-dropdown" id="search-dropdown"></div>
            </div>
            
            <div class="topnav__spacer"></div>
            
            <div class="topnav__right">
                <!-- Party Dropdown -->
                <div class="topnav__dropdown-trigger" id="partyTrigger">
                    <div class="topnav__party">
                        <div class="topnav__party-info">
                            <span class="topnav__party-label">PARTY</span>
                            <span class="topnav__party-status" id="partyOnlineCount">0 Online</span>
                        </div>
                    </div>
                    <div class="topnav__dropdown topnav__dropdown--party">
                        <div class="topnav__dropdown-header">
                            <div class="topnav__dropdown-title">Party</div>
                            <div class="topnav__dropdown-value" id="partyHeaderValue">Keine Spieler</div>
                        </div>
                        <div class="topnav__dropdown-body" id="partyMembersList">
                            <div class="topnav__dropdown-empty">Noch niemand in der Party</div>
                        </div>
                        <div class="topnav__dropdown-body">
                            <div class="topnav__dropdown-divider"></div>
                            <a href="#" class="topnav__dropdown-item" onclick="RIFTLayout.invitePlayers(); return false;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/><path d="M17 3a1 1 0 0 1 1 1v1h1a1 1 0 0 1 0 2h-1v1a1 1 0 0 1 -2 0v-1h-1a1 1 0 0 1 0 -2h1v-1a1 1 0 0 1 1 -1"/></svg>
                                Spieler einladen
                            </a>
                            <a href="#" class="topnav__dropdown-item" onclick="RIFTLayout.manageParty(); return false;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"/></svg>
                                Party verwalten
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- Room Code Dropdown -->
                <div class="topnav__dropdown-trigger" id="roomTrigger">
                    <div class="topnav__room topnav__room-code">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7V3a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4zm0 2H4v10h10v-4H8a1 1 0 0 1-1-1V9zm2-4v10h10V4H9z"/></svg>
                        <code id="roomCodeDisplay">${roomCode || '---'}</code>
                    </div>
                    <div class="topnav__dropdown topnav__dropdown--room">
                        <div class="topnav__dropdown-header">
                            <div class="topnav__dropdown-title">Session Raumcode</div>
                            <div class="topnav__dropdown-value">Teile diesen Code</div>
                        </div>
                        <div class="topnav__dropdown-room-code">
                            <code id="roomCodeLarge">${roomCode || '---'}</code>
                            <button class="topnav__dropdown-room-copy" title="Code kopieren" onclick="RIFTLayout.copyRoomCode()">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 11a3 3 0 0 1 2.995 2.824l.005 .176v6a3 3 0 0 1 -2.824 2.995l-.176 .005h-6a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-6a3 3 0 0 1 2.824 -2.995l.176 -.005zm0 2h-6a1 1 0 0 0 -.993 .883l-.007 .117v6a1 1 0 0 0 .883 .993l.117 .007h6a1 1 0 0 0 .993 -.883l.007 -.117v-6a1 1 0 0 0 -.883 -.993zm-3 -9a3 3 0 0 1 2.995 2.824l.005 .176v1h-2v-1a1 1 0 0 0 -.883 -.993l-.117 -.007h-6a1 1 0 0 0 -.993 .883l-.007 .117v6a1 1 0 0 0 .883 .993l.117 .007h1v2h-1a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-6a3 3 0 0 1 2.824 -2.995l.176 -.005z"/></svg>
                            </button>
                        </div>
                        <div class="topnav__dropdown-body">
                            <a href="#" class="topnav__dropdown-item" onclick="RIFTLayout.shareRoomLink(); return false;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                Link teilen
                            </a>
                            <a href="#" class="topnav__dropdown-item" onclick="RIFTLayout.showQRCode(); return false;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2zm0 10a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2zm10 -10a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2zm-2 12a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/></svg>
                                QR-Code anzeigen
                            </a>
                            <div class="topnav__dropdown-divider"></div>
                            <a href="#" class="topnav__dropdown-item topnav__dropdown-item--danger" onclick="RIFTLayout.leaveSession(); return false;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3a1 1 0 0 1 .117 1.993l-.117 .007h-9a1 1 0 0 0 -.993 .883l-.007 .117v14a1 1 0 0 0 .883 .993l.117 .007h9a1 1 0 0 1 .117 1.993l-.117 .007h-9a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005h9z"/><path d="M21.414 11.293a1 1 0 0 1 .083 1.32l-.083 .094l-3 3a1 1 0 0 1 -1.497 -1.32l.083 -.094l1.792 -1.793h-9.792a1 1 0 0 1 -.117 -1.993l.117 -.007h9.792l-1.792 -1.793a1 1 0 0 1 -.083 -1.32l.083 -.094a1 1 0 0 1 1.32 -.083l.094 .083l3 3z"/></svg>
                                Session verlassen
                            </a>
                        </div>
                    </div>
                </div>
                
                <div class="topnav__divider"></div>
                
                <!-- Notifications -->
                <div class="topnav__icon-wrapper">
                    <button class="topnav__icon-btn" id="notifications-btn" title="Benachrichtigungen">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.235 19c.865 0 1.322 1.024 .745 1.668a3.992 3.992 0 0 1 -2.98 1.332a3.992 3.992 0 0 1 -2.98 -1.332c-.552 -.616 -.158 -1.579 .634 -1.661l.11 -.006h4.47zm-2.235 -17c4.97 0 8 3.03 8 7v3l.005 .158a2 2 0 0 0 1.3 1.77l.195 .072v2h-19v-2a2 2 0 0 0 1.275 -1.776l.025 -.224v-3c0 -3.97 3.03 -7 7 -7z"/></svg>
                        <span class="topnav__badge" id="notificationBadge" style="display: none;">0</span>
                    </button>
                </div>
                
                <!-- GM Button (GM only) -->
                <a href="gm.html" class="topnav__icon-btn" id="settings-btn" title="GM Optionen" style="display: ${(userData.isGM || userData.isCogm) ? 'flex' : 'none'};">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.884 2.007l.114 -.007l.118 .007l.059 .008l.061 .013l.111 .034a.993 .993 0 0 1 .217 .112l.104 .082l.255 .218a11 11 0 0 0 7.189 2.537l.342 -.01a1 1 0 0 1 1.005 .717a13 13 0 0 1 -9.208 16.25a1 1 0 0 1 -.502 0a13 13 0 0 1 -9.209 -16.25a1 1 0 0 1 1.005 -.717a11 11 0 0 0 7.531 -2.527l.263 -.225l.096 -.075a.993 .993 0 0 1 .217 -.112l.112 -.034a.97 .97 0 0 1 .119 -.021z"/></svg>
                </a>
                
                <!-- User Dropdown -->
                <div class="topnav__dropdown-trigger" id="userTrigger">
                    <div class="topnav__user">
                        <div class="topnav__user-avatar" id="userAvatar" style="background: ${userData.color}">
                            ${userData.avatar 
                                ? `<img src="${userData.avatar}" alt="">` 
                                : userData.initial}
                        </div>
                        <span class="topnav__user-name" id="userName">${userData.name}</span>
                    </div>
                    <div class="topnav__dropdown topnav__dropdown--user">
                        <div class="topnav__dropdown-user-header">
                            <div class="topnav__dropdown-user-avatar" id="userAvatarLarge" style="background: ${userData.color}">
                                ${userData.avatar 
                                    ? `<img src="${userData.avatar}" alt="">` 
                                    : userData.initial}
                            </div>
                            <div class="topnav__dropdown-user-info">
                                <div class="topnav__dropdown-user-name" id="userNameLarge">${userData.name}</div>
                                <div class="topnav__dropdown-user-email" id="userEmail">${userData.email || 'Nicht angemeldet'}</div>
                            </div>
                        </div>
                        <div class="topnav__dropdown-body">
                            <a href="user-settings.html" class="topnav__dropdown-item">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/></svg>
                                Mein Profil
                            </a>
                            <a href="sheet.html" class="topnav__dropdown-item">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2"/><path d="M19 7h-4l-.001 -4.001z"/></svg>
                                Meine Charaktere
                            </a>
                            <a href="user-settings.html" class="topnav__dropdown-item">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"/></svg>
                                Einstellungen
                            </a>
                            <div class="topnav__dropdown-divider"></div>
                            <a href="donate.html" class="topnav__dropdown-item">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z"/></svg>
                                RIFT unterstützen
                            </a>
                            <a href="#" class="topnav__dropdown-item topnav__dropdown-item--danger" id="logoutBtn" onclick="RIFTLayout.logout(); return false;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3a1 1 0 0 1 .117 1.993l-.117 .007h-9a1 1 0 0 0 -.993 .883l-.007 .117v14a1 1 0 0 0 .883 .993l.117 .007h9a1 1 0 0 1 .117 1.993l-.117 .007h-9a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005h9z"/><path d="M21.414 11.293a1 1 0 0 1 .083 1.32l-.083 .094l-3 3a1 1 0 0 1 -1.497 -1.32l.083 -.094l1.792 -1.793h-9.792a1 1 0 0 1 -.117 -1.993l.117 -.007h9.792l-1.792 -1.793a1 1 0 0 1 -.083 -1.32l.083 -.094a1 1 0 0 1 1.32 -.083l.094 .083l3 3z"/></svg>
                                Abmelden
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>
    `;
}

// ============================================================
// UNIFIED MEGANAV (Secondary Navigation with Dropdowns)
// ============================================================
function createUnifiedMeganav() {
    const currentPage = getCurrentPage();
    
    return `
    <nav class="meganav">
        <div class="meganav__inner">
            <!-- Hub -->
            <a href="index.html" class="meganav__item meganav__item--link ${currentPage === 'index' || currentPage === 'hub' ? 'active' : ''}">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z"/></svg>
                Hub
            </a>
            
            <!-- Abenteuer -->
            <div class="meganav__item">
                Abenteuer
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                
                <div class="meganav__dropdown">
                    <div class="meganav__dropdown-grid">
                        <a href="sessions.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2a5 5 0 0 1 5 5v14a1 1 0 0 1 -1.555 .832l-5.445 -3.63l-5.444 3.63a1 1 0 0 1 -1.55 -.72l-.006 -.112v-14a5 5 0 0 1 5 -5h4z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Meine Sessions</div>
                                <div class="meganav__dropdown-card-desc">Alle deine Abenteuer</div>
                            </div>
                        </a>
                        <a href="session.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 6.66a1 1 0 0 0 -1 1v4l.007 .117a1 1 0 0 0 1.993 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883zm0 -3a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0 -2.5"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Aktive Session</div>
                                <div class="meganav__dropdown-card-desc">Zur aktuellen Session</div>
                            </div>
                        </a>
                        <a href="sessions.html?new=true" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon meganav__dropdown-card-icon--accent">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.324 .001l.318 .004l.616 .017l.299 .013l.579 .034l.553 .046c4.785 .464 6.732 2.411 7.196 7.196l.046 .553l.034 .579c.005 .098 .01 .198 .013 .299l.017 .616l.005 .642l-.005 .642l-.017 .616l-.013 .299l-.034 .579l-.046 .553c-.464 4.785 -2.411 6.732 -7.196 7.196l-.553 .046l-.579 .034c-.098 .005 -.198 .01 -.299 .013l-.616 .017l-.642 .005l-.642 -.005l-.616 -.017l-.299 -.013l-.579 -.034l-.553 -.046c-4.785 -.464 -6.732 -2.411 -7.196 -7.196l-.046 -.553l-.034 -.579a28.058 28.058 0 0 1 -.013 -.299l-.017 -.616l-.004 -.318l-.001 -.324l.001 -.324l.004 -.318l.017 -.616l.013 -.299l.034 -.579l.046 -.553c.464 -4.785 2.411 -6.732 7.196 -7.196l.553 -.046l.579 -.034c.098 -.005 .198 -.01 .299 -.013l.616 -.017l.318 -.004l.324 -.001zm0 6a1 1 0 0 0 -1 1v2h-2l-.117 .007a1 1 0 0 0 .117 1.993h2v2l.007 .117a1 1 0 0 0 1.993 -.117v-2h2l.117 -.007a1 1 0 0 0 -.117 -1.993h-2v-2l-.007 -.117a1 1 0 0 0 -.993 -.883"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <span class="meganav__dropdown-card-badge">Neu</span>
                                <div class="meganav__dropdown-card-title">Session erstellen</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Charaktere -->
            <div class="meganav__item">
                Charaktere
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                
                <div class="meganav__dropdown">
                    <div class="meganav__dropdown-grid">
                        <a href="sheet.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2"/><path d="M19 7h-4l-.001 -4.001z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Meine Charaktere</div>
                                <div class="meganav__dropdown-card-desc">Charakterverwaltung</div>
                            </div>
                        </a>
                        <a href="sheet.html?new=true" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon meganav__dropdown-card-icon--accent">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/><path d="M17 3a1 1 0 0 1 1 1v1h1a1 1 0 0 1 0 2h-1v1a1 1 0 0 1 -2 0v-1h-1a1 1 0 0 1 0 -2h1v-1a1 1 0 0 1 1 -1"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Charakter erstellen</div>
                                <div class="meganav__dropdown-card-desc">Neuen Helden erschaffen</div>
                            </div>
                        </a>
                        <a href="dice.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.425 1.414l-6.775 3.996a3.21 3.21 0 0 0 -1.65 2.807v7.285a3.226 3.226 0 0 0 1.678 2.826l6.695 4.237c1.034 .57 2.22 .57 3.2 .032l6.804 -4.302c.98 -.537 1.623 -1.618 1.623 -2.793v-7.284l-.005 -.204a3.223 3.223 0 0 0 -1.284 -2.39l-.107 -.075l-.007 -.007a1.074 1.074 0 0 0 -.181 -.133l-6.776 -3.995a3.33 3.33 0 0 0 -3.216 0z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Würfel</div>
                                <div class="meganav__dropdown-card-desc">3D Dice Roller</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Regelwerke -->
            <div class="meganav__item">
                Regelwerke
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                
                <div class="meganav__dropdown meganav__dropdown--rulesets">
                    <div class="meganav__ruleset-grid">
                        <a href="worldsapart.html" class="meganav__ruleset-btn" title="Worlds Apart">
                            <img src="https://res.cloudinary.com/dza4jgreq/image/upload/v1770066185/rs_worldapart_cuqdjn.png" alt="Worlds Apart">
                        </a>
                        <a href="dnd5e.html" class="meganav__ruleset-btn" title="D&D 5e">
                            <img src="https://res.cloudinary.com/dza4jgreq/image/upload/v1770066185/rs_dnd5e_siffwr.png" alt="D&D 5e">
                        </a>
                        <a href="htbah.html" class="meganav__ruleset-btn" title="How To Be A Hero">
                            <img src="https://res.cloudinary.com/dza4jgreq/image/upload/v1770066183/rs_htbah_fmv3sx.png" alt="How To Be A Hero">
                        </a>
                        <a href="cyberpunkred.html" class="meganav__ruleset-btn" title="Cyberpunk RED">
                            <img src="https://res.cloudinary.com/dza4jgreq/image/upload/v1770066183/rs_cpred_ghwma4.png" alt="Cyberpunk RED">
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Tools -->
            <div class="meganav__item">
                Tools
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                
                <div class="meganav__dropdown">
                    <div class="meganav__dropdown-grid">
                        <a href="dice.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.425 1.414l-6.775 3.996a3.21 3.21 0 0 0 -1.65 2.807v7.285a3.226 3.226 0 0 0 1.678 2.826l6.695 4.237c1.034 .57 2.22 .57 3.2 .032l6.804 -4.302c.98 -.537 1.623 -1.618 1.623 -2.793v-7.284l-.005 -.204a3.223 3.223 0 0 0 -1.284 -2.39l-.107 -.075l-.007 -.007a1.074 1.074 0 0 0 -.181 -.133l-6.776 -3.995a3.33 3.33 0 0 0 -3.216 0z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Würfel</div>
                                <div class="meganav__dropdown-card-desc">3D Dice Roller</div>
                            </div>
                        </a>
                        <a href="map.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon" style="background: rgba(6, 182, 212, 0.15); color: #22d3ee;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <span class="meganav__dropdown-card-badge meganav__dropdown-card-badge--beta">Beta</span>
                                <div class="meganav__dropdown-card-title">Karten</div>
                            </div>
                        </a>
                        <a href="whiteboard.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon" style="background: rgba(251, 146, 60, 0.15); color: #fb923c;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zm10 -4a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 -8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Whiteboard</div>
                                <div class="meganav__dropdown-card-desc">Zeichnen & Planen</div>
                            </div>
                        </a>
                        <a href="chat.html" class="meganav__dropdown-card">
                            <div class="meganav__dropdown-card-icon" style="background: rgba(34, 197, 94, 0.15); color: #22c55e;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.821 4.91c3.899 -2.765 9.468 -2.539 13.073 .535c3.667 3.129 4.168 8.238 1.152 11.898c-2.841 3.447 -7.965 4.583 -12.231 2.805l-.233 -.101l-4.374 .931l-.04 .006l-.035 .007h-.018l-.022 .005h-.038l-.033 .004l-.021 -.001l-.023 .001l-.033 -.003h-.035l-.022 -.004l-.022 -.002l-.035 -.007l-.034 -.005l-.016 -.004l-.024 -.005l-.049 -.016l-.024 -.005l-.011 -.005l-.022 -.007l-.045 -.02l-.03 -.012l-.011 -.006l-.014 -.006l-.031 -.018l-.045 -.024l-.016 -.011l-.037 -.026l-.04 -.027l-.002 -.004l-.013 -.009l-.043 -.04l-.025 -.02l-.006 -.007l-.056 -.062l-.013 -.014l-.011 -.014l-.039 -.056l-.014 -.019l-.005 -.01l-.042 -.073l-.007 -.012l-.004 -.008l-.007 -.012l-.014 -.038l-.02 -.042l-.004 -.016l-.004 -.01l-.017 -.061l-.007 -.018l-.002 -.015l-.005 -.019l-.005 -.033l-.008 -.042l-.002 -.031l-.003 -.01v-.016l-.004 -.054l.001 -.036l.001 -.023l.002 -.053l.004 -.025v-.019l.008 -.035l.005 -.034l.005 -.02l.004 -.02l.018 -.06l.003 -.013l1.15 -3.45l-.022 -.037c-2.21 -3.747 -1.209 -8.391 2.413 -11.119z"/></svg>
                            </div>
                            <div class="meganav__dropdown-card-content">
                                <div class="meganav__dropdown-card-title">Chat</div>
                                <div class="meganav__dropdown-card-desc">Gruppen-Chat</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
            
            <div class="meganav__spacer"></div>
            
            <!-- Social Links -->
            <div class="meganav__social">
                <a href="https://discord.gg/riftapp" target="_blank" class="meganav__social-link meganav__social-link--discord" title="Discord">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </a>
                <a href="donate.html" class="meganav__social-link meganav__social-link--heart" title="Unterstützen">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </a>
                <a href="mailto:contact@rift-app.com" class="meganav__social-link meganav__social-link--email" title="Email">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z"/><path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z"/></svg>
                </a>
            </div>
        </div>
    </nav>
    `;
}

// ============================================================
// UNIFIED DOCK (Bottom Navigation)
// ============================================================
function createUnifiedDock() {
    const currentPage = getCurrentPage();
    const userData = getUserData();
    
    // Hub check - includes 'hub' because Netlify redirects / to /hub
    const isHub = currentPage === 'index' || currentPage === '' || currentPage === 'hub';
    
    return `
    <div class="dock" id="bottomDock">
        <a href="index.html" class="dock__item ${isHub ? 'active' : ''}" data-tooltip="Hub">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z"/>
            </svg>
        </a>
        <a href="sessions.html" class="dock__item ${currentPage === 'sessions' ? 'active' : ''}" data-tooltip="Sessions">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2a5 5 0 0 1 5 5v14a1 1 0 0 1 -1.555 .832l-5.445 -3.63l-5.444 3.63a1 1 0 0 1 -1.55 -.72l-.006 -.112v-14a5 5 0 0 1 5 -5h4z"/>
            </svg>
        </a>
        <a href="sheet.html" class="dock__item ${currentPage === 'sheet' || currentPage.startsWith('sheet-') ? 'active' : ''}" data-tooltip="Charakter">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2"/><path d="M19 7h-4l-.001 -4.001z"/>
            </svg>
        </a>
        
        <div class="dock__divider"></div>
        
        <a href="dice.html" class="dock__item ${currentPage === 'dice' ? 'active' : ''}" data-tooltip="Würfel">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.425 1.414l-6.775 3.996a3.21 3.21 0 0 0 -1.65 2.807v7.285a3.226 3.226 0 0 0 1.678 2.826l6.695 4.237c1.034 .57 2.22 .57 3.2 .032l6.804 -4.302c.98 -.537 1.623 -1.618 1.623 -2.793v-7.284l-.005 -.204a3.223 3.223 0 0 0 -1.284 -2.39l-.107 -.075l-.007 -.007a1.074 1.074 0 0 0 -.181 -.133l-6.776 -3.995a3.33 3.33 0 0 0 -3.216 0z"/>
            </svg>
        </a>
        <a href="map.html" class="dock__item ${currentPage === 'map' ? 'active' : ''}" data-tooltip="Karte">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"/>
            </svg>
        </a>
        <a href="notes.html" class="dock__item ${currentPage === 'notes' ? 'active' : ''}" data-tooltip="Notizen">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-2.997 10.83h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m-1 -9a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z"/>
            </svg>
        </a>
        <a href="whiteboard.html" class="dock__item ${currentPage === 'whiteboard' ? 'active' : ''}" data-tooltip="Whiteboard">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 3a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zm10 -4a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 -8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z"/>
            </svg>
        </a>
        <a href="chat.html" class="dock__item ${currentPage === 'chat' ? 'active' : ''}" data-tooltip="Chat">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.821 4.91c3.899 -2.765 9.468 -2.539 13.073 .535c3.667 3.129 4.168 8.238 1.152 11.898c-2.841 3.447 -7.965 4.583 -12.231 2.805l-.233 -.101l-4.374 .931l-.04 .006l-.035 .007h-.018l-.022 .005h-.038l-.033 .004l-.021 -.001l-.023 .001l-.033 -.003h-.035l-.022 -.004l-.022 -.002l-.035 -.007l-.034 -.005l-.016 -.004l-.024 -.005l-.049 -.016l-.024 -.005l-.011 -.005l-.022 -.007l-.045 -.02l-.03 -.012l-.011 -.006l-.014 -.006l-.031 -.018l-.045 -.024l-.016 -.011l-.037 -.026l-.04 -.027l-.002 -.004l-.013 -.009l-.043 -.04l-.025 -.02l-.006 -.007l-.056 -.062l-.013 -.014l-.011 -.014l-.039 -.056l-.014 -.019l-.005 -.01l-.042 -.073l-.007 -.012l-.004 -.008l-.007 -.012l-.014 -.038l-.02 -.042l-.004 -.016l-.004 -.01l-.017 -.061l-.007 -.018l-.002 -.015l-.005 -.019l-.005 -.033l-.008 -.042l-.002 -.031l-.003 -.01v-.016l-.004 -.054l.001 -.036l.001 -.023l.002 -.053l.004 -.025v-.019l.008 -.035l.005 -.034l.005 -.02l.004 -.02l.018 -.06l.003 -.013l1.15 -3.45l-.022 -.037c-2.21 -3.747 -1.209 -8.391 2.413 -11.119z"/>
            </svg>
        </a>
        
        ${(userData.isGM || userData.isCogm) ? `
        <div class="dock__divider"></div>
        <a href="gm.html" class="dock__item dock__item--gm ${currentPage === 'gm' ? 'active' : ''}" data-tooltip="GM Optionen">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.884 2.007l.114 -.007l.118 .007l.059 .008l.061 .013l.111 .034a.993 .993 0 0 1 .217 .112l.104 .082l.255 .218a11 11 0 0 0 7.189 2.537l.342 -.01a1 1 0 0 1 1.005 .717a13 13 0 0 1 -9.208 16.25a1 1 0 0 1 -.502 0a13 13 0 0 1 -9.209 -16.25a1 1 0 0 1 1.005 -.717a11 11 0 0 0 7.531 -2.527l.263 -.225l.096 -.075a.993 .993 0 0 1 .217 -.112l.112 -.034a.97 .97 0 0 1 .119 -.021z"/>
            </svg>
        </a>
        ` : ''}
    </div>
    `;
}

// ============================================================
// UNIFIED FOOTER
// ============================================================
function createUnifiedFooter() {
    const currentYear = new Date().getFullYear();
    
    return `
    <footer class="footer">
        <div class="footer__grid">
            <!-- Brand Column -->
            <div class="footer__brand">
                <a href="index.html" class="footer__logo">
                    <img src="assets/img/logo_rift.png" alt="RIFT">
                </a>
                <p class="footer__tagline">Dein digitaler Begleiter für Pen & Paper Rollenspiele. Erschaffe Helden, erlebe Abenteuer, würfle Schicksale.</p>
            </div>
            
            <!-- Spielen Column -->
            <div class="footer__column">
                <h4 class="footer__column-title">Spielen</h4>
                <nav class="footer__nav">
                    <a href="sessions.html">Sessions</a>
                    <a href="sheet.html">Charaktere</a>
                    <a href="dice.html">Würfel</a>
                    <a href="map.html">Karten</a>
                </nav>
            </div>
            
            <!-- Regelwerke Column -->
            <div class="footer__column">
                <h4 class="footer__column-title">Regelwerke</h4>
                <nav class="footer__nav">
                    <a href="worldsapart.html">Worlds Apart</a>
                    <a href="dnd5e.html">D&D 5e (2024)</a>
                    <a href="htbah.html">How To Be A Hero</a>
                    <a href="cyberpunkred.html">Cyberpunk Red</a>
                </nav>
            </div>
            
            <!-- Über RIFT Column -->
            <div class="footer__column">
                <h4 class="footer__column-title">Über RIFT</h4>
                <nav class="footer__nav">
                    <a href="about.html">Über uns</a>
                    <a href="mailto:contact@rift-app.com">Kontakt</a>
                    <a href="branding.html">Branding</a>
                    <a href="donate.html">Unterstützen</a>
                </nav>
            </div>
        </div>
        
        <!-- Footer Bottom -->
        <div class="footer__bottom">
            <div class="footer__legal">
                <span>© ${currentYear} RIFT</span>
                <span class="footer__separator">·</span>
                <a href="privacy.html">Datenschutz</a>
                <span class="footer__separator">·</span>
                <a href="terms.html">Nutzungsbedingungen</a>
                <span class="footer__separator">·</span>
                <a href="legal.html">Impressum</a>
            </div>
            <div class="footer__social">
                <a href="https://discord.gg/riftapp" target="_blank" title="Discord" class="footer__social-link--discord">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </a>
                <a href="donate.html" title="Unterstützen" class="footer__social-link--heart">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </a>
                <a href="mailto:contact@rift-app.com" title="Email" class="footer__social-link--email">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z"/><path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z"/></svg>
                </a>
            </div>
        </div>
    </footer>
    `;
}

// ============================================================
// RIFT LAYOUT CONTROLLER
// ============================================================
const RIFTLayout = {
    // Copy room code to clipboard
    copyRoomCode: function() {
        const code = localStorage.getItem('rift_current_room') || '';
        if (code) {
            navigator.clipboard.writeText(code);
            if (typeof showToast === 'function') {
                showToast('Raumcode kopiert!', 'success');
            }
        }
    },
    
    // Share room link
    shareRoomLink: function() {
        const code = localStorage.getItem('rift_current_room') || '';
        if (code) {
            const url = `${window.location.origin}/join?code=${code}`;
            if (navigator.share) {
                navigator.share({ title: 'RIFT Session', url: url });
            } else {
                navigator.clipboard.writeText(url);
                if (typeof showToast === 'function') {
                    showToast('Link kopiert!', 'success');
                }
            }
        }
    },
    
    // Show QR code modal
    showQRCode: function() {
        // TODO: Implement QR code modal
        if (typeof showToast === 'function') {
            showToast('QR-Code Funktion kommt bald!', 'info');
        }
    },
    
    // Leave session
    leaveSession: function() {
        if (confirm('Möchtest du die Session wirklich verlassen?')) {
            localStorage.removeItem('rift_current_room');
            window.location.reload();
        }
    },
    
    // Invite players
    invitePlayers: function() {
        this.shareRoomLink();
    },
    
    // Manage party
    manageParty: function() {
        // TODO: Open party management modal
        if (typeof showToast === 'function') {
            showToast('Party-Verwaltung kommt bald!', 'info');
        }
    },
    
    // Logout
    logout: function() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut().then(() => {
                localStorage.removeItem('rift_user');
                localStorage.removeItem('rift_current_room');
                window.location.href = 'login.html';
            });
        } else {
            localStorage.removeItem('rift_user');
            window.location.href = 'login.html';
        }
    }
};

// ============================================================
// INITIALIZE UNIFIED LAYOUT
// ============================================================
function initUnifiedLayout() {
    // Check if we should inject layout (pages without custom header)
    const hasCustomHeader = document.querySelector('header.topnav');
    const hasCustomMeganav = document.querySelector('nav.meganav');
    
    // If page has placeholder elements, inject into those
    const topnavPlaceholder = document.getElementById('topnav-placeholder');
    const meganavPlaceholder = document.getElementById('meganav-placeholder');
    const dockPlaceholder = document.getElementById('dock-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');
    
    // Inject TopNav
    if (topnavPlaceholder) {
        topnavPlaceholder.outerHTML = createUnifiedTopnav();
    } else if (!hasCustomHeader) {
        document.body.insertAdjacentHTML('afterbegin', createUnifiedTopnav());
    }
    
    // Inject MegaNav
    if (meganavPlaceholder) {
        meganavPlaceholder.outerHTML = createUnifiedMeganav();
    } else if (!hasCustomMeganav) {
        const topnav = document.querySelector('header.topnav');
        if (topnav) {
            topnav.insertAdjacentHTML('afterend', createUnifiedMeganav());
        }
    }
    
    // Inject Dock
    if (dockPlaceholder) {
        dockPlaceholder.outerHTML = createUnifiedDock();
    } else if (!document.querySelector('.dock')) {
        document.body.insertAdjacentHTML('beforeend', createUnifiedDock());
    }
    
    // Inject Footer
    if (footerPlaceholder) {
        footerPlaceholder.outerHTML = createUnifiedFooter();
    } else {
        const mainContent = document.querySelector('.main__content');
        if (mainContent && !mainContent.querySelector('.footer')) {
            mainContent.insertAdjacentHTML('beforeend', createUnifiedFooter());
        }
    }
    
    // Initialize dropdowns
    initDropdowns();
    
    // Initialize party display
    initPartyDisplay();
    
    // Initialize banner system
    initBannerSystem();
    
    console.log('[RIFT] Unified layout initialized');
}

// Initialize dropdown interactions
function initDropdowns() {
    document.querySelectorAll('.topnav__dropdown-trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = trigger.classList.contains('open');
            
            // Close all dropdowns
            document.querySelectorAll('.topnav__dropdown-trigger').forEach(t => t.classList.remove('open'));
            
            // Toggle this one
            if (!isOpen) {
                trigger.classList.add('open');
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.topnav__dropdown-trigger').forEach(t => t.classList.remove('open'));
    });
    
    // MegaNav dropdowns
    document.querySelectorAll('.meganav__item').forEach(item => {
        if (!item.classList.contains('meganav__item--link')) {
            item.addEventListener('mouseenter', () => {
                item.classList.add('open');
            });
            item.addEventListener('mouseleave', () => {
                item.classList.remove('open');
            });
        }
    });
}

// Initialize party display
function initPartyDisplay() {
    const updatePartyUI = (members) => {
        const countEl = document.getElementById('partyOnlineCount');
        const listEl = document.getElementById('partyMembersList');
        const headerEl = document.getElementById('partyHeaderValue');
        
        if (!countEl) return;
        
        const online = members.filter(m => m.online === true || m.isOnline === true);
        countEl.textContent = `${online.length} Online`;
        
        if (headerEl) {
            headerEl.textContent = members.length > 0 ? `${members.length} Spieler` : 'Keine Spieler';
        }
        
        if (listEl && members.length > 0) {
            listEl.innerHTML = members.map(m => {
                const isOnline = m.online === true || m.isOnline === true;
                const color = m.color || '#FF4655';
                const name = m.displayName || m.name || 'Unbekannt';
                const initial = name.charAt(0).toUpperCase();
                
                return `
                    <div class="topnav__dropdown-member">
                        <div class="topnav__dropdown-member-avatar" style="background: ${color}">
                            ${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial}
                        </div>
                        <span class="topnav__dropdown-member-name">${name}</span>
                        <span class="topnav__dropdown-member-status" style="color: ${isOnline ? '#22c55e' : '#6b7280'}">●</span>
                    </div>
                `;
            }).join('');
        } else if (listEl) {
            listEl.innerHTML = '<div style="padding: 12px; color: rgba(255,255,255,0.5); text-align: center;">Keine Spieler im Raum</div>';
        }
    };
    
    // Try to subscribe to Firebase for real-time updates
    const roomCode = localStorage.getItem('rift_current_room');
    
    if (roomCode && typeof RIFT !== 'undefined' && RIFT.rooms && RIFT.rooms.subscribeToMembers) {
        console.log('[Layout] Subscribing to party members for room:', roomCode);
        
        // Small delay to ensure Firebase is ready
        setTimeout(() => {
            try {
                RIFT.rooms.subscribeToMembers(roomCode, (members) => {
                    console.log('[Layout] Received members update:', members);
                    updatePartyUI(members);
                    
                    // Also store in localStorage for other components
                    localStorage.setItem('rift_party_members', JSON.stringify(members.map(m => ({
                        name: m.displayName || m.name,
                        color: m.color,
                        avatar: m.photoURL,
                        isOnline: m.online === true
                    }))));
                });
            } catch (e) {
                console.error('[Layout] Failed to subscribe to party:', e);
            }
        }, 1000);
    } else {
        // Fallback: read from localStorage
        const stored = localStorage.getItem('rift_party_members');
        if (stored) {
            try {
                const members = JSON.parse(stored);
                updatePartyUI(members.map(m => ({ ...m, online: m.isOnline })));
            } catch (e) {
                console.error('[Layout] Failed to parse party from localStorage:', e);
            }
        }
    }
    
    // Listen for localStorage changes from other tabs/pages
    window.addEventListener('storage', (e) => {
        if (e.key === 'rift_party_members') {
            const stored = e.newValue;
            if (stored) {
                try {
                    const members = JSON.parse(stored);
                    updatePartyUI(members.map(m => ({ ...m, online: m.isOnline })));
                } catch (e) {}
            }
        }
    });
}

// ============================================================
// BANNER SYSTEM (Announcements/Notifications)
// ============================================================
const BannerSystem = {
    banners: [],
    shownBanners: new Set(),
    countdownIntervals: {},
    
    levelConfig: {
        info: { color: '#3B82F6', icon: 'ℹ️' },
        warning: { color: '#F59E0B', icon: '⚠️' },
        critical: { color: '#EF4444', icon: '🚨' },
        success: { color: '#22C55E', icon: '✅' },
        maintenance: { color: '#8B5CF6', icon: '🔧' },
        event: { color: '#EC4899', icon: '🎉' }
    },
    
    async init() {
        console.log('[Banner] Initializing...');
        if (typeof firebase === 'undefined' || !firebase.apps?.length) {
            setTimeout(() => this.init(), 100);
            return;
        }
        console.log('[Banner] Firebase ready, loading banners...');
        await this.loadBanners();
    },
    
    async loadBanners() {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('announcements').get();
            
            console.log('[Banner] Found', snapshot.docs.length, 'banners in database');
            
            this.banners = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.displayBanners();
        } catch (e) {
            console.error('[Banner] Load error:', e);
        }
    },
    
    displayBanners() {
        const now = new Date();
        const currentPage = this.getCurrentPage();
        const userState = this.getUserState();
        
        console.log('[Banner] Current page:', currentPage, 'User state:', userState);
        
        const eligible = this.banners.filter(banner => {
            if (!banner.active) return false;
            
            if (banner.startDate) {
                const start = banner.startDate.toDate ? banner.startDate.toDate() : new Date(banner.startDate);
                if (now < start) return false;
            }
            if (banner.endDate) {
                const end = banner.endDate.toDate ? banner.endDate.toDate() : new Date(banner.endDate);
                if (now > end) return false;
            }
            
            if (banner.pages && banner.pages !== 'all') {
                if (banner.pages !== currentPage) return false;
            }
            
            if (banner.audience && banner.audience !== 'all') {
                if (banner.audience === 'logged_in' && !userState.isLoggedIn) return false;
                if (banner.audience === 'logged_out' && userState.isLoggedIn) return false;
                if (banner.audience === 'admin' && !userState.isAdmin) return false;
            }
            
            if (this.isDismissed(banner)) return false;
            
            return true;
        });
        
        console.log('[Banner] Eligible banners:', eligible.length);
        
        eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        eligible.forEach(banner => {
            if (this.shownBanners.has(banner.id)) return;
            this.renderBanner(banner);
            this.shownBanners.add(banner.id);
            this.trackView(banner.id);
        });
    },
    
    getCurrentPage() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('index') || path === '/' || path.endsWith('/')) return 'hub';
        if (path.includes('session')) return 'session';
        if (path.includes('character') || path.includes('htbah') || path.includes('dnd') || path.includes('cyberpunk')) return 'character';
        if (path.includes('landing')) return 'landing';
        return 'hub';
    },
    
    getUserState() {
        // Check multiple sources for logged in state
        let isLoggedIn = false;
        let userId = null;
        
        // 1. Check firebase.auth().currentUser
        if (typeof firebase !== 'undefined' && firebase.auth) {
            const fbUser = firebase.auth().currentUser;
            if (fbUser && !fbUser.isAnonymous) {
                isLoggedIn = true;
                userId = fbUser.uid;
            }
        }
        
        // 2. Check window.currentUser
        if (!isLoggedIn && typeof window.currentUser !== 'undefined' && window.currentUser) {
            isLoggedIn = true;
            userId = window.currentUser.oderId || window.currentUser.oderId;
        }
        
        // 3. Check localStorage
        if (!isLoggedIn) {
            const stored = localStorage.getItem('rift_user');
            if (stored) {
                try {
                    const userData = JSON.parse(stored);
                    if (userData && userData.oderId) {
                        isLoggedIn = true;
                        userId = userData.oderId;
                    }
                } catch (e) {}
            }
        }
        
        // Admin check
        const adminId = 'geBL1RI92jUiPrFK1oJ5u2Z25hM2';
        const isAdmin = userId === adminId;
        
        console.log('[Banner] User state:', { isLoggedIn, userId, isAdmin });
        
        return {
            isLoggedIn: isLoggedIn,
            isAdmin: isAdmin,
            userId: userId
        };
    },
    
    getDismissedBanners() {
        try {
            const dismissed = JSON.parse(localStorage.getItem('dismissedBanners') || '{}');
            if (Array.isArray(dismissed)) {
                localStorage.removeItem('dismissedBanners');
                return {};
            }
            return dismissed;
        } catch {
            return {};
        }
    },
    
    isDismissed(banner) {
        const dismissed = this.getDismissedBanners();
        const dismissInfo = dismissed[banner.id];
        
        if (!dismissInfo) return false;
        
        if (banner.updatedAt) {
            const updatedAt = banner.updatedAt.toDate ? banner.updatedAt.toDate() : new Date(banner.updatedAt);
            if (updatedAt.getTime() > dismissInfo.timestamp) return false;
        }
        
        if (!dismissInfo.permanent) {
            const hoursSinceDismiss = (Date.now() - dismissInfo.timestamp) / (1000 * 60 * 60);
            if (hoursSinceDismiss > 24) return false;
        }
        
        return true;
    },
    
    renderBanner(banner) {
        const position = banner.position || 'top-banner';
        const level = banner.level || 'info';
        const config = this.levelConfig[level] || this.levelConfig.info;
        
        console.log('[Banner] Rendering:', banner.title, 'position:', position, 'level:', level);
        
        // Use custom color/emoji if set
        const color = banner.customColor || config.color;
        const icon = banner.customEmoji || config.icon;
        const showEmoji = banner.showEmoji !== false;
        
        const existingId = `banner-${position}`;
        document.getElementById(existingId)?.remove();
        
        let html = '';
        let containerStyle = '';
        
        switch (position) {
            case 'top-bar':
                containerStyle = 'position:fixed;top:122px;left:0;right:0;z-index:9999;';
                html = this.renderBarBanner(banner, color, icon, showEmoji);
                break;
                
            case 'bottom-bar':
                containerStyle = 'position:fixed;bottom:72px;left:0;right:0;z-index:9999;';
                html = this.renderBarBanner(banner, color, icon, showEmoji);
                break;
                
            case 'modal':
                this.renderModalBanner(banner, color, icon, showEmoji);
                return;
                
            case 'corner':
                containerStyle = 'position:fixed;bottom:100px;right:20px;z-index:9999;max-width:360px;';
                html = this.renderCornerBanner(banner, color, icon, showEmoji);
                break;
                
            case 'top-banner':
            default:
                const container = document.getElementById('announcementBanner');
                if (container) {
                    container.innerHTML = this.renderInlineBanner(banner, color, icon, showEmoji);
                    container.style.display = 'block';
                    this.startCountdown(banner);
                }
                return;
        }
        
        const container = document.createElement('div');
        container.id = existingId;
        container.style.cssText = containerStyle;
        container.innerHTML = html;
        document.body.appendChild(container);
        
        this.startCountdown(banner);
    },
    
    renderBarBanner(banner, color, icon, showEmoji) {
        const hasLink = banner.linkUrl && banner.linkText;
        return `
            <div style="background: ${color}; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px;">
                ${showEmoji ? '<span>' + icon + '</span>' : ''}
                <span><strong>${banner.title}</strong>${banner.message ? ' — ' + banner.message : ''}</span>
                ${banner.showCountdown && banner.endDate ? '<span id="countdown-' + banner.id + '" style="font-weight:700;"></span>' : ''}
                ${hasLink ? '<a href="' + banner.linkUrl + '" target="_blank" onclick="BannerSystem.trackClick(\'' + banner.id + '\')" style="padding:6px 14px;background:rgba(255,255,255,0.2);color:white;border-radius:6px;text-decoration:none;font-weight:500;font-size:13px;">' + banner.linkText + '</a>' : ''}
                ${banner.dismissible !== false ? '<button onclick="BannerSystem.dismiss(\'' + banner.id + '\')" style="background:none;border:none;color:white;cursor:pointer;padding:4px 8px;font-size:18px;opacity:0.8;">✕</button>' : ''}
            </div>
        `;
    },
    
    renderInlineBanner(banner, color, icon, showEmoji) {
        const hasLink = banner.linkUrl && banner.linkText;
        return `
            <div style="background: ${color}20; border: 1px solid ${color}40; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
                ${showEmoji ? '<span style="font-size: 28px;">' + icon + '</span>' : ''}
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: ${color}; margin-bottom: 2px;">${banner.title}</div>
                    ${banner.message ? '<div style="font-size: 14px; color: var(--text-muted);">' + banner.message + '</div>' : ''}
                </div>
                ${banner.showCountdown && banner.endDate ? '<div id="countdown-' + banner.id + '" style="font-weight:700;font-size:18px;color:' + color + ';"></div>' : ''}
                ${hasLink ? '<a href="' + banner.linkUrl + '" target="_blank" onclick="BannerSystem.trackClick(\'' + banner.id + '\')" style="padding:8px 16px;background:' + color + ';color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;">' + banner.linkText + '</a>' : ''}
                ${banner.dismissible !== false ? '<button onclick="BannerSystem.dismiss(\'' + banner.id + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:8px;font-size:18px;">✕</button>' : ''}
            </div>
        `;
    },
    
    renderCornerBanner(banner, color, icon, showEmoji) {
        const hasLink = banner.linkUrl && banner.linkText;
        return `
            <div style="background: var(--bg-elevated); border: 1px solid ${color}40; border-radius: 12px; padding: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    ${showEmoji ? '<span style="font-size: 24px;">' + icon + '</span>' : ''}
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: ${color}; margin-bottom: 4px;">${banner.title}</div>
                        ${banner.message ? '<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">' + banner.message + '</div>' : ''}
                        ${banner.showCountdown && banner.endDate ? '<div id="countdown-' + banner.id + '" style="font-weight:700;color:' + color + ';margin-bottom:12px;"></div>' : ''}
                        ${hasLink ? '<a href="' + banner.linkUrl + '" target="_blank" onclick="BannerSystem.trackClick(\'' + banner.id + '\')" style="display:inline-block;padding:8px 16px;background:' + color + ';color:white;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">' + banner.linkText + '</a>' : ''}
                    </div>
                    ${banner.dismissible !== false ? '<button onclick="BannerSystem.dismiss(\'' + banner.id + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;font-size:16px;">✕</button>' : ''}
                </div>
            </div>
        `;
    },
    
    renderModalBanner(banner, color, icon, showEmoji) {
        const hasLink = banner.linkUrl && banner.linkText;
        const html = `
            <div id="banner-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)BannerSystem.dismiss('${banner.id}')">
                <div style="background:var(--bg-elevated);border-radius:16px;padding:32px;max-width:450px;text-align:center;position:relative;">
                    ${banner.dismissible !== false ? '<button onclick="BannerSystem.dismiss(\'' + banner.id + '\')" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;">✕</button>' : ''}
                    ${banner.imageUrl ? '<img src="' + banner.imageUrl + '" style="max-width:100%;max-height:150px;border-radius:8px;margin-bottom:20px;">' : ''}
                    ${showEmoji ? '<div style="font-size:48px;margin-bottom:16px;">' + icon + '</div>' : ''}
                    <div style="font-size:24px;font-weight:700;color:${color};margin-bottom:8px;">${banner.title}</div>
                    ${banner.message ? '<div style="color:var(--text-muted);margin-bottom:20px;">' + banner.message + '</div>' : ''}
                    ${banner.showCountdown && banner.endDate ? '<div id="countdown-' + banner.id + '" style="font-size:28px;font-weight:700;color:' + color + ';margin-bottom:20px;"></div>' : ''}
                    ${hasLink ? '<a href="' + banner.linkUrl + '" target="_blank" onclick="BannerSystem.trackClick(\'' + banner.id + '\')" style="display:inline-block;padding:12px 32px;background:' + color + ';color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">' + banner.linkText + '</a>' : ''}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.startCountdown(banner);
    },
    
    startCountdown(banner) {
        if (!banner.showCountdown || !banner.endDate) return;
        
        const countdownEl = document.getElementById('countdown-' + banner.id);
        if (!countdownEl) return;
        
        const endDate = banner.endDate.toDate ? banner.endDate.toDate() : new Date(banner.endDate);
        
        const update = () => {
            const now = new Date();
            const diff = endDate - now;
            
            if (diff <= 0) {
                countdownEl.textContent = 'Abgelaufen';
                clearInterval(this.countdownIntervals[banner.id]);
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) {
                countdownEl.textContent = days + 'd ' + hours + 'h ' + minutes + 'm';
            } else if (hours > 0) {
                countdownEl.textContent = hours + 'h ' + minutes + 'm ' + seconds + 's';
            } else {
                countdownEl.textContent = minutes + 'm ' + seconds + 's';
            }
        };
        
        update();
        this.countdownIntervals[banner.id] = setInterval(update, 1000);
    },
    
    dismiss(bannerId, permanent = false) {
        const dismissed = this.getDismissedBanners();
        dismissed[bannerId] = {
            timestamp: Date.now(),
            permanent: permanent
        };
        localStorage.setItem('dismissedBanners', JSON.stringify(dismissed));
        
        this.trackDismiss(bannerId);
        
        const banner = this.banners.find(b => b.id === bannerId);
        if (banner) {
            const position = banner.position || 'top-banner';
            if (position === 'top-banner') {
                const container = document.getElementById('announcementBanner');
                if (container) container.style.display = 'none';
            } else if (position === 'modal') {
                document.getElementById('banner-modal')?.remove();
            } else {
                document.getElementById('banner-' + position)?.remove();
            }
        }
        
        if (this.countdownIntervals[bannerId]) {
            clearInterval(this.countdownIntervals[bannerId]);
        }
        
        this.shownBanners.delete(bannerId);
    },
    
    async trackView(bannerId) {
        try {
            const db = firebase.firestore();
            await db.collection('announcements').doc(bannerId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });
        } catch (e) {}
    },
    
    async trackClick(bannerId) {
        try {
            const db = firebase.firestore();
            await db.collection('announcements').doc(bannerId).update({
                clicks: firebase.firestore.FieldValue.increment(1)
            });
        } catch (e) {}
    },
    
    async trackDismiss(bannerId) {
        try {
            const db = firebase.firestore();
            await db.collection('announcements').doc(bannerId).update({
                dismisses: firebase.firestore.FieldValue.increment(1)
            });
        } catch (e) {}
    }
};

// Initialize Banner System when layout is ready
function initBannerSystem() {
    BannerSystem.init();
}

// Make functions globally available
window.RIFTLayout = RIFTLayout;
window.initUnifiedLayout = initUnifiedLayout;
window.createUnifiedTopnav = createUnifiedTopnav;
window.createUnifiedMeganav = createUnifiedMeganav;
window.createUnifiedDock = createUnifiedDock;
window.createUnifiedFooter = createUnifiedFooter;
window.BannerSystem = BannerSystem;
window.initBannerSystem = initBannerSystem;
