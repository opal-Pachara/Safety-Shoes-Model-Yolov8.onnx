import os
from typing import List, Dict

class Settings:
    # Model configuration
    # Default model path pointing to exported_models/best.onnx
    DEFAULT_MODEL_PATH = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "exported_models", "best.onnx")
    )
    MODEL_PATH: str = os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH)

    # Class mappings matching best.onnx metadata exactly
    CLASS_NAMES: List[str] = [
        "other_Shoes",
        "FlipFlops",
        "safety_Shoes",
        "Normal_Shoes"
    ]

    # Classes that violate the safety shoe policy
    VIOLATION_CLASSES: set = {"other_Shoes", "FlipFlops", "Normal_Shoes"}
    COMPLIANT_CLASSES: set = {"safety_Shoes"}

    # Default thresholds per class (0.50 default per requirement)
    DEFAULT_THRESHOLDS: Dict[str, float] = {
        "safety_Shoes": 0.50,
        "other_Shoes": 0.50,
        "FlipFlops": 0.50,
        "Normal_Shoes": 0.50,
    }

    INPUT_WIDTH: int = 320
    INPUT_HEIGHT: int = 320
    DEFAULT_NMS_THRESHOLD: float = 0.45

    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS origins
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]

settings = Settings()
