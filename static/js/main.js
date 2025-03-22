// Global variables for glossary mode
let currentValue = 0;

// Add global CSS for glossary mode
const glossaryDisabledStyle = document.createElement('style');
glossaryDisabledStyle.id = 'glossaryDisabledStyle';
glossaryDisabledStyle.textContent = `
    .slider-container.disabled, 
    .slider-label.disabled,
    .slider-track.disabled,
    .slider-fill.disabled,
    .slider-thumb.disabled,
    .slider-value.disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
    }
    
    .glossary-disabled-message {
        display: block;
        color: #e74c3c;
        font-size: 0.8em;
        margin-top: 5px;
        font-style: italic;
    }
`;
document.head.appendChild(glossaryDisabledStyle);

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded - Initializing managers in sequence');
    
    try {
        // Initialize managers in correct dependency order
        window.settingsManager = new SettingsManager();
        window.chatManager = new ChatManager();
        await new Promise(resolve => setTimeout(resolve, 100)); // Ensure chat manager is ready
        
        window.documentManager = new DocumentManager();
        window.modelManager = new ModelManager();
        window.glossaryManager = new GlossaryManager();
        
        // Initialize visualization last to ensure other components are ready
        window.visualizationManager = new VisualizationManager();

        // Initialize word count controls
        initializeWordCount();

        console.log('All managers initialized successfully');

        // Update visualization and explicitly export functions
        window.updateVisualization = function() {
            console.log('Global updateVisualization called');
            if (window.visualizationManager) {
                window.visualizationManager.updateVisualization();
            } else {
                console.error('VisualizationManager not initialized');
            }
        };

        // Export other necessary visualization functions
        window.clearVisualization = () => window.visualizationManager?.clearVisualization();
        window.showOverlay = (msg, type) => window.visualizationManager?.showOverlay(msg, type);
        window.hideOverlay = () => window.visualizationManager?.hideOverlay();
        window.handleGlossaryModeVisibility = (count) => {
            if (window.glossaryManager) {
                window.glossaryManager.updateSlider(count > 1 ? 0 : window.currentValue);
            }
        };

        // Explicitly trigger initial visualization after a short delay
        setTimeout(() => {
            console.log('Triggering initial visualization');
            if (window.visualizationManager) {
                window.visualizationManager.updateVisualization();
            }
        }, 500);

    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

function initializeWordCount() {
    const wordCountInput = document.getElementById('wordCount');
    const upArrow = document.querySelector('.arrow.up');
    const downArrow = document.querySelector('.arrow.down');

    upArrow.addEventListener('click', () => {
        const currentValue = parseInt(wordCountInput.value) || 300;
        wordCountInput.value = Math.min(currentValue + 50, 2000);
    });
    
    downArrow.addEventListener('click', () => {
        const currentValue = parseInt(wordCountInput.value) || 300;
        wordCountInput.value = Math.max(currentValue - 50, 100);
    });
}