class GlossaryManager {
    constructor() {
        this.sliderValue = 0;
        this.validateDependencies();
        this.initializeSlider();
    }

    validateDependencies() {
        // Check for required dependencies
        if (!window.chatManager) {
            console.error('ChatManager not found - glossary functionality will be disabled');
            return false;
        }
        return true;
    }

    initializeSlider() {
        const sliderTrack = document.querySelector('.slider-track');
        if (!sliderTrack) {
            console.error('Slider track element not found');
            return;
        }

        console.log('Initializing glossary slider');

        let isDragging = false;

        sliderTrack.addEventListener('mousedown', (e) => {
            isDragging = true;
            const value = this.getValueFromPosition(e.clientX, sliderTrack);
            this.updateSlider(value);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const value = this.getValueFromPosition(e.clientX, sliderTrack);
            this.updateSlider(value);
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Initialize slider position
        this.updateSlider(0);
    }

    getValueFromPosition(position, sliderTrack) {
        const rect = sliderTrack.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (position - rect.left) / rect.width));
        return Math.round(percentage * 8);
    }

    updateSlider(value) {
        const selectedCount = document.querySelectorAll('.doc-checkbox:checked').length;
        if (selectedCount > 1 && value > 0) {
            console.log('Blocking glossary slider change - multiple documents selected');
            value = 0;
        }

        // Update slider UI
        const sliderThumb = document.querySelector('.slider-thumb');
        const sliderFill = document.querySelector('.slider-fill');
        const sliderValue = document.querySelector('.slider-value');
        const percentage = (value / 8) * 100;
        
        sliderThumb.style.left = `${percentage}%`;
        sliderFill.style.width = `${percentage}%`;
        sliderValue.textContent = value === 0 ? 'off' : value.toString();

        // Update global state and UI
        this.sliderValue = value;
        window.currentValue = value; // Add this line to maintain backward compatibility
        this.updateGlossaryUI(value);
    }

    updateGlossaryUI(value) {
        if (!this.validateDependencies()) {
            console.error('Cannot update UI - dependencies not met');
            return;
        }

        const questionInput = document.getElementById('questionInput');
        const chatForm = document.getElementById('chatForm');
        
        if (!questionInput || !chatForm) {
            console.error('Required UI elements not found');
            return;
        }

        if (value > 0) {
            questionInput.style.display = "none";
            this.ensureGlossaryButton();
            const submitButton = chatForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.style.display = "none";
        } else {
            questionInput.style.display = "inline-block";
            questionInput.placeholder = "> ask a question...";
            this.hideGlossaryButton();
            const submitButton = chatForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.style.display = "inline-block";
        }
    }

    ensureGlossaryButton() {
        const chatForm = document.getElementById('chatForm');
        let glossaryBtn = document.getElementById('glossaryCreateBtn');
        
        if (!glossaryBtn) {
            glossaryBtn = document.createElement('button');
            glossaryBtn.id = 'glossaryCreateBtn';
            glossaryBtn.textContent = 'Create';
            glossaryBtn.className = 'glossary-create-btn';
            glossaryBtn.type = 'button';
            
            chatForm.insertBefore(glossaryBtn, chatForm.querySelector('input[type="text"]'));
            
            // Store reference to chatManager
            const chatManager = window.chatManager;
            
            glossaryBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                if (glossaryBtn.disabled) return;
                
                try {
                    console.log('Glossary button clicked, current value:', this.getCurrentValue());
                    
                    glossaryBtn.disabled = true;
                    glossaryBtn.textContent = 'Generating...';
                    glossaryBtn.style.opacity = '0.5';
                    
                    if (!chatManager) {
                        throw new Error('Chat manager not available');
                    }
                    
                    await chatManager.createGlossary();
                    
                } catch (error) {
                    console.error('Error in glossary button handler:', error);
                    // Show error to user
                    if (chatManager) {
                        chatManager.appendSystemMessage(`Error: ${error.message}`);
                    }
                } finally {
                    glossaryBtn.disabled = false;
                    glossaryBtn.textContent = 'Create';
                    glossaryBtn.style.opacity = '1';
                }
            });
        }
        
        glossaryBtn.style.display = "inline-block";
        return glossaryBtn;
    }

    hideGlossaryButton() {
        const glossaryBtn = document.getElementById('glossaryCreateBtn');
        if (glossaryBtn) {
            glossaryBtn.style.display = "none";
        }
    }

    getCurrentValue() {
        console.log('Getting current glossary value:', this.sliderValue);
        return this.sliderValue;
    }
}

// Export for use in other files
window.GlossaryManager = GlossaryManager;
