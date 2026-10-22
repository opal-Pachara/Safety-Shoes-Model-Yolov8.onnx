const CLASS_COLORS = {
  safety_Shoes: {
    border: '#10b981', // Emerald
    fill: 'rgba(16, 185, 129, 0.15)',
    tagBg: '#065f46',
    tagText: '#ffffff',
    label: 'safety_Shoes (เซฟตี้ - ถูกต้อง)',
  },
  FlipFlops: {
    border: '#ef4444', // Red
    fill: 'rgba(239, 68, 68, 0.20)',
    tagBg: '#991b1b',
    tagText: '#ffffff',
    label: 'FlipFlops (รองเท้าแตะ - ผิดกฎ)',
  },
  other_Shoes: {
    border: '#f59e0b', // Amber/Orange
    fill: 'rgba(245, 158, 11, 0.20)',
    tagBg: '#b45309',
    tagText: '#ffffff',
    label: 'other_Shoes (ไม่ใช่เซฟตี้ - ผิดกฎ)',
  },
  Normal_Shoes: {
    border: '#f43f5e', // Rose
    fill: 'rgba(244, 63, 94, 0.20)',
    tagBg: '#9f1239',
    tagText: '#ffffff',
    label: 'Normal_Shoes (ทั่วไป - ผิดกฎ)',
  },
};

/**
 * Draw bounding boxes and labels on an HTML Canvas
 */
export function drawDetections(ctx, detections, scaleX = 1, scaleY = 1) {
  if (!ctx) return;

  detections.forEach((det) => {
    const config = CLASS_COLORS[det.class_name] || {
      border: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.2)',
      tagBg: '#1e40af',
      tagText: '#ffffff',
      label: det.class_name,
    };

    const [x, y, w, h] = det.box;
    const sx = x * scaleX;
    const sy = y * scaleY;
    const sw = w * scaleX;
    const sh = h * scaleY;

    // Draw box fill
    ctx.fillStyle = config.fill;
    ctx.fillRect(sx, sy, sw, sh);

    // Draw box border
    ctx.strokeStyle = config.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, sw, sh);

    // Corner accents
    const lineLen = Math.min(18, Math.min(sw, sh) / 3);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';

    // Top-left
    ctx.beginPath();
    ctx.moveTo(sx, sy + lineLen);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + lineLen, sy);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(sx + sw - lineLen, sy + sh);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx + sw, sy + sh - lineLen);
    ctx.stroke();

    // Prepare label
    const confPercent = Math.round(det.confidence * 100);
    const tagText = `${config.label} ${confPercent}%`;

    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textMetrics = ctx.measureText(tagText);
    const textWidth = textMetrics.width;
    const textHeight = 18;
    const padding = 6;

    let tagY = sy - textHeight - 4;
    if (tagY < 0) {
      tagY = sy + 4; // draw inside box if too close to top
    }

    // Draw label background pill
    ctx.fillStyle = config.tagBg;
    ctx.beginPath();
    ctx.roundRect(sx, tagY, textWidth + padding * 2, textHeight, 4);
    ctx.fill();

    // Draw label text
    ctx.fillStyle = config.tagText;
    ctx.fillText(tagText, sx + padding, tagY + 13);
  });
}

/**
 * Capture an annotated evidence snapshot from an HTMLVideoElement or Image
 * and return a Blob & DataURL
 */
export async function captureAnnotatedSnapshot(sourceElement, detections, origW, origH) {
  const canvas = document.createElement('canvas');
  canvas.width = origW;
  canvas.height = origH;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // Draw source image or video
  ctx.drawImage(sourceElement, 0, 0, origW, origH);

  // Overlay detections in full original resolution
  drawDetections(ctx, detections, 1, 1);

  // Add timestamp and camera badge watermark at bottom
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, origH - 32, origW, 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px "JetBrains Mono", monospace';
  const now = new Date().toLocaleString('th-TH', { hour12: false });
  ctx.fillText(`🚨 Concrete Mixer Driver Safety Alert — ${now}`, 12, origH - 12);

  // Export as blob and dataURL
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({ blob, dataUrl });
      },
      'image/jpeg',
      0.92
    );
  });
}
