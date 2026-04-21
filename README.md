# Smart Election Process Assistant & Dashboard

## 📌 Project Overview
The Smart Election Process Assistant is an interactive web application designed to help citizens navigate the complexities of the election process, timelines, and registration steps. It features a conversational AI guide and a dynamic Regional Analytics Dashboard.

## 🚀 Key Features
*   **Interactive AI Assistant**: Powered by Google Gemini to answer voter questions objectively and concisely.
*   **Performance Analytics Dashboard**: Visualizes mocked regional data (Voter Turnout, Query Topics) via interactive charts.
*   **Theme Toggle**: Fully accessible Dark/Light mode switch.

## 🏆 Hackathon Evaluation Focus Areas

### 1. Code Quality
*   **Architecture**: Implements a strict MVC (Model-View-Controller) structure using Python FastAPI.
*   **Maintainability**: Clean, modular code separation between backend routes (`app/routes`), controllers, and frontend static assets.

### 2. Security
*   **API Protection**: API keys are strictly managed via environment variables (`.env`) and Cloud Run Secrets; they are never hardcoded in the source code.
*   **Middleware**: Utilizes CORS middleware to control cross-origin requests securely.

### 3. Efficiency
*   **Lightweight Footprint**: The repository is kept well under the 1MB limit by strictly managing dependencies and excluding heavy frontend frameworks.
*   **Performance**: Fast, asynchronous Python backend (`uvicorn` + `FastAPI`) ensures minimal latency.

### 4. Accessibility
*   **Inclusive Design**: Semantic HTML5 tags (`<nav>`, `<main>`, `<section>`) and ARIA labels are used throughout the UI to ensure screen reader compatibility.
*   **Visual Contrast**: Features a high-contrast dark/light mode toggle to assist users with varying visual needs. 

### 5. Google Services Integration
*   **Google Gemini API**: Deeply integrated to handle the core natural language processing and logical decision-making of the Assistant.
*   **Google Cloud Run**: The application is fully containerized with Docker and configured for Continuous Deployment via Google Cloud Build & Cloud Run.

## ⚙️ How It Works (Logic & Assumptions)
*   **Assumption**: The dashboard currently uses mock data arrays to demonstrate chart functionality. In a production environment, this would dynamically query a Google Cloud SQL database.
*   **Logic**: The user input is captured via vanilla JavaScript, sent asynchronously to the FastAPI backend, processed by the `gemini-2.5-flash` model with strict system instructions to remain objective, and returned to the DOM.

## 🛠️ Local Development Setup
1. Clone the repository.
2. Install requirements: `pip install -r requirements.txt`
3. Add a `.env` file with your `GOOGLE_GEMINI_API_KEY`.
4. Run the server: `uvicorn main:app --reload`
