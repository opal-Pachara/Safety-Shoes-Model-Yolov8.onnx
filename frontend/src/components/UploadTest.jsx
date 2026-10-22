import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle, AlertTriangle, Play, Sparkles, Clock, RefreshCw } from 'lucide-react';
import { detectUpload, detectSample, fetchSamples } from '../utils/api';
import { drawDetections } from '../utils/canvasDraw';

export function UploadTest({ thresholds }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState(null);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch sample presets list from backend on mount
  useEffect(() => {
    async function loadSamples() {
      try {
        const data = await fetchSamples();
        setSamples(data.samples || []);
      } catch (err) {
        console.warn('Could not load samples list:', err);
      }
    }
    loadSamples();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setSelectedFile(file);
    setActiveSampleId(null);
    setResult(null);
    setErrorMessage(null);

    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
  };

  // Instant test with a mock preset sample
  const handleRunSampleInference = async (sample) => {
    setIsLoading(true);
    setErrorMessage(null);
    setActiveSampleId(sample.id);
    setSelectedFile(null);

    const sampleUrl = `/api/samples/${sample.filename}`;
    setImagePreviewUrl(sampleUrl);

    try {
      const data = await detectSample(sample.id, thresholds);
      setResult(data);

      // Draw bounding boxes on canvas
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = data.image_width;
        canvas.height = data.image_height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          drawDetections(ctx, data.detections || [], 1, 1);
        }
      };
      img.src = sampleUrl;
    } catch (err) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการประมวลผลตัวอย่าง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCustomInference = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await detectUpload(selectedFile, thresholds);
      setResult(data);

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = data.image_width;
        canvas.height = data.image_height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          drawDetections(ctx, data.detections || [], 1, 1);
        }
      };
      img.src = imagePreviewUrl;
    } catch (err) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการประมวลผลภาพ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-test-page">
      <div className="section-header">
        <div>
          <h2 className="section-title">โหมดทดสอบด้วยรูปภาพ (Mock Samples & Image Testing)</h2>
          <p className="section-subtitle">
            ทดสอบโมเดล AI ได้ทันทีด้วย <strong>คลังรูปตัวอย่างจำลองสถานการณ์จริง (One-Click Mock Test)</strong> โดยไม่ต้องหารูปมาใส่เอง
            หรือสามารถอัปโหลดไฟล์ภาพของคุณเองได้ตามต้องการ
          </p>
        </div>
      </div>

      {/* Mock Samples Gallery (ไม่ต้องหารูปมาใส่เอง) */}
      <div className="mock-gallery-card">
        <div className="gallery-header">
          <div className="gallery-title-group">
            <Sparkles size={18} className="icon-cyan" />
            <h3 className="gallery-title">คลังรูปตัวอย่างจำลอง (One-Click Mock Detections)</h3>
          </div>
          <span className="gallery-subtitle">คลิกที่การ์ดเพื่อทดสอบผลการตรวจจับจากโมเดลจริงได้ทันที</span>
        </div>

        <div className="samples-grid">
          {samples.map((sample) => (
            <div
              key={sample.id}
              className={`sample-card ${activeSampleId === sample.id ? 'active-sample' : ''}`}
              onClick={() => handleRunSampleInference(sample)}
            >
              <div className="sample-thumb-wrapper">
                <img
                  src={`/api/samples/${sample.filename}`}
                  alt={sample.title}
                  className="sample-thumb-img"
                  loading="lazy"
                />
                <span
                  className={`sample-status-badge badge-${
                    sample.expected_status === 'violation'
                      ? 'red'
                      : sample.expected_status === 'compliant'
                      ? 'green'
                      : 'gray'
                  }`}
                >
                  {sample.expected_status === 'violation'
                    ? '🚨 ผิดระเบียบ'
                    : sample.expected_status === 'compliant'
                    ? '✅ เซฟตี้ผ่าน'
                    : '⚪ ไม่พบรองเท้า'}
                </span>
              </div>
              <div className="sample-info">
                <h4 className="sample-card-title">{sample.title}</h4>
                <p className="sample-scenario">{sample.scenario}</p>
                <button
                  className="btn-sample-run"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunSampleInference(sample);
                  }}
                >
                  <Play size={13} />
                  <span>{activeSampleId === sample.id && isLoading ? 'กำลังประมวลผล...' : 'ทดสอบรูปนี้'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="upload-layout">
        {/* Upload Custom File Sidebar */}
        <div className="upload-sidebar">
          <div
            className="dropzone-box"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) processSelectedFile(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden-file-input"
              onChange={handleFileChange}
            />
            <Upload size={32} className="dropzone-icon" />
            <div className="dropzone-text">
              <strong>หรือ อัปโหลดรูปภาพจากเครื่องของคุณ</strong>
              <span>รองรับ JPG, PNG, WEBP (ไม่เกิน 15MB)</span>
            </div>
            {selectedFile && (
              <div className="selected-file-info">
                <ImageIcon size={16} />
                <span>{selectedFile.name}</span>
              </div>
            )}
          </div>

          {selectedFile && (
            <button
              className="btn-action-primary"
              onClick={handleRunCustomInference}
              disabled={isLoading}
            >
              {isLoading ? 'กำลังประมวลผล...' : 'ตรวจจับรองเท้าจากไฟล์ที่อัปโหลด'}
            </button>
          )}

          {errorMessage && (
            <div className="error-alert">
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Detections List */}
          {result && (
            <div className="upload-results-panel">
              <div className="results-header">
                <h4>ผลการตรวจจับ ({result.detections.length} รายการ)</h4>
                <span className="results-latency">
                  <Clock size={14} /> {result.backend_time_ms} ms
                </span>
              </div>

              {result.detections.length === 0 ? (
                <div className="no-detections-box">
                  <span>⚪ ไม่พบรองเท้าที่ผ่านเกณฑ์ Threshold ในภาพนี้ (ไม่สามารถสรุปได้ว่าปลอดภัย)</span>
                </div>
              ) : (
                <div className="detections-list">
                  {result.detections.map((det, idx) => (
                    <div
                      key={idx}
                      className={`detection-item ${
                        det.is_violation ? 'item-violation' : 'item-compliant'
                      }`}
                    >
                      <div className="det-main">
                        <span className="det-name">{det.class_name}</span>
                        <span className="det-conf">
                          {Math.round(det.confidence * 100)}%
                        </span>
                      </div>
                      <div className="det-sub">
                        <span>
                          พิกัด: [{det.box.join(', ')}]
                        </span>
                        <span className="det-tag">
                          {det.is_violation ? '🚨 ผิดกฎ' : '✅ ถูกต้อง'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canvas / Image Preview Area */}
        <div className="upload-preview-area">
          {imagePreviewUrl ? (
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} className="preview-canvas" />
              {!result && (
                <img
                  src={imagePreviewUrl}
                  alt="Selected Preview"
                  className="preview-img-raw"
                />
              )}
            </div>
          ) : (
            <div className="preview-empty-state">
              <ImageIcon size={48} />
              <span>เลือกตัวอย่างด้านบน หรืออัปโหลดภาพเพื่อดูผลลัพธ์</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
