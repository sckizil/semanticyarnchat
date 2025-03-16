/**
 * models.js - Dedicated file for model fetching functionality
 */

// Function to log to console with a consistent prefix
function logModel(message) {
    console.log(`[Models] ${message}`);
}

// Try to append to terminal if it exists
function appendToTerminalSafe(message) {
    try {
        const terminalContent = document.getElementById('terminalContent');
        if (terminalContent) {
            const timestamp = new Date().toLocaleTimeString();
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.textContent = `[${timestamp}] ${message}`;
            terminalContent.appendChild(line);
            terminalContent.scrollTop = terminalContent.scrollHeight;
            return true;
        }
    } catch (e) {
        console.warn("Terminal feedback not available:", e);
    }
    return false;
}

// Function to fetch available models from the API
function fetchAvailableModels(isInitialLoad = false) {
    logModel(`Fetch requested (initialLoad: ${isInitialLoad})`);
    
    // Get the select element
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) {
        logModel("Error: modelSelect element not found in DOM");
        return;
    }
    
    // Set loading state
    modelSelect.innerHTML = '';
    const loadingOption = document.createElement('option');
    loadingOption.value = 'loading';
    loadingOption.textContent = 'Loading models...';
    modelSelect.appendChild(loadingOption);
    modelSelect.disabled = true;
    modelSelect.classList.add('loading');
    appendToTerminalSafe("Fetching LLM models...");
    
    // Make the request with credentials
    logModel("Sending fetch request to /api/models");
    fetch('/api/models', {
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        logModel(`Response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        logModel(`Response data received: ${JSON.stringify(data)}`);
        
        // Enable the select element
        modelSelect.disabled = false;
        modelSelect.classList.remove('loading');
        
        // Clear the dropdown
        modelSelect.innerHTML = '';
        
        // If we received models, add them
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
            logModel(`Adding ${data.models.length} models to dropdown`);
            appendToTerminalSafe(`Found ${data.models.length} LLM models`);
            
            // Add each model as an option
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            
            // Select first model
            modelSelect.selectedIndex = 0;
            logModel(`Selected first model: ${modelSelect.value}`);
            
            // Add visual feedback
            modelSelect.classList.add('models-loaded');
            setTimeout(() => {
                modelSelect.classList.remove('models-loaded');
            }, 1000);
        } else {
            logModel("No models in response, adding default model only");
            const option = document.createElement('option');
            option.value = 'meta-llama-3.1-8b-instruct';
            option.textContent = 'meta-llama-3.1-8b-instruct';
            modelSelect.appendChild(option);
            appendToTerminalSafe("No models found, using default model");
        }
    })
    .catch(error => {
        logModel(`Error: ${error.message}`);
        appendToTerminalSafe(`Error fetching models: ${error.message}`);
        
        // Ensure we have the default model
        modelSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = 'meta-llama-3.1-8b-instruct';
        option.textContent = 'meta-llama-3.1-8b-instruct';
        modelSelect.appendChild(option);
        modelSelect.disabled = false;
        modelSelect.classList.remove('loading');
        
        // Retry for initial load
        if (isInitialLoad) {
            logModel("Will retry due to initial load");
            setTimeout(() => {
                logModel("Executing retry...");
                fetchAvailableModels(false);
            }, 3000);
        }
    });
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    logModel("DOMContentLoaded - initializing model fetching");
    fetchAvailableModels(true);
});

// Export function for use in other scripts
window.fetchAvailableModels = fetchAvailableModels; 