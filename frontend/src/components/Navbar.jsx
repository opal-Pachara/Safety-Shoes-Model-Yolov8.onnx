import React from 'react';
import { ShieldAlert, Video, History, Upload, Settings, Volume2, VolumeX, Activity } from 'lucide-react';

export function Navbar({
  activeTab,
  setActiveTab,
  onOpenSettings,
  eventCount,
  backendStatus,
  isSoundEnabled,
  onToggleSound,
}) {
  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand logo & title */}
        <div className="brand-group">
          <div className="brand-icon-wrapper">
            <ShieldAlert className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <div className="brand-title">SAFETY SHOES AI DETECTOR</div>
            <div className="brand-subtitle">ระบบตรวจจับรองเท้าเซฟตี้คนขับรถโม่คอนกรีต</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="nav-tabs">
          <button
            id="tab-dashboard-btn"
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Video size={18} />
            <span>ตรวจจับสด (Dashboard)</span>
          </button>

          <button
            id="tab-history-btn"
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} />
            <span>ประวัติเหตุการณ์ (History)</span>
            {eventCount > 0 && <span className="badge-count">{eventCount}</span>}
          </button>

          <button
            id="tab-upload-btn"
            className={`nav-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={18} />
            <span>ทดสอบอัปโหลด (Upload Test)</span>
          </button>
        </nav>

        {/* Right actions: Status, Sound, Settings */}
        <div className="navbar-actions">
          {/* Backend Status indicator */}
          <div
            className={`status-pill ${
              backendStatus === 'ok'
                ? 'status-online'
                : backendStatus === 'checking'
                ? 'status-checking'
                : 'status-offline'
            }`}
            title={
              backendStatus === 'ok'
                ? 'Backend & ONNX พร้อมใช้งาน'
                : backendStatus === 'checking'
                ? 'กำลังเชื่อมต่อ Backend...'
                : 'Backend ไม่พร้อมใช้งาน'
            }
          >
            <Activity size={14} className={backendStatus === 'checking' ? 'spin' : ''} />
            <span>
              {backendStatus === 'ok'
                ? 'AI พร้อม'
                : backendStatus === 'checking'
                ? 'เชื่อมต่อ...'
                : 'AI ออฟไลน์'}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            className={`icon-action-btn ${isSoundEnabled ? 'active' : 'muted'}`}
            onClick={onToggleSound}
            title={isSoundEnabled ? 'ปิดเสียงเตือน' : 'เปิดเสียงเตือน'}
          >
            {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Settings Button */}
          <button
            id="settings-open-btn"
            className="icon-action-btn"
            onClick={onOpenSettings}
            title="ตั้งค่า Thresholds"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
