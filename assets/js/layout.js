/**
 * RIFT - Shared Layout Components
 * Creates Sidebar, Topbar, and Footer dynamically
 */

// User data - loads from Firebase/RIFT.user and localStorage, merging both
function getUserData() {
    // Get data from localStorage first (this is where settings are saved)
    let localData = {};
    const stored = localStorage.getItem('rift_user');
    if (stored) {
        try {
            localData = JSON.parse(stored);
        } catch (e) {
            console.error('[Layout] Failed to parse rift_user from localStorage:', e);
        }
    }
    
    // If window.currentUser exists, merge with localStorage (localStorage takes priority for avatar, color, isGM)
    if (window.currentUser) {
        const data = {
            name: localData.name || localData.displayName || window.currentUser.displayName || window.currentUser.name || 'Spieler',
            initial: localData.initial || (localData.name || localData.displayName || window.currentUser.displayName || window.currentUser.name || 'S').charAt(0).toUpperCase(),
            color: localData.color || window.currentUser.color || '#FF4655',
            avatar: localData.avatar || localData.photoURL || window.currentUser.photoURL || window.currentUser.avatar || null,
            isGM: localData.isGM !== undefined ? localData.isGM : (window.currentUser.isGM || false),
            uid: window.currentUser.uid || localData.uid
        };
        console.log('[Layout] getUserData merged (currentUser + localStorage):', data.name, 'isGM:', data.isGM, 'avatar:', data.avatar ? 'yes' : 'no');
        return data;
    }
    
    // Fallback to localStorage only
    if (stored) {
        const data = {
            name: localData.name || localData.displayName || 'Spieler',
            initial: localData.initial || (localData.name || localData.displayName || 'S').charAt(0).toUpperCase(),
            color: localData.color || '#FF4655',
            avatar: localData.avatar || localData.photoURL || null,
            isGM: localData.isGM || false,
            uid: localData.uid
        };
        console.log('[Layout] getUserData from localStorage only:', data.name, 'isGM:', data.isGM, 'avatar:', data.avatar ? 'yes' : 'no');
        return data;
    }
    
    console.log('[Layout] getUserData: No user data found, using defaults');
    return {
        name: 'Gast',
        initial: 'G',
        color: '#FF4655',
        avatar: null,
        isGM: false
    };
}

// Current room code
function getRoomCode() {
    const code = localStorage.getItem('rift_current_room');
    return code ? code.slice(0, 3) + '-' + code.slice(3) : null;
}

// Current page detection
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
    return page || 'index';
}

/**
 * Create Sidebar
 */
