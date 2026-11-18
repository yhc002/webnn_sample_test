# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of static web demos showcasing real-time ML inference in the browser using live camera video via `getUserMedia`. Each demo lives in its own subfolder. No build system — all files are vanilla ES modules.

### Demos

1. **`facial_detection/`** — Facial landmark detection using the **raw WebNN API** (MLGraphBuilder, not ONNX Runtime). Runs a two-stage ML pipeline per frame:
   - **SSD MobileNetV2 Face** — detects face bounding boxes (input `[1,3,300,300]`, 12 output tensors)
   - **Face Landmark SimpleCNN** — predicts 68 facial keypoints per detected face (input `[1,3,128,128]`, output `[1,136]`)
   - Both models use **NCHW layout only**. Weights fetched at runtime from GitHub Pages (`https://webmachinelearning.github.io/webnn-samples/test-data/models/`).

2. **`hand_tracking/`** — Hand landmark detection using **MediaPipe Hands JS** (`@mediapipe/hands@0.4.1675469240` from jsDelivr CDN). Detects up to 2 hands with 21 3D landmarks each. No local model files — WASM and model binaries load from CDN at runtime.

## Running

Serve via any HTTP server from the project root (required for `fetch()` and `getUserMedia`):

```
python -m http.server 8080
```

- Landing page: `http://localhost:8080/`
- Facial detection: `http://localhost:8080/facial_detection/`
- Hand tracking: `http://localhost:8080/hand_tracking/`

The facial detection demo requires Chrome/Edge with WebNN enabled (`chrome://flags` → `#web-machine-learning-neural-network` → Enabled). The hand tracking demo works in any modern browser.

## Architecture

### Facial Detection (`facial_detection/`)

All JS files are ES modules loaded from `index.html` via `<script type="module" src="js/app.js">`.

- **`js/app.js`** — Entry point. Manages camera lifecycle, model init, the `requestAnimationFrame` inference loop, and UI state.
- **`js/ssd_mobilenetv2_face.js`** — Builds the SSD MobileNetV2 face detection graph using `MLGraphBuilder`. Class `SsdMobilenetV2FaceNchw` with `load()` → `build()` → `compute()` lifecycle.
- **`js/face_landmark.js`** — Builds the Face Landmark SimpleCNN graph. Class `FaceLandmarkNchw` with same lifecycle. 8 conv+relu layers, 4 max-pool, 2 gemm layers.
- **`js/ssd_decoder.js`** — SSD post-processing: anchor generation, box decoding, NMS, cropping, and canvas drawing.
- **`js/utils.js`** — Shared utilities: `.npy` weight loading (`buildConstantByNpy`), input tensor extraction (`getInputTensor`), `computePadding2DForAutoPad`, `permuteData`, camera helpers.
- **`js/numpy.js`** — Binary `.npy` file parser.

### Hand Tracking (`hand_tracking/`)

Uses MediaPipe Hands JS loaded from CDN as a regular `<script>`, then `js/app.js` as `type="module"`.

- **`js/app.js`** — Entry point. Camera lifecycle, MediaPipe Hands initialization (`window.Hands`), `requestAnimationFrame` inference loop via `hands.send()`, UI state.
- **`js/drawing.js`** — Canvas drawing: 21 hand landmark dots, finger/palm connection lines, hand labels (Left/Right with confidence).

## Key Patterns

- Both demos use a two-button flow: "Start Camera" (opens getUserMedia) → "Start Detection" (loads models, starts inference loop) → "Stop Camera".
- Camera feed is mirrored via CSS `transform: scaleX(-1)` on the video element.
- Facial detection: canvas overlay drawn in original orientation. Hand tracking: canvas mirrored via `ctx.translate + ctx.scale(-1,1)` to align with video; labels use reverse transform to prevent mirrored text.
- Weight file names in `facial_detection/` follow the exact naming convention from the `webnn-samples` reference repo — changing them will break weight loading.

### Landing Page (`index.html`)

Root `index.html` is a static landing page with styled cards linking to each demo. Dark theme matching the demos, no JS.

## Reference Implementations

- Facial detection: based on https://github.com/webmachinelearning/webnn-samples/tree/master/facial_landmark_detection/
- Hand tracking: uses [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) JS library
