# Semantic Yarn Chat

A visualization and chat interface for interacting with document vector databases.

## Overview

Semantic Yarn Chat combines 3D visualization of vector embeddings with a natural language chat interface. It allows users to:

- Process documents into vector databases
- Visualize document embeddings in 3D space
- Ask questions about selected documents
- Generate glossaries for technical documents
- Customize visualization parameters

## Features

- **Document Management**: Upload documents or connect to Zotero
- **Vector Visualization**: Interactive 3D visualization of document embeddings
- **Chat Interface**: Ask questions about your documents
- **Glossary Generation**: Create technical glossaries with adjustable detail levels
- **Customizable Settings**: Adjust visualization parameters

## Getting Started

1. Install dependencies:
 ```
```

pip install -r requirements.txt

```plaintext

2. Start the application:
 ```

python app.py

```plaintext

3. Open your browser and navigate to:
 ```

http://localhost:5000

```plaintext

4. Start LMStudio to enable chat functionality:
- Download from [LMStudio](https://lmstudio.ai/)
- Start a local server on port 1234

## Usage

1. **Select Documents**: Choose documents with vector databases from the document panel
2. **Visualize**: View the 3D representation of document embeddings
3. **Chat**: Ask questions about your documents in the chat panel
4. **Create Glossaries**: Use the glossary slider to generate technical term explanations
5. **Customize**: Adjust visualization settings to explore different aspects of your data

## Requirements

See [requirements.md](requirements.md) for detailed dependencies.

## Documentation

For detailed documentation, see [documentation.md](documentation.md).