function createSidebar() {
    const currentPage = getCurrentPage();
    const userData = getUserData();
    
    const sidebarHTML = `
        <!-- Sidebar Overlay (Mobile) -->
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
        
        <!-- Swipe Handle (Mobile) -->
        <div class="swipe-handle" id="swipeHandle"></div>
        
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar__header">
                <a href="index.html" class="sidebar__brand" id="sidebarBrand">
                    <svg class="sidebar__logo" width="32" height="32" viewBox="0 0 192 192" fill="#dedede">
                        <path d="M0 0 C1.00752823 -0.00990463 2.01505646 -0.01980927 3.05311584 -0.03001404 C4.1579834 -0.02551239 5.26285095 -0.02101074 6.40119934 -0.01637268 C8.14820885 -0.02666756 8.14820885 -0.02666756 9.93051147 -0.03717041 C13.79822346 -0.05553408 17.66553297 -0.05158328 21.53327942 -0.0459137 C23.54514793 -0.04838946 25.55700649 -0.05273701 27.56887132 -0.05726677 C33.90820728 -0.07133163 40.24740864 -0.06974149 46.58674622 -0.05836487 C53.09010556 -0.04695035 59.59304929 -0.06084121 66.09635371 -0.08776134 C71.70089343 -0.11007839 77.30530432 -0.11651809 82.90988523 -0.11068493 C86.24722317 -0.10734359 89.58408725 -0.11128914 92.92142296 -0.12693596 C116.68797377 -0.22256312 139.21583216 1.66961518 157.11531067 19.38768005 C163.21307689 26.36493179 168.00724196 33.64623681 171.11531067 42.38768005 C171.70312317 44.03703552 171.70312317 44.03703552 172.30281067 45.7197113 C178.1837873 65.22086644 177.55153775 89.13920346 168.30281067 107.51268005 C165.5786786 112.05290017 162.36653084 116.17735142 158.11531067 119.38768005 C157.45531067 119.38768005 156.79531067 119.38768005 156.11531067 119.38768005 C158.01716847 126.32138483 159.91948571 133.25496346 161.82209778 140.1884613 C162.46705622 142.53901935 163.11191583 144.88960451 163.75666809 147.24021912 C164.3830718 149.52389137 165.00962721 151.80752203 165.63633728 154.09111023 C166.2533583 156.33965128 166.86995826 158.58830792 167.48612976 160.83708191 C168.87052815 165.88372223 170.26284605 170.92759595 171.68806458 175.96287537 C171.92402847 176.79936615 172.15999237 177.63585693 172.40310669 178.49769592 C172.83524505 180.02582167 173.27055628 181.55305535 173.7097168 183.07917786 C174.52185963 185.95427456 175.11531067 188.38248341 175.11531067 191.38768005 C164.98774165 191.45741376 154.86023043 191.51060951 144.73246956 191.54311657 C140.02894185 191.55872405 135.32557929 191.57987175 130.62214661 191.61399841 C126.07690193 191.6467682 121.5318154 191.66456999 116.98646164 191.67231178 C115.25864551 191.67782383 113.53083733 191.68858697 111.80308914 191.70487022 C94.11825065 191.8648034 94.11825065 191.8648034 86.11531067 188.38768005 C85.4303804 188.17091614 84.74545013 187.95415222 84.0397644 187.7308197 C81.05393875 185.64691363 80.33821519 182.61070097 79.21516418 179.29075623 C78.96113358 178.57671474 78.70710299 177.86267324 78.44537449 177.12699413 C77.65306289 174.885659 76.88238715 172.63776208 76.11531067 170.38768005 C75.64835547 169.04060776 75.18107134 167.69364942 74.71342468 166.34681702 C73.28975125 162.2190401 71.90286968 158.07926825 70.51765442 153.9384613 C70.00095714 152.40107104 69.48396137 150.86378108 68.96669006 149.32658386 C67.88271191 146.10436803 66.80007476 142.88170635 65.71842957 139.65870667 C62.92930849 131.35115768 60.1230323 123.04938927 57.31843567 114.74705505 C57.04499517 113.93751436 56.77155468 113.12797367 56.48982811 112.29390144 C54.92983714 107.67554528 53.36933908 103.05736078 51.80851746 98.43928528 C51.16275325 96.52809046 50.51754976 94.61670621 49.87239075 92.70530701 C47.96056931 87.04361338 46.03943337 81.38548678 44.08921814 75.7368927 C43.56973002 74.22632711 43.05488663 72.71415526 42.54496765 71.20033264 C41.86588946 69.18665752 41.17100125 67.17923739 40.47077942 65.1728363 C39.92393494 63.57774231 39.92393494 63.57774231 39.36604309 61.95042419 C37.97197035 59.09397649 36.86402195 57.94265416 34.11531067 56.38768005 C29.7193763 55.74827142 27.84434478 55.87580504 24.17781067 58.45018005 C21.57903789 62.15146249 21.81321288 63.92552682 22.11531067 68.38768005 C22.89629779 71.6999112 22.89629779 71.6999112 24.0962677 75.04930115 C24.30812304 75.67771943 24.51997839 76.30613771 24.73825359 76.95359898 C25.43983612 79.02634228 26.156369 81.09357671 26.87312317 83.16111755 C27.37443174 84.63228329 27.87479322 86.10377205 28.37426758 87.57556152 C29.70883552 91.49960053 31.05628299 95.41910041 32.40636063 99.33782578 C33.79629336 103.37929608 35.17438013 107.42480009 36.55354309 111.46995544 C38.73277101 117.85727676 40.91851919 124.24232493 43.10993958 130.62547302 C45.6599245 138.05351375 48.19529544 145.48642529 50.72077942 152.9228363 C54.15575736 163.03049571 54.15575736 163.03049571 57.60359192 173.1337738 C58.23068054 174.96960022 58.23068054 174.96960022 58.87043762 176.84251404 C59.79358435 179.47146357 60.762449 182.0585427 61.77229309 184.65354919 C63.11531067 188.38768005 63.11531067 188.38768005 63.11531067 191.38768005 C54.30106375 191.45714973 45.48691088 191.51047571 36.67245007 191.54311657 C32.57965624 191.55878151 28.48704953 191.58003464 24.3943634 191.61399841 C20.44566315 191.64656273 16.49714302 191.66452682 12.54831886 191.67231178 C11.04079159 191.6778606 9.53327431 191.688696 8.02582359 191.70487022 C5.91635608 191.72660635 3.80763558 191.7296487 1.69807434 191.72825623 C0.49672348 191.73491806 -0.70462738 191.7415799 -1.94238281 191.7484436 C-4.88468933 191.38768005 -4.88468933 191.38768005 -6.54477406 190.32537556 C-8.56813909 187.3993209 -8.29803698 184.45624864 -8.26564026 181.02378845 C-8.27032023 180.26788469 -8.2750002 179.51198092 -8.27982199 178.73317099 C-8.29181659 176.19270023 -8.28229758 173.65276447 -8.27287292 171.11228943 C-8.27693665 169.29407434 -8.28227741 167.47586173 -8.2888031 165.65765381 C-8.30250619 160.7135115 -8.29716572 155.76955652 -8.28766584 150.82541084 C-8.28008473 145.65780752 -8.28711054 140.49022052 -8.29182434 135.32261658 C-8.29728641 126.64359143 -8.29007843 117.96464281 -8.27580261 109.28562927 C-8.25947525 99.24323377 -8.26476344 89.20102097 -8.28128183 79.15862989 C-8.29488383 70.5454144 -8.29682266 61.932254 -8.28896582 53.31903124 C-8.28428222 48.17079707 -8.28368328 43.02264885 -8.29357529 37.87442017 C-8.30222398 33.03498952 -8.29626153 28.19579506 -8.27889252 23.35639 C-8.27491643 21.57738831 -8.2760808 19.79836683 -8.28268051 18.01937294 C-8.29084202 15.59650168 -8.2806405 13.17439387 -8.26564026 10.75157166 C-8.27233242 10.0425311 -8.27902459 9.33349055 -8.28591955 8.60296392 C-8.25241735 5.82561274 -8.16538187 3.8336523 -6.66617298 1.45166683 C-4.32046372 0.05069768 -2.73068067 0.00757344 0 0 Z" transform="translate(12.884689331054688,0.6123199462890625)"/>
                    </svg>
                </a>
            </div>
            
            <nav class="sidebar__nav">
                <div class="sidebar__section">
                    <a href="index.html" class="sidebar__link ${currentPage === 'index' ? 'active' : ''}" data-tooltip="Hub">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M2.5192 7.82274C2 8.77128 2 9.91549 2 12.2039V13.725C2 17.6258 2 19.5763 3.17157 20.7881C4.34315 22 6.22876 22 10 22H14C17.7712 22 19.6569 22 20.8284 20.7881C22 19.5763 22 17.6258 22 13.725V12.2039C22 9.91549 22 8.77128 21.4808 7.82274C20.9616 6.87421 20.0131 6.28551 18.116 5.10812L16.116 3.86687C14.1106 2.62229 13.1079 2 12 2C10.8921 2 9.88939 2.62229 7.88403 3.86687L5.88403 5.10813C3.98695 6.28551 3.0384 6.87421 2.5192 7.82274ZM9 17.25C8.58579 17.25 8.25 17.5858 8.25 18C8.25 18.4142 8.58579 18.75 9 18.75H15C15.4142 18.75 15.75 18.4142 15.75 18C15.75 17.5858 15.4142 17.25 15 17.25H9Z"/>
                        </svg>
                    </a>
                    
                    <a href="sessions.html" class="sidebar__link ${currentPage === 'sessions' ? 'active' : ''}" data-tooltip="Sessions">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M21.8382 11.1263L21.609 13.5616C21.2313 17.5742 21.0425 19.5805 19.8599 20.7902C18.6773 22 16.9048 22 13.3599 22H10.6401C7.09517 22 5.32271 22 4.14009 20.7902C2.95748 19.5805 2.76865 17.5742 2.391 13.5616L2.16181 11.1263C1.9818 9.2137 1.8918 8.25739 2.21899 7.86207C2.39598 7.64823 2.63666 7.5172 2.89399 7.4946C3.36968 7.45282 3.96708 8.1329 5.16187 9.49307C5.77977 10.1965 6.08872 10.5482 6.43337 10.6027C6.62434 10.6328 6.81892 10.6018 6.99526 10.5131C7.31351 10.3529 7.5257 9.91812 7.95007 9.04852L10.1869 4.46486C10.9888 2.82162 11.3898 2 12 2C12.6102 2 13.0112 2.82162 13.8131 4.46485L16.0499 9.04851C16.4743 9.91812 16.6865 10.3529 17.0047 10.5131C17.1811 10.6018 17.3757 10.6328 17.5666 10.6027C17.9113 10.5482 18.2202 10.1965 18.8381 9.49307C20.0329 8.1329 20.6303 7.45282 21.106 7.4946C21.3633 7.5172 21.604 7.64823 21.781 7.86207C22.1082 8.25739 22.0182 9.2137 21.8382 11.1263ZM12.9524 12.699L12.8541 12.5227C12.4741 11.841 12.2841 11.5002 12 11.5002C11.7159 11.5002 11.5259 11.841 11.1459 12.5227L11.0476 12.699C10.9397 12.8927 10.8857 12.9896 10.8015 13.0535C10.7173 13.1174 10.6125 13.1411 10.4028 13.1886L10.2119 13.2318C9.47396 13.3987 9.10501 13.4822 9.01723 13.7645C8.92945 14.0468 9.18097 14.3409 9.68403 14.9291L9.81418 15.0813C9.95713 15.2485 10.0286 15.3321 10.0608 15.4355C10.0929 15.5389 10.0821 15.6504 10.0605 15.8734L10.0408 16.0765C9.96476 16.8613 9.92674 17.2538 10.1565 17.4282C10.3864 17.6027 10.7318 17.4436 11.4227 17.1255L11.6014 17.0432C11.7978 16.9528 11.8959 16.9076 12 16.9076C12.1041 16.9076 12.2022 16.9528 12.3986 17.0432L12.5773 17.1255C13.2682 17.4436 13.6136 17.6027 13.8435 17.4282C14.0733 17.2538 14.0352 16.8613 13.9592 16.0765L13.9395 15.8734C13.9179 15.6504 13.9071 15.5389 13.9392 15.4355C13.9714 15.3321 14.0429 15.2485 14.1858 15.0813L14.316 14.9291C14.819 14.3409 15.0706 14.0468 14.9828 13.7645C14.895 13.4822 14.526 13.3987 13.7881 13.2318L13.5972 13.1886C13.3875 13.1411 13.2827 13.1174 13.1985 13.0535C13.1143 12.9896 13.0603 12.8927 12.9524 12.699Z"/>
                        </svg>
                    </a>
                    
                    <a href="sheet.html" class="sidebar__link ${currentPage === 'sheet' || currentPage.startsWith('sheet-') ? 'active' : ''}" data-tooltip="Charakterbogen">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.17157 3.17157C3 4.34315 3 6.22876 3 10V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V10C21 6.22876 21 4.34315 19.8284 3.17157C18.6569 2 16.7712 2 13 2H11C7.22876 2 5.34315 2 4.17157 3.17157ZM7.25 8C7.25 7.58579 7.58579 7.25 8 7.25H16C16.4142 7.25 16.75 7.58579 16.75 8C16.75 8.41421 16.4142 8.75 16 8.75H8C7.58579 8.75 7.25 8.41421 7.25 8ZM7.25 12C7.25 11.5858 7.58579 11.25 8 11.25H16C16.4142 11.25 16.75 11.5858 16.75 12C16.75 12.4142 16.4142 12.75 16 12.75H8C7.58579 12.75 7.25 12.4142 7.25 12ZM8 15.25C7.58579 15.25 7.25 15.5858 7.25 16C7.25 16.4142 7.58579 16.75 8 16.75H13C13.4142 16.75 13.75 16.4142 13.75 16C13.75 15.5858 13.4142 15.25 13 15.25H8Z"/>
                        </svg>
                    </a>
                    
                    <a href="dice.html" class="sidebar__link ${currentPage === 'dice' ? 'active' : ''}" data-tooltip="Würfel">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62M11.45 15.96L6.31 15.93V14.91C6.31 14.91 9.74 11.58 9.75 10.57C9.75 9.33 8.73 9.46 8.73 9.46S7.75 9.5 7.64 10.71L6.14 10.76C6.14 10.76 6.18 8.26 8.83 8.26C11.2 8.26 11.23 10.04 11.23 10.5C11.23 12.18 8.15 14.77 8.15 14.77L11.45 14.76V15.96M17.5 13.5C17.5 14.9 16.35 16.05 14.93 16.05C13.5 16.05 12.36 14.9 12.36 13.5V10.84C12.36 9.42 13.5 8.27 14.93 8.27S17.5 9.42 17.5 10.84V13.5M16 10.77V13.53C16 14.12 15.5 14.6 14.92 14.6C14.34 14.6 13.86 14.12 13.86 13.53V10.77C13.86 10.18 14.34 9.71 14.92 9.71C15.5 9.71 16 10.18 16 10.77Z"/>
                        </svg>
                    </a>
                    
                    <a href="map.html" class="sidebar__link ${currentPage === 'map' ? 'active' : ''}" data-tooltip="Karte">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM13.9563 14.0949C13.763 14.2644 13.5167 14.3629 13.024 14.56C10.7142 15.4839 9.55936 15.9459 8.89971 15.4976C8.7433 15.3913 8.6084 15.2564 8.50212 15.1C8.05386 14.4404 8.51582 13.2855 9.43973 10.9757C9.6368 10.483 9.73533 10.2367 9.9048 10.0434C9.94799 9.99419 9.99435 9.94782 10.0436 9.90464C10.2368 9.73517 10.4832 9.63663 10.9759 9.43956C13.2856 8.51565 14.4405 8.0537 15.1002 8.50196C15.2566 8.60824 15.3915 8.74314 15.4978 8.89954C15.946 9.5592 15.4841 10.7141 14.5602 13.0239C14.3631 13.5165 14.2646 13.7629 14.0951 13.9561C14.0519 14.0054 14.0055 14.0517 13.9563 14.0949Z"/>
                        </svg>
                    </a>
                    
                    <a href="notes.html" class="sidebar__link ${currentPage === 'notes' ? 'active' : ''}" data-tooltip="Notizen">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,10V4.5L19.5,10M5,3C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V9L15,3H5Z"/>
                        </svg>
                    </a>
                    
                    <a href="whiteboard.html" class="sidebar__link ${currentPage === 'whiteboard' ? 'active' : ''}" data-tooltip="Whiteboard">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.714 22 12C22 7.28595 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447ZM17 12.25C17.4142 12.25 17.75 12.5858 17.75 13V18C17.75 18.4142 17.4142 18.75 17 18.75C16.5858 18.75 16.25 18.4142 16.25 18V13C16.25 12.5858 16.5858 12.25 17 12.25ZM12.75 6C12.75 5.58579 12.4142 5.25 12 5.25C11.5858 5.25 11.25 5.58579 11.25 6V18C11.25 18.4142 11.5858 18.75 12 18.75C12.4142 18.75 12.75 18.4142 12.75 18V6ZM7 8.25C7.41421 8.25 7.75 8.58579 7.75 9V18C7.75 18.4142 7.41421 18.75 7 18.75C6.58579 18.75 6.25 18.4142 6.25 18V9C6.25 8.58579 6.58579 8.25 7 8.25Z"/>
                        </svg>
                    </a>
                    
                    <a href="chat.html" class="sidebar__link ${currentPage === 'chat' ? 'active' : ''}" data-tooltip="Chat">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22ZM8 13.25C7.58579 13.25 7.25 13.5858 7.25 14C7.25 14.4142 7.58579 14.75 8 14.75H13.5C13.9142 14.75 14.25 14.4142 14.25 14C14.25 13.5858 13.9142 13.25 13.5 13.25H8ZM7.25 10.5C7.25 10.0858 7.58579 9.75 8 9.75H16C16.4142 9.75 16.75 10.0858 16.75 10.5C16.75 10.9142 16.4142 11.25 16 11.25H8C7.58579 11.25 7.25 10.9142 7.25 10.5Z"/>
                        </svg>
                    </a>
                </div>
                
                <div class="sidebar__divider"></div>
                
                <div class="sidebar__section">
                    <a href="about.html" class="sidebar__link ${currentPage === 'about' ? 'active' : ''}" data-tooltip="Über RIFT">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.714 22 12C22 7.28595 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355ZM18.75 16C18.75 16.4142 18.4142 16.75 18 16.75H6C5.58579 16.75 5.25 16.4142 5.25 16C5.25 15.5858 5.58579 15.25 6 15.25H18C18.4142 15.25 18.75 15.5858 18.75 16ZM18 12.75C18.4142 12.75 18.75 12.4142 18.75 12C18.75 11.5858 18.4142 11.25 18 11.25H6C5.58579 11.25 5.25 11.5858 5.25 12C5.25 12.4142 5.58579 12.75 6 12.75H18ZM18.75 8C18.75 8.41421 18.4142 8.75 18 8.75H6C5.58579 8.75 5.25 8.41421 5.25 8C5.25 7.58579 5.58579 7.25 6 7.25H18C18.4142 7.25 18.75 7.58579 18.75 8Z"/>
                        </svg>
                    </a>
                    <a href="roadmap.html" class="sidebar__link ${currentPage === 'roadmap' ? 'active' : ''}" data-tooltip="Roadmap">
                        <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.25 5C4.25 3.48122 5.48122 2.25 7 2.25H17C18.5188 2.25 19.75 3.48122 19.75 5V19C19.75 20.5188 18.5188 21.75 17 21.75H7C5.48122 21.75 4.25 20.5188 4.25 19V5ZM8 6.25C7.58579 6.25 7.25 6.58579 7.25 7C7.25 7.41421 7.58579 7.75 8 7.75H16C16.4142 7.75 16.75 7.41421 16.75 7C16.75 6.58579 16.4142 6.25 16 6.25H8ZM7.25 11C7.25 10.5858 7.58579 10.25 8 10.25H16C16.4142 10.25 16.75 10.5858 16.75 11C16.75 11.4142 16.4142 11.75 16 11.75H8C7.58579 11.75 7.25 11.4142 7.25 11ZM8 14.25C7.58579 14.25 7.25 14.5858 7.25 15C7.25 15.4142 7.58579 15.75 8 15.75H12C12.4142 15.75 12.75 15.4142 12.75 15C12.75 14.5858 12.4142 14.25 12 14.25H8Z"/>
                        </svg>
                    </a>
                </div>
            </nav>
            
            <div class="sidebar__footer">
                ${userData.isGM ? `
                <a href="gm.html" class="sidebar__link sidebar__link--gm ${currentPage === 'gm' ? 'active' : ''}" data-tooltip="GM Optionen">
                    <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.4277 2C11.3139 2 10.2995 2.6007 8.27081 3.80211L7.58466 4.20846C5.55594 5.40987 4.54158 6.01057 3.98466 7C3.42773 7.98943 3.42773 9.19084 3.42773 11.5937V12.4063C3.42773 14.8092 3.42773 16.0106 3.98466 17C4.54158 17.9894 5.55594 18.5901 7.58466 19.7915L8.27081 20.1979C10.2995 21.3993 11.3139 22 12.4277 22C13.5416 22 14.5559 21.3993 16.5847 20.1979L17.2708 19.7915C19.2995 18.5901 20.3139 17.9894 20.8708 17C21.4277 16.0106 21.4277 14.8092 21.4277 12.4063V11.5937C21.4277 9.19084 21.4277 7.98943 20.8708 7C20.3139 6.01057 19.2995 5.40987 17.2708 4.20846L16.5847 3.80211C14.5559 2.6007 13.5416 2 12.4277 2ZM8.67773 12C8.67773 9.92893 10.3567 8.25 12.4277 8.25C14.4988 8.25 16.1777 9.92893 16.1777 12C16.1777 14.0711 14.4988 15.75 12.4277 15.75C10.3567 15.75 8.67773 14.0711 8.67773 12Z"/>
                    </svg>
                </a>
                ` : ''}
                
                <button class="sidebar__link sidebar__link--logout" data-tooltip="Raum verlassen" onclick="handleLogout()">
                    <svg class="sidebar__link-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M9.70725 2.4087C9 3.03569 9 4.18259 9 6.4764V17.5236C9 19.8174 9 20.9643 9.70725 21.5913C10.4145 22.2183 11.4955 22.0297 13.6576 21.6526L15.9864 21.2465C18.3809 20.8288 19.5781 20.62 20.2891 19.7417C21 18.8635 21 17.5933 21 15.0529V8.94711C21 6.40671 21 5.13652 20.2891 4.25826C19.5781 3.37999 18.3809 3.17118 15.9864 2.75354L13.6576 2.34736C11.4955 1.97026 10.4145 1.78171 9.70725 2.4087ZM12 10.1686C12.4142 10.1686 12.75 10.52 12.75 10.9535V13.0465C12.75 13.48 12.4142 13.8314 12 13.8314C11.5858 13.8314 11.25 13.48 11.25 13.0465V10.9535C11.25 10.52 11.5858 10.1686 12 10.1686Z"/>
                        <path d="M7.54717 4.5C5.48889 4.503 4.41599 4.54826 3.73223 5.23202C3 5.96425 3 7.14276 3 9.49979V14.4998C3 16.8568 3 18.0353 3.73223 18.7676C4.41599 19.4513 5.48889 19.4966 7.54717 19.4996C7.49985 18.8763 7.49992 18.1557 7.50001 17.3768V6.6227C7.49992 5.84388 7.49985 5.1233 7.54717 4.5Z"/>
                    </svg>
                </button>
            </div>
        </aside>
    `;
    
    return sidebarHTML;
}

