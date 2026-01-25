// ========================================
// ARTICLE MANAGER
// Full article page with Markdown editor
// ========================================

class ArticleManager {
    constructor(newsSlot) {
        this.newsSlot = newsSlot; // 'news_1' or 'news_2'
        this.STORAGE_KEY = `rift_article_${newsSlot}`;
        this.NEWS_KEY = `rift_${newsSlot}`;
        this.AUTOSAVE_KEY = `rift_article_draft_${newsSlot}`;
        this.currentContent = '';
        this.originalContent = '';
        this.hasUnsavedChanges = false;
        this.autoSaveInterval = null;
        
        this.init();
    }
    
    init() {
        this.loadArticle();
        this.bindEvents();
        this.createEditorModal();
        
        window.addEventListener('adminStatusChanged', () => {
            this.updateAdminButton();
        });
        
        // Initial admin check
        setTimeout(() => this.updateAdminButton(), 100);
        
        // Auto-open editor if ?edit=true in URL (for admin only)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('edit') === 'true') {
            setTimeout(() => {
                if (this.isAdmin()) {
                    this.openEditor();
                    // Remove ?edit=true from URL without reload
                    window.history.replaceState({}, '', window.location.pathname);
                }
            }, 200);
        }
    }
    
    isAdmin() {
        return window.RIFT?.admin?.isAdmin() || false;
    }
    
    updateAdminButton() {
        const btn = document.getElementById('editArticleBtn');
        if (btn) {
            btn.style.display = this.isAdmin() ? '' : 'none';
        }
    }
    
    async loadArticle() {
        // Load article content
        const articleData = localStorage.getItem(this.STORAGE_KEY);
        
        // Load meta data (new format) - from Firestore or localStorage
        const metaData = await this.loadMetaData();
        
        // Parse article content
        let article = null;
        try {
            article = articleData ? JSON.parse(articleData) : null;
        } catch (e) {}
        
        // Update page elements
        const titleEl = document.getElementById('articleTitle');
        const dateEl = document.getElementById('articleDate');
        const authorEl = document.getElementById('articleAuthor');
        const heroEl = document.getElementById('articleHero');
        const contentEl = document.getElementById('articleContent');
        
        // Use meta data if available
        if (metaData && metaData.title) {
            if (titleEl) titleEl.textContent = metaData.title;
            if (dateEl) dateEl.textContent = metaData.date || this.formatDate(new Date());
            if (authorEl) authorEl.textContent = 'von RIFT-Team';
            
            // Update page title
            document.title = `${metaData.title} – RIFT`;
            
            // Hero image
            if (heroEl && metaData.image) {
                heroEl.innerHTML = `<img src="${metaData.image}" alt="${metaData.title}">`;
                heroEl.classList.add('has-image');
            }
        } else {
            // Fallback to default
            if (titleEl) titleEl.textContent = 'RIFT ist released, yay!';
            if (dateEl) dateEl.textContent = '11. Januar 2026';
            if (authorEl) authorEl.textContent = 'von RIFT-Team';
            document.title = 'News – RIFT';
        }
        
        // Article content
        if (article && article.content) {
            this.currentContent = article.content;
            if (contentEl) {
                contentEl.innerHTML = this.renderMarkdown(article.content);
            }
        } else {
            if (contentEl) {
                contentEl.innerHTML = '<p class="article__empty">Dieser Artikel hat noch keinen Inhalt. Als Admin kannst du ihn bearbeiten.</p>';
            }
        }
    }
    
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    renderMarkdown(text) {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            
            let processed = text;
            
            // Alignment blocks
            processed = processed.replace(/\{(full-left|left|center|right)\}\n?([\s\S]*?)\n?\{\/(full-left|left|center|right)\}/g, 
                (match, openTag, content, closeTag) => {
                    const innerHtml = marked.parse(content.trim());
                    return `<div class="align-${openTag}">${innerHtml}</div>`;
                });
            
            // Parse remaining content
            if (!processed.startsWith('<div')) {
                processed = marked.parse(processed);
            }
            
            // Color tags
            processed = processed.replace(/\{(red|orange|yellow|green|blue|purple|pink|white|gray)\}([\s\S]*?)\{\/(red|orange|yellow|green|blue|purple|pink|white|gray)\}/g, 
                '<span class="color-$1">$2</span>');
            
            // Size tags
            processed = processed.replace(/\{(small|large|xlarge)\}([\s\S]*?)\{\/(small|large|xlarge)\}/g, 
                '<span class="size-$1">$2</span>');
            
            // Replace username placeholder
            const user = JSON.parse(localStorage.getItem('rift_user') || '{}');
            const displayName = (user.name || 'Abenteurer').split('#')[0];
            processed = processed.replace(/\{username\}/gi, displayName);
            
            return processed;
        }
        return `<p>${text.replace(/\n/g, '<br>')}</p>`;
    }
    
    bindEvents() {
        document.getElementById('editArticleBtn')?.addEventListener('click', () => {
            this.openEditor();
        });
    }
    
    createEditorModal() {
        const modalHTML = `
            <div class="modal-overlay" id="articleEditorModal">
                <div class="modal md-editor-modal">
                    <div class="modal__header">
                        <h2 class="modal__title">Artikel bearbeiten</h2>
                        <span class="md-autosave-indicator" id="articleAutosaveIndicator"></span>
                        <button class="modal__close" id="closeArticleEditor">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <!-- Meta Fields -->
                        <div class="md-meta-fields">
                            <div class="md-meta-field">
                                <label class="md-meta-field__label">Titel</label>
                                <input type="text" class="md-meta-field__input" id="articleMetaTitle" placeholder="Artikel-Titel...">
                            </div>
                            <div class="md-meta-field">
                                <label class="md-meta-field__label">Kurzbeschreibung (für Hub-Karte)</label>
                                <input type="text" class="md-meta-field__input" id="articleMetaDesc" placeholder="Kurze Beschreibung..." maxlength="150">
                            </div>
                            <div class="md-meta-field">
                                <label class="md-meta-field__label">Bild-URL</label>
                                <div class="md-meta-field__row">
                                    <input type="text" class="md-meta-field__input" id="articleMetaImage" placeholder="assets/img/news/...">
                                    <button type="button" class="md-meta-field__btn" id="articleMetaImagePreview" title="Vorschau">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="md-meta-divider"></div>
                        
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
                                        <span class="md-color-indicator" id="articleColorIndicator"></span>
                                    </button>
                                    <div class="md-color-dropdown" id="articleColorDropdown">
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
                                    <div class="md-size-dropdown" id="articleSizeDropdown">
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
                        <div class="md-editor-container md-editor-container--large">
                            <div class="md-editor-pane md-editor-pane--edit">
                                <textarea id="articleEditorTextarea" 
                                          class="md-editor-textarea" 
                                          placeholder="Schreibe hier deinen Artikel...

**Fett** und *kursiv*
## Überschriften
- Listen
> Zitate
[Links](https://...)
![Bilder](https://...)"></textarea>
                            </div>
                            
                            <div class="md-editor-pane md-editor-pane--preview" style="display: none;">
                                <div class="md-preview" id="articlePreview"></div>
                            </div>
                        </div>
                        
                        <!-- Status Bar -->
                        <div class="md-statusbar">
                            <span class="md-statusbar__item"><span id="articleCharCount">0</span> Zeichen</span>
                            <span class="md-statusbar__item"><span id="articleWordCount">0</span> Wörter</span>
                            <span class="md-statusbar__hint">Markdown</span>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelArticleEditor">Abbrechen</button>
                        <button class="btn btn--primary" id="saveArticleEditor">Speichern</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindEditorEvents();
    }
    
    bindEditorEvents() {
        const modal = document.getElementById('articleEditorModal');
        const textarea = document.getElementById('articleEditorTextarea');
        
        document.getElementById('closeArticleEditor')?.addEventListener('click', () => this.tryCloseEditor());
        document.getElementById('cancelArticleEditor')?.addEventListener('click', () => this.tryCloseEditor());
        document.getElementById('saveArticleEditor')?.addEventListener('click', () => this.saveArticle());
        
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.tryCloseEditor();
        });
        
        // Toolbar buttons
        modal?.querySelectorAll('.md-toolbar__btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.handleToolbarAction(btn.dataset.action));
        });
        
        // Color swatches
        modal?.querySelectorAll('.md-color-swatch[data-color]').forEach(swatch => {
            swatch.addEventListener('click', () => this.applyColor(swatch.dataset.color));
        });
        
        // Size options
        modal?.querySelectorAll('.md-size-option[data-size]').forEach(option => {
            option.addEventListener('click', () => this.applySize(option.dataset.size));
        });
        
        // Close color picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.md-color-picker')) {
                document.getElementById('articleColorDropdown')?.classList.remove('active');
            }
            if (!e.target.closest('.md-size-picker')) {
                document.getElementById('articleSizeDropdown')?.classList.remove('active');
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
                    case 's': e.preventDefault(); this.saveArticle(); break;
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertText('    ');
            }
        });
    }
    
    handleToolbarAction(action) {
        const textarea = document.getElementById('articleEditorTextarea');
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
        const textarea = document.getElementById('articleEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(textarea.selectionEnd);
        textarea.setSelectionRange(start + text.length, start + text.length);
        textarea.focus();
        this.updateCounts();
    }
    
    toggleColorPicker() {
        document.getElementById('articleColorDropdown')?.classList.toggle('active');
    }
    
    applyColor(color) {
        const textarea = document.getElementById('articleEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        
        const replacement = `{${color}}${selected || 'farbiger Text'}{/${color}}`;
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
        textarea.focus();
        
        document.getElementById('articleColorDropdown')?.classList.remove('active');
        this.updateCounts();
        this.updatePreview();
    }
    
    toggleSizePicker() {
        document.getElementById('articleSizeDropdown')?.classList.toggle('active');
        document.getElementById('articleColorDropdown')?.classList.remove('active');
    }
    
    applySize(size) {
        const textarea = document.getElementById('articleEditorTextarea');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        
        let replacement;
        if (size === 'normal') {
            replacement = selected || 'Text';
        } else {
            replacement = `{${size}}${selected || 'Text'}{/${size}}`;
        }
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
        textarea.focus();
        
        document.getElementById('articleSizeDropdown')?.classList.remove('active');
        this.updateCounts();
        this.updatePreview();
    }
    
    togglePreview() {
        const editPane = document.querySelector('#articleEditorModal .md-editor-pane--edit');
        const previewPane = document.querySelector('#articleEditorModal .md-editor-pane--preview');
        const btn = document.querySelector('#articleEditorModal [data-action="preview"]');
        
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
        const textarea = document.getElementById('articleEditorTextarea');
        const preview = document.getElementById('articlePreview');
        if (textarea && preview) {
            preview.innerHTML = this.renderMarkdown(textarea.value);
        }
    }
    
    updateCounts() {
        const textarea = document.getElementById('articleEditorTextarea');
        if (textarea) {
            const text = textarea.value;
            document.getElementById('articleCharCount').textContent = text.length;
            document.getElementById('articleWordCount').textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
        }
    }
    
    openEditor() {
        if (!this.isAdmin()) return;
        
        const modal = document.getElementById('articleEditorModal');
        const textarea = document.getElementById('articleEditorTextarea');
        
        // Reset to edit view
        document.querySelector('#articleEditorModal .md-editor-pane--edit').style.display = '';
        document.querySelector('#articleEditorModal .md-editor-pane--preview').style.display = 'none';
        document.querySelector('#articleEditorModal [data-action="preview"]')?.classList.remove('active');
        
        // Load meta fields
        const metaData = this.loadMetaData();
        const titleInput = document.getElementById('articleMetaTitle');
        const descInput = document.getElementById('articleMetaDesc');
        const imageInput = document.getElementById('articleMetaImage');
        
        if (titleInput) titleInput.value = metaData.title || '';
        if (descInput) descInput.value = metaData.description || '';
        if (imageInput) imageInput.value = metaData.image || '';
        
        // Check for draft
        const draft = localStorage.getItem(this.AUTOSAVE_KEY);
        if (draft && draft !== this.currentContent) {
            if (confirm('Es gibt einen ungespeicherten Entwurf. Möchtest du ihn wiederherstellen?')) {
                textarea.value = draft;
            } else {
                textarea.value = this.currentContent;
                localStorage.removeItem(this.AUTOSAVE_KEY);
            }
        } else {
            if (textarea) textarea.value = this.currentContent;
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
    
    async loadMetaData() {
        // Try Firestore first (global news)
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                const doc = await db.collection('news').doc(this.newsSlot).get();
                if (doc.exists) {
                    console.log('[Article] Loaded meta from Firestore:', this.newsSlot);
                    return doc.data();
                }
            }
        } catch (e) {
            console.warn('[Article] Firestore load failed:', e);
        }
        
        // Fallback to localStorage
        const key = `rift_news_meta_${this.newsSlot}`;
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch {
            return {};
        }
    }
    
    async saveMetaData(data) {
        const metaData = {
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        // Try Firestore first (only works for admin)
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const db = firebase.firestore();
                await db.collection('news').doc(this.newsSlot).set(metaData);
                console.log('[Article] Saved meta to Firestore:', this.newsSlot);
            }
        } catch (e) {
            console.warn('[Article] Firestore save failed (might not be admin):', e);
        }
        
        // Also save to localStorage as backup
        const key = `rift_news_meta_${this.newsSlot}`;
        localStorage.setItem(key, JSON.stringify(metaData));
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
        document.getElementById('articleEditorModal')?.classList.remove('active');
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
        const textarea = document.getElementById('articleEditorTextarea');
        if (textarea && this.hasUnsavedChanges) {
            localStorage.setItem(this.AUTOSAVE_KEY, textarea.value);
            this.showAutoSaveIndicator();
        }
    }
    
    showAutoSaveIndicator() {
        const indicator = document.getElementById('articleAutosaveIndicator');
        if (indicator) {
            indicator.textContent = 'Entwurf gespeichert';
            indicator.classList.add('visible');
            setTimeout(() => indicator.classList.remove('visible'), 2000);
        }
    }
    
    updateUnsavedIndicator() {
        const indicator = document.getElementById('articleAutosaveIndicator');
        if (indicator && this.hasUnsavedChanges) {
            indicator.textContent = '● Ungespeichert';
            indicator.classList.add('unsaved');
        } else if (indicator) {
            indicator.classList.remove('unsaved');
            indicator.textContent = '';
        }
    }
    
    saveArticle() {
        const textarea = document.getElementById('articleEditorTextarea');
        const content = textarea?.value || '';
        
        // Save meta data
        const titleInput = document.getElementById('articleMetaTitle');
        const descInput = document.getElementById('articleMetaDesc');
        const imageInput = document.getElementById('articleMetaImage');
        
        const metaData = {
            title: titleInput?.value || '',
            description: descInput?.value || '',
            image: imageInput?.value || '',
            date: new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
        };
        this.saveMetaData(metaData);
        
        // Save article content
        const articleData = {
            content: content,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(articleData));
        localStorage.removeItem(this.AUTOSAVE_KEY);
        this.currentContent = content;
        this.hasUnsavedChanges = false;
        
        // Update displayed content
        const contentEl = document.getElementById('articleContent');
        if (contentEl) {
            if (content.trim()) {
                contentEl.innerHTML = this.renderMarkdown(content);
            } else {
                contentEl.innerHTML = '<p class="article__empty">Dieser Artikel hat noch keinen Inhalt.</p>';
            }
        }
        
        // Update article title if present
        const titleEl = document.querySelector('.article__title');
        if (titleEl && metaData.title) {
            titleEl.textContent = metaData.title;
        }
        
        if (typeof showToast === 'function') {
            showToast('Artikel gespeichert', 'success');
        }
        
        this.closeEditor();
    }
}

// Export
if (typeof window !== 'undefined') {
    window.ArticleManager = ArticleManager;
}
