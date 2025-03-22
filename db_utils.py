import chromadb
import numpy as np
import os
from pathlib import Path

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
                db_path = self.available_dbs[db_name]
                chroma_client = chromadb.PersistentClient(path=db_path)
                chroma_collection = chroma_client.get_or_create_collection("pdf_index")

                results = chroma_collection.get(include=["embeddings", "metadatas"])

                if results and 'embeddings' in results:
                    embeddings = results['embeddings']
                    metadatas = results['metadatas']
                    print(f"Found {len(embeddings)} embeddings in {db_name}")

                    for i, embedding in enumerate(embeddings):
                        all_embeddings.append(np.array(embedding))
                        metadata = metadatas[i]
                        metadata['db_name'] = db_name # db_name ekliyoruz.
                        all_metadata.append(metadata)
                else:
                    print(f"No embeddings found in {db_name}")

            except Exception as e:
                print(f"Error processing database {db_name}: {str(e)}")

        if all_embeddings:
            try:
                # Check if all embeddings have the same dimension
                dims = [e.shape[0] for e in all_embeddings]
                if len(set(dims)) > 1:
                    print(f"Warning: Found embeddings with different dimensions: {set(dims)}")
                    # Use the most common dimension
                    from collections import Counter
                    target_dim = Counter(dims).most_common(1)[0][0]
                    print(f"Using most common dimension: {target_dim}")
                    # Filter embeddings and metadata to only include those with the target dimension
                    filtered = [(e, m) for e, m, d in zip(all_embeddings, all_metadata, dims) if d == target_dim]
                    if filtered:
                        all_embeddings, all_metadata = zip(*filtered)
                    else:
                        return None, None
                else:
                    print(f"All embeddings have dimension {dims[0]}")
                
                stacked_embeddings = np.vstack(all_embeddings)
                print(f"Sample of retrieved embeddings: {all_embeddings[:3]}")
                print(f"Sample of retrieved metadata: {all_metadata[:3]}")
                return stacked_embeddings, all_metadata
            except ValueError as e:
                print(f"Error stacking embeddings: {str(e)}")
                return None, None
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