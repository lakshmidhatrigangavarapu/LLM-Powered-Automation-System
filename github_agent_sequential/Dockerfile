# Use an official Python image as a base
FROM python:3.10-slim-bookworm

# Install security updates and remove unnecessary files
RUN apt-get update && apt-get upgrade -y && apt-get autoremove -y && apt-get clean

# Set the working directory
WORKDIR /app

# Copy and install dependencies first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code
COPY . .

# Expose the Flask port
EXPOSE 5001

# Run your script
CMD ["python", "github_agent.py"]