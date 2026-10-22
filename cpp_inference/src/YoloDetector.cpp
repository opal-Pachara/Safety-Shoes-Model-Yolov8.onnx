#include "YoloDetector.hpp"

#include <iostream>
#include <chrono>
#include <cmath>
#include <algorithm>
#include <sstream>
#include <iomanip>

namespace safety_shoes {

YoloDetector::YoloDetector(const DetectorConfig& config)
    : config_(config),
      env_(ORT_LOGGING_LEVEL_WARNING, "YoloDetector"),
      memory_info_(Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)) {
    
    // 1. Configure session options for maximum CPU efficiency
    session_options_.SetIntraOpNumThreads(config_.num_threads);
    session_options_.SetInterOpNumThreads(1);
    session_options_.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);

    // 2. Initialize ONNX Runtime Session
#ifdef _WIN32
    std::wstring wpath(config_.model_path.begin(), config_.model_path.end());
    session_ = std::make_unique<Ort::Session>(env_, wpath.c_str(), session_options_);
#else
    session_ = std::make_unique<Ort::Session>(env_, config_.model_path.c_str(), session_options_);
#endif

    // 3. Extract Input & Output Names
    Ort::AllocatorWithDefaultOptions allocator;

    auto in_name_ptr = session_->GetInputNameAllocated(0, allocator);
    input_name_ = in_name_ptr.get();

    auto out_name_ptr = session_->GetOutputNameAllocated(0, allocator);
    output_name_ = out_name_ptr.get();

    // 4. Extract Input & Output Shapes
    auto input_type_info = session_->GetInputTypeInfo(0);
    auto input_tensor_info = input_type_info.GetTensorTypeAndShapeInfo();
    input_shape_ = input_tensor_info.GetShape();

    auto output_type_info = session_->GetOutputTypeInfo(0);
    auto output_tensor_info = output_type_info.GetTensorTypeAndShapeInfo();
    output_shape_ = output_tensor_info.GetShape();

    // Fix dynamic dimensions if needed
    if (input_shape_.size() >= 4) {
        if (input_shape_[0] <= 0) input_shape_[0] = 1;
        if (input_shape_[2] <= 0) input_shape_[2] = config_.input_height;
        if (input_shape_[3] <= 0) input_shape_[3] = config_.input_width;
    }

    // 5. Pre-allocate contiguous input float buffer (Zero reallocation per frame)
    size_t input_size = static_cast<size_t>(1 * 3 * config_.input_height * config_.input_width);
    input_tensor_values_.resize(input_size, 0.0f);
}

void YoloDetector::preprocess(const cv::Mat& image, float& scale, int& pad_x, int& pad_y) {
    // Calculate aspect-preserving letterbox scale
    float r = std::min(static_cast<float>(config_.input_width) / static_cast<float>(image.cols),
                       static_cast<float>(config_.input_height) / static_cast<float>(image.rows));

    int unpad_w = static_cast<int>(std::round(image.cols * r));
    int unpad_h = static_cast<int>(std::round(image.rows * r));
    int dw = config_.input_width - unpad_w;
    int dh = config_.input_height - unpad_h;

    pad_x = dw / 2;
    pad_y = dh / 2;
    scale = r;

    // Resize image
    cv::Mat resized;
    if (image.cols != unpad_w || image.rows != unpad_h) {
        cv::resize(image, resized, cv::Size(unpad_w, unpad_h), 0, 0, cv::INTER_LINEAR);
    } else {
        resized = image;
    }

    // Add symmetric border (letterbox padding with color 114)
    cv::Mat letterboxed;
    cv::copyMakeBorder(resized, letterboxed,
                       pad_y, dh - pad_y,
                       pad_x, dw - pad_x,
                       cv::BORDER_CONSTANT, cv::Scalar(114, 114, 114));

    // Convert BGR to RGB and pack CHW planar float32 in a single cache-friendly pass
    const int h = config_.input_height;
    const int w = config_.input_width;
    const int hw = h * w;
    float* ptr_r = input_tensor_values_.data();
    float* ptr_g = ptr_r + hw;
    float* ptr_b = ptr_g + hw;

    const float norm = 1.0f / 255.0f;
    for (int y = 0; y < h; ++y) {
        const uint8_t* row = letterboxed.ptr<uint8_t>(y);
        int offset = y * w;
        for (int x = 0; x < w; ++x) {
            int src_idx = x * 3;
            ptr_r[offset + x] = static_cast<float>(row[src_idx + 2]) * norm; // R
            ptr_g[offset + x] = static_cast<float>(row[src_idx + 1]) * norm; // G
            ptr_b[offset + x] = static_cast<float>(row[src_idx + 0]) * norm; // B
        }
    }
}

