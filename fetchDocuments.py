import os
import re
import requests
import bibtexparser



ZOTERO_API_URL = "http://localhost:23119/api/users/0/items?format=bibtex"


def clean_field(field):
    return field.replace("{", "").replace("}", "").strip() if field else ""


def fetch_document_details(citekey):
    """Fetches document details from Zotero API using citekeys."""
    document_details = {}
    response = requests.get(ZOTERO_API_URL)
    if response.status_code != 200:
        print(f"Failed to fetch data for citekey: {citekey}, status code: {response.status_code}")
        document_details[citekey] = None
    else:
        print(f"Data fetched for citekey: {citekey}")
    bibtex_data = response.content.decode("utf-8")
    bib_database = bibtexparser.loads(bibtex_data, parser=bibtexparser.bparser.BibTexParser(common_strings=True))
    for item in bib_database.entries:
        if item.get("ID") == citekey:
            folder_path = extract_folder(item.get("file", ""))
            if folder_path:
                document_details[citekey] = {
                    "citekey": citekey,
                    "title": clean_field(item.get("title", "Untitled")),
                    "item_type": item.get("itemType", item.get("ENTRYTYPE", "Unknown")),
                    "tags": clean_field(item.get("keywords", "")).replace(",", ", "),
                    "authors": clean_field(item.get("author", "")),
                    "folder_path": folder_path
                }
            else:
                print(f"No folder path found for citekey: {citekey}")
                document_details[citekey] = None
            break  # Found the matching entry, exit the loop
    else:
        print(f"No data found for citekey: {citekey}")
        document_details[citekey] = None

    return document_details


def extract_folder(fileAttribute):
    """Fetch PDF attachment key from json response."""
    match = re.search(r"/Zotero/storage/(?P<item_id>[^/]+)/", fileAttribute)
    if match:
        folder_path = os.path.expanduser(f"~/Zotero/storage/{match.group('item_id')}")
        print(f"folder: {folder_path}")
        return folder_path
    return None