/**
 * Create Topbar
 */
function createTopbar() {
    const userData = getUserData();
    const roomCode = getRoomCode();
    const currentPage = getCurrentPage();
    
    const topbarHTML = `
        <header class="topbar">
            <!-- Mobile Menu Toggle -->
            <button class="topbar__menu-toggle" id="menuToggle" aria-label="Menü öffnen">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>
            
            <!-- Search -->
            <div class="topbar__search">
                <svg class="topbar__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                <input type="text" class="topbar__search-input" placeholder="Suchen...">
                <button class="topbar__search-btn">Suche</button>
            </div>
            
            <!-- Room Code Badge with Dropdown -->
            ${roomCode ? `
            <div class="topbar__room">
                <div class="topbar__room-badge" id="roomBadge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="4" y1="9" x2="20" y2="9"/>
                        <line x1="4" y1="15" x2="20" y2="15"/>
                        <line x1="10" y1="3" x2="8" y2="21"/>
                        <line x1="16" y1="3" x2="14" y2="21"/>
                    </svg>
                    <span id="roomCodeDisplay">${roomCode}</span>
                    <svg class="topbar__room-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
                <div class="topbar__room-dropdown" id="roomDropdown">
                    <button class="topbar__room-item" onclick="copyRoomCode()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Code kopieren</span>
                    </button>
                    <button class="topbar__room-item" onclick="copyInviteLink()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        <span>Einladungslink</span>
                    </button>
                    ${userData.isGM ? `
                    <div class="topbar__room-divider"></div>
                    <button class="topbar__room-item topbar__room-item--danger" onclick="closeRoom()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>Raum schließen</span>
                    </button>
                    ` : ''}
                </div>
            </div>
            ` : `
            <button class="topbar__room-create" onclick="createRoom()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Raum erstellen</span>
            </button>
            `}
            
            <!-- Party Indicator -->
            <div class="topbar__party">
                <div class="topbar__party-badge" id="partyBadge">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span id="partyCountDisplay">0/0</span>
                    <span class="topbar__party-status"></span>
                    <svg class="topbar__party-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
                <div class="topbar__party-dropdown" id="partyDropdown">
                    <div class="topbar__party-header">
                        <span class="topbar__party-title">Party</span>
                        <span class="topbar__party-count" id="partyOnlineCount">0 online</span>
                    </div>
                    <div class="topbar__party-list" id="partyMembersList">
                        <!-- Dynamisch befüllt -->
                    </div>
                    <div class="topbar__party-empty" id="partyEmptyState">
                        <span style="color: rgba(255,255,255,0.4); font-size: 13px;">Noch keine Mitspieler</span>
                    </div>
                    <div class="topbar__party-footer" id="partyFooter" style="display: none;">
                        <span class="topbar__party-gm" id="partyGmName">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                            GM: --
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Main Action -->
            <button class="topbar__action" onclick="startAdventure()">
                <div class="topbar__action-icon-wrap">
                    <svg class="topbar__action-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62M11.45 15.96L6.31 15.93V14.91C6.31 14.91 9.74 11.58 9.75 10.57C9.75 9.33 8.73 9.46 8.73 9.46S7.75 9.5 7.64 10.71L6.14 10.76C6.14 10.76 6.18 8.26 8.83 8.26C11.2 8.26 11.23 10.04 11.23 10.5C11.23 12.18 8.15 14.77 8.15 14.77L11.45 14.76V15.96M17.5 13.5C17.5 14.9 16.35 16.05 14.93 16.05C13.5 16.05 12.36 14.9 12.36 13.5V10.84C12.36 9.42 13.5 8.27 14.93 8.27S17.5 9.42 17.5 10.84V13.5M16 10.77V13.53C16 14.12 15.5 14.6 14.92 14.6C14.34 14.6 13.86 14.12 13.86 13.53V10.77C13.86 10.18 14.34 9.71 14.92 9.71C15.5 9.71 16 10.18 16 10.77Z"/>
                    </svg>
                </div>
                <span>Abenteuer starten</span>
            </button>
            
            <!-- Spacer -->
            <div class="topbar__spacer"></div>
            
            <!-- Icons Group -->
            <div class="topbar__icons">
                <div class="topbar__clock" id="topbarClock">00:00</div>
                ${userData.isGM ? `
                <a href="gm.html" class="topbar__icon-btn topbar__icon-btn--gm" title="GM Optionen">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </a>
                ` : ''}
                <button class="topbar__icon-btn topbar__icon-btn--notifications" title="Benachrichtigungen">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span class="badge"></span>
                </button>
            </div>
            
            <div class="topbar__divider"></div>
            
            <!-- User Profile -->
            <div class="topbar__user-wrapper">
                <button class="topbar__user" id="userDropdown">
                    <div class="topbar__avatar" style="background: ${userData.color}">
                        ${userData.avatar 
                            ? `<img src="${userData.avatar}" class="topbar__avatar-img" alt="">` 
                            : `<div class="topbar__avatar-fallback">${userData.initial}</div>`
                        }
                    </div>
                    <div class="topbar__user-info">
                        <span class="topbar__user-name">${userData.name}</span>
                    </div>
                    <svg class="topbar__user-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="topbar__dropdown" id="userDropdownMenu">
                    <button class="topbar__dropdown-item" onclick="openSettings('name')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Name ändern
                    </button>
                    <button class="topbar__dropdown-item" onclick="openSettings('color')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Farbe ändern
                    </button>
                    <button class="topbar__dropdown-item" onclick="openSettings('avatar')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Profilbild ändern
                    </button>
                    <div class="topbar__dropdown-divider"></div>
                    <button class="topbar__dropdown-item topbar__dropdown-item--danger" onclick="handleLogout()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>
            </div>
        </header>
        
        <!-- Divider Line -->
        <div class="topbar-divider"></div>
    `;
    
    return topbarHTML;
}

