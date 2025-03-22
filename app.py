from flask import Flask, render_template, request, jsonify
import requests
import bibtexparser
from typing import List, Dict, Any
import os
import json
from datetime import datetime
from llama_index.core import (
    VectorStoreIndex,
    ComposableGraph,
    Settings,
)
from llama_index.embeddings.huggingface_optimum import OptimumEmbedding
from llama_index.llms.lmstudio import LMStudio
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.callbacks import CallbackManager, LlamaDebugHandler


import re
import time
from flask_cors import CORS
import numpy as np
from pathlib import Path

from glossaryCreation import extract_keywords, explain_keyword, format_glossary
from fetchDocuments import fetch_document_details
from db_utils import VectorDBManager, get_or_create_index



app = Flask(__name__)
CORS(app)

# Get the absolute path of the application's root directory
APP_ROOT = os.path.dirname(os.path.abspath(__file__))

# Configuration
CHAT_HISTORY_FILE = os.path.join(APP_ROOT, 'data', 'chat_history', 'chat_history.json')
STORAGE_DIR = os.path.join(APP_ROOT, 'vector_database')
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(CHAT_HISTORY_FILE), exist_ok=True)  # Ensure chat history directory exists

# LMStudio settings
LMSTUDIO_BASE_URL = "http://localhost:1234/v1"
DEFAULT_MODEL = "meta-llama-3.1-8b-instruct"

# Global variable to store available models
AVAILABLE_MODELS = [DEFAULT_MODEL]

def initialize_models():
    """Initialize models by querying LMStudio API."""
    global AVAILABLE_MODELS
    
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            response = requests.get(f"{LMSTUDIO_BASE_URL}/models", timeout=5)
            if response.status_code == 200:
                models_data = response.json()
                if 'data' in models_data and isinstance(models_data['data'], list):
                    models = [model['id'] for model in models_data['data'] if 'id' in model]
                    if models:
                        AVAILABLE_MODELS = models
                        # Ensure default model is always available
                        if DEFAULT_MODEL not in AVAILABLE_MODELS:
                            AVAILABLE_MODELS.insert(0, DEFAULT_MODEL)
                        return True
            
            print(f"Failed to fetch models (status: {response.status_code})")
        except Exception as e:
            print(f"Error fetching models: {str(e)}")
        
        retry_count += 1
        if retry_count < max_retries:
            time.sleep(2 * retry_count)
    
    print(f"\nWarning: Using default model only: {DEFAULT_MODEL}")
    AVAILABLE_MODELS = [DEFAULT_MODEL]
    return False

def initialize_app():
    """Initialize the application state."""
    print("\nInitializing application...")
    initialize_models()

# Initialize OptimumEmbedding
onnx_model_path = "./bge_onnx"
if not os.path.exists(onnx_model_path):
    OptimumEmbedding.create_and_save_optimum_model("BAAI/bge-small-en-v1.5", onnx_model_path)
Settings.embed_model = OptimumEmbedding(folder_name=onnx_model_path)

# Terminal output buffer
terminal_output_buffer = []

def create_llm(model_name: str) -> LMStudio:
    """Create an LMStudio instance with the specified model name."""
    return LMStudio(
        base_url=LMSTUDIO_BASE_URL,
        model_name=model_name,
        timeout=400,
        temperature=0.7,
        top_p=0.9,
        presence_penalty=0.1,
        frequency_penalty=0.1
    )

