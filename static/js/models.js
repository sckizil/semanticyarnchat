/**
 * models.js - Dedicated file for model fetching functionality
 */

class ModelManager {
    constructor() {
        this.modelSelect = document.getElementById('modelSelect');
        this.defaultModel = 'meta-llama-3.1-8b-instruct';
        this.initialized = false;
        
        if (this.modelSelect) {
            this.initialize();
        } else {
            console.error('ModelManager: Could not find modelSelect element');
        }
    }

    initialize() {
        this.fetchModelsWithRetry();
    }

    async fetchModelsWithRetry(attempt = 1) {
        const maxRetries = 3;
        const baseDelay = 1000;
        
        try {
            console.log(`ModelManager: Fetching models (attempt ${attempt}/${maxRetries})`);
            await this.fetchModels();
            this.initialized = true;
        } catch (error) {
            console.error(`ModelManager: Error fetching models (attempt ${attempt}):`, error);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * attempt;
                console.log(`ModelManager: Retrying in ${delay}ms...`);
                setTimeout(() => {
                    this.fetchModelsWithRetry(attempt + 1);
                }, delay);
            } else {
                console.warn('ModelManager: Using default model after max retries');
                this.setDefaultModel();
            }
        }
    }

    async fetchModels() {
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
            this.modelSelect.classList.add('models-loaded');
            setTimeout(() => {
                this.modelSelect.classList.remove('models-loaded');
            }, 1000);
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

// Initialize immediately when the script loads
window.ModelManager = ModelManager;