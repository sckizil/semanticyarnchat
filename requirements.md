
# Requirements for Semantic Yarn Chat

## Python Dependencies

Flask==2.3.3
Flask-CORS==4.0.0
Flask-SocketIO==5.3.4
bibtexparser==1.4.0
numpy==1.24.3
pymupdf4llm==0.1.1
chromadb==0.4.18
llama-index==0.9.11
llama-index-embeddings-huggingface-optimum==0.1.3
llama-index-llms-lmstudio==0.1.3


## JavaScript Dependencies

- Three.js (0.128.0)
- Socket.IO client

## External Services

### LMStudio
- Required for LLM functionality
- Must be running locally on port 1234
- Download from: https://lmstudio.ai/

### Zotero
- Optional for document metadata retrieval
- Zotero API must be accessible at http://localhost:23119/api/

## System Requirements

- **Operating System**: macOS, Windows, or Linux
- **Browser**: Modern browser with WebGL support (Chrome, Firefox, Safari)
- **RAM**: Minimum 8GB, 16GB recommended for larger documents
- **Storage**: At least 1GB free space for vector databases
- **GPU**: Recommended for better visualization performance

## Development Requirements

- Node.js and npm (for frontend development)
- Python 3.9+ with pip
- Git