/**
 * RIFT v2 - News System
 * Featured articles for the hub, admin-only editing
 */

class NewsManager {
    constructor() {
        this.newsData = [null, null]; // Zwei News-Slots
        this.currentEditIndex = null;
        this.init();
    }
    
    init() {
        this.loadAllNews();
        this.bindEvents();
        this.createEditorModal();
        
        // Listen for admin status changes
        window.addEventListener('adminStatusChanged', () => {
            this.updateAdminButtons();
        });
    }
    
    // ========================================
    // ADMIN CHECK (via Admin System)
    // ========================================
    
    isAdmin() {
        return window.RIFT?.admin?.isAdmin() || false;
    }
    
    updateAdminButtons() {
        document.querySelectorAll('.news-admin-btn').forEach(btn => {
            btn.style.display = this.isAdmin() ? '' : 'none';
        });
    }
    
    // ========================================
    // NEWS LOADING
    // ========================================
    
    loadAllNews() {
        // Lade beide News aus localStorage
        for (let i = 1; i <= 2; i++) {
            const stored = localStorage.getItem(`rift_news_${i}`);
            
            if (stored) {
                this.newsData[i-1] = JSON.parse(stored);
            } else {
                // Default News
                this.newsData[i-1] = this.getDefaultNews(i);
            }
            
            this.renderNews(i, this.newsData[i-1]);
        }
    }
    
    getDefaultNews(index) {
        const defaults = [
            {
                id: 'default1',
                title: 'Willkommen bei RIFT v2',
                excerpt: 'Die neue Version ist da! Entdecke das überarbeitete Design und neue Features.',
                date: new Date().toISOString(),
                image: null,
                link: 'news1.html',
                author: 'RIFT-Team'
            },
            {
                id: 'default2',
                title: 'Neue Features',
                excerpt: 'Character Sheets, Dice Roller, Maps und vieles mehr - alles in einer App.',
                date: new Date().toISOString(),
                image: null,
                link: 'news2.html',
                author: 'RIFT-Team'
            }
        ];
        return defaults[index - 1];
    }
    
