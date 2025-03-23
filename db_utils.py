import os
import pymupdf4llm
import chromadb
import numpy as np
from typing import List
from pathlib import Path

from llama_index.core import Document, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.vector_stores.chroma import ChromaVectorStore

def process_document(file_path: str, file_type: str) -> List[Document]:
    """Process a document using LlamaMarkdownReader and return LlamaIndex documents."""
    from app import log_terminal  # Import here to avoid circular dependency
    log_terminal(f"Processing document: {file_path}")
    
    try:
        if file_type == 'pdf':
            llama_reader = pymupdf4llm.LlamaMarkdownReader()
            documents = llama_reader.load_data(file_path)
            log_terminal(f"Successfully loaded document: {file_path}")
            return documents
        else:
            log_terminal(f"Unsupported file type: {file_type}")
            return []
    except Exception as e:
        log_terminal(f"Error processing document: {str(e)}")
        return []

def create_chunks(documents: List[Document]) -> List[Document]:
    """Create chunks using SemanticSplitterNodeParser."""
    from app import Settings, log_terminal  # Import here to avoid circular dependency
    log_terminal("Creating text chunks...")
    
    try:
        semantic_chunker = SemanticSplitterNodeParser(
            buffer_size=1,
            breakpoint_percentile_threshold=70,
            embed_model=Settings.embed_model
        )
        
        all_nodes = semantic_chunker.get_nodes_from_documents(documents)
        chunks = [Document(text=node.get_content()) for node in all_nodes]
        
        log_terminal(f"Created {len(chunks)} chunks")
        return chunks
    except Exception as e:
        log_terminal(f"Error creating chunks: {str(e)}")
        return []

def create_vector_index(documents: List[Document], citekey: str, model_name: str):
    """Create a vector index from documents."""
    from app import Settings, log_terminal, STORAGE_DIR, create_llm  # Import here to avoid circular dependency
    log_terminal(f"Creating vector index for {citekey}...")
    
    try:
        # Configure LMStudio LLM with original settings
        llm = create_llm(model_name)
        # Set up settings
        Settings.llm = llm
        
        # Create Chroma vector store
        storage_path = os.path.join(STORAGE_DIR, f"{citekey}-index.sqlite3")
        chroma_client = chromadb.PersistentClient(path=storage_path)
        chroma_collection = chroma_client.get_or_create_collection("pdf_index")
        vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
        
        # Create and store the index
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
        
        log_terminal(f"Successfully created and stored index for {citekey}")
    except Exception as e:
        log_terminal(f"Error creating vector index: {str(e)}")
        raise

def get_or_create_index(citekey: str, file_path: str, file_type: str, model_name: str):
    """Get an existing index or create a new one."""
    from app import log_terminal, STORAGE_DIR  # Import here to avoid circular dependency
    storage_path = os.path.join(STORAGE_DIR, f"{citekey}-index.sqlite3")
    
    try:
        # Try to load existing index first
        if os.path.exists(storage_path):
            chroma_client = chromadb.PersistentClient(path=storage_path)
            chroma_collection = chroma_client.get_or_create_collection("pdf_index")
            vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            index = VectorStoreIndex.from_vector_store(vector_store=vector_store, storage_context=storage_context)
            return index
    except Exception as e:
        log_terminal(f"Error loading existing index: {str(e)}")
    
    # If loading fails or index doesn't exist, create new one
    documents = process_document(file_path, file_type)
    if not documents:
        raise ValueError(f"Failed to process document: {file_path}")
    
    chunks = create_chunks(documents)
    create_vector_index(chunks, citekey, model_name)
    
    # Load the newly created index
    chroma_client = chromadb.PersistentClient(path=storage_path)
    chroma_collection = chroma_client.get_or_create_collection("pdf_index")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex.from_vector_store(vector_store=vector_store, storage_context=storage_context)


