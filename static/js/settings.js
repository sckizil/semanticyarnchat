// Default settings
const DEFAULT_SETTINGS = {
    scaleMin: '0.3',
    scaleMax: '10',
    curveMin: '-0.001',
    curveMax: '0.001',
    speedMin: '-0.02',
    speedMax: '0.02',
    sizeMin: '0.05',
    sizeMax: '0.5',
    undulationsMin: '2',
    undulationsMax: '10',
    amplitudeMin: '0.01',
    amplitudeMax: '0.05',
    phaseMin: '0',
    phaseMax: '6.28',
    scatterFreqMin: '0.1',
    scatterFreqMax: '1.0',
    scatterLengthMin: '0.5',
    scatterLengthMax: '5.0',
    scatterVelocity: '5',
    scatterLife: '2.0',
    colorMode: 'rgb'
};

class SettingsManager {
    constructor() {
        this.initializeSettings();
        this.bindEvents();
    }

    initializeSettings() {
        // Load settings first
        this.loadSettings();
        
        // Initialize all input handlers
        const settingsInputs = document.querySelectorAll('.settings-popup input, .settings-popup select');
        settingsInputs.forEach(input => {
            // Add both change and input event listeners
            ['change', 'input'].forEach(eventType => {
                input.addEventListener(eventType, (e) => {
                    console.log(`Setting ${input.id} ${eventType}d to ${input.value}`);
                    // Immediately save the setting
                    const settings = this.getCurrentSettings();
                    localStorage.setItem('vectorVisSettings', JSON.stringify(settings));
                    
                    // Directly trigger visualization update if available
                    if (window.visualizationManager?.currentData) {
                        console.log('Triggering immediate visualization update');
                        window.visualizationManager.updatePointCloud(
                            window.visualizationManager.currentData.points,
                            window.visualizationManager.currentData.metadata
                        );
                    }
                });
            });
        });

        // Initialize settings panel visibility
        this.initializeSettingsPanel();
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('vectorVisSettings');
            const settings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
            
            Object.keys(settings).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    element.value = settings[key];
                }
            });
            
            console.log('Settings loaded successfully');
        } catch (error) {
            console.error('Error loading settings:', error);
            this.resetToDefaults();
        }
    }

    saveSettings() {
        try {
            const settings = {};
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    settings[key] = element.value;
                }
            });
            
            localStorage.setItem('vectorVisSettings', JSON.stringify(settings));
            this.showSaveConfirmation();
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings: ' + error.message);
        }
    }

    resetToDefaults() {
        Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.value = value;
            }
        });
    }

    showSaveConfirmation() {
        const saveButton = document.getElementById('saveSettings');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saved!';
        setTimeout(() => {
            saveButton.textContent = originalText;
        }, 1500);
    }

    initializeSettingsPanel() {
        const settingsButton = document.querySelector('.settings-button');
        const settingsPopup = document.querySelector('.settings-popup');

        if (!settingsButton || !settingsPopup) {
            console.error('Settings elements not found');
            return;
        }

        settingsPopup.style.display = 'none';
        settingsPopup.classList.remove('active');

        this.setupEventListeners(settingsButton, settingsPopup);
    }

    setupEventListeners(settingsButton, settingsPopup) {
        // Remove any existing event listeners
        const newButton = settingsButton.cloneNode(true);
        settingsButton.parentNode.replaceChild(newButton, settingsButton);
        
        // Track popup state
        let isPopupVisible = false;
        
        // Handle button click
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isPopupVisible = !isPopupVisible;
            settingsPopup.style.display = isPopupVisible ? 'block' : 'none';
            console.log('Settings button clicked, popup state:', isPopupVisible);
        });
        
        // Handle clicking outside
        document.addEventListener('click', (e) => {
            if (isPopupVisible && !settingsPopup.contains(e.target) && e.target !== newButton) {
                isPopupVisible = false;
                settingsPopup.style.display = 'none';
            }
        });
        
        // Prevent popup closing when clicking inside
        settingsPopup.addEventListener('click', (e) => {
            e.stopPropagation();
            // If clicking a setting input, ensure focus
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                e.target.focus();
            }
        });
    }

    bindEvents() {
        const saveSettingsButton = document.getElementById('saveSettings');
        if (saveSettingsButton) {
            saveSettingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveSettings();
            });
        }
    }

    // Utility method to get current settings
    getCurrentSettings() {
        const settings = {};
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                settings[key] = parseFloat(element.value) || element.value;
            }
        });
        return settings;
    }

    // Add utility method to force update
    forceVisualizationUpdate() {
        if (window.visualizationManager?.currentData) {
            window.visualizationManager.updatePointCloud(
                window.visualizationManager.currentData.points,
                window.visualizationManager.currentData.metadata
            );
        }
    }
}

// Export for use in other files
window.SettingsManager = SettingsManager;
