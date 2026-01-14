FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN mkdir -p /app/data/uploads /app/data/evidence
ENV PORT=8080
EXPOSE $PORT
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT

