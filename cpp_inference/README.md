# 🥾 Safety Shoes YOLOv8 C++ ONNX Runtime Engine

ระบบ Inference โมเดลตรวจจับรองเท้านิรภัย (Safety Shoes Detection) เขียนด้วย **C++ (C++17)** ขับเคลื่อนด้วย **ONNX Runtime C++ API** และ **OpenCV** ออกแบบมาเป็นพิเศษเพื่อ **ความเร็วและประสิทธิภาพสูงสุดบนเครื่อง Server / Cloud Container ที่มีข้อจำกัดด้านฮาร์ดแวร์สูง (เช่น Render.com, Cloud Free/Starter Tiers, Shared vCPUs)**

---

## 🌟 จุดเด่นด้านประสิทธิภาพสำหรับฮาร์ดแวร์จำกัด (Render Server Optimization)

1. **Zero-Allocation Memory Buffer:**
   - จอง Float Buffer ขนาด `1 x 3 x 320 x 320` ครั้งเดียวตอนเริ่มต้น (Initialization) และใช้ซ้ำตลอดอายุการทำงาน ไม่มีการ Allocate/Deallocate RAM ใหม่ในทุกๆ เฟรม
2. **Cache-Friendly Planar Conversion (BGR -> RGB + CHW):**
   - รวบขั้นตอนแปลงสี BGR เป็น RGB, Normalization (`1.0/255.0`) และจัดเรียงช่องสัญญาณแบบ Planar (CHW) เข้าสู่ Memory Buffer ภายใน Single Loop ทำให้ CPU Cache ทำงานได้เต็มประสิทธิภาพสูงสุด
3. **Fixed Shape 320x320 & Graph Optimization:**
   - โมเดลถูก Export แบบ Static Shape ขนาด 320x320 ทำให้ ONNX Runtime ทำ Constant Folding และ Memory Arena ได้สมบูรณ์ที่สุด
4. **Fine-Grained CPU Thread Control:**
   - กำหนด `SetIntraOpNumThreads(2)` และ `SetInterOpNumThreads(1)` โดยตรง เพื่อป้องกันปัญหา CPU Thread Thrashing / Context Switching บน Shared vCPU ของ Render
5. **รองรับทั้ง FP32 และ INT8 Quantization:**
   - มีไฟล์โมเดล `best.onnx` (FP32: 11.5 MB) สำหรับความเร็วเต็มพิกัด และ `best_int8.onnx` (INT8: 3.0 MB) ลดขนาด RAM ลงถึง **74%**
6. **Built-in JSON & Visualization:**
   - มีฟังก์ชัน `toJson()` พร้อมข้อมูลพิกัดและความหน่วง (Latency) ในตัว สะดวกต่อการนำไปเชื่อมต่อกับ Web Backend / Frontend ทันที

---

## 📁 โครงสร้างโปรเจกต์

```text
cpp_inference/
├── CMakeLists.txt          # สคริปต์คอมไพล์ รองรับทั้ง Linux, macOS และ Docker
├── Dockerfile              # Multi-stage Dockerfile ขนาดกะทัดรัด พร้อมรันบน Render
├── build.sh                # สคริปต์คำสั่งสร้างและคอมไพล์แบบอัตโนมัติ
├── sample_test.jpg         # รูปภาพตัวอย่างสำหรับการทดสอบ
├── models/
│   ├── best.onnx           # โมเดล FP32 (ความเร็วสูง Latency ต่ำ)
│   ├── best.onnx.data      # ข้อมูล Weight เพิ่มเติม
│   └── best_int8.onnx      # โมเดล INT8 (ขนาดจิ๋ว 3.0 MB ประหยัด RAM)
├── include/
│   └── YoloDetector.hpp    # Header ประกาศ Class, Config และ Struct ผลลัพธ์
└── src/
    ├── YoloDetector.cpp    # Implementation ของ ONNX Runtime C++ + NMS
    └── main.cpp            # Standalone CLI สำหรับรัน ทดสอบ และทำ Benchmark
```

---

## 🏷️ คลาสวัตถุที่โมเดลตรวจจับ (Class Mapping)

