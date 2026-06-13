# 1. Start with a lightweight Python 3.11 Linux environment
FROM python:3.11-slim

# 2. Tell the container not to buffer Python output (so we can see logs instantly)
ENV PYTHONUNBUFFERED=1

# 3. Create a working directory inside the container
WORKDIR /app

# 4. Copy ONLY the requirements file first (this makes future builds much faster)
COPY requirements.txt .

# 5. Install all your Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of your backend code into the container
COPY . .

# 7. Expose the port FastAPI will run on
EXPOSE 8000

# 8. The command to boot the FastAPI server when the container starts
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]