import os
import time
from typing import List, Dict, Tuple, Optional
import numpy as np
import cv2
import onnxruntime as ort

from .config import settings
from .schemas import Detection

class YoloONNXDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.MODEL_PATH
        self.session: Optional[ort.InferenceSession] = None
        self.input_name: Optional[str] = None
        self.output_name: Optional[str] = None
        self.input_shape: List = []
        self.output_shape: List = []
        self.class_names: List[str] = settings.CLASS_NAMES
        self.violation_classes: set = settings.VIOLATION_CLASSES
        self.compliant_classes: set = settings.COMPLIANT_CLASSES
        self.is_loaded = False
        self.load_error: Optional[str] = None

        self._load_model()

    def _load_model(self) -> None:
        """Load ONNX model and initialize ONNX Runtime session."""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found at: {self.model_path}")

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = min(4, os.cpu_count() or 2)
            opts.inter_op_num_threads = 1
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self.session = ort.InferenceSession(self.model_path, opts)

            inputs = self.session.get_inputs()
            outputs = self.session.get_outputs()

            self.input_name = inputs[0].name
            self.output_name = outputs[0].name
            self.input_shape = list(inputs[0].shape)
            self.output_shape = list(outputs[0].shape)

            self.is_loaded = True
            self.load_error = None
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)

    def preprocess(self, img: np.ndarray) -> Tuple[np.ndarray, float, int, int]:
        """
        Aspect-preserving letterbox resizing with padding to 320x320.
        Returns:
            blob: np.ndarray shape (1, 3, 320, 320) float32 normalized [0, 1]
            scale: float scaling factor
            pad_x: int horizontal padding
            pad_y: int vertical padding
        """
        orig_h, orig_w = img.shape[:2]
        target_w = settings.INPUT_WIDTH
        target_h = settings.INPUT_HEIGHT

        scale = min(target_w / orig_w, target_h / orig_h)
        unpad_w = int(round(orig_w * scale))
        unpad_h = int(round(orig_h * scale))

        pad_x = (target_w - unpad_w) // 2
        pad_y = (target_h - unpad_h) // 2

        if orig_w != unpad_w or orig_h != unpad_h:
            resized = cv2.resize(img, (unpad_w, unpad_h), interpolation=cv2.INTER_LINEAR)
        else:
            resized = img

        letterboxed = cv2.copyMakeBorder(
            resized,
            pad_y,
            target_h - unpad_h - pad_y,
            pad_x,
            target_w - unpad_w - pad_x,
            cv2.BORDER_CONSTANT,
            value=(114, 114, 114)
        )

        # Convert BGR -> RGB
        rgb = cv2.cvtColor(letterboxed, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        # Transpose HWC -> CHW and add batch dimension
        blob = np.transpose(rgb, (2, 0, 1))
        blob = np.expand_dims(blob, axis=0)

        return blob, scale, pad_x, pad_y

    def detect(
        self,
        image: np.ndarray,
        thresholds: Optional[Dict[str, float]] = None,
        nms_iou_threshold: float = settings.DEFAULT_NMS_THRESHOLD
    ) -> Tuple[List[Detection], float]:
        """
        Run inference on OpenCV image (BGR).
        Returns:
            detections: List[Detection]
            backend_time_ms: float execution time in milliseconds
        """
        if not self.is_loaded or self.session is None:
            raise RuntimeError(f"Model not loaded: {self.load_error}")

        t_start = time.perf_counter()

        orig_h, orig_w = image.shape[:2]
        thresh_map = dict(settings.DEFAULT_THRESHOLDS)
        if thresholds:
            thresh_map.update(thresholds)

        # 1. Preprocess
        blob, scale, pad_x, pad_y = self.preprocess(image)

        # 2. Inference
        raw_output = self.session.run([self.output_name], {self.input_name: blob})[0]

        # 3. Postprocess
        # raw_output shape: [1, 8, 2100] -> transpose to [2100, 8]
        preds = raw_output[0].T
        boxes_raw = preds[:, :4]
        class_scores = preds[:, 4:]

        boxes_list = []
        confs_list = []
        class_ids_list = []

        num_classes = len(self.class_names)

        for i in range(preds.shape[0]):
            scores = class_scores[i]
            best_cls = int(np.argmax(scores))
            if best_cls >= num_classes:
                continue

            max_conf = float(scores[best_cls])
            cls_name = self.class_names[best_cls]
            required_threshold = thresh_map.get(cls_name, 0.50)

            if max_conf >= required_threshold:
                cx, cy, w, h = boxes_raw[i]

                # Undo letterbox & scale to original coordinates
                x1 = (cx - 0.5 * w - pad_x) / scale
                y1 = (cy - 0.5 * h - pad_y) / scale
                x2 = (cx + 0.5 * w - pad_x) / scale
                y2 = (cy + 0.5 * h - pad_y) / scale

                # Clamp to image boundaries
                x1_clamped = max(0, min(int(round(x1)), orig_w - 1))
                y1_clamped = max(0, min(int(round(y1)), orig_h - 1))
                x2_clamped = max(x1_clamped + 1, min(int(round(x2)), orig_w))
                y2_clamped = max(y1_clamped + 1, min(int(round(y2)), orig_h))

                box_w = x2_clamped - x1_clamped
                box_h = y2_clamped - y1_clamped

                boxes_list.append([x1_clamped, y1_clamped, box_w, box_h])
                confs_list.append(max_conf)
                class_ids_list.append(best_cls)

        # 4. Non-Maximum Suppression (NMS)
        detections: List[Detection] = []
        if boxes_list:
            # We use lowest threshold among classes for cv2.dnn.NMSBoxes
            min_thresh = min(thresh_map.values())
            indices = cv2.dnn.NMSBoxes(boxes_list, confs_list, min_thresh, nms_iou_threshold)
            if len(indices) > 0:
                for idx in indices.flatten():
                    cid = class_ids_list[idx]
                    cname = self.class_names[cid]
                    box_xywh = boxes_list[idx]
                    box_xyxy = [
                        box_xywh[0],
                        box_xywh[1],
                        box_xywh[0] + box_xywh[2],
                        box_xywh[1] + box_xywh[3]
                    ]
                    detections.append(
                        Detection(
                            class_id=cid,
                            class_name=cname,
                            confidence=round(confs_list[idx], 4),
                            box=box_xywh,
                            box_xyxy=box_xyxy,
                            is_violation=(cname in self.violation_classes)
                        )
                    )

        t_end = time.perf_counter()
        backend_time_ms = round((t_end - t_start) * 1000.0, 2)

        return detections, backend_time_ms

    def smoke_test(self) -> Tuple[bool, Optional[float], Optional[str]]:
        """Run a fast smoke test on a synthetic frame to verify inference works."""
        if not self.is_loaded:
            return False, None, self.load_error or "Model is not loaded"

        try:
            dummy_img = np.full((320, 320, 3), 114, dtype=np.uint8)
            t0 = time.perf_counter()
            _, _ = self.detect(dummy_img)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            return True, latency_ms, None
        except Exception as e:
            return False, None, str(e)

# Global singleton detector
detector = YoloONNXDetector()
