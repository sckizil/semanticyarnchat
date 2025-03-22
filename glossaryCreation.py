import re


def extract_keywords(query_engine, num_keywords=4, metadata=None):
    """Extracts keywords from the document, considering metadata."""
    if metadata is None:
        raise ValueError("Metadata must be provided.")
    try:
        # More specific prompt for better keyword extraction
        prompt = f"""As an expert analyzing this academic {metadata['item_type']}, identify exactly {num_keywords} key technical concepts or findings.

        Requirements:
        1. Extract exactly {num_keywords} distinct technical concepts
        2. Each concept should be 1-7 words long
        3. Focus on novel, specific, and technical terminology
        4. Avoid basic or general concepts
        5. Consider the authors' ({metadata['authors']}) main contributions
        6. Look beyond these basic tags: {metadata['tags']}

        Format: Return ONLY a semicolon-separated list of concepts, nothing else.
        """
        
        response = query_engine.query(prompt)
        keywords_str = str(response).strip()
        # Clean up and validate the response
        keywords = [k.strip() for k in keywords_str.split(';') if k.strip()]
        
        # Ensure we have exactly the requested number of keywords
        if len(keywords) > num_keywords:
            keywords = keywords[:num_keywords]
        elif len(keywords) < num_keywords:
            # Request more keywords if we didn't get enough
            remaining = num_keywords - len(keywords)
            additional_prompt = f"""Provide {remaining} more technical concepts from the document, different from: {'; '.join(keywords)}
            Format: semicolon-separated list only."""
            
            additional_response = query_engine.query(additional_prompt)
            additional_keywords = [k.strip() for k in str(additional_response).strip().split(';') if k.strip()]
            keywords.extend(additional_keywords[:remaining])
        
        return keywords[:num_keywords]
    except Exception as e:
        print(f"Error extracting keywords: {e}")
        return []

def explain_keyword(query_engine, keyword, metadata=None, number_of_words=250):
    """Explains a given keyword using the document."""
    try:
        # More specific prompt for better explanations
        prompt = f"""As an expert in {metadata['tags']}, explain the concept: '{keyword}'

        Requirements:
        1. Use exactly {number_of_words} words
        2. Focus only on explaining '{keyword}' as used in this document
        3. Use technical, precise language - do not simplify
        4. Do not mention the concept name, authors, or document title
        5. Start directly with the explanation

        Format: Provide only the explanation, no introductions or conclusions."""
        
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