/**
 * Create Footer
 */
function createFooter() {
    const footerHTML = `
        <footer class="footer">
            <div class="footer__top">
                <a href="index.html" class="footer__logo">
                    <img src="assets/img/logo_rift.png" alt="RIFT">
                </a>
                <nav class="footer__links">
                    <a href="about.html" class="footer__link">Über RIFT</a>
                    <a href="branding.html" class="footer__link">Branding Guide</a>
                    <a href="contact.html" class="footer__link">Kontakt</a>
                    <a href="donate.html" class="footer__link">Spenden</a>
                </nav>
            </div>
            <div class="footer__divider"></div>
            <div class="footer__bottom">
                <p class="footer__copy">© 2025 RIFT – Tabletop Companion. All rights reserved.</p>
                <nav class="footer__legal">
                    <a href="privacy.html" class="footer__link">Datenschutz</a>
                    <span class="footer__separator">|</span>
                    <a href="imprint.html" class="footer__link">Impressum</a>
                </nav>
            </div>
        </footer>
    `;
    
    return footerHTML;
}

/**
 * Update Clock Display
 */
function updateClock() {
    const clockEl = document.getElementById('topbarClock');
    if (!clockEl) return;
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
}

/**
 * Initialize Layout
 * Call this at the start of each page
 */
