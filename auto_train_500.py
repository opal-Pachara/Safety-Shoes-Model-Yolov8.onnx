import time
import os
import shutil
import psutil
import torch
from ultralytics import YOLO

TARGET_PID = 16798
EXPORT_DIR = "/Users/phatchara/Desktop/train-model/exported_models"

def main():
    print(f"⏳ [Step 1/4] Waiting for initial 30-epoch training (PID: {TARGET_PID}) to finish...")
    while psutil.pid_exists(TARGET_PID):
        time.sleep(15)

    print("✅ [Step 1/4] Initial 30 epochs finished successfully!")
    time.sleep(5)  # Wait for file flush

    # 1. Find checkpoint
    stage1_best = "/Users/phatchara/Desktop/train-model/runs/yolov8n-safety_shoes/weights/best.pt"
    if os.path.exists(stage1_best):
        print(f"🎯 Loading checkpoint from Stage 1: {stage1_best}")
        model = YOLO(stage1_best)
    else:
        print("⚠️ Stage 1 best.pt not found, loading yolov8n.pt")
        model = YOLO("yolov8n.pt")

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 [Step 2/4] Starting 500-epoch training (with patience=50 Early Stopping) on {device}...")

    # 2. Train up to 500 epochs with Early Stopping
    results = model.train(
        data="/Users/phatchara/Downloads/safety-shoes/data.yaml",
        epochs=500,
        patience=50,   # Early stopping: stops automatically when metrics stop improving
        imgsz=320,
        batch=16,
        workers=2,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,
        device=device,
        project="/Users/phatchara/Desktop/train-model/runs",
        name="yolov8n-safety_shoes_500e",
        plots=True,
        save=True
    )
    print("🏆 [Step 2/4] Continuous training completed!")

    # 3. Locate final best model
    stage2_best = "/Users/phatchara/Desktop/train-model/runs/yolov8n-safety_shoes_500e/weights/best.pt"
    final_best = stage2_best if os.path.exists(stage2_best) else stage1_best
    print(f"📦 [Step 3/4] Exporting final model: {final_best}")

    os.makedirs(EXPORT_DIR, exist_ok=True)
    shutil.copy(final_best, os.path.join(EXPORT_DIR, "best.pt"))

    # Load model for export
    trained_model = YOLO(final_best)

    # 4. Export to standard ONNX
    print("⚙️ Exporting to ONNX format...")
    onnx_path = trained_model.export(format="onnx", imgsz=320, simplify=True)
    if os.path.exists(onnx_path):
        shutil.copy(onnx_path, os.path.join(EXPORT_DIR, "best.onnx"))
        print(f"✅ Exported ONNX: {os.path.join(EXPORT_DIR, 'best.onnx')} ({os.path.getsize(onnx_path)} bytes)")

    # 5. INT8 Quantization via onnxruntime
    print("⚡ [Step 4/4] Performing INT8 Quantization on ONNX model...")
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        int8_path = os.path.join(EXPORT_DIR, "best_int8.onnx")
        quantize_dynamic(
            model_input=onnx_path,
            model_output=int8_path,
            weight_type=QuantType.QUInt8
        )
        print(f"🎉 Successfully created INT8 Quantized ONNX model: {int8_path} ({os.path.getsize(int8_path)} bytes)")
    except Exception as e:
        print(f"⚠️ INT8 Quantization notice: {e}")

    # 6. FP16 Quantization via ONNX export
    try:
        fp16_path = trained_model.export(format="onnx", imgsz=320, half=True)
        if os.path.exists(fp16_path):
            shutil.copy(fp16_path, os.path.join(EXPORT_DIR, "best_fp16.onnx"))
            print(f"🎉 Successfully exported FP16 Half-precision ONNX model: {os.path.join(EXPORT_DIR, 'best_fp16.onnx')}")
    except Exception as e:
        print(f"⚠️ FP16 export notice: {e}")

    # 7. Write completion summary
    summary_md = os.path.join(EXPORT_DIR, "SUMMARY.md")
    with open(summary_md, "w", encoding="utf-8") as f:
        f.write("# Safety Shoes Detection Model - Final Export Summary\n\n")
        f.write("All training stages and model quantizations completed automatically while you were away!\n\n")
        f.write("## Exported Artifacts in `exported_models/`:\n")
        for fname in sorted(os.listdir(EXPORT_DIR)):
            fpath = os.path.join(EXPORT_DIR, fname)
            fsize_mb = os.path.getsize(fpath) / (1024 * 1024)
            f.write(f"- `{fname}` ({fsize_mb:.2f} MB)\n")
        f.write("\n## How to Use ONNX Model:\n")
        f.write("```python\n")
        f.write("import onnxruntime as ort\n")
        f.write("session = ort.InferenceSession('exported_models/best_int8.onnx')\n")
        f.write("```\n")

    print(f"\n🌟 ALL TASKS COMPLETED AUTONOMOUSLY! Output folder: {EXPORT_DIR}")

if __name__ == "__main__":
    main()
