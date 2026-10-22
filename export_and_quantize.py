import os
import shutil
import time
import torch
from ultralytics import YOLO
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

EXPORT_DIR = "/Users/phatchara/Desktop/train-model/exported_models"
BEST_PT = "/Users/phatchara/Desktop/train-model/runs/yolov8n-safety_shoes_500e/weights/best.pt"

def main():
    print("=" * 60)
    print("🚀 STARTING FINAL ONNX EXPORT & QUANTIZATION PIPELINE")
    print("=" * 60)

    if not os.path.exists(BEST_PT):
        raise FileNotFoundError(f"Cannot find best.pt at {BEST_PT}")

    os.makedirs(EXPORT_DIR, exist_ok=True)

    # 1. Copy best.pt
    dest_pt = os.path.join(EXPORT_DIR, "best.pt")
    shutil.copy(BEST_PT, dest_pt)
    pt_size_mb = os.path.getsize(dest_pt) / (1024 * 1024)
    print(f"📦 Copied best.pt: {dest_pt} ({pt_size_mb:.2f} MB)")

    # 2. Validate best.pt to get final benchmark numbers
    print("\n📊 Validating final best.pt on validation dataset...")
    model = YOLO(dest_pt)
    val_res = model.val(data="/Users/phatchara/Downloads/safety-shoes/data.yaml", imgsz=320, batch=16, device="cpu")
    map50 = val_res.box.map50
    map50_95 = val_res.box.map
    precision = val_res.box.p.mean() if hasattr(val_res.box.p, 'mean') else float(val_res.box.p)
    recall = val_res.box.r.mean() if hasattr(val_res.box.r, 'mean') else float(val_res.box.r)

    print(f"🎯 Final Validation Metrics:")
    print(f"   - mAP50:     {map50 * 100:.2f}%")
    print(f"   - mAP50-95:  {map50_95 * 100:.2f}%")
    print(f"   - Precision: {precision * 100:.2f}%")
    print(f"   - Recall:    {recall * 100:.2f}%")

    # 3. Export to Standard ONNX
    print("\n⚙️ [Step 1/3] Exporting to standard ONNX (FP32)...")
    exported_onnx = model.export(format="onnx", imgsz=320, simplify=True, dynamic=False)
    dest_onnx = os.path.join(EXPORT_DIR, "best.onnx")
    if exported_onnx != dest_onnx and os.path.exists(exported_onnx):
        shutil.copy(exported_onnx, dest_onnx)
    dest_onnx = exported_onnx
    onnx_size_mb = os.path.getsize(dest_onnx) / (1024 * 1024)
    print(f"✅ Standard ONNX saved: {dest_onnx} ({onnx_size_mb:.2f} MB)")

    # 4. INT8 Quantization via onnxruntime
    print("\n⚡ [Step 2/3] Performing INT8 Dynamic Quantization...")
    dest_int8 = os.path.join(EXPORT_DIR, "best_int8.onnx")
    quantize_dynamic(
        model_input=dest_onnx,
        model_output=dest_int8,
        weight_type=QuantType.QUInt8
    )
    int8_size_mb = os.path.getsize(dest_int8) / (1024 * 1024)
    print(f"🎉 INT8 Quantized ONNX saved: {dest_int8} ({int8_size_mb:.2f} MB)")
    print(f"💡 Compression ratio: {(1 - int8_size_mb / onnx_size_mb) * 100:.1f}% size reduction!")

    # 5. FP16 Quantization via ONNX export
    print("\n⚡ [Step 3/3] Exporting FP16 Half-precision ONNX...")
    try:
        fp16_pt = os.path.join(EXPORT_DIR, "temp_fp16.pt")
        shutil.copy(dest_pt, fp16_pt)
        m_fp16 = YOLO(fp16_pt)
        exported_fp16 = m_fp16.export(format="onnx", imgsz=320, half=True, dynamic=False)
        dest_fp16 = os.path.join(EXPORT_DIR, "best_fp16.onnx")
        if os.path.exists(exported_fp16):
            shutil.move(exported_fp16, dest_fp16)
        if os.path.exists(fp16_pt):
            os.remove(fp16_pt)
        fp16_size_mb = os.path.getsize(dest_fp16) / (1024 * 1024)
        print(f"🎉 FP16 ONNX saved: {dest_fp16} ({fp16_size_mb:.2f} MB)")
    except Exception as e:
        print(f"ℹ️ FP16 Export note: {e}")
        dest_fp16 = None
        fp16_size_mb = None

    # 6. Benchmark Inference Speeds
    print("\n⏱️ Benchmarking Inference Latency...")
    # Test ONNX Runtime session
    session_fp32 = ort.InferenceSession(dest_onnx)
    input_name = session_fp32.get_inputs()[0].name
    import numpy as np
    dummy_input = np.random.randn(1, 3, 320, 320).astype(np.float32)

    # Warmup
    for _ in range(5):
        session_fp32.run(None, {input_name: dummy_input})

    # Benchmark FP32
    t0 = time.time()
    for _ in range(50):
        session_fp32.run(None, {input_name: dummy_input})
    fp32_latency = (time.time() - t0) / 50 * 1000

    # Benchmark INT8
    session_int8 = ort.InferenceSession(dest_int8)
    for _ in range(5):
        session_int8.run(None, {input_name: dummy_input})
    t0 = time.time()
    for _ in range(50):
        session_int8.run(None, {input_name: dummy_input})
    int8_latency = (time.time() - t0) / 50 * 1000

    print(f"   - Standard ONNX (FP32) Latency: {fp32_latency:.2f} ms / frame ({1000/fp32_latency:.1f} FPS)")
    print(f"   - Quantized ONNX (INT8) Latency: {int8_latency:.2f} ms / frame ({1000/int8_latency:.1f} FPS)")

    # 7. Write comprehensive SUMMARY.md
    summary_path = os.path.join(EXPORT_DIR, "SUMMARY.md")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("# 🥾 Safety Shoes Detection - Model Export & Quantization Report\n\n")
        f.write(f"**Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 1. Final Model Performance\n\n")
        f.write(f"- **mAP@50:** `{map50 * 100:.2f}%`\n")
        f.write(f"- **mAP@50-95:** `{map50_95 * 100:.2f}%`\n")
        f.write(f"- **Precision:** `{precision * 100:.2f}%`\n")
        f.write(f"- **Recall:** `{recall * 100:.2f}%`\n\n")
        f.write("### Per-Class Detection Metrics:\n\n")
        f.write("| Class | Precision | Recall | mAP50 | mAP50-95 |\n")
        f.write("| :--- | :---: | :---: | :---: | :---: |\n")
        class_names = val_res.names
        for cls_id in sorted(class_names.keys()):
            c_name = class_names[cls_id]
            cp = val_res.box.p[cls_id] if cls_id < len(val_res.box.p) else 0.0
            cr = val_res.box.r[cls_id] if cls_id < len(val_res.box.r) else 0.0
            cmap50 = val_res.box.all_ap[cls_id][0] if hasattr(val_res.box, 'all_ap') and cls_id < len(val_res.box.all_ap) else 0.0
            cmap_all = val_res.box.ap[cls_id] if cls_id < len(val_res.box.ap) else 0.0
            f.write(f"| **{c_name}** | {cp*100:.1f}% | {cr*100:.1f}% | {cmap50*100:.1f}% | {cmap_all*100:.1f}% |\n")

        f.write("\n## 2. Exported Models & Quantization Comparison\n\n")
        f.write("| Model File | Format | Precision | File Size | Latency (CPU) | Speed (FPS) |\n")
        f.write("| :--- | :--- | :---: | :---: | :---: | :---: |\n")
        f.write(f"| `best.pt` | PyTorch | FP32 | {pt_size_mb:.2f} MB | - | - |\n")
        f.write(f"| `best.onnx` | ONNX | FP32 | {onnx_size_mb:.2f} MB | {fp32_latency:.2f} ms | {1000/fp32_latency:.1f} FPS |\n")
        f.write(f"| `best_int8.onnx` | ONNX (Quantized) | **INT8** | **{int8_size_mb:.2f} MB** | **{int8_latency:.2f} ms** | **{1000/int8_latency:.1f} FPS** |\n")
        if dest_fp16 and fp16_size_mb:
            f.write(f"| `best_fp16.onnx` | ONNX (Quantized) | FP16 | {fp16_size_mb:.2f} MB | - | - |\n")

        f.write("\n## 3. How to Use the Models for Inference\n\n")
        f.write("### Using ONNX Runtime (Recommended for deployment & INT8):\n```python\n")
        f.write("import onnxruntime as ort\n")
        f.write("import numpy as np\n\n")
        f.write("# Load quantized INT8 model\n")
        f.write("session = ort.InferenceSession('exported_models/best_int8.onnx')\n")
        f.write("input_name = session.get_inputs()[0].name\n\n")
        f.write("# Input: normalized image (1, 3, 320, 320) float32 in range [0, 1]\n")
        f.write("outputs = session.run(None, {input_name: img_tensor})\n")
        f.write("```\n\n")
        f.write("### Using Ultralytics YOLO directly:\n```python\n")
        f.write("from ultralytics import YOLO\n\n")
        f.write("# Load PyTorch or ONNX model\n")
        f.write("model = YOLO('exported_models/best_int8.onnx')\n")
        f.write("results = model.predict(source='path/to/test.jpg', imgsz=320, conf=0.25)\n")
        f.write("results[0].show()\n")
        f.write("```\n")

    print(f"\n✨ SUMMARY WRITTEN TO: {summary_path}")
    print("=" * 60)
    print("🎉 ALL TASKS FINISHED SUCCESSFULLY! MODEL IS READY FOR USE!")
    print("=" * 60)

if __name__ == "__main__":
    main()
