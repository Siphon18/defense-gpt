FROM python:3.11-slim

# Set up a new user named "user" with user ID 1000 (Required for Hugging Face Spaces)
RUN useradd -m -u 1000 user

# Switch to the "user" user
USER user

# Set home to the user's home directory
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set the working directory
WORKDIR $HOME/app

# Copy requirements file first to leverage Docker cache
COPY --chown=user:user requirements.txt $HOME/app/

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code into the container
COPY --chown=user:user backend/ $HOME/app/backend/

# Set the environment variables
ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONPATH=$HOME/app

# Expose the default HF Spaces port
EXPOSE 7860

# Start the FastAPI server using Uvicorn
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "7860"]
