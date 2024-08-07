from flask import Flask, render_template, request, Response, stream_with_context, jsonify, redirect, url_for, send_file
import time
import os
from werkzeug.utils import secure_filename
from populate_database import process_youtube_video, add_to_chroma, split_documents, extract_video_id
from query_data import query_rag
from langchain.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from get_embedding_function import get_embedding_function
from youtube_utils import get_video_info
from quiz_utils import generate_quiz, Quiz, MCQ
from mindmap_utils import generate_mindmap, convert_to_network_data
import asyncio
from edge_tts import Communicate
mindmap_directory = 'static/mindmaps'
import uuid
import json
app = Flask(__name__)

CHROMA_PATH = "chroma"
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'pdf'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def initialize_database():
    embedding_function = get_embedding_function()
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function)
    return db

def process_pdf(file_path):
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    chunks = split_documents(documents)
    add_to_chroma(chunks)

@app.route('/')
def index():
    return render_template('project.html')

@app.route('/courses')
def courses():
    return render_template('courses.html')

@app.route('/chatbot')
def chatbot():
    return render_template('chatbot.html')

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        process_pdf(file_path)
        return jsonify({"message": "File uploaded and processed successfully"}), 200
    return jsonify({"error": "Invalid file type"}), 400

@app.route('/process_youtube', methods=['POST'])
def process_youtube():
    url = request.json.get('url')
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    video_info = get_video_info(video_id)
    if not video_info:
        return jsonify({"error": "Failed to fetch video information"}), 400
    
    chunks = process_youtube_video(url)
    add_to_chroma(chunks)
    
    return jsonify({"message": f"YouTube video '{video_info['title']}' processed and indexed."}), 200

@app.route('/send', methods=["POST"])
def send():
    msg = request.form.get("msg", "")
    return "Message received"

@app.route('/stream', methods=["GET"])
def stream():
    def generate_response():
        message = request.args.get('msg', '')
        db = initialize_database()
        response, sources = query_rag(message)
        
        for word in response.split():
            yield f"data: {word+' '}\n\n"
            time.sleep(0.05)
        yield f"data: [EOS]\n\n"
        
        for source in sources:
            yield f"data: SOURCE: {source+' '}\n\n"
        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate_response()), content_type='text/event-stream')

@app.route('/generate_quiz', methods=['POST'])
def create_quiz():
    data = request.json
    topic = data.get('topic')
    if not topic:
        return jsonify({"error": "No topic provided"}), 400

    quiz = generate_quiz(topic)
    
    # Store the quiz in the session
    session['current_quiz'] = {
        "topic": quiz.topic,
        "questions": [
            {
                "question": q.question,
                "choices": [c.choice for c in q.choices],
                "correct_answer": next(i for i, c in enumerate(q.choices) if c.isAnswer)
            } for q in quiz.multiple_choice_questions
        ]
    }
    
    return jsonify({
        "topic": quiz.topic,
        "questions": [
            {
                "question": q.question,
                "choices": [c.choice for c in q.choices]
            } for q in quiz.multiple_choice_questions
        ]
    }), 200


session = {}

@app.route('/submit_quiz', methods=['POST'])
def submit_quiz():
    data = request.json
    user_answers = data.get('answers')
    if not user_answers:
        return jsonify({"error": "No answers provided"}), 400

    quiz = session.get('current_quiz')
    if not quiz:
        return jsonify({"error": "No active quiz found"}), 400

    score = 0
    total = len(quiz['questions'])

    for i, question in enumerate(quiz['questions']):
        if i < len(user_answers):
            user_choice = user_answers[i]
            correct_choice = next(j for j, choice in enumerate(question['choices']) if j == question['correct_answer'])
            if user_choice == correct_choice:
                score += 1

    session.pop('current_quiz', None)

    return jsonify({
        "score": score,
        "total": total,
        "percentage": (score / total) * 100
    }), 200


@app.route('/generate_mindmap', methods=['POST'])
def generate_mindmap_route():
    data = request.json
    topic = data.get('topic')
    mindmap_data = generate_mindmap(topic)
    return jsonify({'mindmap': mindmap_data})

@app.route('/text_to_speech', methods=['POST'])
async def text_to_speech():
    text = request.json.get('text')
    if not text:
        return jsonify({"error": "No text provided"}), 400

    filename = f"speech_{int(time.time())}.mp3"
    file_path = os.path.join(app.static_folder, 'audio', filename)

    communicate = Communicate(text)
    await communicate.save(file_path)

    return jsonify({"audio_url": f"/static/audio/{filename}"})

@app.route('/mindmaps/<mindmap_id>', methods=['GET'])
def get_mindmap(mindmap_id):
    mindmap_path = os.path.join(mindmap_directory, f'{mindmap_id}.json')
    if os.path.exists(mindmap_path):
        with open(mindmap_path, 'r') as f:
            mindmap_data = json.load(f)
        return jsonify(mindmap_data)
    return jsonify({'error': 'Mindmap not found'}), 404


@app.route('/list_mindmaps', methods=['GET'])
def list_mindmaps():
    mindmaps = []
    for filename in os.listdir(mindmap_directory):
        if filename.endswith('.png'):
            mindmap_id = filename.split('.')[0]
            mindmaps.append({'id': mindmap_id, 'name': filename})
    return jsonify({'mindmaps': mindmaps})

@app.route('/save_mindmap', methods=['POST'])
def save_mindmap():
    data = request.json
    mindmap_id = str(uuid.uuid4())
    filename = f"{mindmap_id}.json"
    file_path = os.path.join(mindmap_directory, filename)
    
    with open(file_path, 'w') as f:
        json.dump(data, f)
    
    return jsonify({"id": mindmap_id, "message": "Mindmap saved successfully"})

if __name__ == "__main__":
    if not os.path.exists(mindmap_directory):
        os.makedirs(mindmap_directory)
    app.run(debug=True, threaded=True)