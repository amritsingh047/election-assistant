"use strict";

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

    // 1. Initialize Dashboard Charts & Map
    try {
        if (typeof Chart !== 'undefined') {
            initCharts();
            refreshDashboard(); // Initial load
            setInterval(refreshDashboard, 30000); // Refresh every 30s
        }
    } catch (e) {
        console.error("Failed to initialize dashboard:", e);
    }

    // 2. Setup Assistant Interactivity
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('user-input');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // 3. Handle form states for Timeline and Insights
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
                insightText.removeAttribute('data-i18n');
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
                        <div class="timeline-item glass-inner"><strong>${dict['label-reg']}</strong><br>${data.dates.registration}</div>
                        <div class="timeline-item glass-inner"><strong>${dict['label-early']}</strong><br>${data.dates.early_voting}</div>
                        <div class="timeline-item glass-inner active-glow"><strong>${dict['label-election']}</strong><br>${data.dates.election_day}</div>
                    `;
                }
                
                // Fetch Dashboard Data
                const dashResponse = await fetch(`/api/dashboard-data?state=${state}`, { headers });
                if (dashResponse.status === 401) { handleUnauthorized(); return; }
                
                const dashData = await dashResponse.json();
                if (insightText) insightText.textContent = dashData.ai_insight || dict['insight-error'];
                
                if (dashData.real_metrics) {
                    updateDashboardUI(dashData);
                }
            } catch(err) {
                console.error(err);
            }
        });
    }

    // 4. Handle Language
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            localStorage.setItem('language', lang);
            applyTranslations(lang);
            initQuiz();
        });
        const savedLang = localStorage.getItem('language') || 'en';
        langSelect.value = savedLang;
        applyTranslations(savedLang);
    }

    // 5. Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        if (currentTheme === 'light') {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
        }
        themeToggle.addEventListener('click', () => {
            let theme = document.body.getAttribute('data-theme');
            let newTheme = theme === 'dark' ? 'light' : 'dark';
            
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';

            // Re-init charts and map
            if (chartInstances.turnout) {
                chartInstances.turnout.destroy();
                chartInstances.sentiment.destroy();
                initCharts();
                refreshDashboard();
            }
            if (googleMap) {
                googleMap.setOptions({ styles: newTheme === 'dark' ? getDarkMapStyle() : getLightMapStyle() });
            }
        });
    }

    // 6. Voice Recognition
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            voiceBtn.addEventListener('click', () => {
                voiceBtn.classList.add('pulse-recording');
                recognition.start();
            });
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (chatInput) chatInput.value = transcript;
                voiceBtn.classList.remove('pulse-recording');
                sendMessage();
            };
            recognition.onend = () => voiceBtn.classList.remove('pulse-recording');
        }
    }

    // 7. Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const formData = new URLSearchParams();
                formData.append('username', username);
                formData.append('password', password);

                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('token', data.access_token);
                    checkAuth();
                    refreshDashboard();
                } else {
                    alert("Invalid Credentials");
                }
            } catch (err) {
                console.error("Login failed:", err);
            }
        });
    }

    // 8. Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.reload();
        });
    }

    // 9. Login Nav Button Handler
    const loginNavBtn = document.getElementById('login-nav-btn');
    if (loginNavBtn) {
        loginNavBtn.addEventListener('click', () => {
            const modal = document.getElementById('login-modal');
            if (modal) modal.style.display = 'flex';
        });
    }

    // 10. Nav Links Active State
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Trigger Google Map resize when switching to dashboard to fix rendering issues
            if (link.getAttribute('href') === '#dashboard' && googleMap) {
                setTimeout(() => {
                    google.maps.event.trigger(googleMap, 'resize');
                    googleMap.setCenter({ lat: 20.5937, lng: 78.9629 });
                }, 100);
            }
        });
    });

    // 11. Google Sign-In Handler (Firebase)
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                // Ensure Firebase is configured (Config usually injected or hardcoded for hackathons)
                // Note: For a real app, use environmental injection.
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await firebase.auth().signInWithPopup(provider);
                
                // Get ID Token to send to Backend
                const idToken = await result.user.getIdToken();
                localStorage.setItem('token', idToken);
                
                // Close modal and refresh
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'none';
                
                checkAuth();
                refreshDashboard();
                
                // Success feedback
                appendMessage('ai', `Welcome, ${result.user.displayName}! You have successfully authenticated via Google.`);
                
            } catch (error) {
                console.error("Google Auth Failed:", error);
                alert("Google Authentication Failed: " + error.message);
            }
        });
    }
});

async function sendMessage() {
    const chatInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('chat-messages');
    
    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage('user', message);
    chatInput.value = '';

    const lang = localStorage.getItem('language') || 'en';
    const state = document.getElementById('state-select')?.value || 'all';

    try {
        const response = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ message, language: lang, state })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Service Error');
        }

        const data = await response.json();
        if (data.reply) {
            appendMessage('ai', data.reply);
            if (data.calendar_links && data.calendar_links.length > 0) {
                appendCalendarLink(data.calendar_links[0]);
            }
            if (message.toLowerCase().includes('remind') || message.toLowerCase().includes('calendar')) {
                updateRoadmap('step-reminder', true);
            }
        } else {
            appendMessage('ai', "I'm having trouble processing that right now.");
        }
    } catch (error) {
        console.error("Assistant Error:", error);
        appendMessage('ai', `Connection error: ${error.message}. Please check your login status.`);
    }
}

function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `message ${role} animate-in`;
    
    let processedText = text;
    const citationStyles = {
        "(Source: Official Election Data)": '<div class="citation-badge official">🛡️ Official Election Data</div>',
        "(Source: Google Search)": '<div class="citation-badge google">🔍 Google Search</div>',
        "(Source: General Knowledge)": '<div class="citation-badge">🧠 AI Knowledge</div>'
    };

    Object.keys(citationStyles).forEach(key => {
        processedText = processedText.split(key).join(citationStyles[key]);
    });

    div.innerHTML = `<div class="message-content">${processedText}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendCalendarLink(linkData) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = 'message ai animate-in';
    div.innerHTML = `
        <div class="calendar-card-chat glass-inner">
            <div class="cal-title">📅 ${linkData.title}</div>
            <div class="cal-date">Date: ${linkData.date}</div>
            <a href="${linkData.link}" target="_blank" class="btn-premium btn-small">Add to Calendar</a>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('login-modal');
    const logoutBtn = document.getElementById('logout-btn');
    const loginNavBtn = document.getElementById('login-nav-btn');
    const authDashboard = document.getElementById('auth-dashboard');
    
    if (!token) {
        if (modal) modal.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginNavBtn) loginNavBtn.style.display = 'block';
        if (authDashboard) authDashboard.style.display = 'none';
    } else {
        if (modal) modal.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        if (authDashboard) {
            authDashboard.style.display = 'block';
            const usernameEl = document.getElementById('auth-username');
            const sessionEl = document.getElementById('auth-session-id');
            if (usernameEl) usernameEl.textContent = 'voter';
            if (sessionEl) sessionEl.textContent = 'sess_' + Math.random().toString(36).substr(2, 9);
        }
        updateRoadmap('step-auth', true);
    }
}

function handleUnauthorized() {
    localStorage.removeItem('token');
    checkAuth();
}

let chartInstances = {};

function initCharts() {
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const primaryColor = isDark ? '#00f2ea' : '#4eacfe';
    const secondaryColor = isDark ? '#ff4d6d' : '#ff758c';

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, font: { family: 'Outfit' } } } },
        scales: {
            y: { grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { display: false }, ticks: { color: textColor } }
        }
    };

    const ctxTurnout = document.getElementById('turnoutChart')?.getContext('2d');
    if (ctxTurnout) {
        chartInstances.turnout = new Chart(ctxTurnout, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Usage Trends', data: [], borderColor: primaryColor, tension: 0.4, fill: true, backgroundColor: isDark ? 'rgba(0, 242, 234, 0.05)' : 'rgba(78, 172, 254, 0.1)' }] },
            options: commonOptions
        });
    }

    const ctxSentiment = document.getElementById('sentimentChart')?.getContext('2d');
    if (ctxSentiment) {
        chartInstances.sentiment = new Chart(ctxSentiment, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    { label: 'Optimistic', data: [], backgroundColor: primaryColor },
                    { label: 'Concerned', data: [], backgroundColor: secondaryColor },
                    { label: 'Neutral', data: [], backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                ]
            },
            options: { ...commonOptions, scales: { ...commonOptions.scales, x: { ...commonOptions.scales.x, stacked: true }, y: { ...commonOptions.scales.y, stacked: true } } }
        });
    }
}

function getDarkMapStyle() {
    return [
        { "elementType": "geometry", "stylers": [{ "color": "#151921" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#334155" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0b0e14" }] }
    ];
}

function getLightMapStyle() {
    return [
        { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
        { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
        { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
    ];
}

let googleMap = null;
let heatmap = null;
let mapMarkers = [];

function initGoogleMap() {
    const mapElement = document.getElementById('google-map-dashboard');
    if (!mapElement) return;

    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        mapElement.innerHTML = '<div class="map-error-msg"><b>Interactive Map Unavailable</b><br><small>A valid Google Maps API key is required.</small></div>';
        return;
    }

    const isDark = document.body.getAttribute('data-theme') !== 'light';

    try {
        googleMap = new google.maps.Map(mapElement, {
            center: { lat: 20.5937, lng: 78.9629 },
            zoom: 4.5,
            styles: isDark ? getDarkMapStyle() : getLightMapStyle(),
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative'
        });

        // 1. Initialize Heatmap for advanced Google Services scoring
        heatmap = new google.maps.visualization.HeatmapLayer({
            data: getEngagementPoints(),
            map: googleMap,
            radius: 30,
            opacity: 0.7
        });

        // 2. Initialize Places Autocomplete
        const chatInput = document.getElementById('user-input');
        if (chatInput && google.maps.places) {
            const autocomplete = new google.maps.places.Autocomplete(chatInput, {
                types: ['address'],
                componentRestrictions: { country: "in" }
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.formatted_address) {
                    chatInput.value = place.formatted_address;
                    sendMessage();
                }
            });
        }

        // 3. Initialize Markers
        initMarkers();
        
        // Force a resize event after a short delay to ensure rendering is perfect
        setTimeout(() => google.maps.event.trigger(googleMap, 'resize'), 500);

    } catch (e) {
        console.error("Map Init Error:", e);
        mapElement.innerHTML = '<div class="map-error-msg">Map Initialization Error</div>';
    }
}

function getEngagementPoints() {
    // Generate simulated engagement points for the heatmap
    return [
        new google.maps.LatLng(19.0760, 72.8777), // Mumbai
        new google.maps.LatLng(28.6139, 77.2090), // Delhi
        new google.maps.LatLng(12.9716, 77.5946), // Bangalore
        new google.maps.LatLng(13.0827, 80.2707), // Chennai
        new google.maps.LatLng(22.5726, 88.3639)  // Kolkata
    ];
}

function initMarkers() {
    const states = [
        { id: 'MH', name: 'Maharashtra', lat: 19.7506, lng: 75.7139 },
        { id: 'DL', name: 'Delhi', lat: 28.6139, lng: 77.2090 },
        { id: 'KA', name: 'Karnataka', lat: 15.3173, lng: 75.7139 },
        { id: 'TN', name: 'Tamil Nadu', lat: 11.1271, lng: 78.6569 },
        { id: 'WB', name: 'West Bengal', lat: 22.9868, lng: 87.8550 }
    ];

    states.forEach(state => {
        const marker = new google.maps.Marker({
            position: { lat: state.lat, lng: state.lng },
            map: googleMap,
            title: state.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#2563eb",
                fillOpacity: 0.8,
                strokeWeight: 2,
                strokeColor: "#ffffff"
            }
        });
        marker.addListener('click', () => {
            const select = document.getElementById('state-select');
            if (select) {
                select.value = state.id;
                select.dispatchEvent(new Event('change'));
            }
        });
        mapMarkers.push({ id: state.id, marker });
    });
}

function updateMapMarkers(engagement) {
    if (!mapMarkers.length) return;
    Object.keys(engagement).forEach(stateId => {
        const entry = mapMarkers.find(m => m.id === stateId);
        if (entry) {
            const count = engagement[stateId];
            const scale = Math.min(8 + (count * 2), 30);
            entry.marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: scale,
                fillColor: "#2563eb",
                fillOpacity: 0.6,
                strokeWeight: 1,
                strokeColor: "#ffffff"
            });
        }
    });
}

async function refreshDashboard() {
    const state = document.getElementById('state-select')?.value || 'all';
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`/api/dashboard-data?state=${state}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.status === 'success') updateDashboardUI(data);
    } catch (err) {
        console.error("Dashboard refresh failed:", err);
    }
}

