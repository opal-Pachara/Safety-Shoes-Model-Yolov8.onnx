# 🥾 ระบบตรวจจับรองเท้าเซฟตี้คนขับรถโม่คอนกรีต (Concrete Mixer Driver Safety Shoes Detector)

ระบบเว็บแอปพลิเคชันปัญญาประดิษฐ์ (AI Web Application) สำหรับเฝ้าระวังและตรวจจับการสวมใส่รองเท้าเซฟตี้ของคนขับรถโม่คอนกรีตจากกล้อง USB Webcam ผ่านเบราว์เซอร์ Safari/macOS โดยประมวลผลด้วยโมเดล **YOLO ONNX Runtime** บน Backend FastAPI และแสดงผลบนแดชบอร์ด React + Vite

> [!IMPORTANT]
> **เครื่องมือนี้เป็นระบบช่วยเฝ้าระวังเบื้องต้นเท่านั้น** ไม่ใช่สิ่งทดแทนการตรวจสอบโดยเจ้าหน้าที่ และการตรวจไม่พบรองเท้าในภาพ (**No detection**) ต้องไม่ถูกตีความว่าเป็นการปฏิบัติตามกฎหรือผ่านข้อกำหนดความปลอดภัย

---

## 1. คุณสมบัติเด่นของระบบ (Core Features)

1. **การตรวจจับสดผ่านเว็บเบราว์เซอร์ (Live Webcam Detection):**
   - ขอสิทธิ์และเปิดกล้อง USB Webcam บน Mac ผ่าน `navigator.mediaDevices.getUserMedia()` ใน Safari
   - ส่งภาพเฟรมไปยัง Backend ด้วยอัตราเป้าหมายประมาณ **2 FPS** (~500ms ต่อเฟรม)
   - **กลไก No-Overlap Request:** หากคำขอประมวลผลก่อนหน้ายังไม่เสร็จสิ้น ระบบจะข้ามเฟรมใหม่ทันที ป้องกันการสะสมคิวและ Latency สะสม
   - ยกเลิกและเพิกเฉยต่อผลลัพธ์เก่าที่ค้างอยู่ทันทีเมื่อผู้ใช้กด "หยุดตรวจจับ" (Stop)

2. **ระบบจัดการเหตุการณ์และ Debounce (Alert State Machine):**
   - แจ้งเตือน Popup และส่งเสียงสั้นหนึ่งครั้งต่อเหตุการณ์ผิดกฎ
   - **Debounce 3 วินาที:** เมื่อตรวจพบรองเท้าผิดกฎ เหตุการณ์จะคงอยู่จนกว่าจะไม่พบรองเท้าผิดกฎต่อเนื่องอย่างน้อย **3 วินาที** จึงจะถือว่าสิ้นสุดเหตุการณ์ การขาดหายชั่วคราวสั้นๆ จะไม่ทำให้เกิดการแจ้งเตือนซ้ำ
   - บันทึกภาพหลักฐาน (Evidence Snapshot) พร้อม Bounding Box และวันเวลาลงในประวัติ

3. **การจัดการ State ตามข้อกำหนด:**
   - ประวัติเหตุการณ์ (Event History) และการตั้งค่า (Settings) จัดเก็บใน **React State เท่านั้น**
   - **ไม่มีการใช้ Database, LocalStorage, SessionStorage หรือ Cookies**
   - เมื่อรีเฟรชหน้าเว็บ ข้อมูลทั้งหมดจะกลับสู่ค่าเริ่มต้นโดยอัตโนมัติ

4. **โหมดทดสอบ 2 โหมด:**
   - **โหมดตรวจจับสด (Live Camera Mode):** ทำงานร่วมกับกล้อง แจ้งเตือนด้วยเสียง Popup และบันทึกประวัติ
4. **โหมดทดสอบ 2 โหมด พร้อมระบบจำลองรูปตัวอย่าง (Mock Testing):**
   - **คลังรูปตัวอย่างจำลอง (One-Click Mock Samples Gallery):** อยู่ในแท็บ Upload Test มีรูปตัวอย่างสำเร็จรูปครบทุกสถานการณ์ (รองเท้าแตะ, เซฟตี้, ผ้าใบ, พื้นโรงงาน) สามารถกดทดสอบได้ทันทีในคลิกเดียว **โดยไม่ต้องหารูปมาใส่เอง**
   - **โหมดจำลองกล้องเสมือน (Simulated Camera Feed):** อยู่ในแท็บ Dashboard สามารถเลือกจำลองสถานการณ์กล้องสด (~2 FPS) เพื่อทดสอบระบบแจ้งเตือน, เสียงเตือน, Popup, การดาวน์โหลดหลักฐาน และการสิ้นสุดเหตุการณ์ 3 วินาทีได้ครบทุกขั้นตอน แม้ไม่มีกล้องหรือรองเท้าจริงอยู่ตรงหน้า
   - **โหมดตรวจจับกล้องจริง (Real Webcam Mode):** สำหรับเปิดกล้อง USB Webcam จริงในโรงงาน