def log_terminal(message: str):
    """Add a message to the terminal output buffer."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    terminal_output_buffer.append(f"[{timestamp}] {message}")

def get_terminal_output() -> List[str]:
    """Get the current terminal output and clear the buffer."""
    output = terminal_output_buffer.copy()
    terminal_output_buffer.clear()
    return output

def load_chat_history() -> List[Dict[str, Any]]:
    """Load chat history from JSON file."""
    try:
        if os.path.exists(CHAT_HISTORY_FILE):
            with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
                
                # Ensure each entry has required fields
                valid_history = []
                for entry in history:
                    if all(key in entry for key in ['timestamp', 'question', 'answer', 'citekeys']):
                        # Clean up HTML content if present
                        if isinstance(entry['answer'], dict):
                            # Handle case where answer is a dictionary
                            entry['answer'] = '\n'.join(f"**{k}**: {v}" for k, v in entry['answer'].items())
                        else:
                            entry['answer'] = str(entry['answer'])
                        
                        # Remove any HTML tags
                        entry['answer'] = re.sub(r'<[^>]*>', '', entry['answer'])
                        valid_history.append(entry)
                
                # Sort by timestamp in reverse order (newest first)
                return sorted(valid_history, key=lambda x: x['timestamp'], reverse=True)
        return []
    except Exception as e:
        print(f"Error loading chat history: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return []

def save_chat_history(question: str, answer: str, citekeys: List[str]):
    """Save a chat entry to the history file."""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(CHAT_HISTORY_FILE), exist_ok=True)
        
        # Load existing history
        try:
            if os.path.exists(CHAT_HISTORY_FILE):
                with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            else:
                history = []
        except json.JSONDecodeError:
            print("Warning: Corrupted chat history file. Starting fresh.")
            history = []
        
        # Create a new entry
        entry = {
            'timestamp': datetime.now().isoformat(),
            'question': str(question),
            'answer': str(answer),
            'citekeys': list(citekeys)  # Ensure citekeys is a list
        }
        
        # Add the new entry
        history.append(entry)
        
        # Sort by timestamp (newest first)
        history = sorted(history, key=lambda x: x['timestamp'], reverse=True)
        
        # Save to file with proper encoding
        with open(CHAT_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"Error saving chat history: {str(e)}")
        import traceback
        print(traceback.format_exc())



@app.route('/', methods=['GET', 'POST'])
def index():
    """Render the main page."""
    initialize_app()  # Ensure models are initialized
    chat_history = load_chat_history()
    # Get all documents from Zotero API (BibTeX only)
    available_dbs = db_manager.get_available_databases()
    print(f"Available databases: {available_dbs}")
    
    if request.method == 'POST':
        try:
            selected_dbs = request.form.getlist('databases[]') or request.form.getlist('databases')
            if not selected_dbs:
                return jsonify({'error': 'No databases selected'}), 400

            x_dim = int(request.form.get('x_dimension', 0))
            y_dim = int(request.form.get('y_dimension', 1))
            z_dim = int(request.form.get('z_dimension', 2))
            v_dim = int(request.form.get('w_dimension', 3))  # Velocity dimension
            p_dim = int(request.form.get('v_dimension', 4))  # Point size dimension
            c_dim = int(request.form.get('color_dimension', 5))  # Color dimension
            u_dim = int(request.form.get('undulation_dimension', 6))  # Undulation dimension
            a_dim = int(request.form.get('amplitude_dimension', 7))  # Wave amplitude dimension
            ph_dim = int(request.form.get('phase_dimension', 8))  # Wave phase dimension
            sf_dim = int(request.form.get('scatter_frequency', 9))  # Scatter frequency dimension
            sl_dim = int(request.form.get('scatter_length', 10))  # Scatter length dimension
            sc_dim = int(request.form.get('scatter_color', 11))  # Scatter color dimension
            viz_type = request.form.get('viz_type', '3d')
            
            print(f"Processing request: dims=({x_dim}, {y_dim}, {z_dim}, {v_dim}, {p_dim}, {c_dim}, {u_dim}, {a_dim}, {ph_dim}, {sf_dim}, {sl_dim}, {sc_dim}), type={viz_type}, dbs={selected_dbs}")
            
            embeddings, metadata = db_manager.get_embeddings_and_metadata(selected_dbs)
            if embeddings is None or len(embeddings) == 0:
                return jsonify({'error': 'No embeddings found in selected databases'}), 400
            
            print(f"Retrieved embeddings shape: {embeddings.shape}")
            print(f"Sample of raw embeddings: {embeddings[:3]}")
            
            # Normalize embeddings to [-1, 1] range for better visualization
            embeddings_min = embeddings.min(axis=0)
            embeddings_max = embeddings.max(axis=0)
            embeddings_norm = 2 * (embeddings - embeddings_min) / (embeddings_max - embeddings_min) - 1
            
            print(f"Sample of normalized embeddings: {embeddings_norm[:3]}")
            
            # Prepare points data including all required dimensions
            dimensions = [x_dim, y_dim, z_dim, v_dim, p_dim, c_dim, u_dim, a_dim, ph_dim, sf_dim, sl_dim, sc_dim]
            print(f"Using dimensions: {dimensions}")
            
            # Ensure all dimensions are valid
            max_dim = embeddings_norm.shape[1] - 1
            valid_dimensions = [min(d, max_dim) for d in dimensions]
            if valid_dimensions != dimensions:
                print(f"Warning: Some dimensions were out of range. Max dimension is {max_dim}. Using {valid_dimensions}")
                dimensions = valid_dimensions
            
            points = embeddings_norm[:, dimensions].tolist()
            
            # Generate colors based on database
            unique_dbs = list(set(m['db_name'] for m in metadata))
            colors = [f'hsl({h},70%,50%)' for h in np.linspace(0, 360, len(unique_dbs))]
            color_map = dict(zip(unique_dbs, colors))
            point_colors = [color_map[m['db_name']] for m in metadata]
            
            # Prepare metadata for tooltips
            point_metadata = [{
                'database': m['db_name'],
                **{k: v for k, v in m.items() if k != 'db_name'}
            } for m in metadata]
            
            return jsonify({
                'points': points,
                'colors': point_colors,
                'metadata': point_metadata,
                'dimensions': {
                    'x': x_dim,
                    'y': y_dim,
                    'z': z_dim,
                    'v': v_dim,  # Velocity
                    'p': p_dim,  # Point size
                    'c': c_dim,  # Color
                    'u': u_dim,  # Undulations
                    'a': a_dim,  # Wave amplitude
                    'ph': ph_dim,  # Wave phase
                    'sf': sf_dim,  # Scatter frequency
                    'sl': sl_dim,  # Scatter length
                    'sc': sc_dim  # Scatter color
                }
            })
            
        except Exception as e:
            import traceback
            print(f"Error generating visualization: {str(e)}")
            print(traceback.format_exc())
            return jsonify({'error': str(e)}), 500
    
    documents = []
    response = requests.get("http://localhost:23119/api/users/0/items?format=bibtex")
    if response.status_code == 200:
        bibtex_data = response.content.decode("utf-8")
        bib_database = bibtexparser.loads(bibtex_data, parser=bibtexparser.bparser.BibTexParser(common_strings=True))
        for item in bib_database.entries:
            citekey = item.get("ID")
            if citekey:
                # Check if vector database exists
                storage_path = os.path.join(STORAGE_DIR, f"{citekey}-index.sqlite3")
                has_vector_db = os.path.exists(storage_path)
                documents.append({
                    "citekey": citekey,
                    "title": item.get("title", "Untitled").replace("{", "").replace("}", ""),
                    "authors": item.get("author", "").replace("{", "").replace("}", ""),
                    "year": item.get("year", ""),
                    "folder_path": "",  # Will be fetched when needed
                    "has_vector_db": has_vector_db
                })

    return render_template('index.html', chat_history=chat_history, documents=documents, available_dbs=available_dbs)

@app.route('/chat', methods=['POST'])
def chat():
    print("Chat route called")
    try:
        data = request.get_json()
        print("Received data:", data)
        
        question = data.get('question')
        citekeys = data.get('citekeys', [])
        model_name = data.get('model_name', 'llama2')
        word_count = data.get('word_count', 300)
        use_refine = data.get('use_refine', False)
        glossary_mode = data.get('glossary_mode', 0)
        
        print(f"Processing request with: question='{question}', citekeys={citekeys}, model_name='{model_name}', word_count={word_count}, use_refine={use_refine}, glossary_mode={glossary_mode}")
        
        if not question or not citekeys:
            print("Error: Missing question or citekeys")
            return jsonify({'error': 'Missing question or citekeys'})
        
        try:
            # Handle glossary mode
            if glossary_mode > 0:
                print("=" * 50)
                print(f"GLOSSARY MODE ACTIVATED WITH VALUE: {glossary_mode}")
                print(f"Selected citekeys: {citekeys}")
                print("=" * 50)
                
                # Ensure only one document is selected for glossary mode
                if len(citekeys) > 1:
                    print("Error: Glossary mode only supports a single document")
                    return jsonify({'error': 'Glossary mode only supports a single document. Please select just one document.'})
                
                try:
                    print("Successfully imported glossary functions")
                    
                    # Get document details for each citekey
                    all_keywords = []
                    glossary_query_engine = None  # Initialize query engine variable
                    
                    for citekey in citekeys:
                        print(f"Processing citekey: {citekey}")
                        doc_details = fetch_document_details(citekey)
                        if not doc_details or citekey not in doc_details:
                            print(f"Could not fetch details for citekey: {citekey}")
                            continue
                            
                        metadata = doc_details[citekey]
                        folder_path = metadata.get('folder_path')
                        if not folder_path:
                            print(f"No folder path found for citekey: {citekey}")
                            continue
                            
                        pdf_files = [f for f in os.listdir(folder_path) if f.endswith('.pdf')]
                        if not pdf_files:
                            print(f"No PDF files found in folder: {folder_path}")
                            continue
                            
                        file_path = os.path.join(folder_path, pdf_files[0])
                        print(f"Found PDF file: {file_path}")
                        
                        # Create or get index
                        try:
                            index = get_or_create_index(citekey, file_path, 'pdf', model_name)
                            print(f"Successfully got/created index for {citekey}")
                        except Exception as e:
                            print(f"Error creating/getting index for {citekey}: {str(e)}")
                            continue
                        
                        # Create query engine
                        try:
                            # Configure LLM for glossary mode
                            llm = create_llm(model_name)
                            Settings.llm = llm
                            print(f"Using model for glossary: {model_name}")
                            
                            glossary_query_engine = index.as_query_engine(
                                response_mode="refine",
                                verbose=False,
                            )
                            print(f"Created query engine for {citekey}")
                            print(f"Query engine type: {type(glossary_query_engine)}")
                        except Exception as e:
                            print(f"Error creating query engine for {citekey}: {str(e)}")
                            continue
                        
                        # Extract keywords
                        try:
                            num_keywords = glossary_mode  # Extract num_keywords from glossary_mode
                            keywords = extract_keywords(glossary_query_engine, num_keywords=num_keywords, metadata=metadata)
                            print(f"Extracted keywords for {citekey}: {keywords}")
                            all_keywords.extend(keywords)
                        except Exception as e:
                            print(f"Error extracting keywords for {citekey}: {str(e)}")
                            continue
                    
                    if not all_keywords:
                        print("No keywords found in any documents")
                        return jsonify({'error': 'No keywords found in documents'})
                    
                    # Generate definitions
                    try:
                        keywords_and_definitions = []
                        for keyword in all_keywords:
                            print(f"Processing keyword: {keyword}")
                            definition = explain_keyword(glossary_query_engine, keyword, metadata=metadata, number_of_words=word_count)
                            print(f"Got definition type: {type(definition)}")
                            if definition:
                                # Ensure both keyword and definition are strings
                                keyword_str = str(keyword).strip()
                                definition_str = str(definition).strip()
                                keywords_and_definitions.append({
                                    "keyword": keyword_str,
                                    "definition": definition_str
                                })
                        
                        print("Keywords and definitions before formatting:", keywords_and_definitions)
                        glossary = format_glossary(keywords_and_definitions)
                        print(f"Glossary after formatting: {glossary}")
                        print(f"Glossary type: {type(glossary)}")
                    except Exception as e:
                        print(f"Error generating definitions: {str(e)}")
                        print(f"Error type: {type(e)}")
                        import traceback
                        print(f"Traceback: {traceback.format_exc()}")
                        return jsonify({'error': f'Error generating definitions: {str(e)}'})
                    
                    try:
                        # Format response with markdown (not HTML)
                        response_parts = []  # No introductory text
                        for keyword, definition in glossary.items():
                            # Ensure both keyword and definition are properly formatted strings
                            keyword_clean = str(keyword).strip()
                            definition_clean = str(definition).strip().replace('\n', ' ').replace('\r', '')
                            # Format with markdown - ensure we use consistent format
                            response_parts.append(f'**{keyword_clean}**: {definition_clean}\n\n')
                        
                        response = ''.join(response_parts)
                        print("Final response:", response)
                        
                        # Save glossary to chat history
                        try:
                            save_chat_history(
                                question=f"Generate glossary {num_keywords} mode keywords",
                                answer=response,
                                citekeys=citekeys
                            )
                            print("Successfully saved glossary to chat history")
                        except Exception as e:
                            print(f"Error saving glossary to chat history: {str(e)}")
                        
                        return jsonify({
                            'answer': response,
                            'terminal_output': get_terminal_output()
                        })
                    except Exception as e:
                        print(f"Error formatting response: {str(e)}")
                        print(f"Error type: {type(e)}")
                        import traceback
                        print(f"Traceback: {traceback.format_exc()}")
                        return jsonify({'error': f'Error formatting response: {str(e)}'})
                    
                except Exception as e:
                    print(f"Error in glossary mode: {str(e)}")
                    print(f"Error type: {type(e)}")
                    import traceback
                    print(f"Traceback: {traceback.format_exc()}")
                    return jsonify({'error': f'Error in glossary mode: {str(e)}'})
            
            # Create or load indexes for selected documents
            indexes = []
            for citekey in citekeys:
                # Get document details and file path
                item_details = fetch_document_details(citekey)
                if not item_details or citekey not in item_details:
                    log_terminal(f"Could not fetch details for document: {citekey}")
                    continue
                    
                folder_path = item_details[citekey].get('folder_path')
                if not folder_path:
                    log_terminal(f"No folder path found for document: {citekey}")
                    continue
                    
                # Look for PDF files in the folder
                pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf')]
                if not pdf_files:
                    log_terminal(f"No PDF files found in folder: {folder_path}")
                    continue
                    
                file_path = os.path.join(folder_path, pdf_files[0])
                index = get_or_create_index(citekey, file_path, 'pdf', model_name)
                if index:
                    indexes.append(index)

            if not indexes:
                return jsonify({'error': 'No valid indexes found for selected documents'})

            # For chat mode, handle differently based on number of documents
            print(f"Creating query engine for {len(indexes)} documents...")
            try:
                # Configure LLM explicitly
                llm = create_llm(model_name)
                Settings.llm = llm
                
                # Set response mode
                response_mode = "refine" if use_refine else "tree_summarize"
                print(f"Using response_mode: {response_mode}")
                print(f"Using model: {model_name}")
                
                
                # If only one document is selected, use its index directly
                if len(indexes) == 1:
                    print("Using single index directly (bypassing ComposableGraph)")
                    query_engine = indexes[0].as_query_engine(
                        response_mode=response_mode,
                        verbose=False
                    )
                    print(f"Created query engine for single document, type: {type(query_engine).__name__}")
                # If multiple documents, use ComposableGraph
                else:
                    print("Creating ComposableGraph for multiple documents...")
                    index_summaries = [f"Document {i+1}" for i in range(len(indexes))]
                    
                    # Fix: Use VectorStoreIndex as the first parameter, not a string
                    # This matches your original implementation in AISummary_citekeyQuestion.py
                    graph = ComposableGraph.from_indices(
                        VectorStoreIndex,  # Use proper class instead of string "root"
                        indexes,
                        index_summaries=index_summaries
                    )
                    print("Graph created successfully")
                    
                    # Create query engine from graph
                    query_engine = graph.as_query_engine(
                        response_mode=response_mode,
                        verbose=False
                    )
                    print(f"Created query engine from graph, type: {type(query_engine).__name__}")
                
                # Execute query 
                print(f"Executing query with question: {question}")
                
                try:
                    # Handle query execution
                    formatted_question_with_word_count = f"""In {word_count} words, answer the question '{question}' using the information in the document. 
                    Reply as an expert in topic. Do not simplify. Use proper terminology and be precise."""
                    response = query_engine.query(formatted_question_with_word_count)
                    print(f"Response received, type: {type(response).__name__}")
                    
                    # Convert to string safely
                    if hasattr(response, 'response'):
                        answer_text = str(response.response).strip()
                    else:
                        answer_text = str(response).strip()
                    
                    # Ensure the answer is clean text without HTML tags
                    answer_text = re.sub(r'<[^>]*>', '', answer_text)
                        
                    print(f"Answer text length: {len(answer_text)}")
                    
                    # Save chat history
                    save_chat_history(question, answer_text, citekeys)
                    print("Chat history saved successfully")
                    
                    return jsonify({
                        'answer': answer_text,
                        'terminal_output': get_terminal_output()
                    })
                except Exception as e:
                    print(f"Error executing query: {str(e)}")
                    print(f"Error type: {type(e).__name__}")
                    import traceback
                    print(f"Traceback: {traceback.format_exc()}")
                    return jsonify({'error': f'Error executing query: {str(e)}'})

            except Exception as e:
                print(f"Error in chat mode: {str(e)}")
                print(f"Error type: {type(e).__name__}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                return jsonify({'error': f'Error in chat mode: {str(e)}'})

        except Exception as e:
            log_terminal(f"Error: {str(e)}")
            return jsonify({'error': str(e)})

    except Exception as e:
        print("=" * 80)
        print(f"GLOBAL ERROR: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Full traceback:")
        traceback.print_exc()
        print("=" * 80)
        return jsonify({'error': f'Global error: {str(e)}'})

@app.route('/api/models', methods=['GET'])
def get_models():
    """Returns the list of available models."""
    return jsonify({
        'models': AVAILABLE_MODELS,
        'default': DEFAULT_MODEL,
        'success': True,
        'count': len(AVAILABLE_MODELS)
    })

# Initialize the database manager with proper path resolution
app_dir = Path(os.path.dirname(os.path.abspath(__file__)))
print(f"App directory: {app_dir}")

db_manager = VectorDBManager(app_dir)



@app.route('/db_info')
def db_info():
    """Get information about available databases"""
    available_dbs = db_manager.get_available_databases()
    return jsonify({'databases': available_dbs})



if __name__ == '__main__':
    # Print startup banner only once
    print("\n" + "="*80)
    print("STARTING ZOTERO CHAT APPLICATION")
    print("="*80 + "\n")
    
    print("\nStarting Flask application on port 5001...")
    app.run(debug=True, port=5001)