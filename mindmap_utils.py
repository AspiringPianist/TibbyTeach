from pydantic import BaseModel, Field
from typing import List
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from query_data import query_rag
from langchain.chat_models import ChatOpenAI
import textwrap

AI71_API_KEY = "api71-api-14773c59-2308-416d-b780-3443cafac1b1"
AI71_BASE_URL = "https://api.ai71.ai/v1/"
def wrap_text(text, width=20):
    return '\n'.join(textwrap.wrap(text, width=width))

class InfoNode(BaseModel):
    information: str = Field(description="Relevant information about the topic, that helps give an idea of what the topic is about")

class TopicNode(BaseModel):
    topic: str = Field(description="The topic of the n  ode")
    children: List[InfoNode] = Field(description="A list of information nodes, about 3 or 4, that are children of this topic node")

class MindMap(BaseModel):
    topicNodes: List[TopicNode] = Field(description="A list of topics extracted from the given topic or content, to give an overview and walkthrough of the entire content")
def generate_mindmap(topic: str) -> MindMap:
    # Use the existing RAG system to get information about the topic
    context, sources = query_rag(f"Provide detailed information about {topic}")
    model = ChatOpenAI(
        model="tiiuae/falcon-40b-instruct",
        api_key=AI71_API_KEY,
        base_url=AI71_BASE_URL,
        streaming=False,
    )

    parser = PydanticOutputParser(pydantic_object=MindMap)
    mindmap_prompt = PromptTemplate(
        template="""Based on the following information about {topic}, generate a mind map with 4 topic nodes, unless specified by user.
        Each topic may have about 4 to 5 information nodes. DO NOT USE JSON references like $ref, #defs, give only content required in each field.
        
        Information about {topic}:
        {context}

        Generate the mind map in the following JSON format:
        {{
            "topicNodes": [
                {{
                    "topic": "<topic>",
                    "children": [
                        {{
                            "information": "<information>"
                        }},
                        ...
                    ]
                }},
                ...
            ]
        }}""",
        input_variables=["topic", "context"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )

    mindmap_output = model.invoke(mindmap_prompt.format(topic=topic, context=context)).content

    try:
        # Check if the output matches the expected structure
        if "$defs" in mindmap_output or "$ref" in mindmap_output:
            raise ValueError("Output contains schema references instead of actual content.")
        
        mindmap = parser.parse(mindmap_output)
        return convert_to_network_data(mindmap)
    except Exception as e:
        print(f'Error parsing mindmap output: {e}')
        print(f"Raw output: {mindmap_output}")
        raise


def convert_to_network_data(mindmap: MindMap) -> dict:
    nodes = []
    edges = []
    node_id = 1

    nodes.append({"id": node_id, "label": wrap_text(mindmap.topicNodes[0].topic), "group": "central"})
    central_id = node_id
    node_id += 1

    for topic_node in mindmap.topicNodes:
        topic_id = node_id
        nodes.append({"id": topic_id, "label": wrap_text(topic_node.topic), "group": "topic"})
        edges.append({"from": central_id, "to": topic_id})
        node_id += 1

        for info_node in topic_node.children:
            nodes.append({
                "id": node_id,
                "label": wrap_text(info_node.information),
                "group": "info",
                "shape": "box",
                "size": 30,
                "font": {"size": 14},
                "margin": 10
            })            
            edges.append({"from": topic_id, "to": node_id})
            node_id += 1

    return {"nodes": nodes, "edges": edges}