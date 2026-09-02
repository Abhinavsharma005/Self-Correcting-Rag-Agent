from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

from dotenv import load_dotenv
from google import genai
from google.genai import types


# ============================================================
# 1. Load environment variables and initialize Gemini
# ============================================================

load_dotenv()

client = genai.Client()


# ============================================================
# 2. Load PDF
# ============================================================

loader = PyPDFLoader("sample.pdf")

documents = loader.load()

print(f"Pages loaded: {len(documents)}")


# ============================================================
# 3. Split PDF into smaller chunks
# ============================================================

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = text_splitter.split_documents(documents)

print(f"Chunks created: {len(chunks)}")


# ============================================================
# 4. Create embedding model
# ============================================================

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# ============================================================
# 5. Store chunks + embeddings in Chroma
# ============================================================

vector_db = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    collection_name="pdf_collection",
    persist_directory="./chroma_db"
)

print("PDF successfully embedded and stored!")


# ============================================================
# 6. Create Gemini system prompt
# ============================================================

SYSTEM_PROMPT = """
You are Alexa, a helpful AI assistant that answers questions
strictly based on the provided PDF context.

Rules:

1. Answer only using information available in the provided PDF context.
2. Do not use outside knowledge.
3. If the answer cannot be found in the provided context, say:
   "I could not find the answer in the provided PDF."
4. Mention the relevant page number whenever possible.
5. Keep the answer clear and concise.
6. Remember the previous conversation so the user can ask
   follow-up questions about previous answers.
"""


# ============================================================
# 7. Configure Gemini
# ============================================================

config = types.GenerateContentConfig(
    system_instruction=SYSTEM_PROMPT
)


# ============================================================
# 8. Create multi-turn chat session
# ============================================================

chat = client.chats.create(
    model="gemini-3.7-flash",
    config=config
)


# ============================================================
# 9. Continuous Chat Loop
# ============================================================

print("\n🤖 Alexa PDF Assistant is ready!")
print("Ask questions about the PDF.")
print("Type 'exit' to quit.\n")


while True:

    try:

        # ----------------------------------------------------
        # Take user question
        # ----------------------------------------------------

        user_query = input("You: ")

        if user_query.strip().lower() == "exit":

            print("Alexa: Goodbye!")

            break

        if not user_query.strip():

            continue


        # ----------------------------------------------------
        # Retrieve relevant chunks for THIS question
        # ----------------------------------------------------

        search_results = vector_db.similarity_search(
            query=user_query,
            k=4
        )


        # ----------------------------------------------------
        # Build context
        # ----------------------------------------------------

        context = ""

        for result in search_results:

            page_number = result.metadata.get("page_label")

            if page_number is None:
                page_number = result.metadata.get("page")

            source = result.metadata.get(
                "source",
                "Unknown"
            )

            context += f"""
Page Number: {page_number}

File: {source}

Page Content:
{result.page_content}

----------------------------------------
"""


        # ----------------------------------------------------
        # Combine question + retrieved PDF context
        # ----------------------------------------------------

        prompt = f"""
Use the following retrieved PDF context to answer the user's question.

Retrieved PDF Context:

{context}

User Question:
{user_query}
"""


        # ----------------------------------------------------
        # Send message to Gemini chat
        # ----------------------------------------------------

        response = chat.send_message(prompt)


        # ----------------------------------------------------
        # Display response
        # ----------------------------------------------------

        print(f"\nAlexa: {response.text}\n")


    except Exception as e:

        print(f"An error occurred: {e}\n")