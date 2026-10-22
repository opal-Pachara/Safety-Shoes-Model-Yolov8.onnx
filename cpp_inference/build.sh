#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

echo "=========================================================="
echo "🚀 Building Safety Shoes YOLOv8 C++ ONNX Runtime Engine"
echo "=========================================================="

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# Run CMake
cmake -DCMAKE_BUILD_TYPE=Release ..

# Compile
cmake --build . -j$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo ""
echo "=========================================================="
echo "✅ Build Successful! Binary located at: ${BUILD_DIR}/yolo_infer"
echo "=========================================================="
echo ""
echo "Try running:"
echo "  cd ${SCRIPT_DIR}"
echo "  ./build/yolo_infer --model models/best_int8.onnx --image sample_test.jpg --output result.jpg --benchmark 20"
echo ""
