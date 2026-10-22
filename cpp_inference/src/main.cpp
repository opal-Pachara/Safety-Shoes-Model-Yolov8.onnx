#include "YoloDetector.hpp"

#include <iostream>
#include <string>
#include <vector>
#include <iomanip>
#include <chrono>

void printUsage(const char* prog) {
    std::cout << "\n======================================================\n";
    std::cout << " 🥾 Safety Shoes YOLOv8 C++ ONNX Runtime Engine\n";
    std::cout << " Optimized for High Performance & Low Resource Server\n";
    std::cout << "======================================================\n";
    std::cout << "Usage:\n";
    std::cout << "  " << prog << " [options]\n\n";
    std::cout << "Options:\n";
    std::cout << "  --model <path>      Path to ONNX model (FP32 or INT8, default: models/best.onnx)\n";
    std::cout << "  --image <path>      Path to input image for inference\n";
    std::cout << "  --output <path>     Path to save annotated output image (default: output.jpg)\n";
    std::cout << "  --conf <float>      Confidence threshold (default: 0.25)\n";
    std::cout << "  --nms <float>       NMS IoU threshold (default: 0.45)\n";
    std::cout << "  --threads <int>     Number of CPU intra-op threads (default: 2)\n";
    std::cout << "  --benchmark <int>   Run benchmark for N iterations to measure throughput\n";
    std::cout << "  --json              Print full JSON response to stdout\n";
    std::cout << "  --help              Display this help menu\n\n";
    std::cout << "Examples:\n";
    std::cout << "  " << prog << " --model models/best_int8.onnx --image test.jpg --output res.jpg\n";
    std::cout << "  " << prog << " --model models/best.onnx --image test.jpg --benchmark 50\n\n";
}