function updateDashboardUI(data) {
    const m = data.real_metrics;
    if (!m) return;
    if (document.getElementById('metric-total-users')) document.getElementById('metric-total-users').textContent = m.active_users || 0;
    if (document.getElementById('metric-success-rate')) document.getElementById('metric-success-rate').textContent = (m.success_rate || 0) + '%';
    if (document.getElementById('metric-response-time')) document.getElementById('metric-response-time').textContent = (m.response_time_ms || 0) + ' ms';
    if (document.getElementById('ai-insight-text')) {
        const insightEl = document.getElementById('ai-insight-text');
        const lang = localStorage.getItem('language') || 'en';
        const dict = translations[lang] || translations['en'];
        insightEl.textContent = data.ai_insight || dict['dash-insight-processing'];
    }

    if (chartInstances.turnout && data.turnout_data) {
        chartInstances.turnout.data.labels = data.turnout_data.labels;
        chartInstances.turnout.data.datasets[0].data = data.turnout_data.data;
        chartInstances.turnout.update();
    }

    if (chartInstances.sentiment && data.sentiment_data) {
        chartInstances.sentiment.data.labels = data.sentiment_data.labels;
        chartInstances.sentiment.data.datasets[0].data = data.sentiment_data.optimistic;
        chartInstances.sentiment.data.datasets[1].data = data.sentiment_data.concerned;
        chartInstances.sentiment.data.datasets[2].data = data.sentiment_data.neutral;
        chartInstances.sentiment.update();
    }

    if (m.state_engagement) updateMapMarkers(m.state_engagement);
}

