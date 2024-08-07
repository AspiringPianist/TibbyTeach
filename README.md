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