function initLayout() {
    // Get the app container
    const app = document.querySelector('.app');
    if (!app) return;
    
    // Get the main element and preserve its classes
    const mainEl = app.querySelector('.main');
    const mainClasses = mainEl ? mainEl.className : 'main';
    
    // Get the main content (what's already in the page)
    const mainContent = app.querySelector('.main__content');
    const pageContent = mainContent ? mainContent.innerHTML : '';
    
    // Build the full layout
    app.innerHTML = `
        ${createSidebar()}
        <main class="${mainClasses}">
            <div class="main__content">
                ${createTopbar()}
                ${pageContent}
            </div>
            ${createFooter()}
        </main>
    `;
    
    // Reinitialize sidebar functionality
    initSidebarEvents();
    
    // Initialize room dropdown
    initRoomDropdown();
    
    // Initialize party dropdown
    initPartyDropdown();
    
    // Initialize user dropdown
    initUserDropdown();
    
    // Initialize clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Initialize party count from storage
    updatePartyFromStorage();
}

/**
 * Initialize User Dropdown
 */
function initUserDropdown() {
    const userBtn = document.getElementById('userDropdown');
    const dropdown = document.getElementById('userDropdownMenu');
    
    if (userBtn && dropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userBtn.classList.toggle('open');
            dropdown.classList.toggle('open');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!userBtn.contains(e.target) && !dropdown.contains(e.target)) {
                userBtn.classList.remove('open');
                dropdown.classList.remove('open');
            }
        });
    }
}

/**
 * Update party count from storage
 */
function updatePartyFromStorage() {
    // Load party data from room if exists
    const roomData = JSON.parse(localStorage.getItem('rift_room_data') || '{}');
    const online = roomData.onlineCount || 1; // At least current user
    const total = roomData.partySize || 1;
    updatePartyCount(online, total);
}

/**
 * Update user display in topbar and sidebar
 * Call this after auth state changes
 */
