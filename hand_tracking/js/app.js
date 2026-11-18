'use strict';

import { drawConnections, drawLandmarks, drawHandLabel } from './drawing.js';

const camElement = document.getElementById('camera');
const overlayCanvas = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const detectBtn = document.getElementById('detectBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const errorEl = document.getElementById('error');
const loadProgress = document.getElementById('loadProgress');
const stepLoad = document.getElementById('stepLoad');
const stepInfer = document.getElementById('stepInfer');
const handInfoEl = document.getElementById('handInfo');

let hands = null;
let stream = null;
let rafId = null;
let running = false;

let frameCount = 0;
let lastFpsTime = performance.now();

function setStatus(msg) {
  statusEl.textContent = msg;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function setProgress(el, state) {
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
}

async function initHands() {
  loadProgress.hidden = false;
  setProgress(stepLoad, 'active');
  setStatus('Loading MediaPipe Hands model...');

  const t0 = performance.now();

  hands = new window.Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onHandResults);
  await hands.initialize();

  const elapsed = (performance.now() - t0).toFixed(0);
  setProgress(stepLoad, 'done');
  stepLoad.textContent = `Loading MediaPipe Hands model... ${elapsed}ms`;
}

function onHandResults(results) {
  const ctx = overlayCanvas.getContext('2d');
  const w = camElement.videoWidth;
  const h = camElement.videoHeight;
  overlayCanvas.width = w;
  overlayCanvas.height = h;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i];
      drawConnections(ctx, landmarks, w, h);
      drawLandmarks(ctx, landmarks, w, h);
      drawHandLabel(ctx, landmarks, handedness, w, h);
    }
  }

  ctx.restore();
  updateHandInfo(results);
}

function updateHandInfo(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    handInfoEl.hidden = true;
    return;
  }
  handInfoEl.hidden = false;
  let html = '';
  for (let i = 0; i < results.multiHandedness.length; i++) {
    const h = results.multiHandedness[i];
    const score = (h.score * 100).toFixed(0);
    html += `<div class="hand-entry">` +
      `<span class="hand-label">${h.label} Hand</span>` +
      `<span class="hand-confidence">${score}% confidence</span>` +
      `</div>`;
  }
  handInfoEl.innerHTML = html;
}

async function startCamera() {
  try {
    startBtn.disabled = true;
    errorEl.hidden = true;
    setStatus('Starting camera...');

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user' },
    });
    camElement.srcObject = stream;
    await new Promise((resolve) => { camElement.onloadeddata = resolve; });

    stopBtn.disabled = false;
    detectBtn.disabled = false;
    setStatus('Camera running. Click "Start Detection" to begin.');
  } catch (e) {
    showError(`Camera error: ${e.message}`);
    startBtn.disabled = false;
  }
}

async function startDetection() {
  try {
    detectBtn.disabled = true;
    await initHands();

    setProgress(stepInfer, 'active');
    setStatus('Running inference...');
    running = true;
    frameCount = 0;
    lastFpsTime = performance.now();
    renderLoop();
  } catch (e) {
    showError(`Model error: ${e.message}`);
    detectBtn.disabled = false;
  }
}

async function renderLoop() {
  if (!running || !stream || !stream.active) return;
  if (camElement.readyState < 2) {
    rafId = requestAnimationFrame(renderLoop);
    return;
  }

  await hands.send({ image: camElement });

  frameCount++;
  const now = performance.now();
  const elapsed = now - lastFpsTime;
  if (elapsed >= 500) {
    const fps = (frameCount / (elapsed / 1000)).toFixed(0);
    fpsEl.textContent = `${fps} FPS`;
    fpsEl.hidden = false;
    frameCount = 0;
    lastFpsTime = now;
  }

  if (running) {
    rafId = requestAnimationFrame(renderLoop);
  }
}

function stopCamera() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  stream = null;
  hands = null;
  rafId = null;

  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  fpsEl.hidden = true;
  handInfoEl.hidden = true;
  loadProgress.hidden = true;
  stopBtn.disabled = true;
  detectBtn.disabled = true;
  startBtn.disabled = false;
  setStatus('Camera stopped.');
}

startBtn.addEventListener('click', startCamera);
detectBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopCamera);
setStatus('Ready. Click "Start Camera" to begin.');