| Class ID | Class Name | สีประจำคลาส (BGR) | คำอธิบาย |
| :---: | :--- | :--- | :--- |
| **0** | `other_Shoes` | `(240, 150, 40)` | รองเท้าประเภทอื่นๆ |
| **1** | `FlipFlops` | `(50, 180, 255)` | รองเท้าแตะ |
| **2** | `safety_Shoes` | `(60, 220, 60)` (เขียว) | **รองเท้านิรภัย / Safety Shoes (เป้าหมายหลัก)** |
| **3** | `Normal_Shoes` | `(80, 80, 240)` | รองเท้าผ้าใบ/รองเท้าธรรมดา |

---

## 🚀 วิธีการ Deploy ขึ้น Render.com (ผ่าน Docker)

Render รองรับการ Deploy เว็บเซอร์วิสหรือ Background Worker ผ่าน Dockerfile ได้โดยตรง:

1. นำโฟลเดอร์ `cpp_inference` (หรือทั้ง Repository) ขึ้น Git (GitHub / GitLab)
2. บน Render Dashboard: คลิก **New +** -> **Web Service** (หรือ **Background Worker**)
3. เลือก Repository ของคุณ
4. ตั้งค่า Environment เป็น **Docker**
5. กำหนด Dockerfile Path: `cpp_inference/Dockerfile`
6. คลิก **Deploy Web Service**
   - Dockerfile จะใช้ระบบ **Multi-Stage Build** โดยดึงเฉพาะ Shared Libraries ที่จำเป็นในขั้นตอน Runtime ทำให้ Container มีขนาดกะทัดรัดและประหยัด RAM บน Render ได้สูงสุด

---

## 💻 วิธีการคอมไพล์และทดสอบในเครื่อง Local

### 1. บน Linux (Ubuntu / Debian):
```bash
# ติดตั้งคอมไพเลอร์และ OpenCV
sudo apt-get update && sudo apt-get install -y build-essential cmake libopencv-dev

# คอมไพล์โปรเจกต์
cd cpp_inference
chmod +x build.sh
./build.sh
```

### 2. คำสั่งรันตรวจจับภาพ (Inference):
```bash
# รันโมเดล INT8 (ประหยัด RAM สูงสุด)
./build/yolo_infer --model models/best_int8.onnx --image sample_test.jpg --output result.jpg

# รันโมเดล FP32
./build/yolo_infer --model models/best.onnx --image sample_test.jpg --output result.jpg

# รัน Benchmark วัดค่าความเร็ว (50 รอบ)
./build/yolo_infer --model models/best_int8.onnx --image sample_test.jpg --benchmark 50

# ส่งผลลัพธ์ออกเป็น JSON สำหรับ Web API
./build/yolo_infer --model models/best_int8.onnx --image sample_test.jpg --json
```

---

## 📊 ผลลัพธ์ตัวอย่าง JSON Output (พร้อมนำไปใช้ในเว็บ)

```json
{
  "success": true,
  "latency": {
    "preprocess_ms": 1.2500,
    "inference_ms": 14.3200,
    "postprocess_ms": 0.4100,
    "total_ms": 15.9800,
    "fps": 62.58
  },
  "image": {
    "width": 640,
    "height": 480
  },
  "count": 2,
  "detections": [
    {
      "class_id": 2,
      "class_name": "safety_Shoes",
      "confidence": 0.8842,
      "box": {
        "x": 142,
        "y": 280,
        "w": 96,
        "h": 120
      }
    }
  ]
}
```

---

## 🌐 คำแนะนำในการต่อยอดทำหน้าเว็บแสดงผล (Web Frontend Integration)

เมื่อคุณพร้อมทำหน้าเว็บ สามารถเชื่อมต่อกับโมเดล C++ นี้ได้ 2 รูปแบบยอดนิยม:

1. **C++ Lightweight HTTP Server (แนะนำสำหรับประสิทธิภาพสูงสุด):**
   - รวมไลบรารี Header-only เช่น [cpp-httplib](https://github.com/yhirose/cpp-httplib) หรือ [Crow C++](https://crowcpp.org/) เข้ากับ `yolo_detector`
   - สร้าง Endpoint `POST /predict` รับรูปภาพแล้วเรียก `detector.detect(img)` และส่ง `YoloDetector::toJson(result)` กลับไปยัง Frontend
2. **Node.js / Python / Go Gateway:**
   - รันโปรแกรม C++ เป็น Microservice หรือเรียกใช้ผ่าน Fast Subprocess / gRPC / Shared Memory เพื่อความสะดวกรวดเร็ว
