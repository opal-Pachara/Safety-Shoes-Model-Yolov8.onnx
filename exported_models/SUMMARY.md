# 🥾 Safety Shoes Detection - Model Export & Quantization Report

**Date:** 2026-10-18 08:31:10

## 1. Final Model Performance

- **mAP@50:** `66.65%`
- **mAP@50-95:** `52.71%`
- **Precision:** `62.27%`
- **Recall:** `60.74%`

### Per-Class Detection Metrics:

| Class | Precision | Recall | mAP50 | mAP50-95 |
| :--- | :---: | :---: | :---: | :---: |
| **other_Shoes** | 92.7% | 81.8% | 92.4% | 67.7% |
| **FlipFlops** | 68.5% | 100.0% | 99.5% | 94.5% |
| **safety_Shoes** | 87.9% | 61.1% | 74.7% | 48.5% |
| **Normal_Shoes** | 0.0% | 0.0% | 0.0% | 0.0% |

## 2. Exported Models & Quantization Comparison

| Model File | Format | Precision | File Size | Latency (CPU) | Speed (FPS) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `best.pt` | PyTorch | FP32 | 17.58 MB | - | - |
| `best.onnx` | ONNX | FP32 | 11.54 MB | 8.58 ms | 116.5 FPS |
| `best_int8.onnx` | ONNX (Quantized) | **INT8** | **3.01 MB** | **16.95 ms** | **59.0 FPS** |
| `best_fp16.onnx` | ONNX (Quantized) | FP16 | 11.54 MB | - | - |

## 3. How to Use the Models for Inference

### Using ONNX Runtime (Recommended for deployment & INT8):
```python
import onnxruntime as ort
import numpy as np

# Load quantized INT8 model
session = ort.InferenceSession('exported_models/best_int8.onnx')
input_name = session.get_inputs()[0].name

# Input: normalized image (1, 3, 320, 320) float32 in range [0, 1]
outputs = session.run(None, {input_name: img_tensor})
```

### Using Ultralytics YOLO directly:
```python
from ultralytics import YOLO

# Load PyTorch or ONNX model
model = YOLO('exported_models/best_int8.onnx')
results = model.predict(source='path/to/test.jpg', imgsz=320, conf=0.25)
results[0].show()
```
