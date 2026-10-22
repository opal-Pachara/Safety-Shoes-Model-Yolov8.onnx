import os
import unittest
import numpy as np
import cv2

from backend.app.detector import YoloONNXDetector
from backend.app.config import settings

class TestYoloDetector(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.detector = YoloONNXDetector(settings.MODEL_PATH)

    def test_model_loaded(self):
        self.assertTrue(self.detector.is_loaded, f"Model failed to load: {self.detector.load_error}")
        self.assertEqual(len(self.detector.class_names), 4)
        self.assertIn("safety_Shoes", self.detector.class_names)
        self.assertIn("other_Shoes", self.detector.class_names)
        self.assertIn("FlipFlops", self.detector.class_names)
        self.assertIn("Normal_Shoes", self.detector.class_names)

    def test_preprocess_shape(self):
        dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
        blob, scale, pad_x, pad_y = self.detector.preprocess(dummy_img)

        self.assertEqual(blob.shape, (1, 3, 320, 320))
        self.assertEqual(blob.dtype, np.float32)
        self.assertGreaterEqual(scale, 0.0)
        self.assertGreaterEqual(pad_x, 0)
        self.assertGreaterEqual(pad_y, 0)

    def test_smoke_test(self):
        ok, latency, err = self.detector.smoke_test()
        self.assertTrue(ok, f"Smoke test failed: {err}")
        self.assertIsNotNone(latency)
        self.assertGreater(latency, 0)

    def test_detection_on_sample_flipflops(self):
        img_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "test_samples", "sample_flipflops.jpg"
        )
        if os.path.exists(img_path):
            img = cv2.imread(img_path)
            detections, lat = self.detector.detect(img, thresholds={"FlipFlops": 0.50})
            classes = [d.class_name for d in detections]
            self.assertIn("FlipFlops", classes)
            # FlipFlops should be flagged as violation
            self.assertTrue(any(d.is_violation for d in detections))

    def test_detection_on_sample_safety_shoes(self):
        img_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "test_samples", "sample_safety_shoes.jpg"
        )
        if os.path.exists(img_path):
            img = cv2.imread(img_path)
            detections, lat = self.detector.detect(img, thresholds={"safety_Shoes": 0.50})
            classes = [d.class_name for d in detections]
            self.assertIn("safety_Shoes", classes)
            safety_det = [d for d in detections if d.class_name == "safety_Shoes"][0]
            self.assertFalse(safety_det.is_violation)

    def test_empty_image_thresholding(self):
        # A completely black image should have no detections at standard thresholds
        blank = np.zeros((320, 320, 3), dtype=np.uint8)
        detections, lat = self.detector.detect(blank)
        self.assertEqual(len(detections), 0)

if __name__ == "__main__":
    unittest.main()
