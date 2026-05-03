.PHONY: run dev test lint clean deploy

run:
	uvicorn main:app --host 0.0.0.0 --port 8080

dev:
	uvicorn main:app --reload --port 8080

test:
	pytest tests/

lint:
	# Running simple linting check
	python -m py_compile main.py backend/*.py services/*.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +

deploy:
	gcloud run deploy election-assistant --source . --region us-central1 --allow-unauthenticated
