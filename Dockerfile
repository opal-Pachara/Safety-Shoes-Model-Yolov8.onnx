# =========================================================
# Stage 1: Build React + Vite Frontend Bundle
# =========================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package manifest and install dependencies
COPY frontend/package.json ./
RUN npm install

# Copy frontend source and build static bundle
COPY frontend ./
RUN npm run build

# =========================================================
# Stage 2: Production Python Backend + Integrated Frontend
# =========================================================
FROM python:3.11-slim AS production

# Environment configuration
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    MODEL_PATH=/app/exported_models/best.onnx

WORKDIR /app

# Install minimal OS runtime libraries for OpenCV Headless and ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend ./backend

# Copy exported ONNX models (FP32 best.onnx and its external weights)
COPY exported_models/best.onnx /app/exported_models/best.onnx
COPY exported_models/best.onnx.data /app/exported_models/best.onnx.data

# Copy mock sample images for UAT and testing
COPY test_samples ./test_samples

# Copy built frontend assets from Stage 1 into frontend/dist directory
# FastAPI is already configured to serve frontend/dist at root '/'
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose default port
EXPOSE 8000

# Healthcheck for container orchestrators (Render, Docker, Kubernetes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Start FastAPI server via uvicorn
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
