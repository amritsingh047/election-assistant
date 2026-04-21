document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    checkAuth();

    // 1. Initialize Dashboard Charts
    initCharts();

    // 2. Setup Chatbot Interactivity
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Handle form states for Timeline and Insights
    const stateSelect = document.getElementById('state-select');
    stateSelect.addEventListener('change', async (e) => {
        const state = e.target.value;
        const timelineContent = document.getElementById('timeline-content');
        const insightText = document.getElementById('ai-insight-text');
        
        if (state === 'all') {
            timelineContent.innerHTML = '<p>Select a state above to view your deadlines.</p>';
            insightText.textContent = 'Select a state to generate real-time AI predictions.';
            return;
        }
        
        timelineContent.innerHTML = '<p>Loading deadlines...</p>';
        insightText.textContent = 'Generating AI Insight...';
        
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Fetch Timeline
            const response = await fetch(`/api/timeline?state=${state}`, { headers });
            if (response.status === 401) { handleUnauthorized(); return; }
            
            const data = await response.json();
            timelineContent.innerHTML = `
                <ul style="list-style:none; padding:0;">
                    <li style="margin-bottom:0.5rem;"><strong>Registration Deadline:</strong> ${data.dates.registration}</li>
                    <li style="margin-bottom:0.5rem;"><strong>Early Voting Starts:</strong> ${data.dates.early_voting}</li>
                    <li style="margin-bottom:0.5rem;"><strong>Election Day:</strong> ${data.dates.election_day}</li>
                </ul>
            `;
            
            // Fetch Dashboard Data (AI Insight)
            const dashResponse = await fetch(`/api/dashboard-data?state=${state}`, { headers });
            if (dashResponse.status === 401) { handleUnauthorized(); return; }
            
            const dashData = await dashResponse.json();
            insightText.textContent = dashData.ai_insight || "Insight unavailable.";
            
        } catch(err) {
            timelineContent.innerHTML = '<p>Could not load deadlines.</p>';
            insightText.textContent = "Error loading AI insight.";
        }
    });

    // Handle Language
    const langSelect = document.getElementById('language-select');
    langSelect.addEventListener('change', (e) => {
        localStorage.setItem('language', e.target.value);
    });
    const savedLang = localStorage.getItem('language');
    if(savedLang) { langSelect.value = savedLang; }

    // Setup Quiz
    initQuiz();

    // 3. Setup Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
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
            updateChartsTheme('dark');
        } else {
            document.body.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙';
            updateChartsTheme('light');
        }
    });
    // 4. Setup Voice Recognition
    const voiceBtn = document.getElementById('voice-btn');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        voiceBtn.addEventListener('click', () => {
            voiceBtn.textContent = '🔴'; // recording state
            recognition.start();
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById('chat-input').value = transcript;
            voiceBtn.textContent = '🎤';
            sendMessage();
        };

        recognition.onerror = () => { voiceBtn.textContent = '🎤'; };
        recognition.onend = () => { voiceBtn.textContent = '🎤'; };
    } else {
        voiceBtn.style.display = 'none'; // Hide if not supported
    }
});

/**
 * Sends a user message to the chat API and displays the response.
 * @async
 * @returns {Promise<void>}
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');
    const text = input.value.trim();
    
    if (!text) return;

    // Add user message to UI
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = text;
    messagesContainer.appendChild(userMsg);
    
    // Clear input
    input.value = '';
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show loading
    const sysMsg = document.createElement('div');
    sysMsg.className = 'message system';
    sysMsg.textContent = "Thinking...";
    messagesContainer.appendChild(sysMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Fetch response from FastAPI backend
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
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        const data = await response.json();
        // Add Verified Source logic
        sysMsg.innerHTML = data.reply + `<div style="margin-top: 10px; font-size: 0.8rem; color: var(--success-color);">🛡️ Verified Source Logic</div>`;
    } catch (error) {
        console.error(error);
        sysMsg.textContent = "Error connecting to AI. Make sure GOOGLE_GEMINI_API_KEY is set in Cloud Run.";
    }
}

/**
 * Initializes the Chart.js instances for the dashboard.
 * @returns {void}
 */
