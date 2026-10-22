import os
import unittest
import io
import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["model_loaded"])

    def test_preflight_endpoint(self):
        res = self.client.get("/api/preflight")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["model_loaded"])
        self.assertTrue(data["smoke_test_passed"])
        self.assertEqual(len(data["class_names"]), 4)
        self.assertTrue(len(data["known_risks"]) >= 2)

    def test_detect_upload_valid_image(self):
        img_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "test_samples", "sample_safety_shoes.jpg"
        )
        with open(img_path, "rb") as f:
            file_bytes = f.read()

        response = self.client.post(
            "/api/detect/upload",
            files={"file": ("sample.jpg", file_bytes, "image/jpeg")},
            data={"conf_safety_shoes": "0.50"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertGreater(data["image_width"], 0)
        self.assertGreater(data["image_height"], 0)
        self.assertGreater(data["backend_time_ms"], 0)
        self.assertTrue(data["has_safety"])

    def test_detect_violation_image(self):
        img_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "test_samples", "sample_flipflops.jpg"
        )
        with open(img_path, "rb") as f:
            file_bytes = f.read()

        response = self.client.post(
            "/api/detect/frame",
            files={"file": ("frame.jpg", file_bytes, "image/jpeg")},
            data={"conf_flipflops": "0.50"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["has_violation"])
        self.assertIn("FlipFlops", data["violation_classes"])

    def test_detect_empty_file_bad_request(self):
        response = self.client.post(
            "/api/detect/upload",
            files={"file": ("empty.jpg", b"", "image/jpeg")}
        )
        self.assertEqual(response.status_code, 400)

    def test_detect_invalid_image_data_bad_request(self):
        response = self.client.post(
            "/api/detect/upload",
            files={"file": ("corrupt.jpg", b"not-a-real-jpeg-data", "image/jpeg")}
        )
        self.assertEqual(response.status_code, 400)

if __name__ == "__main__":
    unittest.main()
