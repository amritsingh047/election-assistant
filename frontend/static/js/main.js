document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    checkAuth();

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker failed', err));
        });
    }

    // 1. Initialize Dashboard Charts with Robustness
    try {
        if (typeof Chart !== 'undefined') {
            initCharts();
        } else {
            console.error("Chart.js not loaded. Dashboard metrics will be unavailable.");
            document.querySelectorAll('.chart-container').forEach(el => {
                el.innerHTML = '<p style="padding:2rem; color:var(--text-secondary);">Charts currently unavailable (CDN load fail).</p>';
            });
        }
    } catch (e) {
        console.error("Failed to initialize charts:", e);
    }

    // 2. Setup Chatbot Interactivity
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Handle form states for Timeline and Insights
    const stateSelect = document.getElementById('state-select');
    if (stateSelect) {
        stateSelect.addEventListener('change', async (e) => {
            const state = e.target.value;
            updateRoadmap('step-state', state !== 'all');
            
            const timelineContent = document.getElementById('timeline-content');
            const insightText = document.getElementById('ai-insight-text');
            const lang = localStorage.getItem('language') || 'en';
            const dict = translations[lang] || translations['en'];
            
            if (state === 'all') {
                if (timelineContent) timelineContent.innerHTML = `<p data-i18n="timeline-placeholder">${dict['timeline-placeholder']}</p>`;
                if (insightText) {
                    insightText.textContent = dict['insight-placeholder'];
                    insightText.setAttribute('data-i18n', 'insight-placeholder');
                }
                return;
            }
            
            if (timelineContent) timelineContent.innerHTML = `<p>${dict['loading']}</p>`;
            if (insightText) {
                insightText.textContent = dict['generating'];
                insightText.removeAttribute('data-i18n'); // Clear attribute while loading
            }
            
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Authorization': `Bearer ${token}` };

                // Fetch Timeline
                const response = await fetch(`/api/timeline?state=${state}`, { headers });
                if (response.status === 401) { handleUnauthorized(); return; }
                
                const data = await response.json();
                if (timelineContent) {
                    timelineContent.innerHTML = `
                        <ul style="list-style:none; padding:0; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                            <li style="padding:1rem; background:rgba(255,255,255,0.05); border-radius:12px;"><strong>${dict['label-reg']}</strong><br>${data.dates.registration}</li>
                            <li style="padding:1rem; background:rgba(255,255,255,0.05); border-radius:12px;"><strong>${dict['label-early']}</strong><br>${data.dates.early_voting}</li>
                            <li style="padding:1rem; background:rgba(255,255,255,0.05); border-radius:12px;"><strong>${dict['label-election']}</strong><br>${data.dates.election_day}</li>
                        </ul>
                    `;
                }
                
                // Fetch Dashboard Data (AI Insight)
                const dashResponse = await fetch(`/api/dashboard-data?state=${state}`, { headers });
                if (dashResponse.status === 401) { handleUnauthorized(); return; }
                
                const dashData = await dashResponse.json();
                if (insightText) insightText.textContent = dashData.ai_insight || dict['insight-error'];
                
            } catch(err) {
                if (timelineContent) timelineContent.innerHTML = `<p>${dict['error-load']}</p>`;
                if (insightText) insightText.textContent = dict['error-load'];
            }
        });
    }

    // Handle Language
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            localStorage.setItem('language', lang);
            applyTranslations(lang);
            initQuiz(); // Re-initialize quiz with new language
        });
        const savedLang = localStorage.getItem('language') || 'en';
        langSelect.value = savedLang;
        applyTranslations(savedLang);
    }

    // Setup Quiz with Robustness
    try {
        initQuiz();
    } catch (e) {
        console.error("Failed to initialize Quiz:", e);
    }

    // 3. Setup Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        if (currentTheme === 'light') {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.textContent = '🌙';
        }

        themeToggle.addEventListener('click', () => {
            let theme = document.body.getAttribute('data-theme');
            if (theme === 'light') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
                themeToggle.textContent = '☀️';
                if (typeof Chart !== 'undefined') updateChartsTheme('dark');
            } else {
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                themeToggle.textContent = '🌙';
                if (typeof Chart !== 'undefined') updateChartsTheme('light');
            }
        });
    }

    // 4. Setup Voice Recognition
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            try {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;

                voiceBtn.addEventListener('click', () => {
                    try {
                        voiceBtn.classList.add('pulse-recording');
                        recognition.start();
                    } catch (e) {
                        voiceBtn.classList.remove('pulse-recording');
                    }
                });

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    const chatInput = document.getElementById('chat-input');
                    if (chatInput) chatInput.value = transcript;
                    voiceBtn.classList.remove('pulse-recording');
                    sendMessage();
                };

                recognition.onerror = () => { voiceBtn.classList.remove('pulse-recording'); };
                recognition.onend = () => { voiceBtn.classList.remove('pulse-recording'); };
            } catch (e) {
                voiceBtn.style.display = 'none';
            }
        } else {
            voiceBtn.style.display = 'none';
        }
    }

    // 5. Setup OCR ID Upload
    const idUpload = document.getElementById('id-upload');
    if (idUpload) {
        idUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('ocr-preview');
            preview.style.display = 'block';

            const formData = new FormData();
            formData.append('file', file);

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/assistant/upload-id', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.status === 401) { handleUnauthorized(); return; }

                const result = await response.json();
                if (result.status === 'success') {
                    const analysis = result.analysis;
                    preview.innerHTML = `
                        <div style="color: var(--success-color); font-weight: bold;">✅ Verification Complete</div>
                        <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                            <strong>Name:</strong> ${analysis.name}<br>
                            <strong>ID:</strong> ${analysis.id_number}<br>
                            <strong>State:</strong> ${analysis.state}
                        </div>
                    `;
                    // Auto-prefill state if extracted
                    const stateSelect = document.getElementById('state-select');
                    if (stateSelect && analysis.state) {
                        // Find matching option (simple fuzzy match demo)
                        for (let opt of stateSelect.options) {
                            if (analysis.state.toLowerCase().includes(opt.text.toLowerCase())) {
                                stateSelect.value = opt.value;
                                stateSelect.dispatchEvent(new Event('change'));
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                preview.innerHTML = `<p style="color:var(--error-color);">Analysis failed.</p>`;
            }
        });
    }

    // 6. Setup AI Fact-Checker
    const factBtn = document.getElementById('fact-check-btn');
    if (factBtn) {
        factBtn.addEventListener('click', async () => {
            const input = document.getElementById('fact-claim-input');
            const resultDiv = document.getElementById('fact-result');
            const claim = input.value.trim();
            if (!claim) return;
            factBtn.disabled = true;
            factBtn.textContent = '...';
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/assistant/fact-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ claim })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    const res = data.result;
                    resultDiv.style.display = 'block';
                    const statusEl = document.getElementById('fact-status');
                    statusEl.textContent = res.status;
                    statusEl.style.color = res.status === 'Verified' ? 'var(--success-color)' : 'var(--error-color)';
                    document.getElementById('fact-explanation').textContent = res.explanation;
                    document.getElementById('fact-sources').textContent = res.sources.join(', ');
                }
            } catch (err) { console.error("Fact-check failed"); }
            finally { factBtn.disabled = false; factBtn.textContent = 'Verify Now'; }
        });
    }

    // 7. Voter Badge Logic
    const badgeBtn = document.getElementById('download-cert-btn');
    if (badgeBtn) {
        badgeBtn.addEventListener('click', () => {
            alert("Voter Badge Generated! In a production app, this would trigger a PDF/PNG download with your name.");
        });
    }
});

