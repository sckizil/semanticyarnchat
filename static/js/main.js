// Global variables
let selectedDocsSet = new Set();
let terminalOutput = [];
let currentValue = 0;

// Add global CSS to handle disabled glossary mode
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
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Fetch models immediately before doing anything else
    console.log('Fetching models immediately on page load...');
    fetchAvailableModels(true);
    
    // Schedule a second fetch attempt after a short delay
    setTimeout(() => {
        console.log('Executing scheduled second fetch attempt...');
        fetchAvailableModels(true);
    }, 2000);
    
    // Rest of initialization code
    const searchInput = document.getElementById('searchInput');
    const documentList = document.getElementById('documentList');
    const chatForm = document.getElementById('chatForm');
    const questionInput = document.getElementById('questionInput');
    const chatMessages = document.getElementById('chatMessages');
    const mainContent = document.getElementById('mainContent');
    const terminalPanel = document.getElementById('terminalPanel');
    const previousChats = document.getElementById('previousChats');
    const terminalContent = document.getElementById('terminalContent');
    const selectedDocsList = document.getElementById('selectedDocsList');
    const modelNameInput = document.getElementById('modelName');
    const wordCountInput = document.getElementById('wordCount');
    const upArrow = document.querySelector('.arrow.up');
    const downArrow = document.querySelector('.arrow.down');

    // Initialize search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const documents = documentList.getElementsByClassName('document-item');
        
        Array.from(documents).forEach(doc => {
            const title = doc.querySelector('.doc-title').textContent.toLowerCase();
            const authors = doc.querySelector('.doc-meta').textContent.toLowerCase();
            if (title.includes(searchTerm) || authors.includes(searchTerm)) {
                doc.style.display = '';
            } else {
                doc.style.display = 'none';
            }
        });
    });

    // Handle document selection
    documentList.addEventListener('change', function(e) {
        if (e.target.classList.contains('doc-checkbox')) {
            console.log('Document checkbox changed - updating selected docs list');
            
            // First, update the selected docs list and get the count
            const count = updateSelectedDocsList();
            
            // Log selection state clearly
            const selectedCheckboxes = document.querySelectorAll('.doc-checkbox:checked');
            console.log(`Document selection changed: ${count} documents now selected`);
            console.log('Selected document IDs:', Array.from(selectedCheckboxes).map(cb => cb.id));
            
            // Check if we just selected multiple documents and glossary is on
            if (count > 1 && currentValue > 0) {
                console.log('Multiple documents selected while glossary was active - forcing reset');
                // Force reset the slider - use timeout to ensure it happens after DOM updates
                setTimeout(() => {
                    updateSlider(0);
                    
                    // Double-check it actually reset
                    setTimeout(() => {
                        if (currentValue > 0) {
                            console.log('Slider still not at 0, forcing again');
                            updateSlider(0);
                        }
                    }, 50);
                }, 10);
            }
            
            // Always update glossary visibility
            handleGlossaryModeVisibility(count);
            
            // Force a delay and second check to ensure UI is updated
            setTimeout(() => {
                console.log('Performing delayed check of document count');
                const currentCount = document.querySelectorAll('.doc-checkbox:checked').length;
                handleGlossaryModeVisibility(currentCount);
            }, 100);
        }
    });

    // Initialize chat form
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Chat form submitted');
        
        // Check if we're in glossary mode
        if (currentValue > 0) {
            console.log('Form submitted while in glossary mode - triggering glossary creation');
            e.preventDefault();
            createGlossary();
            return;
        }
        
        const question = questionInput.value.trim();
        if (!question) return;

        const selectedCitekeys = Array.from(document.querySelectorAll('.doc-checkbox:checked'))
            .map(checkbox => checkbox.id.replace('doc-', ''));
        console.log('Selected citekeys:', selectedCitekeys);
        console.log('Current glossary value:', currentValue);

        if (selectedCitekeys.length === 0) {
            appendToTerminal('Please select at least one document.');
            return;
        }

        // Disable inputs during processing
        questionInput.disabled = true;
        searchInput.disabled = true;
        document.querySelectorAll('.doc-checkbox').forEach(checkbox => checkbox.disabled = true);

        try {
            // Get model from dropdown
            const modelSelect = document.getElementById('modelSelect');
            const modelName = modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct';
            
            const requestData = {
                question: question,
                citekeys: selectedCitekeys,
                model_name: modelName,
                word_count: parseInt(wordCountInput.value),
                use_refine: document.getElementById('refineToggle').checked,
                glossary_mode: currentValue
            };
            console.log('Sending request data:', requestData);

            const response = await fetch('http://localhost:5001/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response received:', response);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.error) {
                console.error('Server error:', data.error);
                appendToTerminal(`Error: ${data.error}`);
                return;
            }

            // Add new chat message
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.innerHTML = `
                <div class="message user">> ${question}</div>
                <div class="message assistant">${data.answer}</div>
                <div class="message-meta">${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].slice(0, 5)} | ${selectedCitekeys.join(', ')}</div>
            `;
            chatMessages.insertBefore(chatItem, chatMessages.firstChild);

            // Clear question input
            questionInput.value = '';

            // Add terminal output
            if (data.terminal_output) {
                data.terminal_output.forEach(line => appendToTerminal(line));
            }

        } catch (error) {
            console.error('Error in chat form submission:', error);
            appendToTerminal(`Error: ${error.message}`);
        } finally {
            // Re-enable inputs
            questionInput.disabled = false;
            searchInput.disabled = false;
            document.querySelectorAll('.doc-checkbox').forEach(checkbox => checkbox.disabled = false);
            questionInput.focus();
        }
    });

    // Terminal panel functionality
    window.toggleTerminal = function() {
        terminalPanel.classList.toggle('open');
        mainContent.classList.toggle('terminal-open');
        mainContent.classList.toggle('both-open', previousChats.classList.contains('open'));
    }

    // Previous chats panel functionality
    window.togglePreviousChats = function() {
        previousChats.classList.toggle('open');
        mainContent.classList.toggle('previous-open');
        mainContent.classList.toggle('both-open', terminalPanel.classList.contains('open'));
    }

    // Load specific chat
    window.loadChat = function(index) {
        const chatElement = document.getElementById(`chat-${index}`);
        if (chatElement) {
            chatElement.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Export chat history
    window.exportChat = function() {
        const chatHistory = Array.from(document.querySelectorAll('.chat-history-item')).map(item => {
            const question = item.querySelector('.message.user').textContent.slice(2);
            const answer = item.querySelector('.message.assistant').textContent;
            const meta = item.querySelector('.message-meta').textContent;
            const [date, time, citekeys] = meta.split(' | ');
            return `# ${date} ${time}
Documents: ${citekeys}

## Question
${question}

## Answer
${answer}

---
`;
        }).join('\n');

        const blob = new Blob([chatHistory], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function appendToTerminal(message) {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.textContent = `[${timestamp}] ${message}`;
        terminalContent.appendChild(line);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    // Focus question input on load
    questionInput.focus();

    // Add event listeners for word count arrows
    upArrow.addEventListener('click', () => {
        const currentValue = parseInt(wordCountInput.value) || 300;
        wordCountInput.value = Math.min(currentValue + 50, 2000);
    });
    
    downArrow.addEventListener('click', () => {
        const currentValue = parseInt(wordCountInput.value) || 300;
        wordCountInput.value = Math.max(currentValue - 50, 100);
    });

    // Update checkbox display
    const checkbox = document.querySelector('.hidden-checkbox');
    const checkboxDisplay = document.querySelector('.checkbox-display');
    
    // Set initial state
    checkboxDisplay.textContent = '[ ]';
    checkbox.checked = false;
    
    checkbox.addEventListener('change', function() {
        checkboxDisplay.textContent = this.checked ? '[X]' : '[ ]';
        if (this.checked) {
            checkboxDisplay.style.color = 'var(--accent-color)';
        } else {
            checkboxDisplay.style.color = 'var(--text-color)';
        }
    });

    // Glossary slider functionality
    const sliderTrack = document.querySelector('.slider-track');
    const sliderThumb = document.querySelector('.slider-thumb');
    const sliderFill = document.querySelector('.slider-fill');
    const sliderValue = document.querySelector('.slider-value');
    let isDragging = false;

    function updateSlider(value) {
        // Check if multiple documents are selected - if so, force value to 0
        const selectedCount = document.querySelectorAll('.doc-checkbox:checked').length;
        if (selectedCount > 1 && value > 0) {
            console.log('Blocking glossary slider change - multiple documents selected');
            value = 0;
        }
        
        // Calculate percentage and update visual elements
        const percentage = (value / 8) * 100;
        sliderThumb.style.left = `${percentage}%`;
        sliderFill.style.width = `${percentage}%`;
        sliderValue.textContent = value === 0 ? 'off' : value.toString();
        
        // Store the current value
        const previousValue = currentValue;
        currentValue = value;
        
        console.log(`Slider updated: ${previousValue} → ${currentValue}`);
        
        // Update the question input based on glossary mode
        if (value > 0) {
            // In glossary mode - add Create button
            questionInput.style.display = "none";
            
            // Create glossary button if it doesn't exist
            let glossaryBtn = document.getElementById('glossaryCreateBtn');
            if (!glossaryBtn) {
                glossaryBtn = document.createElement('button');
                glossaryBtn.id = 'glossaryCreateBtn';
                glossaryBtn.textContent = 'Create';
                glossaryBtn.className = 'glossary-create-btn';
                glossaryBtn.type = 'button'; // Set type to button to prevent form submission
                glossaryBtn.addEventListener('click', function(event) {
                    // Stop event propagation
                    event.preventDefault();
                    event.stopPropagation();
                    
                    console.log('Create glossary button clicked - making direct fetch request');
                    
                    // Show loading spinner
                    const loadingElement = document.createElement('div');
                    loadingElement.className = 'glossary-loading';
                    loadingElement.innerHTML = `
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Generating glossary with ${currentValue} terms...</div>
                    `;
                    document.getElementById('chatMessages').insertBefore(loadingElement, document.getElementById('chatMessages').firstChild);
                    
                    // Collect data
                    const selectedCitekeys = Array.from(document.querySelectorAll('.doc-checkbox:checked'))
                        .map(checkbox => checkbox.id.replace('doc-', ''));
                    
                    // Get model from dropdown
                    const modelSelect = document.getElementById('modelSelect');
                    const modelName = modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct';
                    
                    // Make direct request
                    fetch('http://localhost:5001/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            question: "Generate glossary",
                            citekeys: selectedCitekeys,
                            model_name: modelName,
                            word_count: parseInt(wordCountInput.value),
                            use_refine: document.getElementById('refineToggle').checked,
                            glossary_mode: currentValue
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        // Remove loading spinner
                        document.querySelector('.glossary-loading')?.remove();
                        
                        if (data.error) {
                            // Handle error
                            console.error('Error:', data.error);
                            appendToTerminal(`Error: ${data.error}`);
                            
                            // Display error
                            const errorItem = document.createElement('div');
                            errorItem.className = 'message-group';
                            errorItem.innerHTML = `
                                <div class="message">
                                    <div class="message-question">Generate glossary (${currentValue} terms)</div>
                                </div>
                                <div class="message">
                                    <div class="message-content">Error: ${data.error}</div>
                                    <div class="message-metadata">
                                        <span class="timestamp">${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].slice(0, 5)}</span>
                                        <div class="citekeys">
                                            ${selectedCitekeys.map(key => `<span class="citekey">${key}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            `;
                            document.getElementById('chatMessages').insertBefore(errorItem, document.getElementById('chatMessages').firstChild);
                        } else {
                            // Display glossary
                            const chatItem = document.createElement('div');
                            chatItem.className = 'message-group';
                            chatItem.innerHTML = `
                                <div class="message">
                                    <div class="message-question">Generate glossary (${currentValue} terms)</div>
                                </div>
                                <div class="message">
                                    <div class="message-content">${data.answer}</div>
                                    <div class="message-metadata">
                                        <span class="timestamp">${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].slice(0, 5)}</span>
                                        <div class="citekeys">
                                            ${selectedCitekeys.map(key => `<span class="citekey">${key}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            `;
                            document.getElementById('chatMessages').insertBefore(chatItem, document.getElementById('chatMessages').firstChild);
                            
                            // Add terminal output
                            if (data.terminal_output && Array.isArray(data.terminal_output)) {
                                data.terminal_output.forEach(line => appendToTerminal(line));
                            }
                        }
                    })
                    .catch(error => {
                        // Remove loading spinner
                        document.querySelector('.glossary-loading')?.remove();
                        
                        console.error('Error:', error);
                        appendToTerminal(`Error: ${error.message}`);
                        
                        // Display error
                        const errorItem = document.createElement('div');
                        errorItem.className = 'message-group';
                        errorItem.innerHTML = `
                            <div class="message">
                                <div class="message-question">Generate glossary (${currentValue} terms)</div>
                            </div>
                            <div class="message">
                                <div class="message-content">Error: ${error.message}</div>
                                <div class="message-metadata">
                                    <span class="timestamp">${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].slice(0, 5)}</span>
                                    <div class="citekeys">
                                        ${selectedCitekeys.map(key => `<span class="citekey">${key}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                        document.getElementById('chatMessages').insertBefore(errorItem, document.getElementById('chatMessages').firstChild);
                    });
                });
                
                // Add button to the form
                chatForm.insertBefore(glossaryBtn, chatForm.querySelector('button[type="submit"]'));
                
                // Add style for the button
                const style = document.createElement('style');
                style.textContent = `
                    .glossary-create-btn {
                        background-color: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        cursor: pointer;
                        font-family: 'Noto Sans Mono', monospace;
                        margin-right: 10px;
                        font-weight: bold;
                    }
                    .glossary-create-btn:hover {
                        background-color: #45a049;
                    }
                    
                    /* Error message styling */
                    .message.assistant.error {
                        color: #e74c3c;
                        font-weight: bold;
                        border-left: 3px solid #e74c3c;
                    }
                    
                    /* System message styling */
                    .system-message {
                        padding: 10px 0;
                    }
                    .message.system {
                        color: #3498db;
                        font-style: italic;
                        background-color: rgba(52, 152, 219, 0.1);
                        padding: 10px;
                        border-radius: 5px;
                        border-left: 3px solid #3498db;
                    }
                `;
                document.head.appendChild(style);
            }
            glossaryBtn.style.display = "inline-block";
            
            // Hide submit button
            chatForm.querySelector('button[type="submit"]').style.display = "none";
        } else {
            // Normal chat mode
            questionInput.style.display = "inline-block";
            questionInput.placeholder = "> ask a question...";
            
            // Hide glossary button if it exists
            const glossaryBtn = document.getElementById('glossaryCreateBtn');
            if (glossaryBtn) {
                glossaryBtn.style.display = "none";
            }
            
            // Show submit button
            chatForm.querySelector('button[type="submit"]').style.display = "inline-block";
        }
    }

    function getValueFromPosition(position) {
        const rect = sliderTrack.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (position - rect.left) / rect.width));
        const value = Math.round(percentage * 8);
        return value;
    }

    sliderTrack.addEventListener('mousedown', (e) => {
        isDragging = true;
        const value = getValueFromPosition(e.clientX);
        updateSlider(value);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        updateSlider(value);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Initialize slider
    updateSlider(0);
    
    // Initial check for multiple documents
    const initialSelectedDocs = document.querySelectorAll('.doc-checkbox:checked').length;
    console.log(`Initially selected documents: ${initialSelectedDocs}`);
    
    // Force the glossary mode check immediately
    handleGlossaryModeVisibility(initialSelectedDocs);
    
    // Then double check after a short delay to ensure all DOM elements have properly initialized
    setTimeout(() => {
        console.log('Performing delayed initialization check for document count');
        const currentCount = document.querySelectorAll('.doc-checkbox:checked').length;
        console.log(`Delayed check found ${currentCount} selected documents`);
        handleGlossaryModeVisibility(currentCount);
    }, 300);
    
    // Add mutation observer to detect any changes to the document list that may not trigger change events
    const documentListObserver = new MutationObserver(function(mutations) {
        console.log('Document list mutation detected');
        const currentCount = document.querySelectorAll('.doc-checkbox:checked').length;
        console.log(`Mutation observer detected ${currentCount} selected documents`);
        handleGlossaryModeVisibility(currentCount);
    });
    
    // Start observing the document list for changes
    if (documentList) {
        documentListObserver.observe(documentList, { 
            childList: true, 
            subtree: true, 
            attributes: true,
            attributeFilter: ['checked'] 
        });
        console.log('Document list observer active');
    }

    // Ensure the button has a direct handler
    const glossaryCreateBtn = document.getElementById('glossaryCreateBtn');
    if (glossaryCreateBtn) {
        console.log('Adding click handler to glossary create button');
        
        // Remove any existing event listeners (to prevent duplicates)
        const newBtn = glossaryCreateBtn.cloneNode(true);
        glossaryCreateBtn.parentNode.replaceChild(newBtn, glossaryCreateBtn);
        
        // Add new event listener
        newBtn.addEventListener('click', function(event) {
            console.log('Glossary create button clicked');
            event.preventDefault();
            event.stopPropagation();  // Prevent event bubbling to the form
            createGlossary();
        });
    } else {
        console.error('Glossary create button not found');
    }

    // Add a reliable event listener to the form
    if (chatForm) {
        console.log('Adding submit handler to chat form');
        
        chatForm.addEventListener('submit', function(event) {
            console.log('Chat form submitted');
            
            // Check if we're in glossary mode with slider value > 0
            if (currentValue > 0) {
                console.log('Form submitted while in glossary mode - redirecting to createGlossary');
                event.preventDefault();
                createGlossary();
                return false;
            }
            
            // Normal form submission for chat mode
            console.log('Normal chat form submission');
        });
    } else {
        console.error('Chat form not found');
    }
});

// Function to fetch available models from the API
function fetchAvailableModels(isInitialLoad = false) {
    // Check if models have already been fetched by the direct script in HTML
    if (window.modelsFetchedDirectly) {
        console.log('Models were already fetched by direct script, skipping redundant fetch');
        return;
    }
    
    console.log(`Attempting to fetch available models from API (initialLoad: ${isInitialLoad})`);
    
    // Update dropdown to show loading state if needed
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        // Check if we already have models and this isn't an initial load
        if (!isInitialLoad && modelSelect.options.length > 1) {
            console.log('Already have multiple models, not showing loading state');
        } else if (modelSelect.options.length === 0 || 
                  (modelSelect.options.length === 1 && 
                   (modelSelect.options[0].value === 'loading' || 
                    modelSelect.options[0].value === 'meta-llama-3.1-8b-instruct'))) {
            // Only show loading state if we don't have models already
            modelSelect.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.value = 'loading';
            loadingOption.textContent = 'Loading models...';
            modelSelect.appendChild(loadingOption);
            modelSelect.disabled = true;
        }
    }
    
    // Show feedback in terminal
    if (isInitialLoad) {
        try {
            appendToTerminal("Fetching available models from LMStudio...");
        } catch (e) {
            console.warn("Terminal feedback not available yet:", e);
        }
    }
    
    // Only fetch once - no retries needed as we already fetch on page load
    fetch('http://localhost:5001/api/models')
        .then(response => {
            console.log(`Models API response status: ${response.status}`);
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                console.warn(`Models API returned error status: ${response.status}`);
                if (isInitialLoad) {
                    try {
                        appendToTerminal(`Error fetching models: Status ${response.status}`);
                    } catch (e) {
                        console.warn("Terminal feedback not available yet:", e);
                    }
                }
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Models API response data:', data);
            
            if (data.error) {
                console.warn('Warning fetching models:', data.error);
                if (isInitialLoad) {
                    try {
                        appendToTerminal(`Warning fetching models: ${data.error}`);
                    } catch (e) {
                        console.warn("Terminal feedback not available yet:", e);
                    }
                }
            }
            
            if (!modelSelect) {
                console.error('Model select element not found in DOM');
                return;
            }
            
            // Enable the select element
            modelSelect.disabled = false;
            
            // Store current selection if any (but not the loading placeholder)
            const currentSelection = modelSelect.value !== 'loading' ? modelSelect.value : null;
            
            // If we got models from the API, update the dropdown
            if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                console.log(`Got ${data.models.length} models from API:`, data.models);
                
                if (isInitialLoad) {
                    try {
                        appendToTerminal(`Found ${data.models.length} models in LMStudio: ${data.models.slice(0, 3).join(', ')}${data.models.length > 3 ? '...' : ''}`);
                    } catch (e) {
                        console.warn("Terminal feedback not available yet:", e);
                    }
                }
                
                // Clear ALL existing options
                modelSelect.innerHTML = '';
                
                // Add models from API
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
                
                console.log('Models loaded into dropdown');
                
                // Restore previous selection if it exists in the new model list
                if (currentSelection && data.models.includes(currentSelection)) {
                    modelSelect.value = currentSelection;
                    console.log(`Restored previous selection: ${currentSelection}`);
                } else if (modelSelect.options.length > 0) {
                    modelSelect.selectedIndex = 0;
                    console.log(`Set to first model: ${modelSelect.value}`);
                }
                
                // Add a visual indicator that models were loaded successfully
                modelSelect.classList.add('models-loaded');
                setTimeout(() => {
                    modelSelect.classList.remove('models-loaded');
                }, 1000);
            } else {
                console.warn('No valid models array in API response');
                // Ensure we at least have the default model
                modelSelect.innerHTML = '';
                const option = document.createElement('option');
                option.value = 'meta-llama-3.1-8b-instruct';
                option.textContent = 'meta-llama-3.1-8b-instruct';
                modelSelect.appendChild(option);
                
                if (isInitialLoad) {
                    try {
                        appendToTerminal("No models found, using default model only");
                    } catch (e) {
                        console.warn("Terminal feedback not available yet:", e);
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error fetching models:', error);
            try {
                appendToTerminal(`Error fetching models: ${error.message}`);
            } catch (e) {
                console.warn("Terminal feedback not available yet:", e);
            }
            
            // Ensure we have at least the default model
            if (modelSelect) {
                // Only clear if we're in loading state
                if (modelSelect.options.length === 0 || 
                    (modelSelect.options.length === 1 && modelSelect.options[0].value === 'loading')) {
                    modelSelect.innerHTML = '';
                    const option = document.createElement('option');
                    option.value = 'meta-llama-3.1-8b-instruct';
                    option.textContent = 'meta-llama-3.1-8b-instruct';
                    modelSelect.appendChild(option);
                }
                modelSelect.disabled = false;
            }
            
            // Retry after a delay for initial load (with a maximum of 3 retries)
            if (isInitialLoad) {
                // Check if we've maxed out retries by using a data attribute on the body element
                const body = document.body;
                const retryCount = parseInt(body.getAttribute('data-model-fetch-retries') || '0');
                
                if (retryCount < 3) {
                    body.setAttribute('data-model-fetch-retries', (retryCount + 1).toString());
                    setTimeout(() => {
                        console.log(`Retrying model fetch after error (attempt ${retryCount + 1}/3)...`);
                        fetchAvailableModels(true);
                    }, 3000);
                } else {
                    console.log('Max retry attempts reached. Using default model.');
                    appendToTerminal('Max retry attempts reached. Using default model.');
                }
            }
        });
}

// Update selected documents list
function updateSelectedDocsList() {
    console.log('Updating selected docs list');
    
    // Get all checked document checkboxes
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
    console.log('Selected documents:', selectedCitekeys);
    console.log('Number of selected documents:', selectedCitekeys.length);

    const selectedDocsContainer = document.getElementById('selectedDocs');
    const sectionHeader = document.querySelector('.section-header');
    
    // Update the header with document count
    sectionHeader.innerHTML = `Selected Documents <span class="doc-count">(${selectedCitekeys.length})</span>`;
    
    // Update the list of documents
    selectedDocsContainer.innerHTML = selectedCitekeys.map(doc => `
        <div class="selected-doc">
            <button class="remove-doc" onclick="removeDocument('${doc.citekey}')">×</button>
            <div class="doc-title">${doc.title}</div>
            <div class="doc-meta">${doc.authors}</div>
        </div>
    `).join('');
    
    // Explicitly force update of glossary mode based on selection count
    console.log('Forcing glossary mode visibility update from updateSelectedDocsList');
    handleGlossaryModeVisibility(selectedCitekeys.length);
    
    // Return the count for reference
    return selectedCitekeys.length;
}

// Function to handle glossary mode visibility based on document count
function handleGlossaryModeVisibility(documentCount) {
    console.log(`Handling glossary mode visibility for ${documentCount} documents`);
    
    // Get slider elements - ensure they exist before proceeding
    const sliderTrack = document.querySelector('.slider-track');
    const sliderThumb = document.querySelector('.slider-thumb');
    const sliderFill = document.querySelector('.slider-fill');
    const sliderValue = document.querySelector('.slider-value');
    const sliderContainer = document.querySelector('.slider-container');
    const sliderLabel = document.querySelector('.slider-label');
    const glossaryBtn = document.getElementById('glossaryCreateBtn');
    
    // Added extra logging for debugging
    console.log(`Current slider value before processing: ${currentValue}`);
    
    if (documentCount > 1) {
        console.log('Multiple documents selected, disabling glossary mode');
        
        // CRITICAL: Force immediate reset to 0 (not just through updateSlider)
        if (currentValue > 0) {
            console.log('Resetting slider to 0 (multiple documents selected)');
            
            // Force UI update right away
            const percentage = 0;
            if (sliderThumb) sliderThumb.style.left = `${percentage}%`;
            if (sliderFill) sliderFill.style.width = `${percentage}%`;
            if (sliderValue) sliderValue.textContent = 'off';
            
            // Update the current value
            currentValue = 0;
            
            // Call updateSlider as a backup to ensure all UI changes happen
            updateSlider(0);
            
            // Force visibility on the regular input and hide any glossary buttons
            if (questionInput) {
                questionInput.style.display = 'inline-block';
                questionInput.placeholder = '> ask a question...';
            }
            
            // Force the submit button to show
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.style.display = 'inline-block';
            
            // Force a delay and double-check
            setTimeout(() => {
                console.log(`After reset timeout, current value: ${currentValue}`);
                if (currentValue > 0) {
                    console.log('Slider still not reset, forcing again with direct DOM manipulation');
                    
                    // Direct DOM manipulation as last resort
                    if (sliderThumb) sliderThumb.style.left = '0%';
                    if (sliderFill) sliderFill.style.width = '0%';
                    if (sliderValue) sliderValue.textContent = 'off';
                    currentValue = 0;
                }
            }, 50);
        }
        
        // Direct style application with visibility for debugging
        console.log('Applying disabled styles to slider elements');
        const elements = [sliderTrack, sliderThumb, sliderFill, sliderValue, sliderContainer, sliderLabel];
        elements.forEach(el => {
            if (el) {
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none';
                el.style.cursor = 'not-allowed';
                
                // Set inline style to enforce the disabled state
                el.style.setProperty('opacity', '0.5', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
            } else {
                console.error('Element not found when applying disabled style');
            }
        });
        
        // Add tooltip and message
        if (sliderContainer) sliderContainer.title = "Glossary mode is only available for a single document";
        if (sliderLabel) sliderLabel.title = "Glossary mode is only available for a single document";
        
        // Add visible message
        const existingMessage = document.querySelector('.glossary-disabled-message');
        if (!existingMessage && sliderContainer) {
            console.log('Adding glossary disabled message');
            const disabledMessage = document.createElement('div');
            disabledMessage.className = 'glossary-disabled-message';
            disabledMessage.textContent = 'Glossary mode only works with a single document';
            disabledMessage.style.color = '#e74c3c';
            disabledMessage.style.fontSize = '0.8em';
            disabledMessage.style.marginTop = '5px';
            disabledMessage.style.fontStyle = 'italic';
            sliderContainer.parentNode.appendChild(disabledMessage);
        }
        
        // Hide glossary button
        if (glossaryBtn) {
            glossaryBtn.style.display = 'none';
        }
    } else {
        console.log('Single or no document selected, enabling glossary mode');
        
        // Direct style application
        console.log('Applying enabled styles to slider elements');
        const elements = [sliderTrack, sliderThumb, sliderFill, sliderValue, sliderContainer, sliderLabel];
        elements.forEach(el => {
            if (el) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'pointer';
                el.removeAttribute('disabled');
                
                // Remove important styles if they were set
                el.style.removeProperty('opacity');
                el.style.removeProperty('pointer-events');
            } else {
                console.error('Element not found when applying enabled style');
            }
        });
        
        // Remove tooltip
        if (sliderContainer) sliderContainer.title = "";
        if (sliderLabel) sliderLabel.title = "";
        
        // Remove disabled message
        const disabledMessage = document.querySelector('.glossary-disabled-message');
        if (disabledMessage && disabledMessage.parentNode) {
            console.log('Removing glossary disabled message');
            disabledMessage.parentNode.removeChild(disabledMessage);
        }
        
        // Show glossary button if value > 0
        if (currentValue > 0 && glossaryBtn) {
            glossaryBtn.style.display = 'inline-block';
        }
    }
    
    // Log the final state
    console.log(`Glossary mode visibility updated. Current value: ${currentValue}, Doc count: ${documentCount}`);
}

// Remove document from selection
function removeDocument(citekey) {
    console.log(`Removing document with citekey: ${citekey}`);
    const checkbox = document.getElementById(`doc-${citekey}`);
    if (checkbox) {
        checkbox.checked = false;
        const count = updateSelectedDocsList();
        console.log(`After removal: ${count} documents selected`);
        
        // Force immediate update of glossary mode visibility
        handleGlossaryModeVisibility(count);
        
        // Double-check with a delay to ensure UI is updated
        setTimeout(() => {
            const currentCount = document.querySelectorAll('.doc-checkbox:checked').length;
            console.log(`Delayed check after removal: ${currentCount} documents selected`);
            handleGlossaryModeVisibility(currentCount);
        }, 100);
    } else {
        console.error(`Checkbox with ID doc-${citekey} not found`);
    }
}

// Send question to server
async function sendQuestion() {
    console.log('sendQuestion called');
    const question = document.getElementById('questionInput').value;
    const selectedCitekeys = Array.from(document.querySelectorAll('.doc-checkbox:checked'))
        .map(checkbox => checkbox.id.replace('doc-', ''));
    console.log('Selected citekeys in sendQuestion:', selectedCitekeys);
    console.log('Current glossary value in sendQuestion:', currentValue);
    
    // Get model from dropdown
    const modelSelect = document.getElementById('modelSelect');
    const modelName = modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct';
    
    const wordCount = document.getElementById('wordCount').value;
    const useRefine = document.getElementById('refineToggle').checked;

    try {
        const response = await fetch('http://localhost:5001/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                citekeys: selectedCitekeys,
                model_name: modelName,
                word_count: parseInt(wordCount),
                use_refine: useRefine,
                glossary_mode: currentValue
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        appendChatMessage(question, data.answer);
        updateTerminalOutput(data.terminal_output);
    } catch (error) {
        console.error('Error:', error);
        appendChatMessage(question, 'Error: Failed to get response from server');
    }
}

// Append chat message to chat history
function appendChatMessage(question, answer) {
    console.log('appendChatMessage called');
    const chatMessages = document.getElementById('chatMessages');
    const chatItem = document.createElement('div');
    chatItem.className = 'message-group';
    
    const timestamp = new Date().toISOString();
    const selectedCitekeys = Array.from(document.querySelectorAll('.doc-checkbox:checked'))
        .map(checkbox => checkbox.id.replace('doc-', ''));
    console.log('Selected citekeys in appendChatMessage:', selectedCitekeys);
    
    chatItem.innerHTML = `
        <div class="message">
            <div class="message-question">${question}</div>
        </div>
        <div class="message">
            <div class="message-content">${answer}</div>
            <div class="message-metadata">
                <span class="timestamp">${timestamp.split('T')[0]} ${timestamp.split('T')[1].slice(0, 5)}</span>
                <div class="citekeys">
                    ${selectedCitekeys.map(key => `<span class="citekey">${key}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
    
    chatMessages.insertBefore(chatItem, chatMessages.firstChild);
}

// Update terminal output
function updateTerminalOutput(output) {
    const terminalContent = document.getElementById('terminalContent');
    if (Array.isArray(output)) {
        output.forEach(line => {
            const lineElement = document.createElement('div');
            lineElement.textContent = line;
            terminalContent.appendChild(lineElement);
            terminalContent.scrollTop = terminalContent.scrollHeight;
        });
    } else if (typeof output === 'string') {
        const lineElement = document.createElement('div');
        lineElement.textContent = output;
        terminalContent.appendChild(lineElement);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }
}

// Add a helper function to show system messages
function appendSystemMessage(message) {
    console.log('System message:', message);
    const chatMessages = document.getElementById('chatMessages');
    const systemItem = document.createElement('div');
    systemItem.className = 'message-group';
    systemItem.innerHTML = `
        <div class="message">
            <div class="message-content">${message}</div>
        </div>
    `;
    chatMessages.insertBefore(systemItem, chatMessages.firstChild);
    
    // Also log to terminal
    appendToTerminal(message);
}

// Export message function updated for new structure
function exportMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    const question = messageElement.querySelector('.message-question').textContent;
    const answer = messageElement.querySelector('.message-content').textContent;
    const timestamp = messageElement.querySelector('.timestamp').textContent;
    const citekeys = Array.from(messageElement.querySelectorAll('.citekey'))
        .map(el => el.textContent)
        .join(', ');

    // Create markdown content
    const markdown = `# Chat Message Export
Date: ${timestamp}
Documents: ${citekeys}

## Question
${question}

## Answer
${answer}
`;

    // Create and trigger download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_message_${timestamp.replace(/[-: ]/g, '')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Completely rewritten createGlossary function
function createGlossary() {
    console.log('createGlossary function called');
    
    // Get selected citekeys
    const selectedCheckboxes = document.querySelectorAll('.doc-checkbox:checked');
    const selectedCitekeys = Array.from(selectedCheckboxes)
        .map(checkbox => checkbox.id.replace('doc-', ''));
    
    console.log('Selected citekeys for glossary:', selectedCitekeys);
    
    if (selectedCitekeys.length === 0) {
        console.error('No documents selected for glossary');
        appendSystemMessage('Please select at least one document for the glossary.');
        return;
    }
    
    if (selectedCitekeys.length > 1) {
        console.error('Multiple documents selected for glossary');
        appendSystemMessage('Glossary mode only works with a single document. Please select just one document.');
        return;
    }
    
    // Get model and other settings
    const modelSelect = document.getElementById('modelSelect');
    const modelName = modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct';
    const wordCountInput = document.getElementById('wordCount');
    const wordCount = wordCountInput ? parseInt(wordCountInput.value) || 300 : 300;
    const refineToggle = document.getElementById('refineToggle');
    
    // Make request
    console.log('Making glossary request to /chat endpoint');
    fetch('http://localhost:5001/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: "Generate glossary",
            citekeys: selectedCitekeys,
            model_name: modelName,
            word_count: wordCount,
            use_refine: refineToggle ? refineToggle.checked : false,
            glossary_mode: currentValue
        })
    })
    .then(response => {
        console.log(`Response received with status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data received:', typeof data);
        
        if (data.error) {
            console.error('Server returned error:', data.error);
            appendSystemMessage(`Error generating glossary: ${data.error}`);
            return;
        }
        
        if (!data.answer) {
            console.error('No glossary content in response');
            appendSystemMessage('No glossary content received from server.');
            return;
        }
        
        console.log('Glossary answer received, length:', data.answer.length);
        
        try {
            // Create message group with the same structure as regular messages
            const chatItem = document.createElement('div');
            chatItem.className = 'message-group';
            chatItem.innerHTML = `
                <div class="message">
                    <div class="message-question">Generate glossary (${currentValue} terms)</div>
                </div>
                <div class="message">
                    <div class="message-content">${data.answer}</div>
                    <div class="message-metadata">
                        <span class="timestamp">${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].slice(0, 5)}</span>
                        <div class="citekeys">
                            ${selectedCitekeys.map(key => `<span class="citekey">${key}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Add to chat messages
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.insertBefore(chatItem, chatMessages.firstChild);
            
            // Display terminal output if any
            if (data.terminal_output && Array.isArray(data.terminal_output)) {
                data.terminal_output.forEach(line => appendToTerminal(line));
            }
            
            console.log('Glossary successfully displayed');
        } catch (error) {
            console.error('Error displaying glossary:', error);
            appendSystemMessage(`Error displaying glossary: ${error.message}`);
        }
    })
    .catch(error => {
        console.error('Error in glossary request:', error);
        appendSystemMessage(`Error generating glossary: ${error.message}`);
    });
}