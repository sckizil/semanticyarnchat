/**
 * models.js - Dedicated file for model fetching functionality
 */

class ModelManager {
    constructor() {
        this.modelSelect = document.getElementById('modelSelect');
        this.defaultModel = 'meta-llama-3.1-8b-instruct';
        this.initialized = false;
        this.initialize();
    }

    initialize() {
        if (window.modelsFetchedDirectly) {
            console.log('Models already fetched by direct script');
            this.initialized = true;
            return;
        }

        this.fetchModelsWithRetry();
    }

    async fetchModelsWithRetry(isInitialLoad = true, attempt = 1) {
        const maxRetries = 3;
        
        try {
            console.log(`Fetching models (attempt ${attempt}/${maxRetries})`);
            await this.fetchModels(isInitialLoad);
            this.initialized = true;
        } catch (error) {
            console.error(`Error fetching models (attempt ${attempt}):`, error);
            
            if (attempt < maxRetries) {
                const delay = 2000 * attempt;
                console.log(`Retrying in ${delay}ms...`);
                setTimeout(() => {
                    this.fetchModelsWithRetry(isInitialLoad, attempt + 1);
                }, delay);
            } else {
                console.log('Using default model after max retries');
                this.setDefaultModel();
            }
        }
    }

    async fetchModels(isInitialLoad) {
        if (!this.modelSelect) {
            throw new Error('Model select element not found');
        }

        // Show loading state
        this.setLoadingState(true);

        const response = await fetch('http://localhost:5001/api/models');
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle API response
        if (data.error) {
            console.warn('Warning fetching models:', data.error);
            throw new Error(data.error);
        }

        this.updateModelSelect(data.models);
    }

    setLoadingState(loading) {
        if (!this.modelSelect) return;

        if (loading) {
            this.modelSelect.innerHTML = '<option value="loading">Loading models...</option>';
            this.modelSelect.disabled = true;
            this.modelSelect.classList.add('loading');
        } else {
            this.modelSelect.disabled = false;
            this.modelSelect.classList.remove('loading');
        }
    }

    updateModelSelect(models) {
        if (!Array.isArray(models) || models.length === 0) {
            console.warn('No valid models array in response');
            this.setDefaultModel();
            return;
        }

        // Store current selection
        const currentSelection = this.modelSelect.value;
        
        // Clear existing options
        this.modelSelect.innerHTML = '';
        
        // Add new options
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            this.modelSelect.appendChild(option);
        });

        // Add default model if not included
        if (!models.includes(this.defaultModel)) {
            const defaultOption = document.createElement('option');
            defaultOption.value = this.defaultModel;
            defaultOption.textContent = this.defaultModel;
            this.modelSelect.insertBefore(defaultOption, this.modelSelect.firstChild);
        }

        // Restore previous selection if valid
        if (models.includes(currentSelection)) {
            this.modelSelect.value = currentSelection;
        }

        // Visual feedback
        this.modelSelect.classList.add('models-loaded');
        setTimeout(() => {
            this.modelSelect.classList.remove('models-loaded');
        }, 1000);

        this.setLoadingState(false);
    }

    setDefaultModel() {
        if (!this.modelSelect) return;
        
        this.modelSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = this.defaultModel;
        option.textContent = this.defaultModel;
        this.modelSelect.appendChild(option);
        this.setLoadingState(false);
    }

    getCurrentModel() {
        return this.modelSelect ? this.modelSelect.value : this.defaultModel;
    }
}

// Export for use in other files
window.ModelManager = ModelManager;