std::vector<Detection> YoloDetector::postprocess(const float* output_data, float scale, int pad_x, int pad_y, int orig_w, int orig_h) {
    // YOLOv8 output shape is [1, 4 + num_classes, num_proposals]
    // For 320x320: [1, 8, 2100] (8 channels: cx, cy, w, h + 4 classes; 2100 anchor predictions)
    int num_channels = 8;
    int num_proposals = 2100;

    if (output_shape_.size() == 3) {
        num_channels = static_cast<int>(output_shape_[1]);
        num_proposals = static_cast<int>(output_shape_[2]);
    }

    int num_classes = num_channels - 4;
    std::vector<cv::Rect> boxes;
    std::vector<float> confidences;
    std::vector<int> class_ids;

    boxes.reserve(64);
    confidences.reserve(64);
    class_ids.reserve(64);

    const float inv_scale = 1.0f / scale;

    for (int i = 0; i < num_proposals; ++i) {
        // Find best class score
        float max_score = -1.0f;
        int best_cls = -1;

        for (int c = 0; c < num_classes; ++c) {
            float score = output_data[(4 + c) * num_proposals + i];
            if (score > max_score) {
                max_score = score;
                best_cls = c;
            }
        }

        if (max_score >= config_.conf_threshold) {
            float cx = output_data[0 * num_proposals + i];
            float cy = output_data[1 * num_proposals + i];
            float w  = output_data[2 * num_proposals + i];
            float h  = output_data[3 * num_proposals + i];

            // Reconstruct coordinates and undo letterbox
            float x1 = (cx - 0.5f * w - static_cast<float>(pad_x)) * inv_scale;
            float y1 = (cy - 0.5f * h - static_cast<float>(pad_y)) * inv_scale;
            float box_w = w * inv_scale;
            float box_h = h * inv_scale;

            // Clamp to image dimensions
            int left = std::max(0, std::min(static_cast<int>(std::round(x1)), orig_w - 1));
            int top  = std::max(0, std::min(static_cast<int>(std::round(y1)), orig_h - 1));
            int width  = std::max(1, std::min(static_cast<int>(std::round(box_w)), orig_w - left));
            int height = std::max(1, std::min(static_cast<int>(std::round(box_h)), orig_h - top));

            boxes.emplace_back(left, top, width, height);
            confidences.push_back(max_score);
            class_ids.push_back(best_cls);
        }
    }

    // Apply Non-Maximum Suppression (NMS)
    std::vector<int> nms_indices;
    cv::dnn::NMSBoxes(boxes, confidences, config_.conf_threshold, config_.nms_threshold, nms_indices);

    std::vector<Detection> detections;
    detections.reserve(nms_indices.size());

    for (int idx : nms_indices) {
        Detection det;
        det.box = boxes[idx];
        det.confidence = confidences[idx];
        det.class_id = class_ids[idx];
        if (det.class_id >= 0 && det.class_id < static_cast<int>(config_.class_names.size())) {
            det.class_name = config_.class_names[det.class_id];
        } else {
            det.class_name = "class_" + std::to_string(det.class_id);
        }
        detections.push_back(det);
    }

    return detections;
}

InferenceResult YoloDetector::detect(const cv::Mat& image) {
    InferenceResult result;
    if (image.empty()) {
        std::cerr << "[YoloDetector] Error: Input image is empty!" << std::endl;
        return result;
    }

    auto t0 = std::chrono::high_resolution_clock::now();

    // 1. Preprocessing
    float scale = 1.0f;
    int pad_x = 0;
    int pad_y = 0;
    preprocess(image, scale, pad_x, pad_y);

    auto t1 = std::chrono::high_resolution_clock::now();

    // 2. Inference
    std::vector<int64_t> in_shape = {1, 3, config_.input_height, config_.input_width};
    Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
        memory_info_,
        input_tensor_values_.data(),
        input_tensor_values_.size(),
        in_shape.data(),
        in_shape.size()
    );

    const char* input_names[] = {input_name_.c_str()};
    const char* output_names[] = {output_name_.c_str()};

    auto output_tensors = session_->Run(
        Ort::RunOptions{nullptr},
        input_names,
        &input_tensor,
        1,
        output_names,
        1
    );

    auto t2 = std::chrono::high_resolution_clock::now();

    // 3. Postprocessing
    const float* output_data = output_tensors[0].GetTensorData<float>();
    result.detections = postprocess(output_data, scale, pad_x, pad_y, image.cols, image.rows);

    auto t3 = std::chrono::high_resolution_clock::now();

    // Timing calculations in milliseconds
    result.preprocess_time_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    result.inference_time_ms = std::chrono::duration<double, std::milli>(t2 - t1).count();
    result.postprocess_time_ms = std::chrono::duration<double, std::milli>(t3 - t2).count();
    result.total_time_ms = std::chrono::duration<double, std::milli>(t3 - t0).count();

    return result;
}

