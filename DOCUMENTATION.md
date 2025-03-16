# Zotero Chat Interface - Technical Documentation

This document provides detailed technical documentation for the Zotero Chat application, focusing on the architecture, code organization, and interactions between components.

## System Architecture

The Zotero Chat interface follows a client-server architecture with Flask serving as the backend web server and a JavaScript-powered frontend for user interactions.

### High-Level Architecture Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Zotero API     │◄────►│  Zotero Chat    │◄────►│  LMStudio API   │
│  (localhost)    │      │  Application    │      │  (localhost)    │
│                 │      │                 │      │                 │
└─────────────────┘      └────────┬────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │                 │
                         │  Vector Database│
                         │  (ChromaDB)     │
                         │                 │
                         └─────────────────┘
```

## Backend Components

### Flask Application (`app.py`)

The Flask application serves as the central component, handling HTTP requests and coordinating between the various services:

1. **Route Handlers**:
   - `/` - Main route that renders the index page with document list and chat history
   - `/chat` - POST endpoint that handles chat and glossary requests

2. **Core Functions**:
   - `fetch_document_details` - Retrieves document metadata from Zotero API
   - `get_or_create_index` - Manages vector database indexes for documents
   - `process_document` - Extracts text content from PDF documents
   - `create_chunks` - Splits document text into meaningful chunks
   - `create_vector_index` - Creates and stores embeddings

### AI Summary Modules

1. **AISummary_citekeyQuestion.py**:
   - Handles multi-document queries
   - Creates document indexes and query engines
   - Fetches document details from Zotero
   - Formats query responses

2. **AISummary_citekeyGlossary.py**:
   - Extracts key terms from academic documents
   - Generates definitions for each term
   - Formats glossary output for display
   - Functions include:
     - `extract_keywords`: Identifies important terms in the document
     - `explain_keyword`: Generates definitions for each term
     - `format_glossary`: Structures the glossary output

### Data Flow in Backend

1. **Document Loading Process**:
   ```
   Zotero API -> fetch_document_details -> extract_documents_from_pdf -> chunk_text -> create_vector_index
   ```

2. **Query Processing Flow**:
   ```
   User Question -> /chat endpoint -> get_or_create_index -> create query engine -> LMStudio inference -> format response
   ```

3. **Glossary Generation Flow**:
   ```
   Glossary Request -> /chat endpoint -> extract_keywords -> explain_keyword -> format_glossary -> response
   ```

## Frontend Components

### HTML Template (`index.html`)

The main template defines three primary panels:

1. **Document Panel**:
   - Displays the list of available documents
   - Contains search functionality
   - Shows document metadata

2. **Chat Panel**:
   - Displays chat history
   - Contains input field for questions
   - Shows formatted responses including glossaries

3. **Terminal Panel**:
   - Shows application logs and debugging information
   - Contains settings controls (model name, word count, etc.)
   - Displays selected documents

### JavaScript (`main.js`)

The JavaScript file handles all dynamic interactions:

1. **Initialization Flow**:
   - `DOMContentLoaded` event listener sets up all event handlers
   - Initializes search functionality, document selection, and chat form
   - Sets up glossary slider and terminal panel

2. **Document Selection Management**:
   - `updateSelectedDocsList` function tracks selected documents
   - `handleGlossaryModeVisibility` controls glossary slider state
   - Document checkbox change event handlers update UI accordingly

3. **Chat Form Handling**:
   - Manages form submission for both regular chat and glossary modes
   - Sends AJAX requests to the backend
   - Updates UI with responses

4. **Glossary-Specific Functions**:
   - `createGlossary` initiates glossary generation requests
   - `formatGlossaryResponse` formats glossary responses with styling
   - `updateSlider` manages the glossary term count slider

### CSS Styling

The application uses a clean, terminal-inspired design with:
- Dark/light contrast for readability
- Clean typography with monospace fonts
- Responsive design for different screen sizes
- Special styling for glossary terms and definitions

## API Endpoints

### `/` (GET)

**Purpose**: Renders the main application page

**Response**:
- HTML template with:
  - List of documents from Zotero
  - Chat history from previous sessions

### `/chat` (POST)

**Purpose**: Processes chat questions and glossary requests

**Request Parameters**:
```json
{
  "question": "Your question text",
  "citekeys": ["doc1", "doc2"],
  "model_name": "meta-llama-3.1-8b-instruct",
  "word_count": 300,
  "use_refine": true,
  "glossary_mode": 0
}
```

**Response**:
```json
{
  "answer": "Formatted response text",
  "terminal_output": ["Log line 1", "Log line 2"]
}
```

**Error Response**:
```json
{
  "error": "Error message"
}
```

## Key Workflows

### Document Processing and Indexing

1. When a document is selected for the first time:
   - Backend checks if a vector database exists for the document
   - If not, it processes the PDF to extract text content
   - Text is split into chunks for better semantic understanding
   - Embeddings are generated using the BGE model
   - Vector database is created and stored for future use

2. Caching mechanism:
   - The application maintains vector databases in the `vector_database/` directory
   - Each document's database is stored in a separate file named with the citekey
   - Subsequent queries reuse existing databases for faster response

### Question Answering Process

1. Frontend collects:
   - Selected document citekeys
   - User's question
   - Model settings (name, word count, refine toggle)

2. Backend processing:
   - Loads vector databases for selected documents
   - Creates appropriate query engine:
     - Single document: direct query to the index
     - Multiple documents: ComposableGraph to query across documents
   - Sends request to LMStudio with appropriate prompts
   - Formats response for display

3. Frontend display:
   - Adds question and answer to chat history
   - Updates terminal with debug information
   - Resets UI for next question

### Glossary Generation Process

1. Frontend preparation:
   - Ensures only one document is selected
   - Sets glossary mode slider to desired number of terms (1-8)
   - Displays the "Create" button instead of regular submit

2. Backend processing:
   - Uses specialized glossary functions from AISummary_citekeyGlossary.py
   - Extracts keywords based on document content and metadata
   - Generates detailed definitions for each keyword
   - Formats response as markdown with term-definition pairs

3. Frontend formatting:
   - Processes markdown formatting
   - Applies special styling for glossary terms
   - Creates structured display with hover effects
   - Adds to chat history

## Error Handling

### Frontend Error Handling

1. **Network Errors**:
   - AJAX request failures show error messages in terminal
   - Error responses from server are displayed in chat history
   - Loading states are cleared on error

2. **UI State Errors**:
   - Glossary mode automatically disables when multiple documents are selected
   - Input validation prevents submission with no selected documents
   - Timeout mechanisms ensure UI updates correctly

### Backend Error Handling

1. **Document Processing Errors**:
   - Failed document loading is logged and reported
   - Missing documents or permissions issues are handled gracefully

2. **LLM Interaction Errors**:
   - Connection timeouts or errors are caught and reported
   - Malformed responses are sanitized before returning to frontend

3. **Vector Database Errors**:
   - Failed index creation is handled with descriptive error messages
   - File permission or storage issues are detected and reported

## Configuration and Customization

### LLM Configuration

The application is configured to use LMStudio as its LLM provider:

```python
# LMStudio settings
LMSTUDIO_BASE_URL = "http://localhost:1234/v1"
LMSTUDIO_MODEL = "meta-llama-3.1-8b-instruct"
```

To use a different LLM service:
1. Update the base URL and model name in `app.py`
2. Adjust the LMStudio initialization parameters:
   ```python
   llm = LMStudio(
       base_url=LMSTUDIO_BASE_URL,
       model_name=LMSTUDIO_MODEL,
       timeout=180,
       temperature=0.7,
       top_p=0.9,
       presence_penalty=0.1,
       frequency_penalty=0.1
   )
   ```

### Embedding Model Configuration

The application uses the BGE small embedding model:

```python
onnx_model_path = "./bge_onnx"
if not os.path.exists(onnx_model_path):
    OptimumEmbedding.create_and_save_optimum_model("BAAI/bge-small-en-v1.5", onnx_model_path)