    renderNews(index, news) {
        const container = document.getElementById(`featuredNews${index}`);
        if (!container) return;
        
        if (!news) {
            container.innerHTML = `
                <div class="news-card__empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span class="news-card__empty-text">Keine Neuigkeiten</span>
                </div>
            `;
            return;
        }
        
        const formattedDate = this.formatDate(news.date);
        const imageHTML = news.image 
            ? `<img src="${news.image}" alt="${news.title}">`
            : `<div style="width:100%;height:100%;background:linear-gradient(135deg, var(--accent) 0%, #e63e4d 50%, #ff6b7a 100%);"></div>`;
        
        // Always link to the dedicated news page
        const newsPageLink = `news${index}.html`;
        
        container.innerHTML = `
            <div class="news-card__image">
                ${imageHTML}
            </div>
            <div class="news-card__content">
                <span class="news-card__date">${formattedDate}</span>
                <h3 class="news-card__title">${this.escapeHtml(news.title)}</h3>
                <p class="news-card__excerpt">${this.escapeHtml(news.excerpt)}</p>
                <a href="${newsPageLink}" class="news-card__link">
                    Artikel lesen
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </a>
            </div>
        `;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('de-DE', options);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ========================================
    // EVENT BINDING
    // ========================================
    
    bindEvents() {
        // Admin edit buttons
        document.querySelectorAll('.news-admin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.news);
                this.openEditor(index);
            });
        });
    }
    
    // ========================================
    // EDITOR MODAL
    // ========================================
    
    createEditorModal() {
        const modalHTML = `
            <div class="modal-overlay" id="newsEditorModal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal__header">
                        <h2 class="modal__title">News bearbeiten</h2>
                        <button class="modal__close" id="closeNewsEditor">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <!-- Image Upload -->
                        <div class="settings-form-group">
                            <label class="settings-label">Bild</label>
                            <div class="news-image-upload" id="newsImageUpload">
                                <div class="news-image-preview" id="newsImagePreview">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <span>Bild hochladen oder ziehen</span>
                                </div>
                                <input type="file" id="newsImageInput" accept="image/*">
                            </div>
                            <button class="btn btn--secondary btn--sm" id="removeNewsImage" style="margin-top: 8px; display: none;">
                                Bild entfernen
                            </button>
                        </div>
                        
                        <!-- Title -->
                        <div class="settings-form-group">
                            <label class="settings-label" for="newsTitleInput">Titel</label>
                            <input type="text" 
                                   id="newsTitleInput" 
                                   class="form-input" 
                                   placeholder="Artikel-Titel"
                                   maxlength="100">
                        </div>
                        
                        <!-- Excerpt -->
                        <div class="settings-form-group">
                            <label class="settings-label" for="newsExcerptInput">Teaser-Text</label>
                            <textarea id="newsExcerptInput" 
                                      class="form-input" 
                                      placeholder="Kurze Beschreibung des Artikels..."
                                      rows="4"
                                      maxlength="500"
                                      style="resize: vertical;"></textarea>
                            <p class="form-hint"><span id="excerptCharCount">0</span>/500 Zeichen</p>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelNewsEditor">Abbrechen</button>
                        <button class="btn btn--primary" id="saveNewsEditor">Veröffentlichen</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindEditorEvents();
    }
    
    bindEditorEvents() {
        const modal = document.getElementById('newsEditorModal');
        
        // Close buttons
        document.getElementById('closeNewsEditor')?.addEventListener('click', () => this.closeEditor());
        document.getElementById('cancelNewsEditor')?.addEventListener('click', () => this.closeEditor());
        
        // Click outside
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeEditor();
        });
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('active')) {
                this.closeEditor();
            }
        });
        
        // Image upload
        const imageInput = document.getElementById('newsImageInput');
        const imageUpload = document.getElementById('newsImageUpload');
        
        imageInput?.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // Drag & Drop
        imageUpload?.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUpload.classList.add('dragover');
        });
        
        imageUpload?.addEventListener('dragleave', () => {
            imageUpload.classList.remove('dragover');
        });
        
        imageUpload?.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUpload.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.processImage(file);
            }
        });
        
        // Remove image with confirmation
        document.getElementById('removeNewsImage')?.addEventListener('click', async () => {
            if (typeof showConfirm === 'function') {
                const confirmed = await showConfirm('Möchtest du das Bild wirklich entfernen?', 'Entfernen', 'Abbrechen');
                if (!confirmed) return;
            }
            this.tempImage = null;
            this.updateImagePreview(null);
        });
        
        // Character count
        document.getElementById('newsExcerptInput')?.addEventListener('input', (e) => {
            const count = document.getElementById('excerptCharCount');
            if (count) count.textContent = e.target.value.length;
        });
        
        // Save
        document.getElementById('saveNewsEditor')?.addEventListener('click', () => this.saveNews());
    }
    
    openEditor(index) {
        if (!this.isAdmin()) return;
        
        this.currentEditIndex = index;
        const modal = document.getElementById('newsEditorModal');
        const news = this.newsData[index - 1];
        
        // Fill with current news data
        if (news) {
            document.getElementById('newsTitleInput').value = news.title || '';
            document.getElementById('newsExcerptInput').value = news.excerpt || '';
            document.getElementById('excerptCharCount').textContent = (news.excerpt || '').length;
            
            this.tempImage = news.image;
            this.updateImagePreview(news.image);
        } else {
            document.getElementById('newsTitleInput').value = '';
            document.getElementById('newsExcerptInput').value = '';
            document.getElementById('excerptCharCount').textContent = '0';
            this.tempImage = null;
            this.updateImagePreview(null);
        }
        
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    closeEditor() {
        const modal = document.getElementById('newsEditorModal');
        modal?.classList.remove('active');
        document.body.style.overflow = '';
        this.currentEditIndex = null;
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.processImage(file);
        }
        e.target.value = '';
    }
    
    processImage(file) {
        if (file.size > 2 * 1024 * 1024) {
            alert('Das Bild darf maximal 2MB groß sein');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            this.resizeImage(event.target.result, 800, 400).then(resized => {
                this.tempImage = resized;
                this.updateImagePreview(resized);
            });
        };
        reader.readAsDataURL(file);
    }
    
    resizeImage(dataUrl, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = dataUrl;
        });
    }
    
    updateImagePreview(imageSrc) {
        const preview = document.getElementById('newsImagePreview');
        const removeBtn = document.getElementById('removeNewsImage');
        
        if (imageSrc) {
            preview.innerHTML = `<img src="${imageSrc}" alt="Preview">`;
            preview.classList.add('has-image');
            if (removeBtn) removeBtn.style.display = '';
        } else {
            preview.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>Bild hochladen oder ziehen</span>
            `;
            preview.classList.remove('has-image');
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }
    
    saveNews() {
        if (!this.currentEditIndex) return;
        
        const title = document.getElementById('newsTitleInput')?.value?.trim();
        const excerpt = document.getElementById('newsExcerptInput')?.value?.trim();
        
        if (!title) {
            alert('Bitte gib einen Titel ein');
            return;
        }
        
        const index = this.currentEditIndex;
        const newsData = {
            id: `news_${index}_${Date.now()}`,
            title: title,
            excerpt: excerpt || '',
            date: new Date().toISOString(),
            image: this.tempImage || null,
            link: `news${index}.html`,
            author: 'RIFT-Team'
        };
        
        // Save to localStorage
        localStorage.setItem(`rift_news_${index}`, JSON.stringify(newsData));
        
        // Update data and render
        this.newsData[index - 1] = newsData;
        this.renderNews(index, newsData);
        
        // Close editor
        this.closeEditor();
        
        console.log(`News ${index} published:`, newsData);
    }
}

