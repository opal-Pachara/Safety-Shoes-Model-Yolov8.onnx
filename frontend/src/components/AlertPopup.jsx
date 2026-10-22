import React from 'react';
import { AlertTriangle, Download, X, Clock, ShieldX, Percent } from 'lucide-react';

export function AlertPopup({ event, onClose }) {
  if (!event) return null;

  const handleDownload = () => {
    if (!event.evidence || !event.evidence.dataUrl) return;

    // Safari-compatible download using an anchor element
    const link = document.createElement('a');
    link.href = event.evidence.dataUrl;
    const cleanTime = new Date(event.timestamp)
      .toISOString()
      .replace(/[:.]/g, '-');
    link.download = `safety_violation_${event.classes.join('_')}_${cleanTime}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="popup-backdrop">
      <div className="popup-card">
        {/* Header */}
        <div className="popup-header">
          <div className="popup-title-group">
            <div className="popup-icon-warning">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="popup-title">แจ้งเตือน: พบรองเท้าไม่ผ่านเกณฑ์เซฟตี้!</h3>
              <p className="popup-subtitle">คนขับรถโม่คอนกรีตอาจไม่ได้สวมรองเท้าเซฟตี้</p>
            </div>
          </div>
          <button className="popup-btn-close" onClick={onClose} title="ปิดหน้าต่าง">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="popup-body">
          {/* Evidence Image */}
          <div className="popup-evidence-container">
            {event.evidence?.dataUrl ? (
              <img
                src={event.evidence.dataUrl}
                alt="Evidence Snapshot"
                className="popup-evidence-img"
              />
            ) : (
              <div className="popup-evidence-placeholder">
                <span>ไม่มีภาพหลักฐาน</span>
              </div>
            )}
            <div className="evidence-badge">ภาพเฟรมขณะเกิดเหตุการณ์</div>
          </div>

          {/* Details list */}
          <div className="popup-details">
            <div className="detail-row">
              <span className="detail-label">
                <ShieldX size={16} /> คลาสที่ตรวจพบ:
              </span>
              <div className="detail-badges">
                {event.classes.map((cls) => (
                  <span key={cls} className={`badge-class badge-violation`}>
                    {cls}
                  </span>
                ))}
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                <Percent size={16} /> ความมั่นใจสูงสุด:
              </span>
              <span className="detail-value highlight-red">
                {Math.round(event.maxConfidence * 100)}%
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                <Clock size={16} /> เวลาที่ตรวจพบ:
              </span>
              <span className="detail-value">
                {event.timeFormatted} ({event.dateFormatted})
              </span>
            </div>

            <div className="popup-notice">
              ⚠️ เครื่องมือนี้เป็นเพียงระบบช่วยเฝ้าระวังเบื้องต้น เจ้าหน้าที่ควรตรวจสอบด้วยตนเองก่อนสรุปผล
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="popup-footer">
          <button className="btn-secondary" onClick={onClose}>
            รับทราบและปิด
          </button>
          <button className="btn-primary-alert" onClick={handleDownload}>
            <Download size={18} />
            <span>ดาวน์โหลดภาพหลักฐาน</span>
          </button>
        </div>
      </div>
    </div>
  );
}
