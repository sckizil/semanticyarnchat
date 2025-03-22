class DocumentManager {
    constructor() {
        this.initializeDocuments();
    }

    initializeDocuments() {
        this.searchInput = document.getElementById('searchInput');
        this.documentList = document.getElementById('documentList');
        this.bindEvents();
    }

    bindEvents() {
        // Search functionality
        this.searchInput.addEventListener('input', () => this.handleSearch());

        // Document selection
        this.documentList.addEventListener('change', (e) => {
            if (e.target.classList.contains('doc-checkbox')) {
                this.handleDocumentSelection(e);
            }
        });

        // Document removal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-doc')) {
                e.preventDefault();
                const citekey = e.target.dataset.citekey;
                this.removeDocument(citekey);
            }
        });
    }

    handleSearch() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const documents = this.documentList.getElementsByClassName('document-item');
        
        Array.from(documents).forEach(doc => {
            const title = doc.querySelector('.doc-title').textContent.toLowerCase();
            const authors = doc.querySelector('.doc-meta').textContent.toLowerCase();
            doc.style.display = (title.includes(searchTerm) || authors.includes(searchTerm)) ? '' : 'none';
        });
    }

    handleDocumentSelection(e) {
        console.log('Document checkbox changed - updating selected docs list');
        const count = this.updateSelectedDocsList();
        
        const selectedCheckboxes = document.querySelectorAll('.doc-checkbox:checked');
        console.log(`Document selection changed: ${count} documents now selected`);
        console.log('Selected document IDs:', Array.from(selectedCheckboxes).map(cb => cb.id));
        
        // Handle glossary mode updates
        if (count > 1 && window.currentValue > 0) {
            console.log('Multiple documents selected while glossary was active - forcing reset');
            if (window.glossaryManager) {
                window.glossaryManager.updateSlider(0);
            }
        }
        
        // Update glossary visibility
        if (window.handleGlossaryModeVisibility) {
            window.handleGlossaryModeVisibility(count);
        }

        // Explicitly update visualization with delay
        console.log('Triggering visualization update after document selection');
        setTimeout(() => {
            if (window.visualizationManager) {
                window.visualizationManager.updateVisualization();
            }
        }, 100);
    }

    updateSelectedDocsList() {
        console.log('Updating selected docs list');
        
        const checkedBoxes = document.querySelectorAll('.doc-checkbox:checked');
        console.log(`Found ${checkedBoxes.length} checked document checkboxes`);
        
        const selectedCitekeys = Array.from(checkedBoxes)
            .map(checkbox => {
                const label = checkbox.nextElementSibling;
                return {
                    citekey: checkbox.id.replace('doc-', ''),
                    title: label.querySelector('.doc-title').textContent,
                    authors: label.querySelector('.doc-meta').textContent
                };
            });

        const selectedDocsContainer = document.getElementById('selectedDocs');
        const sectionHeader = document.querySelector('.section-header');
        
        sectionHeader.innerHTML = `Selected Documents <span class="doc-count">(${selectedCitekeys.length})</span>`;
        
        selectedDocsContainer.innerHTML = selectedCitekeys.map(doc => `
            <div class="selected-doc">
                <button class="remove-doc" data-citekey="${doc.citekey}">×</button>
                <div class="doc-title">${doc.title}</div>
                <div class="doc-meta">${doc.authors}</div>
            </div>
        `).join('');
        
        return selectedCitekeys.length;
    }

    removeDocument(citekey) {
        console.log(`Removing document with citekey: ${citekey}`);
        const checkbox = document.getElementById(`doc-${citekey}`);
        if (checkbox) {
            checkbox.checked = false;
            const count = this.updateSelectedDocsList();
            console.log(`After removal: ${count} documents selected`);
            
            if (typeof window.handleGlossaryModeVisibility === 'function') {
                window.handleGlossaryModeVisibility(count);
            }

            if (typeof window.updateVisualization === 'function') {
                window.updateVisualization();
            }
        }
    }

    getSelectedCitekeys() {
        return Array.from(document.querySelectorAll('.doc-checkbox:checked'))
            .map(checkbox => checkbox.id.replace('doc-', ''));
    }
}

// Export for use in other files
window.DocumentManager = DocumentManager;
