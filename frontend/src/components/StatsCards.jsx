import React from 'react';
import { Layers, Clock, AlertOctagon, RefreshCw, Tag } from 'lucide-react';

export function StatsCards({ stats, eventCounters, isDetecting }) {
  return (
    <div className="stats-grid">
      {/* 1. Processed Frames */}
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">เฟรมที่ประมวลผล</span>
          <Layers size={18} className="stat-icon icon-blue" />
        </div>
        <div className="stat-value">{stats.processedFrames.toLocaleString()}</div>
        <div className="stat-subtext">
          {isDetecting ? 'อัตราเป้าหมาย ~2 FPS (500ms)' : 'ระบบไม่ได้ตรวจจับ'}
        </div>
      </div>

      {/* 2. Latency */}
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">เวลาตอบสนองเฉลี่ย</span>
          <Clock size={18} className="stat-icon icon-purple" />
        </div>
        <div className="stat-value">
          {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs} ms` : '-'}
        </div>
        <div className="stat-subtext">
          {stats.lastBackendTimeMs > 0
            ? `Backend: ${stats.lastBackendTimeMs}ms | Network: ${Math.max(0, stats.lastLatencyMs - stats.lastBackendTimeMs)}ms`
            : 'วัดจากเวลาจริง (Roundtrip)'}
        </div>
      </div>

      {/* 3. Reconnects */}
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">การเชื่อมต่อใหม่</span>
          <RefreshCw size={18} className="stat-icon icon-amber" />
        </div>
        <div className="stat-value">{stats.reconnectCount}</div>
        <div className="stat-subtext">
          {stats.reconnectCount === 0 ? 'สัญญาณเสถียรปกติ' : 'มีการพยายามเชื่อมต่อใหม่'}
        </div>
      </div>

      {/* 4. Violation Events Breakdown */}
      <div className="stat-card stat-card-alert">
        <div className="stat-card-header">
          <span className="stat-label">เหตุการณ์ผิดกฎ (ตามคลาส)</span>
          <AlertOctagon size={18} className="stat-icon icon-red" />
        </div>
        <div className="stat-value-group">
          <div className="stat-sub-item">
            <span className="tag-pill tag-flipflops">FlipFlops</span>
            <span className="count-num">{eventCounters.FlipFlops}</span>
          </div>
          <div className="stat-sub-item">
            <span className="tag-pill tag-others">other_Shoes</span>
            <span className="count-num">{eventCounters.other_Shoes}</span>
          </div>
          <div className="stat-sub-item">
            <span className="tag-pill tag-normal">Normal_Shoes</span>
            <span className="count-num">{eventCounters.Normal_Shoes}</span>
          </div>
        </div>
        <div className="stat-subtext">
          นับตามเหตุการณ์ (Debounce 3 วินาที) ไม่ใช่นับทุกเฟรม
        </div>
      </div>

      {/* 5. Last Detected Class */}
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">คลาสตารางล่าสุด</span>
          <Tag size={18} className="stat-icon icon-green" />
        </div>
        <div className="stat-value stat-value-text">
          {stats.lastDetectedClass ? (
            <span
              className={`badge-class ${
                stats.lastDetectedClass === 'safety_Shoes'
                  ? 'badge-safety'
                  : 'badge-violation'
              }`}
            >
              {stats.lastDetectedClass}
            </span>
          ) : (
            <span className="text-muted">ยังไม่พบ</span>
          )}
        </div>
        <div className="stat-subtext">อัปเดตจากเฟรมล่าสุด</div>
      </div>
    </div>
  );
}
