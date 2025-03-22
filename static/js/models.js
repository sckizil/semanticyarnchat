/**
 * models.js - Dedicated file for model fetching functionality
 */

class ModelManager {
    constructor() {
        this.modelSelect = document.getElementById('modelSelect');
        this.initialized = false;
        
        if (this.modelSelect) {
            this.initialize();
        } else {
            console.error('ModelManager: Could not find modelSelect element');
        }
    }

    initialize() {
        this.fetchModels();
    }

    async fetchModels() {
        if (!this.modelSelect) return;

        try {
            this.setLoadingState(true);
            const response = await fetch('/api/models');
            const data = await response.json();
            
            if (data.success && Array.isArray(data.models)) {
                this.updateModelSelect(data.models, data.default);
                this.initialized = true;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('ModelManager: Error fetching models:', error);
            this.setLoadingState(false);
        }
    }

    setLoadingState(loading) {
        if (!this.modelSelect) return;
        this.modelSelect.disabled = loading;
        if (loading) {
            this.modelSelect.innerHTML = '<option value="loading">Loading models...</option>';
        }
    }

    updateModelSelect(models, defaultModel) {
        if (!this.modelSelect) return;
        
        const currentSelection = this.modelSelect.value;
        this.modelSelect.innerHTML = '';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            option.selected = model === currentSelection || (!currentSelection && model === defaultModel);
            this.modelSelect.appendChild(option);
        });
        
        this.setLoadingState(false);
    }

    getCurrentModel() {
        return this.modelSelect?.value;
    }
}

window.ModelManager = ModelManager;