std::string YoloDetector::toJson(const InferenceResult& result, int image_width, int image_height) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(4);
    ss << "{\n";
    ss << "  \"success\": true,\n";
    ss << "  \"latency\": {\n";
    ss << "    \"preprocess_ms\": " << result.preprocess_time_ms << ",\n";
    ss << "    \"inference_ms\": " << result.inference_time_ms << ",\n";
    ss << "    \"postprocess_ms\": " << result.postprocess_time_ms << ",\n";
    ss << "    \"total_ms\": " << result.total_time_ms << ",\n";
    ss << "    \"fps\": " << (result.total_time_ms > 0 ? (1000.0 / result.total_time_ms) : 0.0) << "\n";
    ss << "  },\n";
    if (image_width > 0 && image_height > 0) {
        ss << "  \"image\": {\n";
        ss << "    \"width\": " << image_width << ",\n";
        ss << "    \"height\": " << image_height << "\n";
        ss << "  },\n";
    }
    ss << "  \"count\": " << result.detections.size() << ",\n";
    ss << "  \"detections\": [\n";

    for (size_t i = 0; i < result.detections.size(); ++i) {
        const auto& d = result.detections[i];
        ss << "    {\n";
        ss << "      \"class_id\": " << d.class_id << ",\n";
        ss << "      \"class_name\": \"" << d.class_name << "\",\n";
        ss << "      \"confidence\": " << d.confidence << ",\n";
        ss << "      \"box\": {\n";
        ss << "        \"x\": " << d.box.x << ",\n";
        ss << "        \"y\": " << d.box.y << ",\n";
        ss << "        \"w\": " << d.box.width << ",\n";
        ss << "        \"h\": " << d.box.height << "\n";
        ss << "      }\n";
        ss << "    }" << (i + 1 < result.detections.size() ? "," : "") << "\n";
    }

    ss << "  ]\n";
    ss << "}";
    return ss.str();
}

cv::Scalar YoloDetector::getClassColor(int class_id) {
    // Curated distinct color palette (BGR)
    switch (class_id) {
        case 0: return cv::Scalar(240, 150, 40);   // other_Shoes: Orange-Blue
        case 1: return cv::Scalar(50, 180, 255);   // FlipFlops: Amber/Gold
        case 2: return cv::Scalar(60, 220, 60);    // safety_Shoes: Green (Safe / Target)
        case 3: return cv::Scalar(80, 80, 240);    // Normal_Shoes: Red/Coral
        default: return cv::Scalar(200, 200, 200); // Default: Light Gray
    }
}

void YoloDetector::drawDetections(cv::Mat& image, const std::vector<Detection>& detections) {
    for (const auto& det : detections) {
        cv::Scalar color = getClassColor(det.class_id);

        // Draw bounding box
        cv::rectangle(image, det.box, color, 2);

        // Prepare label text
        std::ostringstream label_ss;
        label_ss << det.class_name << " " << std::fixed << std::setprecision(1) << (det.confidence * 100.0f) << "%";
        std::string label = label_ss.str();

        int base_line = 0;
        cv::Size text_size = cv::getTextSize(label, cv::FONT_HERSHEY_SIMPLEX, 0.5, 1, &base_line);

        // Label background rectangle
        int top = std::max(det.box.y, text_size.height + 4);
        cv::Rect label_rect(det.box.x, top - text_size.height - 4, text_size.width + 8, text_size.height + 6);
        cv::rectangle(image, label_rect, color, cv::FILLED);

        // Label text (White / Dark depending on contrast)
        cv::putText(image, label, cv::Point(det.box.x + 4, top - 2),
                    cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(0, 0, 0), 1, cv::LINE_AA);
    }
}

} // namespace safety_shoes
