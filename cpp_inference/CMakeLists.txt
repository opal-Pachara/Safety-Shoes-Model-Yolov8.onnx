cmake_minimum_required(VERSION 3.16)
project(SafetyShoesYoloInference CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags for high-performance CPU execution
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang|AppleClang")
    add_compile_options(-O3 -march=native -ffast-math -Wall -Wextra)
endif()

# Find OpenCV
find_package(OpenCV REQUIRED)
message(STATUS "✅ Found OpenCV: ${OpenCV_VERSION}")

# Find ONNX Runtime C++
find_path(ONNXRUNTIME_INCLUDE_DIR onnxruntime_cxx_api.h
    HINTS
    $ENV{ONNXRUNTIME_ROOTDIR}/include
    /opt/onnxruntime/include
    /usr/local/include/onnxruntime
    /usr/local/include
    /opt/homebrew/include/onnxruntime
    /opt/homebrew/include
)

find_library(ONNXRUNTIME_LIBRARY
    NAMES onnxruntime
    HINTS
    $ENV{ONNXRUNTIME_ROOTDIR}/lib
    /opt/onnxruntime/lib
    /usr/local/lib
    /opt/homebrew/lib
)

# Auto-download prebuilt ONNX Runtime if not installed on host
if(NOT ONNXRUNTIME_INCLUDE_DIR OR NOT ONNXRUNTIME_LIBRARY)
    message(STATUS "📦 ONNX Runtime not found in system paths. Fetching official prebuilt release...")
    include(FetchContent)

    if(APPLE)
        if(CMAKE_SYSTEM_PROCESSOR MATCHES "arm64")
            set(ORT_URL "https://github.com/microsoft/onnxruntime/releases/download/v1.18.0/onnxruntime-osx-arm64-1.18.0.tgz")
        else()
            set(ORT_URL "https://github.com/microsoft/onnxruntime/releases/download/v1.18.0/onnxruntime-osx-x86_64-1.18.0.tgz")
        endif()
    elseif(UNIX AND NOT APPLE)
        if(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64")
            set(ORT_URL "https://github.com/microsoft/onnxruntime/releases/download/v1.18.0/onnxruntime-linux-aarch64-1.18.0.tgz")
        else()
            set(ORT_URL "https://github.com/microsoft/onnxruntime/releases/download/v1.18.0/onnxruntime-linux-x64-1.18.0.tgz")
        endif()
    endif()

    if(ORT_URL)
        FetchContent_Declare(
            onnxruntime_prebuilt
            URL ${ORT_URL}
        )
        FetchContent_MakeAvailable(onnxruntime_prebuilt)
        set(ONNXRUNTIME_INCLUDE_DIR "${onnxruntime_prebuilt_SOURCE_DIR}/include")
        file(GLOB ORT_LIBS "${onnxruntime_prebuilt_SOURCE_DIR}/lib/libonnxruntime*")
        list(GET ORT_LIBS 0 ONNXRUNTIME_LIBRARY)
    else()
        message(FATAL_ERROR "Could not auto-fetch ONNX Runtime. Please install it or set ONNXRUNTIME_ROOTDIR.")
    endif()
endif()

message(STATUS "✅ ONNX Runtime Include: ${ONNXRUNTIME_INCLUDE_DIR}")
message(STATUS "✅ ONNX Runtime Library: ${ONNXRUNTIME_LIBRARY}")

# Include directories
include_directories(
    ${PROJECT_SOURCE_DIR}/include
    ${OpenCV_INCLUDE_DIRS}
    ${ONNXRUNTIME_INCLUDE_DIR}
)

# Core library for modular reuse (can be linked to web servers like Crow / httplib)
add_library(yolo_detector STATIC
    src/YoloDetector.cpp
)
target_link_libraries(yolo_detector PUBLIC
    ${OpenCV_LIBS}
    ${ONNXRUNTIME_LIBRARY}
)

# Standalone CLI binary for inference and benchmarking
add_executable(yolo_infer
    src/main.cpp
)
target_link_libraries(yolo_infer PRIVATE
    yolo_detector
)

# Copy dynamic libraries to runtime output if needed
if(UNIX AND NOT APPLE)
    set_target_properties(yolo_infer PROPERTIES INSTALL_RPATH "$ORIGIN;$ORIGIN/../lib;/opt/onnxruntime/lib")
endif()
