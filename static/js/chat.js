class ChatManager {
    constructor() {
        this.initializeChat();
    }

    initializeChat() {
        this.chatForm = document.getElementById('chatForm');
        this.questionInput = document.getElementById('questionInput');
        this.chatMessages = document.getElementById('chatMessages');
        this.bindEvents();
    }

    bindEvents() {
        this.chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChatSubmit();
        });
    }

    async handleChatSubmit() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        const currentValue = window.currentValue || 0; // Get from global state
        
        if (currentValue > 0) {
            console.log('Form submitted while in glossary mode - triggering glossary creation');
            this.createGlossary();
            return;
        }

        const selectedCitekeys = this.getSelectedCitekeys();
        if (selectedCitekeys.length === 0) {
            this.appendSystemMessage('Please select at least one document.');
            return;
        }

        await this.sendChatRequest(question, selectedCitekeys);
    }

    getSelectedCitekeys() {
        return Array.from(document.querySelectorAll('.doc-checkbox:checked'))
            .map(checkbox => checkbox.id.replace('doc-', ''));
    }

    async sendChatRequest(question, selectedCitekeys) {
        this.setInputsDisabled(true);

        try {
            const modelSelect = document.getElementById('modelSelect');
            const wordCountInput = document.getElementById('wordCount');
            const refineToggle = document.getElementById('refineToggle');
            
            const requestData = {
                question: question,
                citekeys: selectedCitekeys,
                model_name: modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct',
                word_count: parseInt(wordCountInput.value),
                use_refine: refineToggle.checked,
                glossary_mode: window.currentValue || 0
            };

            const response = await fetch('http://localhost:5001/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            this.appendChatMessage(question, data.answer);
            this.updateTerminalOutput(data.terminal_output);
            this.questionInput.value = '';

        } catch (error) {
            console.error('Chat request error:', error);
            this.appendSystemMessage(`Error: ${error.message}`);
        } finally {
            this.setInputsDisabled(false);
            this.questionInput.focus();
        }
    }

    setInputsDisabled(disabled) {
        this.questionInput.disabled = disabled;
        document.getElementById('searchInput').disabled = disabled;
        document.querySelectorAll('.doc-checkbox').forEach(checkbox => {
            checkbox.disabled = disabled;
        });
    }

    appendChatMessage(question, answer) {
        const chatItem = document.createElement('div');
        chatItem.className = 'message-group';
        
        const timestamp = new Date().toISOString();
        const selectedCitekeys = this.getSelectedCitekeys();
        
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
        
        this.chatMessages.insertBefore(chatItem, this.chatMessages.firstChild);
    }

    appendSystemMessage(message) {
        console.log('System message:', message);
        const systemItem = document.createElement('div');
        systemItem.className = 'message-group';
        systemItem.innerHTML = `
            <div class="message">
                <div class="message-content">${message}</div>
            </div>
        `;
        this.chatMessages.insertBefore(systemItem, this.chatMessages.firstChild);
        this.updateTerminalOutput(message);
    }

    updateTerminalOutput(output) {
        const terminalContent = document.getElementById('terminalContent');
        if (!terminalContent) return;

        if (Array.isArray(output)) {
            output.forEach(line => this.appendTerminalLine(terminalContent, line));
        } else if (typeof output === 'string') {
            this.appendTerminalLine(terminalContent, output);
        }
    }

    appendTerminalLine(terminalContent, text) {
        const lineElement = document.createElement('div');
        lineElement.textContent = text;
        terminalContent.appendChild(lineElement);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    async createGlossary() {
        const selectedCitekeys = this.getSelectedCitekeys();
        
        if (selectedCitekeys.length === 0) {
            this.appendSystemMessage('Please select at least one document for the glossary.');
            return;
        }
        
        if (selectedCitekeys.length > 1) {
            this.appendSystemMessage('Glossary mode only works with a single document. Please select just one document.');
            return;
        }

        // Get glossary value directly from GlossaryManager
        let glossaryValue;
        try {
            if (!window.glossaryManager) {
                console.error('GlossaryManager not initialized');
                this.appendSystemMessage('Error: Glossary system not properly initialized');
                return;
            }
            glossaryValue = window.glossaryManager.getCurrentValue();
            console.log('Retrieved glossary value:', glossaryValue);
        } catch (error) {
            console.error('Error getting glossary value:', error);
            this.appendSystemMessage('Error: Could not get glossary settings');
            return;
        }

        if (!glossaryValue || glossaryValue <= 0) {
            this.appendSystemMessage('Please set the number of glossary terms (1-8).');
            return;
        }

        try {
            // Disable inputs during processing
            this.setInputsDisabled(true);
            const glossaryBtn = document.getElementById('glossaryCreateBtn');
            if (glossaryBtn) {
                glossaryBtn.disabled = true;
                glossaryBtn.textContent = 'Generating...';
                glossaryBtn.style.opacity = '0.5';
            }

            const modelSelect = document.getElementById('modelSelect');
            const wordCountInput = document.getElementById('wordCount');
            const refineToggle = document.getElementById('refineToggle');

            const requestData = {
                question: "Generate glossary",
                citekeys: selectedCitekeys,
                model_name: modelSelect ? modelSelect.value : 'meta-llama-3.1-8b-instruct',
                word_count: parseInt(wordCountInput.value) || 300,
                use_refine: refineToggle ? refineToggle.checked : false,
                glossary_mode: glossaryValue
            };

            console.log('Sending glossary request with:', requestData);

            const response = await fetch('http://localhost:5001/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.answer) {
                throw new Error('No glossary content received from server.');
            }

            this.appendChatMessage(
                `Generate glossary with ${glossaryValue} terms`, 
                data.answer
            );

            if (data.terminal_output) {
                this.updateTerminalOutput(data.terminal_output);
            }

        } catch (error) {
            console.error('Glossary creation error:', error);
            this.appendSystemMessage(`Error generating glossary: ${error.message}`);
        } finally {
            // Re-enable inputs
            this.setInputsDisabled(false);
            const glossaryBtn = document.getElementById('glossaryCreateBtn');
            if (glossaryBtn) {
                glossaryBtn.disabled = false;
                glossaryBtn.textContent = 'Create';
                glossaryBtn.style.opacity = '1';
            }
        }
    }

    exportMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;

        const question = messageElement.querySelector('.message-question').textContent;
        const answer = messageElement.querySelector('.message-content').textContent;
        const timestamp = messageElement.querySelector('.timestamp').textContent;
        const citekeys = Array.from(messageElement.querySelectorAll('.citekey'))
            .map(el => el.textContent)
            .join(', ');

        const markdown = `# Chat Message Export
Date: ${timestamp}
Documents: ${citekeys}

## Question
${question}

## Answer
${answer}
`;

        this.downloadMarkdown(markdown, `chat_message_${timestamp.replace(/[-: ]/g, '')}.md`);
    }

    downloadMarkdown(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export for use in other files
window.ChatManager = ChatManager;
