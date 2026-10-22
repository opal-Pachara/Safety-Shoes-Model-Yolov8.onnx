from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class Detection(BaseModel):
    class_id: int = Field(..., description="Numeric class index (0-3)")
    class_name: str = Field(..., description="Class name from model mapping")
    confidence: float = Field(..., description="Detection confidence score (0.0 - 1.0)")
    # [x, y, width, height] in original image coordinates
    box: List[int] = Field(..., description="Bounding box [x, y, w, h] in image pixels")
    # [x1, y1, x2, y2]
    box_xyxy: List[int] = Field(..., description="Bounding box [x1, y1, x2, y2] in image pixels")
    is_violation: bool = Field(..., description="True if class violates safety shoe policy")

class DetectionResponse(BaseModel):
    success: bool
    image_width: int
    image_height: int
    backend_time_ms: float
    detections: List[Detection]
    has_violation: bool = Field(..., description="True if at least one violation detected")
    has_safety: bool = Field(..., description="True if safety shoes detected")
    violation_classes: List[str] = Field(default_factory=list, description="Unique violation class names detected")
    timestamp: float

class HealthResponse(BaseModel):
    status: str
    service: str = "safety-shoes-detector"
    model_loaded: bool

class PreflightResponse(BaseModel):
    status: str  # "ok" or "error"
    model_loaded: bool
    model_path: str
    input_shape: List[Any]
    output_shape: List[Any]
    class_names: List[str]
    smoke_test_passed: bool
    smoke_test_latency_ms: Optional[float] = None
    known_risks: List[str]
    error_message: Optional[str] = None
