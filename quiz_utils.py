from pydantic import BaseModel, Field
from typing import List
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain.chat_models import ChatOpenAI
from query_data import query_rag
AI71_API_KEY = "api71-api-14773c59-2308-416d-b780-3443cafac1b1"
AI71_BASE_URL = "https://api.ai71.ai/v1/"
class Choice(BaseModel):
    isAnswer: bool = Field(description="True if this is the correct answer, False otherwise.")
    choice: str = Field(description="The text of the answer choice.")

class MCQ(BaseModel):
    question: str = Field(description="The question text.")
    choices: List[Choice] = Field(description="A list of 4 choices, with exactly one correct answer.")

class Quiz(BaseModel):
    topic: str = Field(description="The topic of the quiz.")
    multiple_choice_questions: List[MCQ] = Field(description="A list of MCQ objects.")

def generate_quiz(topic: str) -> Quiz:
    # Use the existing RAG system to get information about the topic
    context, sources = query_rag(f"Provide detailed information about {topic}")

    model = ChatOpenAI(
    model="tiiuae/falcon-40b-instruct",
    api_key=AI71_API_KEY,
    base_url=AI71_BASE_URL,
    streaming=False,
)

    parser = PydanticOutputParser(pydantic_object=Quiz)

    quiz_prompt = PromptTemplate(
    template="""Based on the following information about {topic}, generate a quiz with 3 multiple-choice questions, unless the user specifies how many they want. 
    Each question should have 4 choices, with exactly one correct answer. 

    Information about {topic}:
    {context}

    Generate the quiz in the following JSON format:
    {{
        "topic": "{topic}",
        "multiple_choice_questions": [
            {{
                "question": "<question>",
                "choices": [
                    {{
                        "isAnswer": <true/false>, 
                        "choice": "<answer choice>"
                    }},
                    {{
                        "isAnswer": <true/false>, 
                        "choice": "<answer choice>"
                    }},
                    {{
                        "isAnswer": <true/false>, 
                        "choice": "<answer choice>"
                    }},
                    {{
                        "isAnswer": <true/false>, 
                        "choice": "<answer choice>"
                    }}
                ]
            }},
            // ... more questions with the same structure ...
        ]
    }}
    """,
    input_variables=["topic", "context"],
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

    quiz_output = model.invoke(quiz_prompt.format(topic=topic, context=context)).content

    try:
        quiz = parser.parse(quiz_output)
        return quiz
    except Exception as e:
        print(f"Error parsing quiz output: {e}")
        print(f"Raw output: {quiz_output}")
        raise