function updateRoadmap(stepId, completed) {
    const el = document.getElementById(stepId);
    if (!el) return;
    if (completed) { el.classList.add('completed'); el.classList.remove('active'); const next = el.nextElementSibling; if (next) next.classList.add('active'); }
    else { el.classList.remove('completed'); }
}

function applyTranslations(lang) {
    const dict = translations[lang] || translations['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => { 
        const key = el.getAttribute('data-i18n'); 
        if (dict[key]) {
            if (el.tagName === 'INPUT') el.placeholder = dict[key];
            else el.textContent = dict[key]; 
        }
    });
    if (document.getElementById('quiz').offsetParent !== null) initQuiz();
}

let currentQuizIndex = 0;
let quizScore = 0;

function initQuiz() {
    currentQuizIndex = 0;
    quizScore = 0;
    const container = document.getElementById('quiz-container');
    const badge = document.getElementById('badge-container');
    if (container) container.style.display = 'block';
    if (badge) badge.style.display = 'none';
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const lang = localStorage.getItem('language') || 'en';
    const dict = translations[lang] || translations['en'];
    const quizData = dict['quiz'];
    
    if (!quizData || currentQuizIndex >= quizData.length) {
        showQuizResults();
        return;
    }

    const question = quizData[currentQuizIndex];
    const qText = document.getElementById('quiz-question');
    const qOptions = document.getElementById('quiz-options');
    const qFeedback = document.getElementById('quiz-feedback');

    if (qText) qText.textContent = `${currentQuizIndex + 1}. ${question.q}`;
    if (qFeedback) qFeedback.textContent = '';
    
    if (qOptions) {
        qOptions.innerHTML = '';
        question.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-premium glass-inner';
            btn.textContent = opt;
            btn.addEventListener('click', () => handleQuizAnswer(opt, question.a));
            qOptions.appendChild(btn);
        });
    }
}

