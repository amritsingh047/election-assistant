# Use official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Expose the default Cloud Run port
EXPOSE 8080

# Use the PORT environment variable provided by Cloud Run
ENV PORT 8080

# Run uvicorn via python module for better stability and signal handling
# We use shell form to allow environment variable expansion for $PORT
CMD python -m uvicorn main:app --host 0.0.0.0 --port $PORT
