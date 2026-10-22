import React from 'react';
import { X, Sliders, Volume2, VolumeX, RotateCcw, Info } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  thresholds,
  setThresholds,
  isSoundEnabled,
  setIsSoundEnabled,
}) {
  if (!isOpen) return null;

  const handleSliderChange = (className, value) => {
    setThresholds((prev) => ({
      ...prev,
      [className]: parseFloat(value),
    }));
  };

  const handleResetDefaults = () => {
    setThresholds({
      safety_Shoes: 0.50,
      other_Shoes: 0.50,
      FlipFlops: 0.50,
      Normal_Shoes: 0.50,
    });
  };

  const CLASS_CONFIGS = [
    {
      key: 'safety_Shoes',
      title: 'safety_Shoes (รองเท้าเซฟตี้)',
      desc: 'ตรวจจับรองเท้าที่ได้มาตรฐานความปลอดภัย (ไม่แจ้งเตือน)',
      colorClass: 'slider-safety',
    },
    {
      key: 'FlipFlops',
      title: 'FlipFlops (รองเท้าแตะ)',
      desc: 'ตรวจจับรองเท้าแตะหรือเปิดส้น (แจ้งเตือนทันที)',
      colorClass: 'slider-violation',
    },
    {
      key: 'other_Shoes',
      title: 'other_Shoes (รองเท้าผ้าใบ/ทั่วไป)',
      desc: 'ตรวจจับรองเท้าที่ไม่ใช่เซฟตี้ (แจ้งเตือนทันที)',
      colorClass: 'slider-violation',
    },
    {
      key: 'Normal_Shoes',
      title: 'Normal_Shoes (รองเท้าธรรมดา)',
      desc: 'คลาสที่มี mAP 0.0% จากชุดเทรน ควรตั้งค่าอย่างระมัดระวัง',
      colorClass: 'slider-violation',
    },
  ];

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title-group">
            <Sliders size={20} className="icon-blue" />
            <h3 className="settings-title">ตั้งค่าเกณฑ์ความมั่นใจ (Thresholds & Audio)</h3>
          </div>
          <button className="popup-btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {/* Audio setting */}
          <div className="setting-section">
            <h4 className="setting-section-title">การแจ้งเตือนด้วยเสียง (Sound Alert)</h4>
            <div className="sound-toggle-row">
              <div className="sound-toggle-info">
                <span>เล่นเสียงเตือนสั้นหนึ่งครั้งเมื่อเกิดเหตุการณ์ผิดกฎใหม่</span>
                <span className="sound-toggle-sub">สังเคราะห์ด้วย Web Audio API (รองรับ Safari/macOS)</span>
              </div>
              <button
                className={`btn-sound-switch ${isSoundEnabled ? 'active' : ''}`}
                onClick={() => setIsSoundEnabled((prev) => !prev)}
              >
                {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{isSoundEnabled ? 'เปิดเสียง' : 'ปิดเสียง'}</span>
              </button>
            </div>
          </div>

          {/* Threshold Sliders */}
          <div className="setting-section">
            <div className="section-title-with-action">
              <h4 className="setting-section-title">เกณฑ์ Confidence Threshold แยกตามคลาส</h4>
              <button className="btn-text-action" onClick={handleResetDefaults}>
                <RotateCcw size={14} /> คืนค่าเริ่มต้น (0.50 ทุกคลาส)
              </button>
            </div>

            <div className="threshold-sliders-list">
              {CLASS_CONFIGS.map((c) => {
                const val = thresholds[c.key] ?? 0.50;
                return (
                  <div key={c.key} className="slider-item">
                    <div className="slider-label-row">
                      <div>
                        <span className="slider-class-name">{c.title}</span>
                        <p className="slider-class-desc">{c.desc}</p>
                      </div>
                      <div className="slider-value-badge">
                        {(val * 100).toFixed(0)}% ({val.toFixed(2)})
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={val}
                      className={`threshold-slider ${c.colorClass}`}
                      onChange={(e) => handleSliderChange(c.key, e.target.value)}
                    />
                    <div className="slider-scale">
                      <span>0% (ไวสุด)</span>
                      <span>50% (แนะนำ)</span>
                      <span>100% (เข้มงวด)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notice box */}
          <div className="settings-notice-box">
            <Info size={16} />
            <span>
              <strong>หมายเหตุสำคัญ:</strong> ค่า Threshold ทั้งหมดถูกจัดเก็บใน React State เท่านั้น
              และจะกลับเป็นค่าเริ่มต้น 0.50 เสมอเมื่อรีเฟรชหน้าเว็บ (ไม่มีการใช้ LocalStorage หรือ Database)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn-primary-alert" onClick={onClose}>
            บันทึกและปิด
          </button>
        </div>
      </div>
    </div>
  );
}
