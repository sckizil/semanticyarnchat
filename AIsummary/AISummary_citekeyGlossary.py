import re


def extract_keywords(query_engine, num_keywords=4, metadata=None):
    """Extracts keywords from the document, considering metadata."""
    if metadata is None:
        raise ValueError("Metadata must be provided.")
    try:
        prompt = f"""Extract {num_keywords} of the most important and novel statements from the academic piece. 
        Try to capture all the core ideas, arguments, findings or contrubitons of the document between 1 and 7 words.
        Do not choose simple and general ones, be specific and technical. use proper terminology.
        It is a {metadata['item_type']} by authors: {metadata['authors']}. 
        My humble tags are: {metadata['tags']}. Be much more specific than me!
        Return a semicolon-separated list of statements."""
        response = query_engine.query(prompt)
        keywords_str = str(response).strip()
        keywords = [keyword.strip() for keyword in keywords_str.split(';')]
        return keywords[:num_keywords]
    except Exception as e:
        print(f"Error extracting keywords: {e}")
        return []

def explain_keyword(query_engine, keyword, metadata=None, number_of_words=250): 
    """Explains a given keyword using the document."""
    try:
        prompt = f"""Reply as an expert in {metadata['tags']}. In {number_of_words} words, explain statement '{keyword}' using the information in the document. 
        Do not repeat the statement or authors or the name of the document in your explanation. Just explain the statement.
        Do not simplify. Use proper terminology and be precise."""
        response = query_engine.query(prompt)
        explanation = str(response).strip()
       
        return explanation
    except Exception as e:
        print(f"Error explaining keyword '{keyword}': {e}")
        return None

def format_glossary(keywords_and_definitions):
    """Formats the extracted keywords and definitions into a glossary."""
    glossary = {}
    for item in keywords_and_definitions:
        keyword = str(item["keyword"]).strip()
        
        # Clean up definition
        if item["definition"]:
            definition = str(item["definition"]).strip()
            
            # Remove any markdown formatting that might be present
            definition = definition.replace('**', '')
            
            # Remove bullet points if they exist
            definition = re.sub(r'^\s*[-•*]\s*', '', definition, flags=re.MULTILINE)
            
            # Replace multiple spaces with a single space
            definition = re.sub(r'\s+', ' ', definition)
            
            # Replace multiple newlines with a single space
            definition = re.sub(r'\n+', ' ', definition)
        else:
            definition = "No definition available."
        
        glossary[keyword] = definition
    
    return glossary