/**
 * Updates the Voter Readiness Roadmap steps.
 * @param {string} stepId - The ID of the roadmap step.
 * @param {boolean} completed - Whether the step is completed.
 */
function updateRoadmap(stepId, completed) {
    const el = document.getElementById(stepId);
    if (!el) return;
    if (completed) {
        el.classList.add('completed');
        el.classList.remove('active');
        // Set next step to active
        const next = el.nextElementSibling;
        if (next) next.classList.add('active');
    } else {
        el.classList.remove('completed');
    }
}

/**
 * Speaks the given text using the Web Speech API.
 * @param {string} text - The text to speak.
 */
function speak(text) {
    if ('speechSynthesis' in window) {
        // Cancel existing speech
        window.speechSynthesis.cancel();
        
        const lang = localStorage.getItem('language') || 'en';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        window.speechSynthesis.speak(utterance);
    }
}

/**
 * Sends a user message to the chat API and displays the response.
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');
    const text = input.value.trim();
    
    if (!text) return;

    updateRoadmap('step-consult', true);

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = text;
    messagesContainer.appendChild(userMsg);
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show loading
    const sysMsg = document.createElement('div');
    sysMsg.className = 'message system';
    sysMsg.textContent = "...";
    messagesContainer.appendChild(sysMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const lang = localStorage.getItem('language') || 'en';
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message: text, language: lang })
        });
        
        if (response.status === 401) { handleUnauthorized(); return; }

        const data = await response.json();
        sysMsg.innerHTML = `
            <div class="reply-text">${data.reply}</div>
            <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                <button onclick="speak(this.closest('.message').querySelector('.reply-text').textContent)" style="padding: 4px 8px; font-size: 0.7rem; background: var(--glass-bg); border: 1px solid var(--glass-border);">🔊 Listen</button>
                <span style="font-size: 0.7rem; color: var(--success-color);">🛡️ Verified Source</span>
            </div>
        `;
    } catch (error) {
        sysMsg.textContent = "Error connecting to AI.";
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Initializes the Chart.js instances for the dashboard.
 */
