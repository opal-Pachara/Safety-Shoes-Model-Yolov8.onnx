import os
import time
from typing import Optional, Dict
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .detector import detector
from .schemas import (
    DetectionResponse,
    HealthResponse,
    PreflightResponse
)

app = FastAPI(
    title="Concrete Mixer Driver Safety Shoes Detector API",
    description="Detects whether concrete mixer drivers are wearing proper safety shoes using YOLO ONNX.",
    version="1.0.0"
)

# CORS configuration
# Allows explicit frontend origins and any dynamically provided origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

KNOWN_RISKS = [
    "Normal_Shoes has 0.0% precision, recall, and mAP in training evaluation. Detections for this class should be validated manually.",
    "safety_Shoes has 61.1% recall. Compliant safety shoes may be missed in extreme angles, low lighting, or partial occlusions.",
    "Absence of detection must NEVER be interpreted as compliance or safe status."
]


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Simple health check endpoint for monitoring and cold-start detection."""
    return HealthResponse(
        status="ok" if detector.is_loaded else "degraded",
        service="safety-shoes-detector",
        model_loaded=detector.is_loaded
    )


@app.get("/api/preflight", response_model=PreflightResponse)
async def preflight_check():
    """
    Comprehensive preflight readiness check.
    Verifies model presence, ONNX Runtime session, tensor shapes, class mappings,
    and runs a smoke inference test.
    """
    if not detector.is_loaded:
        return PreflightResponse(
            status="error",
            model_loaded=False,
            model_path=detector.model_path,
            input_shape=[],
            output_shape=[],
            class_names=detector.class_names,
            smoke_test_passed=False,
            smoke_test_latency_ms=None,
            known_risks=KNOWN_RISKS,
            error_message=detector.load_error or "Model failed to load"
        )

    smoke_ok, smoke_latency, smoke_err = detector.smoke_test()

    if not smoke_ok:
        return PreflightResponse(
            status="error",
            model_loaded=True,
            model_path=detector.model_path,
            input_shape=detector.input_shape,
            output_shape=detector.output_shape,
            class_names=detector.class_names,
            smoke_test_passed=False,
            smoke_test_latency_ms=None,
            known_risks=KNOWN_RISKS,
            error_message=f"Smoke test failed: {smoke_err}"
        )

    return PreflightResponse(
        status="ok",
        model_loaded=True,
        model_path=detector.model_path,
        input_shape=detector.input_shape,
        output_shape=detector.output_shape,
        class_names=detector.class_names,
        smoke_test_passed=True,
        smoke_test_latency_ms=smoke_latency,
        known_risks=KNOWN_RISKS,
        error_message=None
    )


async def _process_image_upload(
    file: UploadFile,
    conf_safety_shoes: float = 0.50,
    conf_other_shoes: float = 0.50,
    conf_flipflops: float = 0.50,
    conf_normal_shoes: float = 0.50
) -> DetectionResponse:
    """Helper to decode image upload and run YOLO ONNX detection."""
    if not detector.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Detector backend not ready: {detector.load_error or 'Model not loaded'}"
        )

    # Read binary bytes
    contents = await file.read()
    if not contents or len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # Check maximum payload size (15 MB safety limit)
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed limit of 15MB."
        )

    # Decode image using OpenCV
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Could not decode image."
        )

    orig_h, orig_w = image.shape[:2]

    thresholds: Dict[str, float] = {
        "safety_Shoes": max(0.0, min(1.0, conf_safety_shoes)),
        "other_Shoes": max(0.0, min(1.0, conf_other_shoes)),
        "FlipFlops": max(0.0, min(1.0, conf_flipflops)),
        "Normal_Shoes": max(0.0, min(1.0, conf_normal_shoes)),
    }

    detections, backend_time_ms = detector.detect(image, thresholds=thresholds)

    has_violation = any(d.is_violation for d in detections)
    has_safety = any(d.class_name in detector.compliant_classes for d in detections)
    violation_classes = list({d.class_name for d in detections if d.is_violation})

    return DetectionResponse(
        success=True,
        image_width=orig_w,
        image_height=orig_h,
        backend_time_ms=backend_time_ms,
        detections=detections,
        has_violation=has_violation,
        has_safety=has_safety,
        violation_classes=violation_classes,
        timestamp=time.time()
    )


@app.post("/api/detect/frame", response_model=DetectionResponse)
async def detect_frame(
    file: UploadFile = File(...),
    conf_safety_shoes: float = Form(0.50),
    conf_other_shoes: float = Form(0.50),
    conf_flipflops: float = Form(0.50),
    conf_normal_shoes: float = Form(0.50)
):
    """
    Inference endpoint for live video frames sent from browser.
    """
    return await _process_image_upload(
        file=file,
        conf_safety_shoes=conf_safety_shoes,
        conf_other_shoes=conf_other_shoes,
        conf_flipflops=conf_flipflops,
        conf_normal_shoes=conf_normal_shoes
    )


@app.post("/api/detect/upload", response_model=DetectionResponse)
async def detect_upload(
    file: UploadFile = File(...),
    conf_safety_shoes: float = Form(0.50),
    conf_other_shoes: float = Form(0.50),
    conf_flipflops: float = Form(0.50),
    conf_normal_shoes: float = Form(0.50)
):
    """
    Inference endpoint for standalone test image uploads.
    """
    return await _process_image_upload(
        file=file,
        conf_safety_shoes=conf_safety_shoes,
        conf_other_shoes=conf_other_shoes,
        conf_flipflops=conf_flipflops,
        conf_normal_shoes=conf_normal_shoes
    )


@app.get("/api/samples")
async def list_samples():
    """
    Returns available mock sample images for fast testing and UAT validation.
    """
    samples = [
        {
            "id": "flipflops",
            "filename": "sample_flipflops.jpg",
            "title": "รองเท้าแตะ (FlipFlops)",
            "scenario": "คนขับสวมรองเท้าแตะเดินลงจากรถโม่",
            "expected_status": "violation",
            "expected_class": "FlipFlops",
            "color": "red"
        },
        {
            "id": "safety_shoes",
            "filename": "sample_safety_shoes.jpg",
            "title": "รองเท้าเซฟตี้หัวเหล็ก (safety_Shoes)",
            "scenario": "คนขับสวมรองเท้าเซฟตี้ถูกต้องตามกฎ",
            "expected_status": "compliant",
            "expected_class": "safety_Shoes",
            "color": "green"
        },
        {
            "id": "other_shoes",
            "filename": "sample_other_shoes.jpg",
            "title": "รองเท้าผ้าใบ/ทั่วไป (other_Shoes)",
            "scenario": "คนขับสวมรองเท้าผ้าใบธรรมดาไม่ใช่เซฟตี้",
            "expected_status": "violation",
            "expected_class": "other_Shoes",
            "color": "amber"
        },
        {
            "id": "worker_other",
            "filename": "sample_worker_other_shoes.jpg",
            "title": "คนขับหน้างานจริง (other_Shoes)",
            "scenario": "ภาพคนขับเต็มตัวยืนข้างเครื่องจักร",
            "expected_status": "violation",
            "expected_class": "other_Shoes",
            "color": "amber"
        },
        {
            "id": "no_shoes",
            "filename": "sample_no_shoes.jpg",
            "title": "พื้นโรงงานคอนกรีต (ไม่พบรองเท้า)",
            "scenario": "บริเวณหน้าเคาน์เตอร์ไม่มีคนขับหรือรองเท้าในระยะกล้อง",
            "expected_status": "none",
            "expected_class": None,
            "color": "gray"
        }
    ]
    return {"samples": samples}


@app.get("/api/samples/{filename}")
async def get_sample_image(filename: str):
    """
    Serves a mock sample image file.
    """
    # Look in test_samples directory
    sample_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "test_samples")
    )
    file_path = os.path.join(sample_dir, filename)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Sample {filename} not found.")

    return FileResponse(file_path, media_type="image/jpeg")


@app.post("/api/detect/sample/{sample_id}", response_model=DetectionResponse)
async def detect_sample(
    sample_id: str,
    conf_safety_shoes: float = Form(0.50),
    conf_other_shoes: float = Form(0.50),
    conf_flipflops: float = Form(0.50),
    conf_normal_shoes: float = Form(0.50)
):
    """
    Directly run inference on a pre-loaded mock sample by sample ID.
    Enables instant one-click testing without requiring user file upload.
    """
    sample_id_to_filename = {
        "flipflops": "sample_flipflops.jpg",
        "safety_shoes": "sample_safety_shoes.jpg",
        "other_shoes": "sample_other_shoes.jpg",
        "worker_other": "sample_worker_other_shoes.jpg",
        "no_shoes": "sample_no_shoes.jpg",
    }

    filename = sample_id_to_filename.get(sample_id)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Unknown sample ID: {sample_id}")

    sample_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "test_samples")
    )
    file_path = os.path.join(sample_dir, filename)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Sample file {filename} not found on server.")

    image = cv2.imread(file_path)
    if image is None:
        raise HTTPException(status_code=500, detail="Could not read sample image file.")

    orig_h, orig_w = image.shape[:2]

    thresholds: Dict[str, float] = {
        "safety_Shoes": max(0.0, min(1.0, conf_safety_shoes)),
        "other_Shoes": max(0.0, min(1.0, conf_other_shoes)),
        "FlipFlops": max(0.0, min(1.0, conf_flipflops)),
        "Normal_Shoes": max(0.0, min(1.0, conf_normal_shoes)),
    }

    detections, backend_time_ms = detector.detect(image, thresholds=thresholds)

    has_violation = any(d.is_violation for d in detections)
    has_safety = any(d.class_name in detector.compliant_classes for d in detections)
    violation_classes = list({d.class_name for d in detections if d.is_violation})

    return DetectionResponse(
        success=True,
        image_width=orig_w,
        image_height=orig_h,
        backend_time_ms=backend_time_ms,
        detections=detections,
        has_violation=has_violation,
        has_safety=has_safety,
        violation_classes=violation_classes,
        timestamp=time.time()
    )


# Serve built frontend static files if available (useful for production deployment on Render)
dist_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)
if os.path.isdir(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Allow API endpoints to fall through
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(dist_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
