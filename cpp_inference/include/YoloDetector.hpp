#pragma once

#include <string>
#include <vector>
#include <memory>
#include <opencv2/opencv.hpp>
#include <onnxruntime_cxx_api.h>

namespace safety_shoes {

/**
 * @brief Detection bounding box and metadata
 */
struct Detection {
    cv::Rect box;            // Bounding box in original image coordinates
    float confidence;        // Confidence score [0.0, 1.0]
    int class_id;            // Class index (0: other_Shoes, 1: FlipFlops, 2: safety_Shoes, 3: Normal_Shoes)
    std::string class_name;  // Human-readable class name
};

/**
 * @brief Complete inference result with latency metrics
 */
struct InferenceResult {
    std::vector<Detection> detections;
    double preprocess_time_ms = 0.0;
    double inference_time_ms = 0.0;
    double postprocess_time_ms = 0.0;
    double total_time_ms = 0.0;
};

/**
 * @brief Configuration parameters for the YOLOv8 detector
 */
struct DetectorConfig {
    std::string model_path;                          // Path to .onnx file (FP32 or INT8)
    int input_width = 320;                           // Model input width (default 320 for speed)
    int input_height = 320;                          // Model input height (default 320 for speed)
    float conf_threshold = 0.25f;                    // Minimum confidence to accept detection
    float nms_threshold = 0.45f;                     // Non-maximum suppression IoU threshold
    int num_threads = 2;                             // CPU execution threads (recommended: 1-2 on Render)
    std::vector<std::string> class_names = {
        "other_Shoes",
        "FlipFlops",
        "safety_Shoes",
        "Normal_Shoes"
    };
};

/**
 * @brief High-performance YOLOv8 ONNX Runtime C++ detector
 * Optimized for low-latency, low-memory CPU environments (Render/Cloud containers).
 */
class YoloDetector {
public:
    explicit YoloDetector(const DetectorConfig& config);
    ~YoloDetector() = default;

    // Disallow copy to avoid shared ORT session issues
    YoloDetector(const YoloDetector&) = delete;
    YoloDetector& operator=(const YoloDetector&) = delete;

    // Allow move semantics
    YoloDetector(YoloDetector&&) noexcept = default;
    YoloDetector& operator=(YoloDetector&&) noexcept = default;

    /**
     * @brief Run inference on a BGR image (cv::Mat)
     * @param image Input image in BGR format
     * @return InferenceResult containing detections and timing benchmarks
     */
    InferenceResult detect(const cv::Mat& image);

    /**
     * @brief Convert detections and metrics to JSON string
     * Useful for web API responses (e.g. REST API, WebSocket)
     */
    static std::string toJson(const InferenceResult& result, int image_width = 0, int image_height = 0);

    /**
     * @brief Draw bounding boxes, labels, and confidence on the image
     */
    static void drawDetections(cv::Mat& image, const std::vector<Detection>& detections);

    /**
     * @brief Get class color for consistent visualization
     */
    static cv::Scalar getClassColor(int class_id);

private:
    DetectorConfig config_;

    // ONNX Runtime Core objects
    Ort::Env env_;
    Ort::SessionOptions session_options_;
    std::unique_ptr<Ort::Session> session_;
    Ort::MemoryInfo memory_info_;

    // Cached model I/O names and shapes
    std::string input_name_;
    std::string output_name_;
    std::vector<int64_t> input_shape_;
    std::vector<int64_t> output_shape_;

    // Pre-allocated contiguous memory buffer to eliminate per-frame allocations
    std::vector<float> input_tensor_values_;

    /**
     * @brief Letterbox resize preserving aspect ratio with zero-copy CHW planar packing
     */
    void preprocess(const cv::Mat& image, float& scale, int& pad_x, int& pad_y);

    /**
     * @brief Parse raw YOLOv8 tensor [1, 8, 2100] and apply NMS
     */
    std::vector<Detection> postprocess(const float* output_data, float scale, int pad_x, int pad_y, int orig_w, int orig_h);
};

} // namespace safety_shoes