function updateUserDisplay() {
    const userData = getUserData();
    console.log('[Layout] updateUserDisplay called, avatar:', userData.avatar ? 'yes (' + userData.avatar.length + ' chars)' : 'no');
    
    // Update topbar user button
    const userBtn = document.querySelector('.topbar__user-btn');
    if (userBtn) {
        const avatarContainer = userBtn.querySelector('.topbar__avatar');
        const name = userBtn.querySelector('.topbar__user-name');
        
        if (avatarContainer) {
            avatarContainer.style.backgroundColor = userData.color;
            
            // Check if we need to update avatar content
            if (userData.avatar) {
                // Has avatar image
                let img = avatarContainer.querySelector('.topbar__avatar-img');
                if (!img) {
                    // Create img element
                    avatarContainer.innerHTML = `<img src="${userData.avatar}" class="topbar__avatar-img" alt="">`;
                } else {
                    img.src = userData.avatar;
                }
            } else {
                // No avatar, show initial
                let fallback = avatarContainer.querySelector('.topbar__avatar-fallback');
                if (!fallback) {
                    avatarContainer.innerHTML = `<div class="topbar__avatar-fallback">${userData.initial}</div>`;
                } else {
                    fallback.textContent = userData.initial;
                }
            }
        }
        if (name) {
            name.textContent = userData.name;
        }
    }
    
    // Update sidebar user info
    const sidebarAvatar = document.querySelector('.sidebar__avatar');
    const sidebarName = document.querySelector('.sidebar__user-name');
    
    if (sidebarAvatar) {
        sidebarAvatar.style.backgroundColor = userData.color;
        
        if (userData.avatar) {
            let img = sidebarAvatar.querySelector('img');
            if (!img) {
                sidebarAvatar.innerHTML = `<img src="${userData.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                img.src = userData.avatar;
            }
        } else {
            sidebarAvatar.innerHTML = userData.initial;
        }
    }
    if (sidebarName) {
        sidebarName.textContent = userData.name;
    }
    
    console.log('[Layout] User display updated:', userData.name, userData.color);
}

// Make updateUserDisplay globally available
window.updateUserDisplay = updateUserDisplay;

/**
 * Initialize Sidebar Events (mobile swipe, overlay, etc.)
 */
function initSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const swipeHandle = document.getElementById('swipeHandle');
    const menuToggle = document.getElementById('menuToggle');
    
    if (!sidebar || !overlay) return;
    
    // Toggle function
    const toggleSidebar = (open) => {
        if (open) {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
    
    // Menu toggle button click
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.contains('open');
            toggleSidebar(!isOpen);
        });
    }
    
    // Close sidebar on overlay click
    overlay.addEventListener('click', () => {
        toggleSidebar(false);
    });
    
    // Close sidebar on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            toggleSidebar(false);
        }
    });
    
    // Close sidebar when clicking a link (on mobile)
    sidebar.querySelectorAll('.sidebar__link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                toggleSidebar(false);
            }
        });
    });
    
    // Swipe handling
    if (swipeHandle) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        swipeHandle.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
        });
        
        document.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            if (diff > 50) {
                toggleSidebar(true);
            }
        });
    }
    
    // Logo click ripple effect
    const logoBrand = document.getElementById('sidebarBrand');
    if (logoBrand) {
        logoBrand.addEventListener('click', function(e) {
            // Add ripple class
            this.classList.add('ripple');
            
            // Remove after animation
            setTimeout(() => {
                this.classList.remove('ripple');
            }, 400);
        });
    }
}

/**
 * Logout handler
 */
async function handleLogout() {
    // Clear localStorage
    localStorage.removeItem('rift_user');
    localStorage.removeItem('rift_current_room');
    localStorage.removeItem('rift_last_session');
    
    // Sign out from Firebase
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
            console.log('[Layout] Firebase signed out');
        }
    } catch (e) {
        console.warn('[Layout] Firebase signOut error:', e);
    }
    
    // Redirect to login with logout flag (prevents auto-login redirect)
    window.location.href = 'login.html?logout=true';
}

/**
 * Copy room code to clipboard
 */
function copyRoomCode() {
    const code = getRoomCode();
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            // Close dropdown
            const dropdown = document.getElementById('roomDropdown');
            if (dropdown) dropdown.classList.remove('open');
            
            // Show toast
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success(`Code ${code} kopiert`, 'Raum-Code');
            }
        });
    }
}

/**
 * Copy invite link to clipboard
 */
function copyInviteLink() {
    const code = getRoomCode();
    if (code) {
        const link = `${window.location.origin}/login.html?room=${code.replace('-', '')}`;
        navigator.clipboard.writeText(link).then(() => {
            // Close dropdown
            const dropdown = document.getElementById('roomDropdown');
            if (dropdown) dropdown.classList.remove('open');
            
            // Show toast
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success('Einladungslink kopiert', 'Link');
            }
        });
    }
}

/**
 * Generate a 6-character room code (XXX-XXX format)
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create a new room
 */
function createRoom() {
    const code = generateRoomCode();
    const roomData = {
        code: code,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        createdBy: getUserData().displayName || 'Unknown'
    };
    
    localStorage.setItem('rift_current_room', code);
    localStorage.setItem('rift_room_data', JSON.stringify(roomData));
    
    // Show toast
    if (window.RIFT?.ui?.Toast) {
        RIFT.ui.Toast.success(`Raum ${code.slice(0,3)}-${code.slice(3)} erstellt`, 'Neuer Raum');
    }
    
    // Reload to show room badge
    setTimeout(() => window.location.reload(), 500);
}

/**
 * Close the current room (GM only)
 */
async function closeRoom() {
    // Close dropdown first
    const dropdown = document.getElementById('roomDropdown');
    if (dropdown) dropdown.classList.remove('open');
    
    const confirmed = await showConfirm(
        'Möchtest du diesen Raum wirklich schließen? Alle Spieler werden getrennt.',
        'Raum schließen',
        'Abbrechen'
    );
    
    if (confirmed) {
        localStorage.removeItem('rift_current_room');
        localStorage.removeItem('rift_room_data');
        
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.info('Raum wurde geschlossen', 'Raum');
        }
        
        // Reload to update UI
        setTimeout(() => window.location.reload(), 500);
    }
}

/**
 * Update room activity timestamp
 */
function updateRoomActivity() {
    const roomData = JSON.parse(localStorage.getItem('rift_room_data') || '{}');
    if (roomData.code) {
        roomData.lastActivity = Date.now();
        localStorage.setItem('rift_room_data', JSON.stringify(roomData));
    }
}

/**
 * Check if room is expired (30 days no activity)
 */
function checkRoomExpiry() {
    const roomData = JSON.parse(localStorage.getItem('rift_room_data') || '{}');
    if (roomData.lastActivity) {
        const daysSinceActivity = (Date.now() - roomData.lastActivity) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity > 30) {
            localStorage.removeItem('rift_current_room');
            localStorage.removeItem('rift_room_data');
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.info('Raum wegen Inaktivität geschlossen', 'Raum abgelaufen');
            }
            return true;
        }
    }
    return false;
}

/**
 * Initialize room dropdown
 */
function initRoomDropdown() {
    const badge = document.getElementById('roomBadge');
    const dropdown = document.getElementById('roomDropdown');
    
    if (badge && dropdown) {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            badge.classList.toggle('open');
            // Close party dropdown
            document.getElementById('partyDropdown')?.classList.remove('open');
            document.getElementById('partyBadge')?.classList.remove('open');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!badge.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                badge.classList.remove('open');
            }
        });
    }
    
    // Update activity on page load
    updateRoomActivity();
    
    // Check room expiry
    checkRoomExpiry();
}

/**
 * Initialize party dropdown
 */
function initPartyDropdown() {
    const badge = document.getElementById('partyBadge');
    const dropdown = document.getElementById('partyDropdown');
    
    if (badge && dropdown) {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            badge.classList.toggle('open');
            // Close room dropdown
            document.getElementById('roomDropdown')?.classList.remove('open');
            document.getElementById('roomBadge')?.classList.remove('open');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!badge.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                badge.classList.remove('open');
            }
        });
    }
}

/**
 * Show a toast notification (wrapper for RIFT.ui.Toast)
 * @param {string} message - The message to display
 * @param {string} type - 'info' (default), 'success', 'error', 'warning'
 * @param {number} duration - Duration in ms (default 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
    if (window.RIFT?.ui?.Toast) {
        RIFT.ui.Toast.show({ message, type, duration });
    } else {
        console.log(`[Toast ${type}]`, message);
    }
}

/**
 * Show a confirmation dialog (wrapper for RIFT.ui.confirm)
 * @param {string} message - The confirmation message
 * @param {string} confirmText - Text for confirm button (default 'Bestätigen')
 * @param {string} cancelText - Text for cancel button (default 'Abbrechen')
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirm(message, confirmText = 'Bestätigen', cancelText = 'Abbrechen') {
    if (window.RIFT?.ui?.confirm) {
        return RIFT.ui.confirm(message, { confirmText, cancelText });
    }
    // Fallback to native confirm
    return Promise.resolve(confirm(message));
}

/**
 * Update sidebar badge
 * @param {string} linkId - ID or href of the sidebar link (e.g., 'chat.html')
 * @param {number|string|null} count - Number to show, or null to hide. Use 'dot' for just a dot.
 */
function updateSidebarBadge(linkId, count) {
    const link = document.querySelector(`.sidebar__link[href*="${linkId}"]`);
    if (!link) return;
    
    // Find or create badge
    let badge = link.querySelector('.sidebar__badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sidebar__badge';
        link.style.position = 'relative';
        link.appendChild(badge);
    }
    
    if (count === null || count === 0) {
        badge.classList.remove('visible');
    } else if (count === 'dot') {
        badge.classList.add('sidebar__badge--dot', 'visible');
        badge.textContent = '';
    } else {
        badge.classList.remove('sidebar__badge--dot');
        badge.classList.add('visible');
        badge.textContent = count > 99 ? '99+' : count;
    }
}

// Make functions globally available for onclick handlers
window.handleLogout = handleLogout;
window.copyRoomCode = copyRoomCode;
window.copyInviteLink = copyInviteLink;
window.createRoom = createRoom;
window.closeRoom = closeRoom;
window.initLayout = initLayout;
window.initRoomDropdown = initRoomDropdown;

// Global variable to store pending avatar (backup for dataset issues)
// Using window to ensure global scope across all contexts
window.pendingAvatarData = null;
window.pendingAvatarRemove = false;

/**
 * Open Settings Modal for specific setting type
 * @param {string} type - 'name', 'color', or 'avatar'
 */
function openSettings(type) {
    // Reset pending avatar data
    window.pendingAvatarData = null;
    window.pendingAvatarRemove = false;
    
    // Close user dropdown
    const dropdown = document.getElementById('userDropdownMenu');
    const userBtn = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.remove('open');
    if (userBtn) userBtn.classList.remove('open');
    
    // Create settings modal if it doesn't exist
    let modal = document.getElementById('settingsModal');
    if (!modal) {
        modal = createSettingsModal();
    }
    
    // Show the appropriate tab
    const tabs = modal.querySelectorAll('.settings-tab');
    const contents = modal.querySelectorAll('.settings-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    const targetTab = modal.querySelector(`.settings-tab[data-tab="${type}"]`);
    const targetContent = modal.querySelector(`.settings-content[data-content="${type}"]`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetContent) targetContent.classList.add('active');
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus input if name tab
    if (type === 'name') {
        setTimeout(() => {
            const input = modal.querySelector('#settingsNameInput');
            if (input) input.focus();
        }, 100);
    }
}

/**
 * Create the settings modal HTML
 */
function createSettingsModal() {
    const userData = getUserData();
    
    const modalHTML = `
        <div class="modal-overlay" id="settingsModal">
            <div class="modal" style="max-width: 440px;">
                <div class="modal__header">
                    <h2 class="modal__title">Einstellungen</h2>
                    <button class="modal__close" onclick="closeSettingsModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                
                <div class="settings-tabs">
                    <button class="settings-tab active" data-tab="name">Name</button>
                    <button class="settings-tab" data-tab="color">Farbe</button>
                    <button class="settings-tab" data-tab="avatar">Profilbild</button>
                    <button class="settings-tab" data-tab="role">Rolle</button>
                </div>
                
                <div class="modal__body">
                    <!-- Name Tab -->
                    <div class="settings-content active" data-content="name">
                        <div class="settings-form-group">
                            <label class="settings-label" for="settingsNameInput">Anzeigename</label>
                            <input type="text" id="settingsNameInput" class="form-input" 
                                   value="${userData.name}" maxlength="24" placeholder="Dein Name">
                            <p class="form-hint">Dieser Name wird anderen Spielern angezeigt.</p>
                        </div>
                    </div>
                    
                    <!-- Color Tab -->
                    <div class="settings-content" data-content="color">
                        <div class="settings-form-group">
                            <label class="settings-label">Profilfarbe</label>
                            <div class="color-picker-grid" id="colorPickerGrid">
                                ${['#FF4655', '#FF6B6B', '#F06595', '#CC5DE8', '#845EF7', 
                                   '#5C7CFA', '#339AF0', '#22B8CF', '#20C997', '#51CF66',
                                   '#94D82D', '#FCC419', '#FF922B', '#E64980', '#BE4BDB'].map(color => `
                                    <button class="color-swatch ${userData.color === color ? 'active' : ''}" 
                                            data-color="${color}" 
                                            style="background: ${color}"
                                            onclick="selectColor('${color}')"></button>
                                `).join('')}
                            </div>
                            <p class="form-hint">Diese Farbe wird für deinen Avatar verwendet.</p>
                        </div>
                    </div>
                    
                    <!-- Avatar Tab -->
                    <div class="settings-content" data-content="avatar">
                        <div class="settings-form-group">
                            <label class="settings-label">Profilbild</label>
                            <div class="avatar-preview" id="avatarPreview" style="background: ${userData.color}">
                                ${userData.avatar 
                                    ? `<img src="${userData.avatar}" alt="">` 
                                    : `<span class="avatar-initial">${userData.initial}</span>`}
                            </div>
                            <div class="avatar-actions">
                                <label class="btn btn--secondary" for="avatarUpload">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    Bild hochladen
                                </label>
                                <input type="file" id="avatarUpload" accept="image/*" style="display:none" onchange="handleAvatarUpload(event)">
                                ${userData.avatar ? `
                                <button class="btn btn--danger" onclick="removeAvatar()">Entfernen</button>
                                ` : ''}
                            </div>
                            <p class="form-hint">Empfohlen: Quadratisches Bild, mind. 128x128px</p>
                        </div>
                    </div>
                    
                    <!-- Role Tab -->
                    <div class="settings-content" data-content="role">
                        <div class="settings-form-group">
                            <label class="settings-label">Spielleiter-Modus</label>
                            ${window.currentUser?.roomRole ? `
                                <!-- In a room - show current role -->
                                <div class="settings-info-box ${userData.isGM ? 'settings-info-box--gm' : ''}">
                                    <div class="settings-info-icon">
                                        ${userData.isGM ? `
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                            </svg>
                                        ` : `
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                            </svg>
                                        `}
                                    </div>
                                    <div class="settings-info-text">
                                        <strong>${userData.isGM ? 'Du bist Spielleiter' : 'Du bist Spieler'}</strong>
                                        <span>Deine Rolle in diesem Raum</span>
                                    </div>
                                </div>
                                <p class="form-hint">Die Rolle wird vom Raum-Ersteller vergeben und kann nicht selbst geändert werden.</p>
                            ` : `
                                <!-- No room - allow toggle for solo mode -->
                                <div class="settings-toggle-row">
                                    <span class="settings-toggle-label">Ich bin Spielleiter (GM)</span>
                                    <label class="settings-toggle">
                                        <input type="checkbox" id="settingsIsGM" ${userData.isGM ? 'checked' : ''}>
                                        <span class="settings-toggle-slider"></span>
                                    </label>
                                </div>
                                <p class="form-hint">Als GM hast du Zugriff auf erweiterte Optionen wie Spielerverwaltung, Session-Steuerung und mehr.</p>
                            `}
                        </div>
                    </div>
                </div>
                
                <div class="modal__footer">
                    <button class="btn btn--secondary" onclick="closeSettingsModal()">Abbrechen</button>
                    <button class="btn btn--primary" onclick="saveSettings()">Speichern</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('settingsModal');
    
    // Tab switching
    modal.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const content = modal.querySelector(`.settings-content[data-content="${tab.dataset.tab}"]`);
            if (content) content.classList.add('active');
        });
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettingsModal();
    });
    
    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeSettingsModal();
        }
    });
    
    return modal;
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Select color in settings
 */
