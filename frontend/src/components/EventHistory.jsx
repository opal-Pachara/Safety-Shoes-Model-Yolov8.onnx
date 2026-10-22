import React, { useState } from 'react';
import { History, ShieldAlert, Download, Eye, Clock, Trash2 } from 'lucide-react';

export function EventHistory({ eventHistory, eventCounters, onClearHistory }) {
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const handleDownload = (event) => {
    if (!event.evidence?.dataUrl) return;
    const link = document.createElement('a');
    link.href = event.evidence.dataUrl;
    link.download = `violation_${event.classes.join('_')}_${event.timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="history-page">
      <div className="section-header">
        <div className="header-left">
          <h2 className="section-title">ประวัติเหตุการณ์ตรวจพบรองเท้าผิดกฎ (Event History)</h2>
          <p className="section-subtitle">
            บันทึกเหตุการณ์ความผิดปกติเฉพาะการตรวจจับสด (1 รายการต่อ 1 เหตุการณ์ ไม่ซ้ำทุกเฟรม)
          </p>
        </div>
        {eventHistory.length > 0 && (
          <button className="btn-clear-history" onClick={onClearHistory}>
            <Trash2 size={16} /> ล้างประวัติชั่วคราว
          </button>
        )}
      </div>

      {/* Summary counters bar */}
      <div className="history-summary-bar">
        <div className="summary-pill">
          <span>เหตุการณ์ทั้งหมด:</span>
          <strong>{eventHistory.length}</strong>
        </div>
        <div className="summary-pill pill-flipflops">
          <span>FlipFlops:</span>
          <strong>{eventCounters.FlipFlops}</strong>
        </div>
        <div className="summary-pill pill-others">
          <span>other_Shoes:</span>
          <strong>{eventCounters.other_Shoes}</strong>
        </div>
        <div className="summary-pill pill-normal">
          <span>Normal_Shoes:</span>
          <strong>{eventCounters.Normal_Shoes}</strong>
        </div>
        <div className="state-notice-tag">
          ℹ️ ประวัติจะถูกรีเซ็ตเมื่อรีเฟรชหน้าเว็บ (React State Only)
        </div>
      </div>

      {/* Event list */}
      {eventHistory.length === 0 ? (
        <div className="empty-history-box">
          <History size={48} className="empty-icon" />
          <h4>ยังไม่มีบันทึกเหตุการณ์ผิดกฎ</h4>
          <p>
            เมื่อระบบตรวจจับพบคนขับรถโม่สวมรองเท้าที่ไม่ใช่รองเท้าเซฟตี้ขณะเปิดกล้องสด
            ระบบจะบันทึกหลักฐานและเวลาไว้ที่นี่
          </p>
        </div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>ภาพหลักฐาน</th>
                <th>เวลาที่ตรวจพบ</th>
                <th>คลาสรองเท้าที่ผิดกฎ</th>
                <th>ความมั่นใจสูงสุด</th>
                <th>จำนวนกรอบ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {eventHistory.map((item) => (
                <tr key={item.id} className="history-row">
                  {/* Thumbnail */}
                  <td className="col-thumb">
                    {item.evidence?.dataUrl ? (
                      <img
                        src={item.evidence.dataUrl}
                        alt="Evidence thumb"
                        className="thumb-img"
                        onClick={() => setSelectedSnapshot(item)}
                      />
                    ) : (
                      <span className="no-thumb">ไม่มีภาพ</span>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="col-time">
                    <div className="time-primary">{item.timeFormatted}</div>
                    <div className="date-secondary">{item.dateFormatted}</div>
                  </td>

                  {/* Violation classes */}
                  <td className="col-classes">
                    <div className="badge-group">
                      {item.classes.map((cls) => (
                        <span key={cls} className={`badge-class badge-violation`}>
                          {cls}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Max Confidence */}
                  <td className="col-conf">
                    <span className="conf-value">
                      {Math.round(item.maxConfidence * 100)}%
                    </span>
                  </td>

                  {/* Detection count */}
                  <td className="col-boxes">
                    <span className="boxes-count">
                      {item.detections?.length || 1} กรอบ
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="col-actions">
                    <button
                      className="btn-table-action"
                      onClick={() => setSelectedSnapshot(item)}
                      title="ดูภาพขยาย"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="btn-table-action"
                      onClick={() => handleDownload(item)}
                      title="ดาวน์โหลดภาพหลักฐาน"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshot Preview Lightbox */}
      {selectedSnapshot && (
        <div className="popup-backdrop" onClick={() => setSelectedSnapshot(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <h4>หลักฐานเหตุการณ์: {selectedSnapshot.timeFormatted}</h4>
              <button
                className="popup-btn-close"
                onClick={() => setSelectedSnapshot(null)}
              >
                ✕
              </button>
            </div>
            <div className="lightbox-body">
              {selectedSnapshot.evidence?.dataUrl && (
                <img
                  src={selectedSnapshot.evidence.dataUrl}
                  alt="Full evidence"
                  className="lightbox-img"
                />
              )}
            </div>
            <div className="lightbox-footer">
              <div className="lightbox-info">
                <span>คลาส: {selectedSnapshot.classes.join(', ')}</span>
                <span>ความมั่นใจ: {Math.round(selectedSnapshot.maxConfidence * 100)}%</span>
              </div>
              <button
                className="btn-primary-alert"
                onClick={() => handleDownload(selectedSnapshot)}
              >
                <Download size={16} /> ดาวน์โหลดภาพ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
