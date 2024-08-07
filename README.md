# AI Educational Companion

![AI Educational Companion](tibby.png)

The AI Educational Companion is a cutting-edge tool designed to revolutionize online learning by providing an interactive experience with YouTube video content.

## Key Features

1. **Video Analysis**: Process any YouTube video for interactive learning.
2. **Interactive Q&A**: Ask questions about the video content.
3. **Summary Generation**: Get concise summaries of video content.
4. **Mind Maps**: Visualize concepts with automatically generated mind maps.
5. **Quizzes**: Test your knowledge with content-based quizzes.

## How To Use

First install the requirements.

We are using Ollama for local embeddings via the nomic-embed-text model.
Make sure to visit the [ollama website](https://ollama.ai) and download it
After installing ollama run this in your terminal.
```bash
ollama pull nomic-embed-text
```

Then, for the python dependencies, run this:
```bash
pip install -r requirements.txt
```

You can then cd into the repository folder and run this:
```
flask --app appv2 run
```

This will open the website, where you can click the Chatbot section to go there and proceed to use the chatbot.
