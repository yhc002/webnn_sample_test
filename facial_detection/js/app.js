'use strict';

import {SsdMobilenetV2FaceNchw} from './ssd_mobilenetv2_face.js';
import {FaceLandmarkNchw} from './face_landmark.js';
import * as utils from './utils.js';
import * as SsdDecoder from './ssd_decoder.js';

const camElement = document.getElementById('camera');
const overlayCanvas = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const detectBtn = document.getElementById('detectBtn');
const stopBtn = document.getElementById('stopBtn');
const deviceSelect = document.getElementById('deviceSelect');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const errorEl = document.getElementById('error');
const loadProgress = document.getElementById('loadProgress');
const stepLoad = document.getElementById('stepLoad');
const stepBuild = document.getElementById('stepBuild');
const stepInfer = document.getElementById('stepInfer');

let fdInstance = null;
let fldInstance = null;
let fdInputOptions = null;
let fldInputOptions = null;
let stream = null;
let rafReq = null;
let stopRender = true;
let isRendering = false;
let currentDeviceType = '';

function showError(message) {
  errorEl.innerHTML = message;
  errorEl.hidden = false;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setProgress(step, state) {
  step.className = 'progress-step ' + state;
}

async function initModels(deviceType) {
  if (fdInstance && currentDeviceType === deviceType) return;

  loadProgress.hidden = false;
  setProgress(stepLoad, 'active');
  setProgress(stepBuild, '');
  setProgress(stepInfer, '');
  setStatus('Loading model weights...');

  const contextOptions = {deviceType};

  fdInstance = new SsdMobilenetV2FaceNchw();
  fldInstance = new FaceLandmarkNchw();
  fdInputOptions = fdInstance.inputOptions;
  fldInputOptions = {...fldInstance.inputOptions};

  const start = performance.now();
  const [fdOutputOperand, fldOutputOperand] = await Promise.all([
    fdInstance.load(contextOptions),
    fldInstance.load(contextOptions),
  ]);
  const loadTime = (performance.now() - start).toFixed(0);
  setProgress(stepLoad, 'done');
  stepLoad.textContent = `Loading models... ${loadTime}ms`;

  setProgress(stepBuild, 'active');
  setStatus('Building compute graphs...');
  const buildStart = performance.now();
  await Promise.all([
    fdInstance.build(fdOutputOperand),
    fldInstance.build(fldOutputOperand),
  ]);
  const buildTime = (performance.now() - buildStart).toFixed(0);
  setProgress(stepBuild, 'done');
  stepBuild.textContent = `Building graphs... ${buildTime}ms`;

  currentDeviceType = deviceType;
  setStatus('Models ready');
}

async function predict(inputElement) {
  const fdInputBuffer = utils.getInputTensor(inputElement, fdInputOptions);
  let totalComputeTime = 0;

  let start = performance.now();
  const results = await fdInstance.compute(fdInputBuffer);
  totalComputeTime += performance.now() - start;

  const strokedRects = [];
  const keyPoints = [];
  const height = inputElement.videoHeight || inputElement.naturalHeight;
  const width = inputElement.videoWidth || inputElement.naturalWidth;

  const fdOutputArray = [];
  for (const output of Object.entries(results)) {
    fdOutputArray.push(output[1]);
  }
  const fdSsdOutputs = SsdDecoder.processSsdOutputTensor(
      fdOutputArray, fdInputOptions, fdInstance.outputsInfo);

  const anchors = SsdDecoder.generateAnchors({});
  SsdDecoder.decodeOutputBoxTensor({}, fdSsdOutputs.outputBoxTensor, anchors);
  let [totalDetections, boxesList, scoresList] = SsdDecoder.nonMaxSuppression(
      {numClasses: 2},
      fdSsdOutputs.outputBoxTensor,
      fdSsdOutputs.outputClassScoresTensor);
  boxesList = SsdDecoder.cropSsdBox(
      inputElement, totalDetections, boxesList, fdInputOptions.margin);

  for (let i = 0; i < totalDetections; ++i) {
    let [ymin, xmin, ymax, xmax] = boxesList[i];
    ymin = Math.max(0, ymin) * height;
    xmin = Math.max(0, xmin) * width;
    ymax = Math.min(1, ymax) * height;
    xmax = Math.min(1, xmax) * width;
    const prob = 1 / (1 + Math.exp(-scoresList[i]));
    const rect = [xmin, ymin, xmax - xmin, ymax - ymin, prob];
    strokedRects.push(rect);
    const drawOptions = {
      sx: xmin,
      sy: ymin,
      sWidth: rect[2],
      sHeight: rect[3],
      dWidth: 128,
      dHeight: 128,
    };
    fldInputOptions.drawOptions = drawOptions;
    const fldInputBuffer = utils.getInputTensor(inputElement, fldInputOptions);
    start = performance.now();
    const fldResults = await fldInstance.compute(fldInputBuffer);
    totalComputeTime += performance.now() - start;
    keyPoints.push(fldResults.slice());
  }

  return [totalComputeTime.toFixed(2), strokedRects, keyPoints];
}

function drawOutput(inputCanvas, strokedRects, keyPoints) {
  overlayCanvas.width = inputCanvas.width;
  overlayCanvas.height = inputCanvas.height;

  const texts = strokedRects.map((r) => r[4].toFixed(2));
  SsdDecoder.drawFaceRectangles(inputCanvas, overlayCanvas, strokedRects, texts);
  SsdDecoder.drawKeyPoints(inputCanvas, overlayCanvas, keyPoints, strokedRects);
}

async function renderCamStream() {
  if (!stream || !stream.active || stopRender) return;
  if (camElement.readyState === 0) {
    rafReq = requestAnimationFrame(renderCamStream);
    return;
  }
  isRendering = true;
  const inputCanvas = utils.getVideoFrame(camElement);

  const [totalComputeTime, strokedRects, keyPoints] =
      await predict(camElement);

  drawOutput(inputCanvas, strokedRects, keyPoints);

  fpsEl.textContent = `${(1000 / parseFloat(totalComputeTime)).toFixed(0)} FPS`;
  fpsEl.hidden = false;

  setProgress(stepInfer, 'done');
  setStatus(`Inference: ${totalComputeTime}ms`);

  isRendering = false;
  if (!stopRender) {
    rafReq = requestAnimationFrame(renderCamStream);
  }
}

async function startCamera() {
  try {
    startBtn.disabled = true;
    setStatus('Starting camera...');

    stream = await utils.getMediaStream();
    camElement.srcObject = stream;

    await new Promise((resolve) => {
      camElement.onloadeddata = resolve;
    });

    stopBtn.disabled = false;
    detectBtn.disabled = false;
    setStatus('Camera running. Click "Start Detection" to load models.');
  } catch (e) {
    console.error(e);
    showError(`Camera error: ${e.message}`);
    startBtn.disabled = false;
  }
}

async function startDetection() {
  try {
    detectBtn.disabled = true;
    deviceSelect.disabled = true;

    const deviceType = deviceSelect.value;
    await initModels(deviceType);

    setProgress(stepInfer, 'active');
    setStatus('Running inference...');

    stopRender = false;
    renderCamStream();
  } catch (e) {
    console.error(e);
    showError(`Model error: ${e.message}`);
    detectBtn.disabled = false;
    deviceSelect.disabled = false;
  }
}

function stopCamera() {
  stopRender = true;
  utils.stopCameraStream(rafReq, stream);
  stream = null;
  rafReq = null;
  fpsEl.hidden = true;
  stopBtn.disabled = true;
  detectBtn.disabled = true;
  startBtn.disabled = false;
  deviceSelect.disabled = false;
  setStatus('Camera stopped');

  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

async function init() {
  if (await utils.isWebNN()) {
    setStatus('WebNN supported. Ready to start.');
    startBtn.disabled = false;
  } else {
    setStatus('WebNN not supported');
    showError(
        'Your browser does not support WebNN. Please use Chrome 113+ or Edge ' +
        'with the WebNN flag enabled. Go to <code>chrome://flags</code> and ' +
        'enable <code>#web-machine-learning-neural-network</code>. ' +
        'See <a href="https://github.com/webmachinelearning/webnn-samples/#webnn-installation-guides">WebNN Installation Guides</a> for details.');
  }
}

startBtn.addEventListener('click', startCamera);
detectBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopCamera);
init();