Settings.embed_model = OptimumEmbedding(folder_name=onnx_model_path)
```

To use a different embedding model:
1. Change the model name in the `create_and_save_optimum_model` call
2. Update the folder path accordingly

## Performance Considerations

### Memory Usage

The application's memory usage depends on:
1. Number of documents processed
2. Size of vector databases
3. Complexity of queries

Recommendations:
- Process documents in batches for large libraries
- Use smaller embedding models for resource-constrained environments
- Implement index pruning for infrequently used documents

### Response Time Optimization

Factors affecting response time:
1. LLM model size and complexity
2. Number of documents being queried
3. Vector database performance

Optimization strategies:
- Use smaller, more efficient LLM models for faster responses
- Limit the number of documents in multi-document queries
- Optimize chunk size for better retrieval performance
- Consider hardware acceleration for LLM inference

## Future Extension Points

1. **Additional Document Types**:
   - Add support for more document formats (EPUB, HTML, etc.)
   - Implement specialized parsers for different document types

2. **Enhanced UI Features**:
   - Add visualization for document relationships
   - Implement side-by-side document viewing
   - Add citation formatting options

3. **Advanced LLM Features**:
   - Implement model switching for different types of questions
   - Add summarization and comparison modes
   - Support for streaming responses

4. **Integration Possibilities**:
   - Connect with reference management systems beyond Zotero
   - Support cloud-based document storage
   - Integration with academic search engines

## Data Storage and Management

### Chat History
The application stores chat history in a structured JSON format within the `data/chat_history` directory. This allows for:
- Persistent storage of conversations
- Chat history retrieval and context management
- Conversation backup and restoration

#### Structure
```
data/
└── chat_history/
    ├── chat_history.json    # Main chat history file
    └── backups/            # Automated backups
