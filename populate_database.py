# populate_database.py

import argparse
import os
import shutil
from langchain.document_loaders.pdf import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.schema.document import Document
from get_embedding_function import get_embedding_function
from langchain_community.vectorstores import Chroma
from urllib.parse import urlparse, parse_qs
from youtube_utils import get_video_info, get_video_transcript

CHROMA_PATH = "chroma"
DATA_PATH = "uploads"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Reset the database.")
    parser.add_argument("--youtube", type=str, help="YouTube video URL to process.")
    args = parser.parse_args()

    if args.reset:
        print("✨ Clearing Database")
        clear_database()

    documents = load_documents()
    
    if args.youtube:
        youtube_chunks = process_youtube_video(args.youtube)
        documents.extend(youtube_chunks)

    chunks = split_documents(documents)
    add_to_chroma(chunks)

def load_documents():
    """Load PDF documents from the data directory."""
    document_loader = PyPDFDirectoryLoader(DATA_PATH)
    return document_loader.load()

def process_youtube_video(url):
    """
    Process a YouTube video, extracting transcript and video information.

    Args:
        url (str): The YouTube video URL.

    Returns:
        list: A list of Document objects containing video information and transcript.
    """
    video_id = extract_video_id(url)
    
    # Get video information
    video_info = get_video_info(video_id)
    
    # Get video transcript
    transcript = get_video_transcript(video_id)
    
    documents = []
    
    # Create a document for video information
    if video_info:
        info_doc = Document(
            page_content=f"Title: {video_info['title']}\nDescription: {video_info['description']}",
            metadata={
                'source': f'youtube:{video_id}',
                'type': 'video_info'
            }
        )
        documents.append(info_doc)
    
    # Create documents for transcript
    if transcript:
        transcript_doc = Document(
            page_content=transcript,
            metadata={
                'source': f'youtube:{video_id}',
                'type': 'transcript'
            }
        )
        documents.append(transcript_doc)
    
    return documents

def extract_video_id(url):
    """
    Extract the video ID from a YouTube URL.

    Args:
        url (str): The YouTube video URL.

    Returns:
        str: The extracted video ID, or None if not found.
    """
    parsed_url = urlparse(url)
    if parsed_url.hostname == 'youtu.be':
        return parsed_url.path[1:]
    if parsed_url.hostname in ('www.youtube.com', 'youtube.com'):
        if parsed_url.path == '/watch':
            p = parse_qs(parsed_url.query)
            return p['v'][0]
        if parsed_url.path[:7] == '/embed/':
            return parsed_url.path.split('/')[2]
        if parsed_url.path[:3] == '/v/':
            return parsed_url.path.split('/')[2]
    return None

def split_documents(documents: list[Document]):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_documents(documents)

def add_to_chroma(chunks: list[Document]):
    db = Chroma(
        persist_directory=CHROMA_PATH, embedding_function=get_embedding_function()
    )

    chunks_with_ids = calculate_chunk_ids(chunks)

    existing_items = db.get(include=[])
    existing_ids = set(existing_items["ids"])
    print(f"Number of existing documents in DB: {len(existing_ids)}")

    new_chunks = [chunk for chunk in chunks_with_ids if chunk.metadata["id"] not in existing_ids]

    if new_chunks:
        print(f"👉 Adding new documents: {len(new_chunks)}")
        new_chunk_ids = [chunk.metadata["id"] for chunk in new_chunks]
        db.add_documents(new_chunks, ids=new_chunk_ids)
        db.persist()
    else:
        print("✅ No new documents to add")

def calculate_chunk_ids(chunks):
    last_source = None
    current_chunk_index = 0

    for chunk in chunks:
        source = chunk.metadata.get("source")
        
        if source.startswith("youtube:"):
            # For YouTube videos, use content type as the chunk ID
            content_type = chunk.metadata.get("type")
            chunk_id = f"{source}:{content_type}"
        else:
            # For PDFs, use the existing logic
            page = chunk.metadata.get("page")
            current_source_id = f"{source}:{page}"

            if current_source_id == last_source:
                current_chunk_index += 1
            else:
                current_chunk_index = 0

            chunk_id = f"{current_source_id}:{current_chunk_index}"
            last_source = current_source_id

        chunk.metadata["id"] = chunk_id

    return chunks

def clear_database():
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)

if __name__ == "__main__":
    main()