function selectColor(color) {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(s => s.classList.remove('active'));
    
    const selected = document.querySelector(`.color-swatch[data-color="${color}"]`);
    if (selected) selected.classList.add('active');
    
    // Update preview
    const preview = document.getElementById('avatarPreview');
    if (preview) preview.style.background = color;
}

/**
 * Handle avatar upload with compression
 */
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.error('Bild zu groß (max 2MB)');
        }
        return;
    }
    
    // Compress image before storing
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Max size 256x256 for avatar
            const maxSize = 256;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round(height * maxSize / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round(width * maxSize / height);
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with compression
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            // Store in global variable (more reliable than dataset)
            window.pendingAvatarData = compressedBase64;
            window.pendingAvatarRemove = false;
            
            const preview = document.getElementById('avatarPreview');
            if (preview) {
                preview.innerHTML = `<img src="${compressedBase64}" alt="">`;
                preview.dataset.newAvatar = compressedBase64;
            }
            
            console.log('[Settings] Avatar uploaded, length:', compressedBase64.length);
            
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success('Bild geladen');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Remove avatar
 */
function removeAvatar() {
    window.pendingAvatarRemove = true;
    window.pendingAvatarData = null;
    
    const preview = document.getElementById('avatarPreview');
    const userData = getUserData();
    
    if (preview) {
        preview.innerHTML = `<span class="avatar-initial">${userData.initial}</span>`;
        preview.dataset.newAvatar = '';
        preview.dataset.removeAvatar = 'true';
    }
    console.log('[Settings] Avatar marked for removal');
}

/**
 * Save settings
 */
function saveSettings() {
    const nameInput = document.getElementById('settingsNameInput');
    const colorSwatch = document.querySelector('.color-swatch.active');
    const avatarPreview = document.getElementById('avatarPreview');
    
    // Get current user data
    let userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
    
    console.log('[Settings] Saving settings...');
    console.log('[Settings] Current userData:', userData);
    console.log('[Settings] window.pendingAvatarData:', window.pendingAvatarData ? 'yes (' + window.pendingAvatarData.length + ' chars)' : 'no');
    console.log('[Settings] window.pendingAvatarRemove:', window.pendingAvatarRemove);
    
    // Update name
    if (nameInput && nameInput.value.trim()) {
        userData.name = nameInput.value.trim();
        userData.displayName = nameInput.value.trim();
        userData.initial = nameInput.value.trim().charAt(0).toUpperCase();
        console.log('[Settings] Updated name:', userData.name);
    }
    
    // Update color
    if (colorSwatch) {
        userData.color = colorSwatch.dataset.color;
        console.log('[Settings] Updated color:', userData.color);
    }
    
    // Update avatar - use global variables as primary source
    if (window.pendingAvatarRemove) {
        delete userData.avatar;
        delete userData.photoURL;
        console.log('[Settings] Avatar removed (from global var)');
    } else if (window.pendingAvatarData && window.pendingAvatarData.length > 0) {
        userData.avatar = window.pendingAvatarData;
        userData.photoURL = window.pendingAvatarData;
        console.log('[Settings] Avatar saved from global var, length:', userData.avatar.length);
    } else if (avatarPreview) {
        // Fallback to dataset
        console.log('[Settings] Checking avatarPreview dataset...');
        console.log('[Settings] dataset.removeAvatar:', avatarPreview.dataset.removeAvatar);
        console.log('[Settings] dataset.newAvatar length:', avatarPreview.dataset.newAvatar?.length || 0);
        
        if (avatarPreview.dataset.removeAvatar === 'true') {
            delete userData.avatar;
            delete userData.photoURL;
            console.log('[Settings] Avatar removed (from dataset)');
        } else if (avatarPreview.dataset.newAvatar && avatarPreview.dataset.newAvatar.length > 0) {
            userData.avatar = avatarPreview.dataset.newAvatar;
            userData.photoURL = avatarPreview.dataset.newAvatar;
            console.log('[Settings] Avatar saved from dataset, length:', userData.avatar.length);
        }
    }
    
    // Update GM status
    const isGMCheckbox = document.getElementById('settingsIsGM');
    if (isGMCheckbox) {
        userData.isGM = isGMCheckbox.checked;
        console.log('[Settings] Updated isGM:', userData.isGM);
    }
    
    // Save to localStorage
    try {
        localStorage.setItem('rift_user', JSON.stringify(userData));
        console.log('[Settings] Saved to localStorage successfully');
    } catch (e) {
        console.error('[Settings] Failed to save:', e);
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.error('Speichern fehlgeschlagen - Speicher voll?');
        }
        return;
    }
    
    // Also save to Firebase if authenticated
    const db = window.RIFT?.firebase?.getFirestore?.();
    const user = window.RIFT?.firebase?.getCurrentUser?.();
    if (db && user) {
        try {
            db.collection('users').doc(user.uid).set({
                displayName: userData.name,
                color: userData.color,
                avatar: userData.avatar || null,
                isGM: userData.isGM || false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('[Settings] Synced to Firebase');
        } catch (e) {
            console.warn('[Settings] Firebase sync failed:', e);
        }
    }
    
    // Reset global variables
    window.pendingAvatarData = null;
    window.pendingAvatarRemove = false;
    
    // Update window.currentUser if exists
    if (window.currentUser) {
        Object.assign(window.currentUser, userData);
    }
    
    // Show success
    if (window.RIFT?.ui?.Toast) {
        RIFT.ui.Toast.success('Einstellungen gespeichert');
    }
    
    // Close modal
    closeSettingsModal();
    
    // Reload to update UI
    setTimeout(() => window.location.reload(), 500);
}

/**
 * Start Adventure - navigate to next session or sessions page
 */
function startAdventure() {
    // Check for upcoming sessions
    const sessions = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
    const now = new Date();
    
    // Find next upcoming session
    const upcomingSessions = sessions
        .filter(s => {
            const sessionDate = new Date(s.date + 'T' + s.time);
            return sessionDate > now;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time);
            const dateB = new Date(b.date + 'T' + b.time);
            return dateA - dateB;
        });
    
    if (upcomingSessions.length > 0) {
        // Go to next session
        window.location.href = `session.html?id=${upcomingSessions[0].id}`;
    } else {
        // Go to sessions overview
        window.location.href = 'sessions.html';
    }
}

/**
 * Update Party Count Display
 * @param {number} online - Number of online members
 * @param {number} total - Total party size
 */
function updatePartyCount(online = 0, total = 0) {
    const display = document.getElementById('partyCountDisplay');
    const onlineCount = document.getElementById('partyOnlineCount');
    
    if (display) {
        display.textContent = `${online}/${total}`;
    }
    if (onlineCount) {
        onlineCount.textContent = `${online} online`;
    }
}

// Make new functions globally available
// openSettings is handled by settings.js - don't override here
// window.openSettings = openSettings; // REMOVED - use settings.js version
window.closeSettingsModal = closeSettingsModal;
window.selectColor = selectColor;
window.handleAvatarUpload = handleAvatarUpload;
window.removeAvatar = removeAvatar;
window.saveSettings = saveSettings;
window.startAdventure = startAdventure;
window.updatePartyCount = updatePartyCount;

// Debug helper - activate GM mode from console
window.activateGM = function() {
    let userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
    userData.isGM = true;
    localStorage.setItem('rift_user', JSON.stringify(userData));
    console.log('[Debug] GM mode activated. Reload page to see changes.');
    if (window.RIFT?.ui?.Toast) {
        RIFT.ui.Toast.success('GM-Modus aktiviert - Seite wird neu geladen');
    }
    setTimeout(() => window.location.reload(), 1000);
};

// Debug helper - show user data
window.showUserData = function() {
    const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
    console.log('[Debug] Current user data:', userData);
    return userData;
};

// Debug helper - show all characters
window.showCharacters = function() {
    const chars = JSON.parse(localStorage.getItem('rift_characters') || '{}');
    console.log('[Debug] All characters:', chars);
    console.log('[Debug] Character IDs:', Object.keys(chars));
    return chars;
};

// Sync user settings from Firebase
window.syncUserFromFirebase = async function() {
    const db = window.RIFT?.firebase?.getFirestore?.();
    const user = window.RIFT?.firebase?.getCurrentUser?.();
    
    if (!db || !user) {
        console.log('[Layout] Cannot sync - not authenticated');
        return false;
    }
    
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const firebaseData = doc.data();
            let localData = JSON.parse(localStorage.getItem('rift_user') || '{}');
            
            // Merge Firebase data into local (Firebase takes priority for synced fields)
            localData = {
                ...localData,
                name: firebaseData.displayName || localData.name,
                displayName: firebaseData.displayName || localData.displayName,
                color: firebaseData.color || localData.color,
                avatar: firebaseData.avatar || localData.avatar,
                isGM: firebaseData.isGM !== undefined ? firebaseData.isGM : localData.isGM,
                uid: user.uid
            };
            
            localStorage.setItem('rift_user', JSON.stringify(localData));
            console.log('[Layout] Synced user settings from Firebase');
            return true;
        }
    } catch (e) {
        console.error('[Layout] Firebase sync error:', e);
    }
    return false;
};

// Auto-sync user settings when authenticated
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const user = window.RIFT?.firebase?.getCurrentUser?.();
        if (user) {
            window.syncUserFromFirebase();
        }
    }, 2000);
});

// Export for use in pages
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createSidebar, createTopbar, createFooter, initLayout };
}