```

#### Chat History Format
The `chat_history.json` file follows this structure:
```json
{
  "conversations": [
    {
      "id": "unique_conversation_id",
      "timestamp": "ISO-8601 timestamp",
      "messages": [
        {
          "role": "user|assistant",
          "content": "message content",
          "timestamp": "ISO-8601 timestamp"
        }
      ],
      "metadata": {
        "paper_id": "associated_paper_id",
        "model_used": "model_name"
      }
    }
  ]
}
```

### Data Management Functions
- `save_chat_history()`: Persists chat messages to storage
- `load_chat_history()`: Retrieves previous conversations
- `create_chat_backup()`: Creates timestamped backups
- `cleanup_old_backups()`: Maintains backup storage limits

# File Paths and Database Management

## Application Root and File Paths

The application uses absolute paths based on the application's root directory to ensure consistent file access regardless of where the virtual environment is located. Key paths are configured as follows:

```python
# Get the absolute path of the application's root directory
APP_ROOT = os.path.dirname(os.path.abspath(__file__))

# Configuration
CHAT_HISTORY_FILE = os.path.join(APP_ROOT, 'data', 'chat_history', 'chat_history.json')
STORAGE_DIR = os.path.join(APP_ROOT, 'vector_database')
```

The application automatically creates necessary directories:
```python
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(CHAT_HISTORY_FILE), exist_ok=True)
```

## Directory Structure

```
zotero_chat/
├── data/
│   └── chat_history/
│       └── chat_history.json    # Stores chat history
├── vector_database/             # Stores document vector databases !!!THEY ARE IN A RELATIVE FOLDER RN!!!
│   └── {citekey}-index.sqlite3  # One database per document
├── static/
│   ├── css/
│   │   └── style.css           # Application styles
│   └── js/
│       └── main.js             # Frontend functionality
└── templates/
    └── index.html              # Main application template
```

## Vector Database Management

Each document's vector database is stored in a separate SQLite file named with the document's citekey:

```python
storage_path = os.path.join(STORAGE_DIR, f"{citekey}-index.sqlite3")
```

The application checks for existing vector databases before processing documents:
```python
if os.path.exists(storage_path):
    # Load existing index
    chroma_client = chromadb.PersistentClient(path=storage_path)
    chroma_collection = chroma_client.get_or_create_collection("pdf_index")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    index = VectorStoreIndex.from_vector_store(vector_store=vector_store, storage_context=storage_context)
else:
    # Create new index
    documents = process_document(file_path, file_type)
    chunks = create_chunks(documents)
    create_vector_index(chunks, citekey, model_name)
```

## Styling and UI Components

### Glossary Styling

Glossary responses have special styling to distinguish them from regular chat messages:

```css
.message.assistant.glossary-response {
    border-left: 2px solid var(--accent-color);
    padding: 1rem;
    margin-bottom: 1rem;
}

.glossary-response strong {
    color: var(--accent-color);
    font-weight: 600;
    display: block;
    margin-bottom: 0.5rem;
}

.glossary-response p {
    margin: 0 0 1.5rem 0;
    line-height: 1.6;
}
```

The template automatically applies these styles to glossary responses:
```html
{% if chat.question == "Generate glossary" or chat.question.startswith("Generate glossary") %}
<div class="message assistant glossary-response">{{ chat.answer|safe }}</div>
{% else %}
<div class="message assistant">{{ chat.answer|safe }}</div>
{% endif %}
``` 