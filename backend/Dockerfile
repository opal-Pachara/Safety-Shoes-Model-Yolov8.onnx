FROM python:3.11-slim

WORKDIR /app

# Install minimal OS dependencies for OpenCV headless and ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Copy exported models
COPY exported_models ./exported_models

# Optional: if frontend static build exists, copy it
COPY frontend/dist ./frontend/dist 2>/dev/null || true

ENV MODEL_PATH=/app/exported_models/best.onnx
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
