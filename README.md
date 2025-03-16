# Zotero Chat

A web application that integrates with Zotero and LMStudio to provide an AI-powered chat interface for your research papers.

## 🚀 Quick Start

1. **Setup Virtual Environment**
   ```bash
   # Create a virtual environment in the parent directory
   python -m venv ../venv
   
   # Activate the virtual environment
   source ../venv/bin/activate  # On Unix/macOS
   ..\venv\Scripts\activate     # On Windows
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start LMStudio**
   - Launch LMStudio
   - Start the server with your chosen model
   - Ensure it's running on the default port (1234)

4. **Run the Application**
   ```bash
   # Using the provided script
   ./scripts/restart_app.sh
   
   # Or directly with Python
   python app.py
   ```

5. **Access the Application**
   - Main Web App: http://localhost:5001
   - Debug Tools: http://localhost:5001/static/debug-tools.html

## 🏗️ Architecture

### Core Components

1. **Flask Backend (`app.py`)**
   - Handles API routes and serves the web interface
   - Manages model initialization and caching
   - Provides endpoints for model selection and chat interactions

2. **Web Interface**
   - `static/index.html`: Main chat interface
   - `static/js/models.js`: Model selection and management
   - `static/js/chat.js`: Chat functionality and UI interactions
   - `static/debug-tools.html`: Diagnostic interface for troubleshooting

3. **Utility Scripts**
   - `scripts/restart_app.sh`: Restarts the application
   - `scripts/stop_app.sh`: Gracefully stops running instances
   - `scripts/cleanup.sh`: Removes redundant debug files

### API Endpoints

- `/`: Serves the main web interface
- `/api/models`: Returns available LLM models
- `/api/chat`: Handles chat interactions
- `/api/status`: Returns application status

## 🔧 Development

### Directory Structure
```
zotero_chat/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── static/            # Web assets
│   ├── css/          # Stylesheets
│   ├── js/           # JavaScript files
│   └── debug-tools.html
├── data/             # Application data
│   └── chat_history/ # Chat history storage
│       ├── chat_history.json
│       └── backups/
├── scripts/          # Utility scripts
│   ├── restart_app.sh
│   ├── stop_app.sh
│   └── cleanup.sh
└── README.md         # This file
```

### Key Functions

1. **Model Management**
   - `initialize_app()`: Sets up application state
   - `fetch_models_with_retry()`: Retrieves models from LMStudio
   - `get_models()`: API endpoint for model list

2. **Chat Interface**
   - `fetchAvailableModels()`: Updates model dropdown
   - `initializeChat()`: Sets up chat UI
   - `handleMessage()`: Processes user messages

### Debugging

1. **Using Debug Tools**
   - Open http://localhost:5001/static/debug-tools.html
   - Check API connections and model availability
   - View detailed error messages and status

2. **Common Issues**
   - Model dropdown not updating: Check browser console and network tab
   - Connection errors: Verify LMStudio is running
   - Port conflicts: Use `lsof -i :5001` to check port usage

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🔒 Security

- API keys and sensitive data should be stored in environment variables
- CORS is enabled for local development only
- Debug tools should not be exposed in production

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 