class VectorDBManager:
    def __init__(self, app_directory):
        self.app_directory = Path(app_directory)
        self.vector_db_directory = Path("/Users/sck/workspace/zotero_chat/vector_database") # Sabit konum
        print(f"Looking for databases in: {self.vector_db_directory}")
        self.available_dbs = self._scan_for_dbs()

    def _scan_for_dbs(self):
        """Scan for Chroma databases in the specified directory only."""
        db_files = {}

        if not self.vector_db_directory.exists():
            print(f"Warning: vector-database directory not found at {self.vector_db_directory}")
            return db_files

        print(f"Scanning directory: {self.vector_db_directory}")

        # Only iterate through direct children of the directory.
        for item in self.vector_db_directory.iterdir():
            # Check if it is a directory and ends with -index.sqlite3.
            if item.is_dir() and item.name.endswith('-index.sqlite3'):
                db_name = item.name.replace('-index.sqlite3', '')
                db_path = str(item)
                db_files[db_name] = db_path
                print(f"Found database: {db_name} at {db_path}")

        print(f"Found {len(db_files)} databases: {list(db_files.keys())}")
        return db_files

    def get_available_databases(self):
        """Return list of available databases"""
        dbs = list(self.available_dbs.keys())
        print(f"Available databases: {dbs}")
        return dbs

    def get_embeddings_and_metadata(self, db_names):
        """Get embeddings and metadata from specified Chroma databases"""
        all_embeddings = []
        all_metadata = []

        for db_name in db_names:
            try:
                print(f"\nProcessing database: {db_name}")
                if db_name not in self.available_dbs:
                    print(f"Database {db_name} not found in available databases")
                    continue

                db_path = self.available_dbs[db_name]
                chroma_client = chromadb.PersistentClient(path=db_path)
                
                try:
                    chroma_collection = chroma_client.get_collection(name="pdf_index")
                    count = chroma_collection.count()
                    print(f"Found {count} items in collection")
                    
                    if count == 0:
                        print(f"Collection is empty for {db_name}")
                        continue

                    # Get all items
                    results = chroma_collection.get(
                        limit=count,
                        include=["embeddings", "metadatas", "documents"]
                    )
                    
                    if not results or "embeddings" not in results:
                        print(f"No results or embeddings for {db_name}")
                        continue

                    embeddings = results["embeddings"]
                    metadatas = results.get("metadatas", [{}] * len(embeddings))
                    ids = results.get("ids", [f"{db_name}_{i}" for i in range(len(embeddings))])

                    # Process embeddings one by one
                    for i, (embedding, metadata, id_) in enumerate(zip(embeddings, metadatas, ids)):
                        try:
                            # Convert to numpy array first
                            emb_array = np.array(embedding, dtype=np.float32)
                            
                            # Check if embedding is valid using proper numpy comparisons
                            if emb_array.size > 0 and np.any(~np.isnan(emb_array)) and np.any(~np.isinf(emb_array)):
                                # Create metadata dictionary
                                meta_dict = metadata if isinstance(metadata, dict) else {}
                                meta_dict["db_name"] = db_name
                                meta_dict["node_id"] = id_
                                
                                # Store valid embedding and metadata
                                all_embeddings.append(emb_array)
                                all_metadata.append(meta_dict)
                            else:
                                print(f"Skipping invalid embedding at index {i}")

                        except Exception as e:
                            print(f"Error processing embedding {i}: {str(e)}")
                            continue

                    print(f"Successfully processed {len(all_embeddings)} embeddings from {db_name}")

                except Exception as e:
                    print(f"Error accessing collection: {str(e)}")
                    continue

            except Exception as e:
                print(f"Error processing database {db_name}: {str(e)}")
                continue

        if not all_embeddings:
            print("No valid embeddings collected")
            return None, None

        try:
            # Stack embeddings into a single array
            stacked = np.vstack(all_embeddings)
            print(f"Final embeddings shape: {stacked.shape}")
            return stacked, all_metadata

        except Exception as e:
            print(f"Error stacking embeddings: {str(e)}")
            return None, None

    def get_database_stats(self):
        """Get statistics about each database"""
        stats = {}
        for db_name in self.available_dbs.keys():
            try:
                db_path = self.available_dbs[db_name]
                chroma_client = chromadb.PersistentClient(path=db_path)
                chroma_collection = chroma_client.get_or_create_collection("pdf_index")

                results = chroma_collection.count()
                stats[db_name] = {
                    'embedding_count': results,
                    'embedding_dimensions': len(chroma_collection.get(ids=[chroma_collection.peek()['ids'][0]])['embeddings'][0]) if results else 0,
                }

            except Exception as e:
                print(f"Error analyzing database {db_name}: {str(e)}")
                stats[db_name] = {'error': str(e)}

        return stats