5. **ระบบ Preflight Check อัตโนมัติ:**
   - ตรวจสอบความพร้อมของ Backend, ONNX Runtime, Class Mapping และทดสอบ Smoke Test ก่อนเริ่มใช้งาน
   - แสดงการแจ้งเตือนข้อจำกัดของโมเดลอย่างโปร่งใส

6. **เอกสารการทดสอบการยอมรับของผู้ใช้ (UAT Specification):**
   - มีเอกสาร [UAT.md](file:///Users/phatchara/Desktop/train-model/UAT.md) สำหรับใช้ตรวจรับระบบจริง พร้อมตาราง Test Cases และแบบฟอร์มลงนามอนุมัติ (Sign-off) ครบถ้วน

---

## 2. โครงสร้างโมเดลและ Class Mapping (Model Details)

โมเดลที่ใช้งานคือ `exported_models/best.onnx` (ส่งออกจาก YOLOv8/v12):
- **Input Tensor:** `images` ขนาด `[1, 3, 320, 320]` ชนิด `float32` (RGB Normalized ในช่วง `0.0` - `1.0`)
- **Output Tensor:** `output0` ขนาด `[1, 8, 2100]` (ช่องข้อมูล 8 แถว: `[cx, cy, w, h, class_0, class_1, class_2, class_3]` กับ 2100 Anchor Proposals)
- **Letterbox Preprocessing:** รักษาสัดส่วนภาพเดิม (Aspect Ratio) และเติมขอบสมมาตรด้วยสี `114`
- **Postprocessing:** Non-Maximum Suppression (NMS) ผ่าน `cv2.dnn.NMSBoxes`

### ตารางคลาสและกฎการตัดสินผล

| Index | Class Name | ผลการประเมินจากชุดเทรน | กฎการแจ้งเตือน | ค่าเริ่มต้น Threshold |
| :---: | :--- | :---: | :---: | :---: |
| 0 | `other_Shoes` | Precision 92.7% / Recall 81.8% / mAP 92.4% | 🚨 **แจ้งเตือน (ผิดกฎ)** | `0.50` |
| 1 | `FlipFlops` | Precision 68.5% / Recall 100.0% / mAP 99.5% | 🚨 **แจ้งเตือน (ผิดกฎ)** | `0.50` |
| 2 | `safety_Shoes` | Precision 87.9% / Recall 61.1% / mAP 74.7% | ✅ **ไม่แจ้งเตือน (ผ่านเกณฑ์)** | `0.50` |
| 3 | `Normal_Shoes` | Precision 0.0% / Recall 0.0% / mAP 0.0% | 🚨 **แจ้งเตือน (ผิดกฎ)** | `0.50` |

> [!WARNING]
> **ข้อจำกัดและประเด็นความเสี่ยงของโมเดล:**
> - `Normal_Shoes` มีค่าความแม่นยำเป็น 0.0% จากการประเมินชุดเทรน จึงต้องมีการเฝ้าระวังเป็นพิเศษ
> - `safety_Shoes` มีค่า Recall 61.1% หมายความว่ามีโอกาสเกิด False Negative (ไม่ตรวจจับรองเท้าเซฟตี้ในบางมุมมองหรือสภาพแสงน้อย)
> - เมื่อภาพตรวจไม่พบวัตถุใด ระบบจะแสดงสถานะว่า **"ไม่พบรองเท้าในภาพ"** เท่านั้น ห้ามสรุปว่าคนขับปฏิบัติตามกฎ

---

## 3. สถาปัตยกรรมระบบ (Architecture)

```mermaid
graph LR
    subgraph Client ["Client (Mac / Safari)"]
        Webcam["USB Webcam"] -->|getUserMedia| Browser["React App (Vite)"]
        Browser -->|Render Canvas| BBox["วาด Bounding Box & แจ้งเตือน"]
        Browser -->|Web Audio| Audio["เสียงเตือนสังเคราะห์"]
    end

    subgraph Server ["Backend (FastAPI on Render / Local)"]
        API["FastAPI Endpoints"] --> Pre["Letterbox & Normalization"]
        Pre --> ORT["ONNX Runtime Engine (best.onnx)"]
        ORT --> Post["BBox Unscaling & NMS"]
        Post --> API
    end

    Browser -->|HTTPS POST ~2 FPS (No-Overlap)| API
    API -->|JSON Detections| Browser
```

---

## 4. โครงสร้างโปรเจกต์ (Project Structure)

```text
train-model/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py         # กำหนดค่า Path, Classes, Thresholds, CORS
│   │   ├── detector.py       # YOLO ONNX Detector, Preprocessing, NMS, Smoke Test
│   │   ├── schemas.py        # Pydantic Schemas (Detection, Preflight, Health)
│   │   └── main.py           # FastAPI routes, CORS, Static files mount
│   ├── tests/
│   │   ├── test_detector.py  # Unit tests สำหรับ Detector logic
│   │   └── test_api.py       # Automated tests สำหรับ FastAPI endpoints
│   ├── Dockerfile            # Dockerfile สำหรับ Render deployment
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── public/
│   │   └── test_samples/     # ตัวอย่างภาพสำหรับทดสอบใน Upload mode
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlertPopup.jsx       # Modal แจ้งเตือนเมื่อผิดกฎ + ดาวน์โหลดหลักฐาน
│   │   │   ├── CameraView.jsx       # จอแสดงผลกล้องสดและ Canvas วาดกรอบ
│   │   │   ├── Dashboard.jsx        # หน้าจอหลักรวบรวมกล้องและสถิติ
│   │   │   ├── EventHistory.jsx     # หน้าประวัติเหตุการณ์ (React state only)
│   │   │   ├── Navbar.jsx           # แถบเมนูด้านบนและสถานะ AI
│   │   │   ├── PreflightBanner.jsx  # แถบแจ้งเตือนสถานะความพร้อมและข้อจำกัด
│   │   │   ├── SettingsModal.jsx    # หน้าต่างปรับ Thresholds 4 คลาส + เสียง
│   │   │   ├── StatsCards.jsx       # การ์ดแสดงผลสถิติเฟรม Latency และคลาส
│   │   │   └── UploadTest.jsx       # หน้าทดสอบอัปโหลดภาพแยกต่างหาก
│   │   ├── hooks/
│   │   │   ├── useCamera.js         # ควบคุมกล้อง Safari และ Frame loop (No-overlap)
│   │   │   ├── useEventStateMachine.js # Debounce 3 วิ, Event tracking, History
│   │   │   └── useSound.js          # สังเคราะห์เสียงเตือนด้วย Web Audio API
│   │   ├── utils/
│   │   │   ├── api.js               # Client API calls
│   │   │   └── canvasDraw.js        # ฟังก์ชันวาดกรอบสีและบันทึกภาพ Snapshot
│   │   ├── App.jsx
│   │   ├── index.css                # ดีไซน์ Dark Mode และสไตล์ระบบ
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── exported_models/
│   ├── best.onnx             # โมเดลหลัก ONNX FP32
│   └── best.onnx.data        # External weights ของโมเดล
├── test_samples/             # ภาพตัวอย่างจริงสำหรับทดสอบ
├── render.yaml               # Render Blueprint deployment configuration
├── .env.example              # ตัวอย่าง Environment variables
└── README.md                 # คู่มือการใช้งานนี้
```

---

## 5. วิธีการติดตั้งและรันในเครื่อง (Local Setup & Run)

### ความต้องการของระบบ:
- macOS (รองรับกล้องใน Safari / Chrome)
- Python 3.10+
- Node.js 18+ และ npm

### ขั้นตอนที่ 1: ติดตั้งและรัน Backend (FastAPI)
```bash
# 1. ติดตั้ง Dependencies
pip install -r backend/requirements.txt

# 2. ทดสอบ Unit Tests ให้แน่ใจว่าผ่าน 100%
python3 -m unittest discover -s backend/tests

# 3. รันเซิร์ฟเวอร์ Backend (รันบนพอร์ต 8001 เพื่อหลีกเลี่ยงการชนกับพอร์ต 8000 อื่นๆ)
python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8001 --reload
```

### ขั้นตอนที่ 2: ติดตั้งและรัน Frontend (React + Vite)
เปิด Terminal ใหม่:
```bash
cd frontend

# 1. ติดตั้ง Node Dependencies
npm install

# 2. รัน Vite Development Server
npm run dev
```
เปิดเว็บเบราว์เซอร์ไปที่: **`http://localhost:5173`**

---

## 6. การทดสอบระบบ (Test Verification Checklist)

### 6.1 Automated Tests (รันผ่าน Terminal)
ระบบมีชุดการทดสอบครอบคลุมทั้ง Detector และ API ทั้งหมด 12 การทดสอบ:
```bash
python3 -m unittest backend/tests/test_detector.py
python3 -m unittest backend/tests/test_api.py
```
ผลลัพธ์ที่ได้: **`Ran 12 tests ... OK` (100% ผ่านทั้งหมด)**

### 6.2 Manual Testing Checklist
- [x] **Preflight Readiness:** เมื่อเปิดเว็บ แถบ Preflight แสดงว่าเชื่อมต่อโมเดลสำเร็จ พร้อมรายงานความหน่วง (Latency ~8-30 ms)
- [x] **Settings Adjustment:** ปรับ Thresholds ทั้ง 4 คลาสแยกกันได้ ค่าเริ่มต้นคือ 0.50 และจะกลับเป็น 0.50 เมื่อรีเฟรชหน้า
- [x] **Image Upload Test:**
  - ทดสอบ `sample_flipflops.jpg` -> ตรวจพบ `FlipFlops` พร้อมแท็ก `🚨 ผิดกฎ`
  - ทดสอบ `sample_safety_shoes.jpg` -> ตรวจพบ `safety_Shoes` พร้อมแท็ก `✅ ถูกต้อง`
  - ยืนยันว่าการอัปโหลดทดสอบไม่มีการส่งเสียงเตือน และไม่เพิ่มรายการในประวัติ
- [x] **Live Camera Test:**
  - กด "เริ่มตรวจจับสด" Safari จะขออนุญาตเข้าถึงกล้อง
  - กล้องส่งภาพประมาณ 2 FPS โดยไม่มีคำขอซ้อนกัน (No-overlap)
  - เมื่อมีคนสวมรองเท้าแตะหรือรองเท้าทั่วไปเข้ามาในกล้อง Popup แจ้งเตือนจะปรากฏขึ้นพร้อมเสียงเตือน 1 ครั้ง
  - กด "ดาวน์โหลดภาพหลักฐาน" เพื่อบันทึกภาพพร้อมกรอบ Bounding Box ลงในเครื่อง
  - ประวัติบันทึกเป็น 1 เหตุการณ์ และนับสถิติตามคลาสอย่างถูกต้อง
  - เมื่อนำรองเท้าออกจากเฟรมต่อเนื่องเกิน 3 วินาที เหตุการณ์จะสิ้นสุดลงโดยอัตโนมัติ

---

## 7. คู่มือการรันด้วย Docker และการ Deploy (Deployment Guide)

ดูคู่มือฉบับสมบูรณ์ได้ที่ [DEPLOYMENT.md](file:///Users/phatchara/Desktop/train-model/DEPLOYMENT.md)

### 7.1 รันด้วย Docker Compose ในเครื่อง (คำสั่งเดียวจบ):
```bash
docker compose up --build
```
เปิดเว็บเบราว์เซอร์ไปที่: **`http://localhost:8000`**

### 7.2 Deploy บน Render (Cloud Web Service):
1. ดันโค้ดขึ้น GitHub
2. สร้าง Web Service บน [Render.com](https://render.com) เลือก **Docker Runtime**
3. ตั้งค่า **Dockerfile Path:** `Dockerfile` และ **Health Check Path:** `/api/health`
4. หรือเลือกใช้ไฟล์ Blueprint [render.yaml](file:///Users/phatchara/Desktop/train-model/render.yaml) เพื่อสร้าง Service ให้อัตโนมัติ

> [!NOTE]
> **ข้อจำกัดของ Render Free Tier:**
> - เซอร์วิสจะเข้าสู่โหมด Sleep (Cold Start) หากไม่มีการใช้งานเป็นเวลา 15 นาที การเปิดครั้งแรกอาจใช้เวลา 30–50 วินาที
> - หน้าเว็บมีระบบตรวจจับสถานะ Cold Start และจะแสดงข้อความแจ้งผู้ใช้ให้รอจนกว่า Backend จะพร้อมใช้งาน

---

## 8. สรุปสิ่งที่ผู้ใช้ต้องเตรียมและดำเนินการเอง (User Action Items)

1. **การอนุญาตกล้องในเบราว์เซอร์:**
   - เมื่อกดปุ่ม "เริ่มตรวจจับสด" เบราว์เซอร์ Safari/Chrome บน macOS จะแสดงกล่องขอสิทธิ์การใช้งานกล้อง ให้กด **"Allow" (อนุญาต)**
2. **ไฟล์โมเดล:**
   - ตรวจสอบให้แน่ใจว่าไฟล์ `exported_models/best.onnx` และ `best.onnx.data` อยู่ในโฟลเดอร์เสมอ
3. **การดาวน์โหลดภาพหลักฐาน:**
   - Safari จะบันทึกไฟล์ภาพหลักฐานลงในโฟลเดอร์ Downloads เริ่มต้นของระบบ macOS ผ่านคำสั่งดาวน์โหลดของเบราว์เซอร์