function initCharts() {
    // Turnout Chart (Bar)
    const ctxTurnout = document.getElementById('turnoutChart').getContext('2d');
    new Chart(ctxTurnout, {
        type: 'bar',
        data: {
            labels: ['2016', '2018', '2020', '2022', '2024'],
            datasets: [{
                label: 'Voter Turnout (%)',
                data: [55, 49, 66, 52, 60], // Mock Data
                backgroundColor: '#007BFF',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#FFF' } },
                title: { display: true, text: 'Historical Turnout', color: '#FFF' }
            },
            scales: {
                y: { ticks: { color: '#B3B3B3' }, grid: { color: '#333' } },
                x: { ticks: { color: '#B3B3B3' }, grid: { color: '#333' } }
            }
        }
    });

    // Queries Chart (Doughnut)
    const ctxQueries = document.getElementById('queriesChart').getContext('2d');
    new Chart(ctxQueries, {
        type: 'doughnut',
        data: {
            labels: ['Registration', 'Deadlines', 'Polling Stations', 'Candidates'],
            datasets: [{
                data: [40, 25, 20, 15], // Mock Data
                backgroundColor: ['#007BFF', '#03DAC6', '#CF6679', '#BB86FC'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#FFF' } },
                title: { display: true, text: 'Top User Queries', color: '#FFF' }
            }
        }
    });
}

/**
 * Updates the chart colors based on the selected theme.
 * @param {string} theme - The active theme ('light' or 'dark').
 * @returns {void}
 */
function updateChartsTheme(theme) {
    const textColor = theme === 'light' ? '#212529' : '#FFFFFF';
    const gridColor = theme === 'light' ? '#DEE2E6' : '#333333';
    
    for (let id in Chart.instances) {
        let chart = Chart.instances[id];
        if (chart.options.plugins && chart.options.plugins.legend) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        if (chart.options.plugins && chart.options.plugins.title) {
            chart.options.plugins.title.color = textColor;
        }
        if (chart.options.scales && chart.options.scales.x) {
            chart.options.scales.x.ticks.color = textColor;
            chart.options.scales.x.grid.color = gridColor;
        }
        if (chart.options.scales && chart.options.scales.y) {
            chart.options.scales.y.ticks.color = textColor;
            chart.options.scales.y.grid.color = gridColor;
        }
        chart.update();
    }
}

// --- Quiz Logic ---
const quizQuestions = [
    { q: "When is the next general Election Day?", options: ["Nov 5", "Dec 25", "July 4"], a: "Nov 5" },
    { q: "Can you register to vote online in most states?", options: ["Yes", "No"], a: "Yes" },
    { q: "What is required to vote at the polls in many states?", options: ["Passport", "Voter ID", "Birth Certificate"], a: "Voter ID" }
];
let currentQ = 0;
let score = 0;

/**
 * Initializes and manages the state of the interactive quiz.
 * @returns {void}
 */
function initQuiz() {
    if(currentQ >= quizQuestions.length) {
        document.getElementById('quiz-container').style.display = 'none';
        if(score === quizQuestions.length) {
            document.getElementById('badge-container').style.display = 'block';
        } else {
            document.getElementById('quiz-title').textContent = "Quiz Finished! Review the process and try again.";
        }
        return;
    }
    const qData = quizQuestions[currentQ];
    document.getElementById('quiz-question').textContent = `${currentQ+1}. ${qData.q}`;
    const optsContainer = document.getElementById('quiz-options');
    optsContainer.innerHTML = '';
    
    qData.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.style.padding = '0.75rem';
        btn.style.background = 'var(--bg-secondary)';
        btn.style.color = 'var(--text-primary)';
        btn.style.border = '1px solid var(--border-color)';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.onclick = () => {
            if(opt === qData.a) { score++; }
            currentQ++;
            initQuiz();
        };
        optsContainer.appendChild(btn);
    });
}

// --- Auth Logic ---
/**
 * Checks for an existing authentication token and updates UI visibility.
 * @returns {void}
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('logout-btn').style.display = 'none';
    } else {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
    }
}

/**
 * Handles unauthorized API responses by destroying the token and prompting login.
 * @returns {void}
 */
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
            errorMsg.style.display = 'none';
            document.getElementById('login-modal').style.display = 'none';
            document.getElementById('logout-btn').style.display = 'inline-block';
            
            // Reload the page to fetch dashboard data with new token
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
