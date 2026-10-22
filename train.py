import torch
from ultralytics import YOLO

def main():
    # Detect hardware acceleration: Apple Silicon (mps), NVIDIA (0), or CPU
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = 0
    else:
        device = "cpu"
    print(f"🚀 Using device: {device}")

    # Load YOLOv8n (highly optimized for Apple Silicon MPS, ~2 min/epoch)
    model = YOLO("yolov8n.pt")

    # Start training
    model.train(
        data="/Users/phatchara/Downloads/safety-shoes/data.yaml",
        epochs=500,     # Train up to 500 epochs
        patience=50,    # Early stopping: automatically stops when accuracy peaks
        imgsz=320,      # 320 is super fast on MPS and yields great detection accuracy
        batch=16,
        workers=2,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,
        device=device,
        project="/Users/phatchara/Desktop/train-model/runs",
        name="yolov8n-safety_shoes",
        plots=True,
        save=True
    )

if __name__ == "__main__":
    main()
