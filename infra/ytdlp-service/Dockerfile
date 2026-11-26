FROM python:3.12-slim

# ffmpeg : fusion video+audio (1080p) et conversion MP3
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY service.py .

ENV PORT=9000
EXPOSE 9000
CMD ["python3", "service.py"]