int main(int argc, char** argv) {
    std::string model_path = "models/best.onnx";
    std::string image_path = "";
    std::string output_path = "output.jpg";
    float conf_thresh = 0.25f;
    float nms_thresh = 0.45f;
    int num_threads = 2;
    int benchmark_runs = 0;
    bool print_json = false;

    // Parse command line arguments
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--help" || arg == "-h") {
            printUsage(argv[0]);
            return 0;
        } else if (arg == "--model" && i + 1 < argc) {
            model_path = argv[++i];
        } else if (arg == "--image" && i + 1 < argc) {
            image_path = argv[++i];
        } else if (arg == "--output" && i + 1 < argc) {
            output_path = argv[++i];
        } else if (arg == "--conf" && i + 1 < argc) {
            conf_thresh = std::stof(argv[++i]);
        } else if (arg == "--nms" && i + 1 < argc) {
            nms_thresh = std::stof(argv[++i]);
        } else if (arg == "--threads" && i + 1 < argc) {
            num_threads = std::stoi(argv[++i]);
        } else if (arg == "--benchmark" && i + 1 < argc) {
            benchmark_runs = std::stoi(argv[++i]);
        } else if (arg == "--json") {
            print_json = true;
        }
    }

    if (image_path.empty()) {
        std::cerr << "[Warning] No --image provided. Searching for default test images...\n";
        // Check fallback paths
        std::vector<std::string> test_candidates = {
            "test.jpg",
            "../runs/yolo12n-safety_shoes/train_batch0.jpg",
            "../runs/yolo12n-safety_shoes/train_batch1.jpg"
        };
        for (const auto& c : test_candidates) {
            FILE* f = fopen(c.c_str(), "r");
            if (f) {
                fclose(f);
                image_path = c;
                std::cout << "-> Auto-selected test image: " << image_path << "\n";
                break;
            }
        }
    }

    if (image_path.empty()) {
        std::cerr << "[Error] Please specify an image using --image <path>\n";
        printUsage(argv[0]);
        return 1;
    }

    // Load image
    cv::Mat image = cv::imread(image_path);
    if (image.empty()) {
        std::cerr << "[Error] Failed to open image: " << image_path << "\n";
        return 1;
    }

    // Configure detector
    safety_shoes::DetectorConfig config;
    config.model_path = model_path;
    config.input_width = 320;
    config.input_height = 320;
    config.conf_threshold = conf_thresh;
    config.nms_threshold = nms_thresh;
    config.num_threads = num_threads;

    std::cout << "\n🚀 Initializing YOLOv8 ONNX Runtime Session..." << std::endl;
    std::cout << "   - Model:       " << config.model_path << std::endl;
    std::cout << "   - Input Size:  " << config.input_width << "x" << config.input_height << " (Static Shape)" << std::endl;
    std::cout << "   - CPU Threads: " << config.num_threads << std::endl;
    std::cout << "   - Confidence:  " << config.conf_threshold << std::endl;
    std::cout << "   - NMS IoU:     " << config.nms_threshold << std::endl;

    safety_shoes::YoloDetector detector(config);

    // Warmup
    detector.detect(image);

    // Run inference
    auto result = detector.detect(image);

    std::cout << "\n🎯 Inference Finished Successfully!" << std::endl;
    std::cout << "   - Preprocess:  " << std::fixed << std::setprecision(2) << result.preprocess_time_ms << " ms" << std::endl;
    std::cout << "   - Inference:   " << result.inference_time_ms << " ms" << std::endl;
    std::cout << "   - Postprocess: " << result.postprocess_time_ms << " ms" << std::endl;
    std::cout << "   - Total:       " << result.total_time_ms << " ms (" 
              << (result.total_time_ms > 0 ? 1000.0 / result.total_time_ms : 0.0) << " FPS)" << std::endl;
    std::cout << "   - Detections:  " << result.detections.size() << " object(s) found" << std::endl;

    if (!result.detections.empty()) {
        std::cout << "\n📋 Detection List:\n";
        std::cout << "  ----------------------------------------------------------------------\n";
        std::cout << "  | #  | Class Name      | Confidence | Box [X, Y, W, H]               |\n";
        std::cout << "  ----------------------------------------------------------------------\n";
        for (size_t i = 0; i < result.detections.size(); ++i) {
            const auto& d = result.detections[i];
            std::cout << "  | " << std::setw(2) << (i + 1) << " | "
                      << std::setw(15) << std::left << d.class_name << " | "
                      << std::setw(9) << std::right << std::fixed << std::setprecision(1) << (d.confidence * 100.0f) << "% | "
                      << "[" << std::setw(4) << d.box.x << ", " << std::setw(4) << d.box.y << ", "
                      << std::setw(4) << d.box.width << ", " << std::setw(4) << d.box.height << "] |\n";
        }
        std::cout << "  ----------------------------------------------------------------------\n";
    }

    // Benchmark mode if requested
    if (benchmark_runs > 0) {
        std::cout << "\n⏱️ Running Benchmark for " << benchmark_runs << " iterations...\n";
        double total_time = 0.0;
        double min_time = 1e9;
        double max_time = 0.0;

        for (int i = 0; i < benchmark_runs; ++i) {
            auto bench_res = detector.detect(image);
            total_time += bench_res.total_time_ms;
            min_time = std::min(min_time, bench_res.total_time_ms);
            max_time = std::max(max_time, bench_res.total_time_ms);
        }

        double avg_time = total_time / benchmark_runs;
        std::cout << "📊 Benchmark Summary:\n";
        std::cout << "   - Average Latency: " << std::fixed << std::setprecision(2) << avg_time << " ms\n";
        std::cout << "   - Min Latency:     " << min_time << " ms\n";
        std::cout << "   - Max Latency:     " << max_time << " ms\n";
        std::cout << "   - Average FPS:     " << (1000.0 / avg_time) << " FPS\n";
    }

    // Save annotated image
    cv::Mat visual = image.clone();
    safety_shoes::YoloDetector::drawDetections(visual, result.detections);
    if (cv::imwrite(output_path, visual)) {
        std::cout << "\n🖼️ Annotated result image saved to: " << output_path << std::endl;
    }

    // Print JSON if requested
    if (print_json) {
        std::cout << "\n📦 JSON Output:\n";
        std::cout << safety_shoes::YoloDetector::toJson(result, image.cols, image.rows) << std::endl;
    }

    return 0;
}