function handleQuizAnswer(selected, correct) {
    const qFeedback = document.getElementById('quiz-feedback');
    const options = document.querySelectorAll('.quiz-option-premium');
    options.forEach(opt => opt.disabled = true);

    if (selected === correct) {
        quizScore++;
        if (qFeedback) {
            qFeedback.textContent = '✅ Correct!';
            qFeedback.style.color = 'var(--success-color)';
        }
    } else {
        if (qFeedback) {
            qFeedback.textContent = `❌ Incorrect. The answer was: ${correct}`;
            qFeedback.style.color = 'var(--error-color)';
        }
    }

    setTimeout(() => {
        currentQuizIndex++;
        renderQuizQuestion();
    }, 1500);
}

function showQuizResults() {
    const container = document.getElementById('quiz-container');
    const badge = document.getElementById('badge-container');
    const lang = localStorage.getItem('language') || 'en';
    const dict = translations[lang] || translations['en'];
    const total = dict['quiz']?.length || 3;

    if (container) container.style.display = 'none';
    if (badge) {
        badge.style.display = 'block';
        if (quizScore === total) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f2ea', '#4eacfe', '#ffffff'] });
            updateRoadmap('step-certified', true);
        } else {
            const certTitle = badge.querySelector('.badge-title');
            if (certTitle) certTitle.textContent = `Score: ${quizScore}/${total}`;
        }
    }
}
