# ==============================================================================
# Stage 1: Build Environment
# ==============================================================================
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV ONNXRUNTIME_VERSION=1.18.0

# Install build dependencies & OpenCV development headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    wget \
    tar \
    ca-certificates \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Download & install official prebuilt ONNX Runtime C++ Linux x64
WORKDIR /tmp
RUN wget -q https://github.com/microsoft/onnxruntime/releases/download/v${ONNXRUNTIME_VERSION}/onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}.tgz \
    && tar -xzf onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}.tgz \
    && mv onnxruntime-linux-x64-${ONNXRUNTIME_VERSION} /opt/onnxruntime \
    && rm onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}.tgz

# Copy source code
WORKDIR /app
COPY CMakeLists.txt .
COPY include/ include/
COPY src/ src/

# Build optimized Release binary
RUN mkdir build && cd build \
    && cmake -DCMAKE_BUILD_TYPE=Release \
             -DONNXRUNTIME_ROOTDIR=/opt/onnxruntime \
             .. \
    && cmake --build . -j$(nproc)

# ==============================================================================
# Stage 2: Minimal Lightweight Runtime (Optimized for Render Cloud)
# ==============================================================================
FROM ubuntu:22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Install only minimal runtime OpenCV shared libraries (no dev tools/compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopencv-core4.5d \
    libopencv-imgproc4.5d \
    libopencv-imgcodecs4.5d \
    libopencv-dnn4.5d \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy ONNX Runtime shared library from builder
COPY --from=builder /opt/onnxruntime/lib/libonnxruntime.so* /usr/local/lib/
RUN ldconfig

WORKDIR /app

# Copy compiled executable and models
COPY --from=builder /app/build/yolo_infer /app/yolo_infer
COPY models/ /app/models/
COPY sample_test.jpg /app/sample_test.jpg

# Default command: Run benchmark on INT8 / FP32 model with 2 CPU threads
CMD ["/app/yolo_infer", "--model", "models/best_int8.onnx", "--image", "sample_test.jpg", "--benchmark", "20", "--threads", "2"]
