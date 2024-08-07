function copyToClipboard(element) {
    const messageContainer = $(element).closest('.msg_cotainer, .msg_cotainer_send');
    let textToCopy;
    
    if (messageContainer.hasClass('msg_cotainer_send')) {
        textToCopy = messageContainer.clone().children().remove().end().text().trim();
    } else {
        const messageText = messageContainer.find(".messageText").text().trim();
        const sourcesText = messageContainer.find(".sources").text().trim();
        textToCopy = messageText + (sourcesText ? "\n\nSources:\n" + sourcesText : "");
    }
    
    navigator.clipboard.writeText(textToCopy).then(function() {
        alert('Copied to clipboard');
    }, function(err) {
        console.error('Could not copy text: ', err);
    });
}
function textToSpeech(element) {
    const messageContainer = $(element).closest('.msg_cotainer');
    const messageText = messageContainer.find(".messageText").text().trim();

    $.ajax({
        url: '/text_to_speech',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ text: messageText }),
        success: function(response) {
            const audio = new Audio(response.audio_url);
            audio.play();
        },
        error: function(xhr, status, error) {
            console.error("Error converting text to speech:", error);
            alert('Error converting text to speech. Please try again.');
        }
    });
}

$(document).ready(function() {
    let currentQuiz = null;
    let mediaList = [];
    const options = {
        layout: {
            improvedLayout: true,
            randomSeed: 42
        },
        nodes: {
            shape: "box",
            scaling: {
                min: 20,
                max: 60,
                label: { enabled: true, min: 14, max: 30, maxVisible: 30, drawThreshold: 5 },
            },
            font: {
                size: 16,
                face: "Arial"
            },
            margin: 10
        },
        edges: {
            width: 2,
            smooth: {
                type: "continuous",
                forceDirection: "none",
                roundness: 0.5
            }
        },
        physics: {
            stabilization: false,
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.3,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.09,
                avoidOverlap: 0.2
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            zoomView: true,
            dragView: true
        }
    };

    $("#messageArea").on("submit", function(event) {
        event.preventDefault();
        var rawText = $("#text").val();
        if (rawText.trim() === "") {
            return;
        }
        if (rawText.startsWith("/Mindmap")) {
            console.log("Mindmap command detected");
            var topic = rawText.substring(8).trim();
            processMindmapCommand(topic);
            $("#text").val("");
        } else if (rawText.startsWith("/QuizCreate")) {
            var topic = rawText.substring(11).trim();
            generateQuiz(topic);
            $("#text").val("");
        } else if (rawText.trim() === "/QuizSubmit") {
            displayUserMessage("/QuizSubmit");
            submitQuiz();
            $("#text").val("");
        } else if (isYouTubeLink(rawText)) {
            processYouTubeLink(rawText);
            $("#text").val("");
        } else {
            displayUserMessage(rawText);
            $("#text").val("");
            getResponse(rawText);
        }
    });

    $("#uploadPdf").click(function() {
        $("#pdfUpload").click();
    });

    $("#pdfUpload").change(function(e) {
        var file = e.target.files[0];
        if (file && file.type === "application/pdf") {
            uploadPdf(file);
        }
    });

    $('#mediaSelect').on('change', function() {
        const selectedIndex = $(this).val();
        if (selectedIndex !== '') {
            const selectedMedia = mediaList[selectedIndex];
            displayMedia(selectedMedia.type, selectedMedia.content);
        }
    });

    $('#text').on('input', function() {
        if ($(this).val().length > 0) {
            $('.placeholder-text').hide();
        } else {
            $('.placeholder-text').show();
        }
    });
    
     function displayUserMessage(message) {
        let userMessageHtml = `
            <div class="d-flex justify-content-end mb-4">
                <div class="msg_cotainer_send">
                    ${escapeHtml(message)}
                    <span class="msg_time_send">${new Date().toLocaleTimeString()}</span>
                    <i class="fas fa-copy copy-btn" onclick="copyToClipboard(this)"></i>
                </div>
                <div class="img_cont_msg">
                    <img src="https://i.ibb.co/d5b84Xw/Untitled-design.png" class="rounded-circle user_img_msg">
                </div>
            </div>
        `;
        $("#messageFormeight").append(userMessageHtml);
        scrollToBottom();
    }

        

        function getResponse(message) {
            let botMessageHtml = `
                <div class="d-flex justify-content-start mb-4">
                    <div class="img_cont_msg">
                        <img src="https://i.ibb.co/fSNP7Rz/icons8-chatgpt-512.png" class="rounded-circle user_img_msg">
                    </div>
                    <div class="msg_cotainer">
                        <div class="messageText"></div>
                        <span class="blinking-cursor">|</span>
                        <div class="sources"></div>
                        <span class="msg_time">${new Date().toLocaleTimeString()}</span>
                        <i class="fas fa-copy copy-btn" onclick="copyToClipboard(this)"></i>
                        <i class="fas fa-volume-up tts-btn" onclick="textToSpeech(this)"></i>
                    </div>
                </div>`;
        var botMessageElement = $($.parseHTML(botMessageHtml)).appendTo("#messageFormeight");
        scrollToBottom();

        const source = new EventSource(`/stream?msg=${encodeURIComponent(message)}`);
        let messageText = botMessageElement.find(".messageText")[0];
        let cursor = botMessageElement.find(".blinking-cursor")[0];

        source.onmessage = function(event) {
            if (event.data.trim() === "[EOS]") {
                cursor.remove();
            } else if (event.data.trim() === "[DONE]") {
                source.close();
            } else if (event.data.startsWith("SOURCE:")) {
                let sourceText = event.data.substring(7);
                let sourceElement = $('<div class="source"></div>').text(sourceText);
                botMessageElement.find('.sources').append(sourceElement);
            } else {
                let decodedText = $('<div/>').html(event.data).text();
                let formattedText = decodedText.replace(/\n/g, '<br>');
                let messageTextElement = botMessageElement.find('.messageText');
                messageTextElement.append(formattedText);
                scrollToBottom();
            }
        };

        source.onerror = function() {
            botMessageElement.find('.messageText').text("Error: Could not reach the server.");
            cursor.remove();
            source.close();
        };
    }




      function processMindmapCommand(topic) {
        console.log("Processing mindmap command for topic:", topic);
        displayUserMessage(`/Mindmap ${topic}`);
        
        let loadingHtml = `
            <div class="d-flex justify-content-start mb-4">
                <div class="img_cont_msg">
                    <img src="https://i.ibb.co/fSNP7Rz/icons8-chatgpt-512.png" class="rounded-circle user_img_msg">
                </div>
                <div class="msg_cotainer">
                    <div class="loading">Generating mindmap...</div>
                    <span class="msg_time">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;
        $("#messageFormeight").append(loadingHtml);
        scrollToBottom();

        $.ajax({
            url: '/generate_mindmap',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ topic: topic }),
            success: function(response) {
                console.log("Received mindmap data:", response);
                $(".loading").closest(".d-flex").remove();
                displayMindmap(response.mindmap, topic);
            },
            error: function(xhr, status, error) {
                console.error("Error generating mindmap:", error);
                $(".loading").html(`Error generating mindmap: ${xhr.responseText}`);
            }
        });
    }


    function generateQuiz(topic) {
        displayUserMessage(`/QuizCreate ${topic}`);

        let loadingHtml = `
            <div class="d-flex justify-content-start mb-4">
                <div class="img_cont_msg">
                    <img src="https://i.ibb.co/fSNP7Rz/icons8-chatgpt-512.png" class="rounded-circle user_img_msg">
                </div>
                <div class="msg_cotainer">
                    <div class="loading">Generating quiz...</div>
                    <span class="msg_time">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;
        $("#messageFormeight").append(loadingHtml);
        scrollToBottom();

        $.ajax({
            url: '/generate_quiz',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ topic: topic }),
            success: function(response) {
                currentQuiz = response;
                displayQuiz(response);
                $(".loading").closest(".d-flex").remove();
            },
            error: function(xhr, status, error) {
                console.error("Error generating quiz:", error);
                $(".loading").html('Error generating quiz. Please try again.');
            }
        });
    }

    function displayQuiz(quiz) {
        let quizHtml = `
            <div class="d-flex justify-content-start mb-4">
                <div class="img_cont_msg">
                    <img src="https://i.ibb.co/fSNP7Rz/icons8-chatgpt-512.png" class="rounded-circle user_img_msg">
                </div>
                <div class="msg_cotainer">
                    <div class="quiz-box">
                        <h3>Quiz on ${quiz.topic}</h3>
                        <div class="questions">
                            ${quiz.questions.map((question, index) => `
                                <div class="question">
                                    <p>${index + 1}. ${question.question.replace(/\n/g, '<br>')}</p>
                                    ${question.choices.map((choice, choiceIndex) => `
                                        <label>
                                            <input type="radio" name="q${index}" value="${choiceIndex}">
                                            ${choice.replace(/\n/g, '<br>')}
                                        </label>
                                    `).join('')}
                                </div>
                            `).join('')}
                        </div>
                        <p class="quiz-instruction">Type "/QuizSubmit" to submit your answers.</p>
                    </div>
                    <span class="msg_time">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;

        $("#messageFormeight").append(quizHtml);
        scrollToBottom();
    }

    function submitQuiz() {
        if (!currentQuiz) {
            alert("No active quiz to submit!");
            return;
        }
    
        let answers = [];
        currentQuiz.questions.forEach((question, index) => {
            let selectedAnswer = $(`input[name="q${index}"]:checked`).val();
            answers.push(selectedAnswer ? parseInt(selectedAnswer) : null);
        });
    
        $.ajax({
            url: '/submit_quiz',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ answers: answers }),
            success: function(response) {
                $(".loading").closest(".d-flex").remove();
                displayQuizResult(response);
            },
            error: function(xhr, status, error) {
                console.error("Error submitting quiz:", error);
                $(".loading").html('Error submitting quiz. Please try again.');
            }
        });
    }
    
    function displayQuizResult(result) {
        let resultHtml = `
            <div class="d-flex justify-content-start mb-4">
                <div class="img_cont_msg">
                    <img src="https://i.ibb.co/fSNP7Rz/icons8-chatgpt-512.png" class="rounded-circle user_img_msg">
                </div>
                <div class="msg_cotainer">
                    <div class="quiz-result">
                        <h4>Quiz Result</h4>
                        <p>Your score: ${result.score}/${result.total} (${result.percentage.toFixed(2)}%)</p>
                    </div>
                    <span class="msg_time">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;
        $("#messageFormeight").append(resultHtml);
        scrollToBottom();
        currentQuiz = null;
    }

    function scrollToBottom() {
        var chatContainer = document.getElementById("messageFormeight");
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }


    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function isYouTubeLink(str) {
        return str.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/);
    }


    function processYouTubeLink(url) {
        $.ajax({
            url: '/process_youtube',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ url: url }),
            success: function(response) {
                console.log("YouTube video processed:", response.message);
                displayUserMessage(`YouTube video processed: ${response.message}`);
                addMedia('youtube', url, response.message);
                displayMedia('youtube', url);
            },
            error: function(xhr, status, error) {
                console.error("Error processing YouTube video:", error);
                displayUserMessage(`Error processing YouTube video: ${xhr.responseJSON.error}`);
            }
        });
    }

    function uploadPdf(file) {
        var formData = new FormData();
        formData.append('file', file);
        
        $.ajax({
            url: '/upload_pdf',
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            success: function(response) {
                displayUserMessage(`PDF uploaded: ${response.message}`);
                addMedia('pdf', URL.createObjectURL(file), file.name);
                displayMedia('pdf', URL.createObjectURL(file));
            },
            error: function(xhr, status, error) {
                displayUserMessage(`Error uploading PDF: ${xhr.responseJSON.error}`);
            }
        });
    }

    function addMedia(type, content, name) {
        mediaList.push({ type, content, name });
        updateMediaSelector();
    }

    function updateMediaSelector() {
        const select = document.getElementById('mediaSelect');
        select.innerHTML = '<option value="">Select media</option>';
        mediaList.forEach((media, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = media.name || `${media.type} ${index + 1}`;
            select.appendChild(option);
        });
    }

    function displayMedia(type, content) {
        let mediaHtml = '';
        if (type === 'youtube') {
            const videoId = extractYouTubeId(content);
            mediaHtml = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        } else if (type === 'pdf') {
            mediaHtml = `<embed src="${content}" type="application/pdf" width="100%" height="600px">`;
        } else if (type === 'mindmap') {
            const mindmapId = `mindmap-${Date.now()}`;
            mediaHtml = `
                <div id="${mindmapId}" style="width: 100%; height: 600px;"></div>
                <button id="saveMindmapImage" class="btn btn-primary mt-2">Save as Image</button>
            `;
            $('.media-content').html(mediaHtml).addClass('fade-in');
            
            // Fetch and render the saved mindmap
            $.ajax({
                url: `/mindmaps/${content}`,
                type: 'GET',
                success: function(mindmapData) {
                    const container = document.getElementById(mindmapId);
                    const data = {
                        nodes: new vis.DataSet(mindmapData.nodes),
                        edges: new vis.DataSet(mindmapData.edges)
                    };
                    const options = {
                        layout: {
                            improvedLayout: true,
                            randomSeed: 42
                        },
                        nodes: {
                            shape: "box",
                            scaling: {
                                min: 20,
                                max: 60,
                                label: { enabled: true, min: 14, max: 30, maxVisible: 30, drawThreshold: 5 },
                            },
                            font: {
                                size: 16,
                                face: "Arial"
                            },
                            margin: 10
                        },
                        edges: {
                            width: 2,
                            smooth: {
                                type: "continuous",
                                forceDirection: "none",
                                roundness: 0.5
                            }
                        },
                        physics: {
                            stabilization: false,
                            barnesHut: {
                                gravitationalConstant: -2000,
                                centralGravity: 0.3,
                                springLength: 200,
                                springConstant: 0.04,
                                damping: 0.09,
                                avoidOverlap: 0.2
                            }
                        },
                        interaction: {
                            hover: true,
                            tooltipDelay: 200,
                            zoomView: true,
                            dragView: true
                        }
                    };
                    const network = new vis.Network(container, data, options);
                    
                    // Attach save image functionality
                    $('#saveMindmapImage').click(function() {
                        const canvas = network.canvas.frame.canvas;
                        const dataUrl = canvas.toDataURL();
                        const link = document.createElement('a');
                        link.download = `mindmap-${content}.png`;
                        link.href = dataUrl;
                        link.click();
                    });
                },
                error: function(xhr, status, error) {
                    console.error("Error fetching mindmap:", error);
                    $('.media-content').html('<p>Error loading mindmap</p>');
                }
            });
        } else {
            mediaHtml = `<p>Unsupported media type</p>`;
        }
        $('.media-content').html(mediaHtml).addClass('fade-in');
    }

    function displayMindmap(mindmapData, topic) {
        const mindmapId = `mindmap-${Date.now()}`;
        let mindmapHtml = `
            <div id="${mindmapId}" style="width: 100%; height: 600px;"></div>
            <button id="saveMindmapImage" class="btn btn-primary mt-2">Save as Image</button>
        `;
        
        $('.media-content').html(mindmapHtml).addClass('fade-in');
        
        const container = document.getElementById(mindmapId);
        const data = {
            nodes: new vis.DataSet(mindmapData.nodes),
            edges: new vis.DataSet(mindmapData.edges)
        };
    
        // Generate a color palette for the topics
        const colorPalette = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", 
            "#98D8C8", "#F7DC6F", "#BB8FCE", "#82E0AA"
        ];
    
        // Assign colors to the nodes
        data.nodes.forEach((node, index) => {
            if (node.id === 1) {
                // Central node
                node.color = "#3498DB";
                node.font = { size: 20, color: "#FFFFFF" };
            } else if (node.id % 2 === 0) {
                // Topic nodes
                node.color = colorPalette[Math.floor(index / 2) % colorPalette.length];
                node.font = { size: 16, color: "#FFFFFF" };
            } else {
                // Info nodes
                node.color = "#ECF0F1";
                node.font = { size: 14, color: "#34495E" };
            }
        });
    
        const options = {
            layout: {
                improvedLayout: true,
                randomSeed: 42
            },
            nodes: {
                shape: "box",
                scaling: {
                    min: 20,
                    max: 60,
                    label: { enabled: true, min: 14, max: 30, maxVisible: 30, drawThreshold: 5 },
                },
                font: {
                    size: 16,
                    face: "Arial"
                },
                margin: 10
            },
            edges: {
                width: 2,
                smooth: {
                    type: "continuous",
                    forceDirection: "none",
                    roundness: 0.5
                }
            },
            physics: {
                stabilization: false,
                barnesHut: {
                    gravitationalConstant: -2000,
                    centralGravity: 0.3,
                    springLength: 200,
                    springConstant: 0.04,
                    damping: 0.09,
                    avoidOverlap: 0.2
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                zoomView: true,
                dragView: true
            }
        };
    
        const network = new vis.Network(container, data, options);

        network.on("stabilizationIterationsDone", function () {
            network.setOptions( { physics: false } );
        });

        $.ajax({
            url: '/save_mindmap',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(mindmapData),
            success: function(response) {
                console.log("Mindmap saved:", response.message);
                addMedia('mindmap', response.id, `Mindmap: ${topic}`);
                updateMediaSelector();
            },
            error: function(xhr, status, error) {
                console.error("Error saving mindmap:", error);
            }
        });
    

    
        addMedia('mindmap', mindmapHtml, `Mindmap: ${topic}`);
        updateMediaSelector();
        scrollToBottom();
    }

    $('#saveMindmapImage').click(function() {
        const canvas = network.canvas.frame.canvas;
        const dataUrl = canvas.toDataURL();
        const link = document.createElement('a');
        link.download = `mindmap-${topic}.png`;
        link.href = dataUrl;
        link.click();
    });

    function extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }


    function initializeMindmap() {
        const container = document.getElementById('mindmap');
        const network = new vis.Network(container, {nodes: nodes, edges: edges}, options);
        
        network.on("afterDrawing", function (ctx) {
            network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: "easeOutQuint"
                }
            });
        });
    
        $('#saveMindmapImage').click(function() {
            const dataUrl = network.canvas.canvas.toDataURL();
            const link = document.createElement('a');
            link.download = 'mindmap.png';
            link.href = dataUrl;
            link.click();
        });
    }

    function extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
});


