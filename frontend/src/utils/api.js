const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Fetch health status of the backend
 */
export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetch preflight readiness status
 */
export async function fetchPreflight() {
  const res = await fetch(`${API_BASE}/api/preflight`);
  if (!res.ok) {
    throw new Error(`Preflight check failed with status ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetch list of mock samples available on server
 */
export async function fetchSamples() {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) {
    throw new Error(`Failed to fetch samples: ${res.status}`);
  }
  return await res.json();
}

/**
 * Direct inference on a mock sample by ID (no file upload required)
 */
export async function detectSample(sampleId, thresholds = {}) {
  const formData = new FormData();
  if (thresholds.safety_Shoes !== undefined) {
    formData.append('conf_safety_shoes', thresholds.safety_Shoes);
  }
  if (thresholds.other_Shoes !== undefined) {
    formData.append('conf_other_shoes', thresholds.other_Shoes);
  }
  if (thresholds.FlipFlops !== undefined) {
    formData.append('conf_flipflops', thresholds.FlipFlops);
  }
  if (thresholds.Normal_Shoes !== undefined) {
    formData.append('conf_normal_shoes', thresholds.Normal_Shoes);
  }

  const res = await fetch(`${API_BASE}/api/detect/sample/${sampleId}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Sample inference failed' }));
    throw new Error(errorData.detail || `Server returned ${res.status}`);
  }

  return await res.json();
}

/**
 * Send a camera frame blob to backend for inference
 */
export async function detectFrame(blob, thresholds = {}, signal = null) {
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');

  if (thresholds.safety_Shoes !== undefined) {
    formData.append('conf_safety_shoes', thresholds.safety_Shoes);
  }
  if (thresholds.other_Shoes !== undefined) {
    formData.append('conf_other_shoes', thresholds.other_Shoes);
  }
  if (thresholds.FlipFlops !== undefined) {
    formData.append('conf_flipflops', thresholds.FlipFlops);
  }
  if (thresholds.Normal_Shoes !== undefined) {
    formData.append('conf_normal_shoes', thresholds.Normal_Shoes);
  }

  const res = await fetch(`${API_BASE}/api/detect/frame`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Network or server error' }));
    throw new Error(errorData.detail || `Server returned ${res.status}`);
  }

  return await res.json();
}

/**
 * Send an uploaded image file for test inference
 */
export async function detectUpload(file, thresholds = {}) {
  const formData = new FormData();
  formData.append('file', file);

  if (thresholds.safety_Shoes !== undefined) {
    formData.append('conf_safety_shoes', thresholds.safety_Shoes);
  }
  if (thresholds.other_Shoes !== undefined) {
    formData.append('conf_other_shoes', thresholds.other_Shoes);
  }
  if (thresholds.FlipFlops !== undefined) {
    formData.append('conf_flipflops', thresholds.FlipFlops);
  }
  if (thresholds.Normal_Shoes !== undefined) {
    formData.append('conf_normal_shoes', thresholds.Normal_Shoes);
  }

  const res = await fetch(`${API_BASE}/api/detect/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Network or server error' }));
    throw new Error(errorData.detail || `Server returned ${res.status}`);
  }

  return await res.json();
}
