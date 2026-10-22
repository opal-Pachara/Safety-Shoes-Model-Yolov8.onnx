import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, X, Info } from 'lucide-react';

export function PreflightBanner({ preflightData, isLoading, onRetry }) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  if (isLoading) {
    return (
      <div className="preflight-banner banner-loading">
        <RefreshCw size={18} className="spin" />
        <div className="banner-content">
          <strong>กำลังตรวจสอบความพร้อมระบบ (Backend Preflight Check)...</strong>
          <span>หากอยู่บน Render Free Tier อาจใช้เวลาประมาณ 30–50 วินาทีในการตื่นจาก Cold Start</span>
        </div>
      </div>
    );
  }

  if (!preflightData || preflightData.status !== 'ok') {
    return (
      <div className="preflight-banner banner-error">
        <AlertTriangle size={20} className="banner-icon-error" />
        <div className="banner-content">
          <strong>⚠️ Backend หรือโมเดล ONNX ยังไม่พร้อมใช้งาน</strong>
          <p>{preflightData?.error_message || 'ไม่สามารถติดต่อ Backend API ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์รันอยู่'}</p>
        </div>
        <button className="btn-retry" onClick={onRetry}>
          <RefreshCw size={14} /> ลองใหม่
        </button>
      </div>
    );
  }

  // Preflight passed, show brief model assurance and transparent known risk notice
  return (
    <div className="preflight-banner banner-info">
      <Info size={18} className="banner-icon-info" />
      <div className="banner-content">
        <div className="banner-title">
          <span>โมเดล YOLO ONNX โหลดสำเร็จ (Latency: {preflightData.smoke_test_latency_ms} ms)</span>
          <span className="classes-pill">คลาส: {preflightData.class_names.join(', ')}</span>
        </div>
        <div className="risk-notes">
          <span>⚠️ ข้อจำกัดโมเดล: Normal_Shoes มี mAP 0.0% จากชุดเทรน | safety_Shoes มี Recall 61.1% | การตรวจไม่พบรองเท้าไม่ได้หมายความว่าสวมถูกต้อง</span>
        </div>
      </div>
      <button className="btn-close-banner" onClick={() => setIsDismissed(true)}>
        <X size={16} />
      </button>
    </div>
  );
}
