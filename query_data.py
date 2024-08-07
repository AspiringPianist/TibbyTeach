import argparse
from langchain_community.vectorstores import Chroma
from langchain.prompts import ChatPromptTemplate
import os
from dotenv import load_dotenv
from langchain.chat_models import ChatOpenAI
from get_embedding_function import get_embedding_function

AI71_API_KEY = "api71-api-14773c59-2308-416d-b780-3443cafac1b1"
AI71_BASE_URL = "https://api.ai71.ai/v1/"
CHROMA_PATH = "chroma"

PROMPT_TEMPLATE = """
Answer the question based only on the following context:

{context}

---

Answer the question based on the above context: {question}
"""

model = None

# Load environment variables
load_dotenv()

def main():
    # Create CLI.
    parser = argparse.ArgumentParser()
    parser.add_argument("query_text", type=str, help="The query text.")
    args = parser.parse_args()
    query_text = args.query_text
    query_rag(query_text)

def query_rag(query_text: str):
    global model
    # Prepare the DB.
    embedding_function = get_embedding_function()
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function)

    # Search the DB.
    results = db.max_marginal_relevance_search(query_text, k=10)
    # use with scores
    #context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
    context_text = "\n\n---\n\n".join([doc.page_content for doc in results])
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(context=context_text, question=query_text)

    # Initialize the Together AI model
    if not model:
           model = ChatOpenAI(
    model="tiiuae/falcon-40b-instruct",
    api_key=AI71_API_KEY,
    base_url=AI71_BASE_URL,
    streaming=False,
)
    response_text = model.invoke(prompt).content
    #use with _scores
    #sources = [doc.metadata.get("id", None) for doc, _score in results]
    sources = [doc.metadata.get("id", None) for doc in results]
    formatted_response = f"Response: {response_text}\nSources: {sources}"
    print(formatted_response)
    return response_text, sources

if __name__ == "__main__":
    main()