// ========================================
// ANNOUNCEMENT MANAGER (with Markdown Editor)
// ========================================

class AnnouncementManager {
    constructor() {
        this.STORAGE_KEY = 'rift_announcement';
        this.AUTOSAVE_KEY = 'rift_announcement_draft';
        this.currentMarkdown = '';
        this.originalContent = '';
        this.hasUnsavedChanges = false;
        this.autoSaveInterval = null;
        this.init();
    }
    
    init() {
        this.loadAnnouncement();
        this.bindEvents();
        this.createEditorModal();
        
        window.addEventListener('adminStatusChanged', () => {
            this.updateAdminButton();
        });
    }
    
    isAdmin() {
        return window.RIFT?.admin?.isAdmin() || false;
    }
    
    updateAdminButton() {
        const btn = document.querySelector('.announcement-admin-btn');
        if (btn) {
            btn.style.display = this.isAdmin() ? '' : 'none';
        }
    }
    
    loadAnnouncement() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        const contentEl = document.getElementById('announcementContent');
        
        if (stored && contentEl) {
            this.currentMarkdown = stored;
            contentEl.innerHTML = `<div class="announcement__content">${this.renderMarkdown(stored)}</div>`;
        }
    }
    
    renderMarkdown(text) {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            
            let processed = text;
            
            // Step 1: Extract alignment blocks and process their content separately
            processed = processed.replace(/\{(full-left|left|center|right)\}\n?([\s\S]*?)\n?\{\/(full-left|left|center|right)\}/g, 
                (match, openTag, content, closeTag) => {
                    // Parse the inner content as markdown
                    const innerHtml = marked.parse(content.trim());
                    return `<div class="align-${openTag}">${innerHtml}</div>`;
                });
            
            // Step 2: Parse remaining content as markdown (for content outside blocks)
            // Check if there's content that's not already in a div
            if (!processed.startsWith('<div')) {
                processed = marked.parse(processed);
            }
            
            // Step 3: Parse color tags
            processed = processed.replace(/\{(red|orange|yellow|green|blue|purple|pink|white|gray)\}([\s\S]*?)\{\/(red|orange|yellow|green|blue|purple|pink|white|gray)\}/g, 
                '<span class="color-$1">$2</span>');
            
            // Step 4: Parse size tags
            processed = processed.replace(/\{(small|large|xlarge)\}([\s\S]*?)\{\/(small|large|xlarge)\}/g, 
                '<span class="size-$1">$2</span>');
            
            // Step 5: Replace username placeholder
            const user = JSON.parse(localStorage.getItem('rift_user') || '{}');
            const displayName = (user.name || 'Abenteurer').split('#')[0];
            processed = processed.replace(/\{username\}/gi, displayName);
            
            return processed;
        }
        return `<p>${text.replace(/\n/g, '<br>')}</p>`;
    }
    
    bindEvents() {
        document.querySelector('.announcement-admin-btn')?.addEventListener('click', () => {
            this.openEditor();
        });
    }
    
    createEditorModal() {
        const modalHTML = `
            <div class="modal-overlay" id="announcementEditorModal">
                <div class="modal md-editor-modal">
                    <div class="modal__header">
                        <h2 class="modal__title">Ankündigung bearbeiten</h2>
                        <span class="md-autosave-indicator" id="mdAutosaveIndicator"></span>
                        <button class="modal__close" id="closeAnnouncementEditor">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <!-- Markdown Toolbar -->
                        <div class="md-toolbar">
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="undo" title="Rückgängig (Ctrl+Z)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="redo" title="Wiederherstellen (Ctrl+Y)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="bold" title="Fett (Ctrl+B)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="italic" title="Kursiv (Ctrl+I)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="strikethrough" title="Durchgestrichen">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="h1" title="Überschrift 1">
                                    <span style="font-weight:700;font-size:14px;">H1</span>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="h2" title="Überschrift 2">
                                    <span style="font-weight:700;font-size:13px;">H2</span>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="h3" title="Überschrift 3">
                                    <span style="font-weight:700;font-size:12px;">H3</span>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="ul" title="Aufzählung">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="ol" title="Nummerierte Liste">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="quote" title="Zitat">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="link" title="Link (Ctrl+K)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="image" title="Bild">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="code" title="Code">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="hr" title="Trennlinie">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 11h16v2H4z"/></svg>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn" data-action="align-full-left" title="Ganz links (volle Breite)">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v18h2V3H3zm4 4v2h14V7H7zm0 4v2h14v-2H7zm0 4v2h14v-2H7z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="align-left" title="Linksbündig">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="align-center" title="Zentriert">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>
                                </button>
                                <button type="button" class="md-toolbar__btn" data-action="align-right" title="Rechtsbündig">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>
                                </button>
                            </div>
                            
                            <div class="md-toolbar__divider"></div>
                            
                            <div class="md-toolbar__group">
                                <div class="md-color-picker">
                                    <button type="button" class="md-toolbar__btn md-toolbar__btn--color" data-action="color" title="Textfarbe">
                                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                                        <span class="md-color-indicator" id="mdColorIndicator"></span>
                                    </button>
                                    <div class="md-color-dropdown" id="mdColorDropdown">
                                        <button type="button" class="md-color-swatch" data-color="red" style="background: #FF4655;" title="Rot"></button>
                                        <button type="button" class="md-color-swatch" data-color="orange" style="background: #FF9500;" title="Orange"></button>
                                        <button type="button" class="md-color-swatch" data-color="yellow" style="background: #FFCC00;" title="Gelb"></button>
                                        <button type="button" class="md-color-swatch" data-color="green" style="background: #34C759;" title="Grün"></button>
                                        <button type="button" class="md-color-swatch" data-color="blue" style="background: #007AFF;" title="Blau"></button>
                                        <button type="button" class="md-color-swatch" data-color="purple" style="background: #AF52DE;" title="Lila"></button>
                                        <button type="button" class="md-color-swatch" data-color="pink" style="background: #FF2D55;" title="Pink"></button>
                                        <button type="button" class="md-color-swatch" data-color="white" style="background: #FFFFFF; border: 1px solid #333;" title="Weiß"></button>
                                        <button type="button" class="md-color-swatch" data-color="gray" style="background: #8E8E93;" title="Grau"></button>
                                    </div>
                                </div>
                                
                                <div class="md-size-picker">
                                    <button type="button" class="md-toolbar__btn" data-action="size" title="Schriftgröße">
                                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"/></svg>
                                    </button>
                                    <div class="md-size-dropdown" id="mdSizeDropdown">
                                        <button type="button" class="md-size-option" data-size="small" title="Klein">
                                            <span style="font-size: 11px;">Klein</span>
                                        </button>
                                        <button type="button" class="md-size-option" data-size="normal" title="Normal">
                                            <span style="font-size: 14px;">Normal</span>
                                        </button>
                                        <button type="button" class="md-size-option" data-size="large" title="Groß">
                                            <span style="font-size: 17px;">Groß</span>
                                        </button>
                                        <button type="button" class="md-size-option" data-size="xlarge" title="Sehr groß">
                                            <span style="font-size: 20px;">XL</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="md-toolbar__spacer"></div>
                            
                            <div class="md-toolbar__group">
                                <button type="button" class="md-toolbar__btn md-toolbar__btn--toggle" data-action="preview" title="Vorschau">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Editor Container -->
                        <div class="md-editor-container">
                            <div class="md-editor-pane md-editor-pane--edit">
                                <textarea id="mdEditorTextarea" 
                                          class="md-editor-textarea" 
                                          placeholder="Schreibe hier...

**Fett** und *kursiv*
- Listen
> Zitate
[Links](https://...)"></textarea>
                            </div>
                            
                            <div class="md-editor-pane md-editor-pane--preview" style="display: none;">
                                <div class="md-preview" id="mdPreview"></div>
                            </div>
                        </div>
                        
                        <!-- Status Bar -->
                        <div class="md-statusbar">
                            <span class="md-statusbar__item"><span id="mdCharCount">0</span> Zeichen</span>
                            <span class="md-statusbar__item"><span id="mdWordCount">0</span> Wörter</span>
                            <span class="md-statusbar__hint">Markdown</span>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelAnnouncementEditor">Abbrechen</button>
                        <button class="btn btn--primary" id="saveAnnouncementEditor">Veröffentlichen</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindEditorEvents();
    }
    
    bindEditorEvents() {
        const modal = document.getElementById('announcementEditorModal');
        const textarea = document.getElementById('mdEditorTextarea');
        
        document.getElementById('closeAnnouncementEditor')?.addEventListener('click', () => this.tryCloseEditor());
        document.getElementById('cancelAnnouncementEditor')?.addEventListener('click', () => this.tryCloseEditor());
        document.getElementById('saveAnnouncementEditor')?.addEventListener('click', () => this.saveAnnouncement());
        
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.tryCloseEditor();
        });
        
        // Toolbar buttons
        document.querySelectorAll('#announcementEditorModal .md-toolbar__btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.handleToolbarAction(btn.dataset.action));
        });
        
        // Color swatches
        document.querySelectorAll('#announcementEditorModal .md-color-swatch[data-color]').forEach(swatch => {
            swatch.addEventListener('click', () => this.applyColor(swatch.dataset.color));
        });
        
        // Size options
        document.querySelectorAll('#announcementEditorModal .md-size-option[data-size]').forEach(option => {
            option.addEventListener('click', () => this.applySize(option.dataset.size));
        });
        
        // Close color picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.md-color-picker')) {
                document.getElementById('mdColorDropdown')?.classList.remove('active');
            }
            if (!e.target.closest('.md-size-picker')) {
                document.getElementById('mdSizeDropdown')?.classList.remove('active');
            }
        });
        
        // Textarea events - track changes
        textarea?.addEventListener('input', () => {
            this.updateCounts();
            this.updatePreview();
            this.hasUnsavedChanges = textarea.value !== this.originalContent;
            this.updateUnsavedIndicator();
        });
        
        // Keyboard shortcuts
        textarea?.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); this.handleToolbarAction('bold'); break;
                    case 'i': e.preventDefault(); this.handleToolbarAction('italic'); break;
                    case 'k': e.preventDefault(); this.handleToolbarAction('link'); break;
                    case 'z': e.preventDefault(); this.handleToolbarAction('undo'); break;
                    case 'y': e.preventDefault(); this.handleToolbarAction('redo'); break;
                    case 's': e.preventDefault(); this.saveAnnouncement(); break;
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertText('    ');
            }
        });
    }
    
    handleToolbarAction(action) {
        const textarea = document.getElementById('mdEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        
        let replacement = '';
        let offset = 0;
        
        switch (action) {
            case 'undo':
                document.execCommand('undo');
                this.updateCounts();
                this.updatePreview();
                return;
            case 'redo':
                document.execCommand('redo');
                this.updateCounts();
                this.updatePreview();
                return;
            case 'bold':
                replacement = `**${selected || 'text'}**`;
                offset = selected ? 0 : -2;
                break;
            case 'italic':
                replacement = `*${selected || 'text'}*`;
                offset = selected ? 0 : -1;
                break;
            case 'strikethrough':
                replacement = `~~${selected || 'text'}~~`;
                offset = selected ? 0 : -2;
                break;
            case 'h1':
                replacement = `# ${selected || 'Überschrift'}`;
                break;
            case 'h2':
                replacement = `## ${selected || 'Überschrift'}`;
                break;
            case 'h3':
                replacement = `### ${selected || 'Überschrift'}`;
                break;
            case 'ul':
                replacement = selected 
                    ? selected.split('\n').map(l => `- ${l}`).join('\n')
                    : '- Punkt';
                break;
            case 'ol':
                replacement = selected 
                    ? selected.split('\n').map((l, i) => `${i+1}. ${l}`).join('\n')
                    : '1. Punkt';
                break;
            case 'quote':
                replacement = selected 
                    ? selected.split('\n').map(l => `> ${l}`).join('\n')
                    : '> Zitat';
                break;
            case 'link':
                replacement = `[${selected || 'Link'}](https://)`;
                break;
            case 'image':
                replacement = `![${selected || 'Bild'}](https://)`;
                break;
            case 'code':
                replacement = selected.includes('\n') 
                    ? `\`\`\`\n${selected}\n\`\`\`` 
                    : `\`${selected || 'code'}\``;
                break;
            case 'hr':
                replacement = '\n---\n';
                break;
            case 'align-full-left':
                replacement = `{full-left}\n${selected || 'Text'}\n{/full-left}`;
                break;
            case 'align-left':
                replacement = `{left}\n${selected || 'Text'}\n{/left}`;
                break;
            case 'align-center':
                replacement = `{center}\n${selected || 'Text'}\n{/center}`;
                break;
            case 'align-right':
                replacement = `{right}\n${selected || 'Text'}\n{/right}`;
                break;
            case 'color':
                this.toggleColorPicker();
                return;
            case 'size':
                this.toggleSizePicker();
                return;
            case 'preview':
                this.togglePreview();
                return;
        }
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        const newPos = start + replacement.length + offset;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
        
        this.updateCounts();
        this.updatePreview();
    }
    
    insertText(text) {
        const textarea = document.getElementById('mdEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(textarea.selectionEnd);
        textarea.setSelectionRange(start + text.length, start + text.length);
        textarea.focus();
        this.updateCounts();
    }
    
    toggleColorPicker() {
        const dropdown = document.getElementById('mdColorDropdown');
        dropdown?.classList.toggle('active');
    }
    
    applyColor(color) {
        const textarea = document.getElementById('mdEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        
        const replacement = `{${color}}${selected || 'farbiger Text'}{/${color}}`;
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        const newPos = start + replacement.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
        
        // Update indicator
        const indicator = document.getElementById('mdColorIndicator');
        if (indicator) {
            const colors = {
                red: '#FF4655',
                orange: '#FF9500',
                yellow: '#FFCC00',
                green: '#34C759',
                blue: '#007AFF',
                purple: '#AF52DE',
                pink: '#FF2D55',
                white: '#FFFFFF',
                gray: '#8E8E93'
            };
            indicator.style.background = colors[color] || '#FF4655';
        }
        
        // Close dropdown
        document.getElementById('mdColorDropdown')?.classList.remove('active');
        
        this.updateCounts();
        this.updatePreview();
    }
    
    toggleSizePicker() {
        const dropdown = document.getElementById('mdSizeDropdown');
        dropdown?.classList.toggle('active');
        // Close color picker if open
        document.getElementById('mdColorDropdown')?.classList.remove('active');
    }
    
    applySize(size) {
        const textarea = document.getElementById('mdEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        
        let replacement;
        if (size === 'normal') {
            // Normal entfernt Size-Tags
            replacement = selected || 'Text';
        } else {
            replacement = `{${size}}${selected || 'Text'}{/${size}}`;
        }
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        const newPos = start + replacement.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
        
        // Close dropdown
        document.getElementById('mdSizeDropdown')?.classList.remove('active');
        
        this.updateCounts();
        this.updatePreview();
    }
    
    togglePreview() {
        const editPane = document.querySelector('.md-editor-pane--edit');
        const previewPane = document.querySelector('.md-editor-pane--preview');
        const btn = document.querySelector('[data-action="preview"]');
        
        if (previewPane.style.display === 'none') {
            this.updatePreview();
            editPane.style.display = 'none';
            previewPane.style.display = '';
            btn?.classList.add('active');
        } else {
            editPane.style.display = '';
            previewPane.style.display = 'none';
            btn?.classList.remove('active');
        }
    }
    
    updatePreview() {
        const textarea = document.getElementById('mdEditorTextarea');
        const preview = document.getElementById('mdPreview');
        if (textarea && preview) {
            preview.innerHTML = this.renderMarkdown(textarea.value);
        }
    }
    
    updateCounts() {
        const textarea = document.getElementById('mdEditorTextarea');
        if (textarea) {
            const text = textarea.value;
            document.getElementById('mdCharCount').textContent = text.length;
            document.getElementById('mdWordCount').textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
        }
    }
    
    openEditor() {
        if (!this.isAdmin()) return;
        
        const modal = document.getElementById('announcementEditorModal');
        const textarea = document.getElementById('mdEditorTextarea');
        
        // Reset to edit view
        document.querySelector('#announcementEditorModal .md-editor-pane--edit').style.display = '';
        document.querySelector('#announcementEditorModal .md-editor-pane--preview').style.display = 'none';
        document.querySelector('#announcementEditorModal [data-action="preview"]')?.classList.remove('active');
        
        // Check for draft
        const draft = localStorage.getItem(this.AUTOSAVE_KEY);
        if (draft && draft !== this.currentMarkdown) {
            if (confirm('Es gibt einen ungespeicherten Entwurf. Möchtest du ihn wiederherstellen?')) {
                textarea.value = draft;
            } else {
                textarea.value = this.currentMarkdown;
                localStorage.removeItem(this.AUTOSAVE_KEY);
            }
        } else {
            if (textarea) textarea.value = this.currentMarkdown;
        }
        
        this.originalContent = textarea?.value || '';
        this.hasUnsavedChanges = false;
        this.updateUnsavedIndicator();
        this.updateCounts();
        
        // Start auto-save
        this.startAutoSave();
        
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => textarea?.focus(), 100);
    }
    
    async tryCloseEditor() {
        if (this.hasUnsavedChanges) {
            const confirmed = typeof showConfirm === 'function' 
                ? await showConfirm('Du hast ungespeicherte Änderungen. Wirklich schließen?', 'Schließen', 'Weiter bearbeiten')
                : confirm('Du hast ungespeicherte Änderungen. Wirklich schließen?');
            if (!confirmed) return;
        }
        this.closeEditor();
    }
    
    closeEditor() {
        this.stopAutoSave();
        localStorage.removeItem(this.AUTOSAVE_KEY);
        this.hasUnsavedChanges = false;
        document.getElementById('announcementEditorModal')?.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    startAutoSave() {
        this.stopAutoSave();
        this.autoSaveInterval = setInterval(() => this.autoSave(), 30000); // 30 seconds
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    autoSave() {
        const textarea = document.getElementById('mdEditorTextarea');
        if (textarea && this.hasUnsavedChanges) {
            localStorage.setItem(this.AUTOSAVE_KEY, textarea.value);
            this.showAutoSaveIndicator();
        }
    }
    
    showAutoSaveIndicator() {
        const indicator = document.getElementById('mdAutosaveIndicator');
        if (indicator) {
            indicator.textContent = 'Entwurf gespeichert';
            indicator.classList.add('visible');
            setTimeout(() => indicator.classList.remove('visible'), 2000);
        }
    }
    
    updateUnsavedIndicator() {
        const indicator = document.getElementById('mdAutosaveIndicator');
        if (indicator && this.hasUnsavedChanges) {
            indicator.textContent = '● Ungespeichert';
            indicator.classList.add('unsaved');
        } else if (indicator) {
            indicator.classList.remove('unsaved');
            indicator.textContent = '';
        }
    }
    
    saveAnnouncement() {
        const text = document.getElementById('mdEditorTextarea')?.value?.trim();
        
        if (!text) {
            if (typeof showToast === 'function') {
                showToast('Bitte gib einen Text ein', 'warning');
            } else {
                alert('Bitte gib einen Text ein');
            }
            return;
        }
        
        localStorage.setItem(this.STORAGE_KEY, text);
        localStorage.removeItem(this.AUTOSAVE_KEY);
        this.currentMarkdown = text;
        this.hasUnsavedChanges = false;
        
        const contentEl = document.getElementById('announcementContent');
        if (contentEl) {
            contentEl.innerHTML = `<div class="announcement__content">${this.renderMarkdown(text)}</div>`;
        }
        
        if (typeof showToast === 'function') {
            showToast('Ankündigung veröffentlicht', 'success');
        }
        
        this.closeEditor();
    }
}

// ========================================
// INITIALIZATION
// ========================================

let newsManager;
let announcementManager;

document.addEventListener('DOMContentLoaded', () => {
    // Only init on hub page
    if (document.getElementById('newsHero1')) {
        newsManager = new NewsManager();
    }
    
    // Init announcement manager
    if (document.getElementById('announcementSection')) {
        announcementManager = new AnnouncementManager();
    }
});

// Export
if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.news = {
        manager: () => newsManager,
        refresh: () => newsManager?.loadAllNews()
    };
    window.RIFT.announcement = {
        manager: () => announcementManager
    };
}