function initCharts() {
    const ctxTurnout = document.getElementById('turnoutChart').getContext('2d');
    window.turnoutChart = new Chart(ctxTurnout, {
        type: 'bar',
        data: {
            labels: ['2016', '2018', '2020', '2022', '2024'],
            datasets: [{
                label: 'Voter Turnout (%)',
                data: [55, 49, 66, 52, 60],
                backgroundColor: '#4eacfe',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: 'rgba(255,255,255,0.7)' } },
                title: { display: true, text: 'Historical Participation', color: '#FFF' }
            },
            scales: {
                y: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { display: false } }
            }
        }
    });

    const ctxQueries = document.getElementById('queriesChart').getContext('2d');
    window.queriesChart = new Chart(ctxQueries, {
        type: 'doughnut',
        data: {
            labels: ['Registration', 'Deadlines', 'Stations', 'Candidates'],
            datasets: [{
                data: [40, 25, 20, 15],
                backgroundColor: ['#4eacfe', '#00f2ea', '#ff4d6d', '#BB86FC'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', padding: 20 } },
                title: { display: true, text: 'Voter Interest Topics', color: '#FFF' }
            }
        }
    });

    // Sentiment Chart Initialization
    const ctxSentiment = document.getElementById('sentimentChart').getContext('2d');
    window.sentimentChart = new Chart(ctxSentiment, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                {
                    label: 'Optimistic',
                    data: [10, 15, 20, 25, 30, 28, 35],
                    borderColor: '#00f2ea',
                    backgroundColor: 'rgba(0, 242, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Concerned',
                    data: [5, 4, 3, 6, 8, 5, 2],
                    borderColor: '#ff4d6d',
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'rgba(255,255,255,0.7)' } }
            },
            scales: {
                y: { display: false },
                x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { display: false } }
            }
        }
    });
}

function updateChartsTheme(theme) {
    const textColor = theme === 'light' ? '#1a202c' : '#FFFFFF';
    const subColor = theme === 'light' ? '#4a5568' : 'rgba(255,255,255,0.5)';
    
    for (let id in Chart.instances) {
        let chart = Chart.instances[id];
        if (chart.options.plugins.legend) chart.options.plugins.legend.labels.color = subColor;
        if (chart.options.plugins.title) chart.options.plugins.title.color = textColor;
        if (chart.options.scales) {
            if (chart.options.scales.x) chart.options.scales.x.ticks.color = subColor;
            if (chart.options.scales.y) chart.options.scales.y.ticks.color = subColor;
        }
        chart.update();
    }
}

// --- Quiz Logic ---
let currentQ = 0;
let score = 0;

function initQuiz() {
    const lang = localStorage.getItem('language') || 'en';
    const questions = (translations[lang] && translations[lang].quiz) ? translations[lang].quiz : translations['en'].quiz;
    
    updateRoadmap('step-quiz', true);

    if(currentQ >= questions.length) {
        document.getElementById('quiz-container').style.display = 'none';
        if(score === questions.length) {
            document.getElementById('badge-container').style.display = 'block';
            updateRoadmap('step-certified', true);
            // Confetti Trigger!
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4eacfe', '#00f2ea', '#ffffff']
                });
            }
        } else {
            document.getElementById('quiz-title').textContent = "Quiz Finished!";
        }
        return;
    }
    const qData = questions[currentQ];
    document.getElementById('quiz-question').textContent = `${currentQ+1}. ${qData.q}`;
    const optsContainer = document.getElementById('quiz-options');
    optsContainer.innerHTML = '';
    
    qData.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.className = 'quiz-option';
        btn.onclick = () => {
            if(opt === qData.a) { score++; }
            currentQ++;
            initQuiz();
        };
        optsContainer.appendChild(btn);
    });
}

function applyTranslations(lang) {
    if (!translations || !translations[lang]) return;
    const dict = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    if (lang === 'ar') {
        document.body.style.direction = 'rtl';
    } else {
        document.body.style.direction = 'ltr';
    }
}

// --- Auth Logic ---
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('logout-btn').style.display = 'none';
    } else {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        updateRoadmap('step-auth', true);
    }
}

function handleUnauthorized() {
    localStorage.removeItem('token');
    checkAuth();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            window.location.reload();
        } else {
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.style.display = 'block';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.reload();
});
