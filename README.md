# WebNN & ML Sample Demos

A collection of sample web applications demonstrating real-time ML-powered computer vision in the browser. Each demo captures live camera video via `getUserMedia` and runs ML inference to detect and track features in real time.

## Demos

### Facial Landmark Detection (`facial_detection/`)

Real-time face detection and 68-point landmark tracking using the [Web Neural Network (WebNN) API](https://www.w3.org/TR/webnn/). Both models are constructed operation-by-operation using the raw `MLGraphBuilder` API (not ONNX Runtime), making this a useful reference for understanding how WebNN works at a low level.

- **SSD MobileNetV2 Face** — detects face bounding boxes in the full frame
- **Face Landmark SimpleCNN** — predicts 68 facial keypoints (eyes, nose, mouth, jawline) per detected face

### Hand Tracking (`hand_tracking/`)

Real-time hand landmark detection and tracking using [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html). Detects up to 2 hands simultaneously, drawing 21 landmark points with finger/palm connections and Left/Right hand labels with confidence scores.

## Prerequisites

- **Browser**: Chrome 113+ or Microsoft Edge
- **WebNN flag** (facial detection only): Navigate to `chrome://flags` and enable `#web-machine-learning-neural-network`, then restart the browser
- **Camera**: A webcam or front-facing camera
- **HTTP server**: The pages must be served over HTTP (not `file://`) for `fetch()` and `getUserMedia` to work

## Getting Started

1. **Clone or download** this repository

2. **Start a local HTTP server** from the project directory:
   ```bash
   python -m http.server 8080
   ```

3. **Open** the landing page at `http://localhost:8080/` and pick a demo, or go directly:
   - Facial detection: `http://localhost:8080/facial_detection/`
   - Hand tracking: `http://localhost:8080/hand_tracking/`

4. **Click "Start Camera"** to begin the camera feed

5. **Click "Start Detection"** to load the ML models and begin tracking

## How It Works

### Facial Detection — WebNN API

The facial detection demo builds neural network compute graphs manually using the WebNN API:

```javascript
// Create context and graph builder
const context = await navigator.ml.createContext({deviceType: 'gpu'});
const builder = new MLGraphBuilder(context);

// Declare input, load weights, chain operations
const input = builder.input('input', {dataType: 'float32', shape: [1, 3, 128, 128]});
const conv = builder.conv2d(input, weights, {bias});
const relu = builder.relu(conv);
// ... more layers ...

// Compile and run
const graph = await builder.build({'output': outputOperand});
context.dispatch(graph, inputs, outputs);
```

Model weights (`.npy` files) are fetched at runtime from the [WebNN Samples](https://github.com/webmachinelearning/webnn-samples) GitHub Pages deployment. No local download is required.

### Hand Tracking — MediaPipe Hands

The hand tracking demo uses Google's MediaPipe Hands JS library, loaded from CDN. It automatically downloads the WASM runtime and TFLite model at initialization time.

```javascript
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1 });
hands.onResults(onHandResults);
await hands.initialize();
```

## Project Structure

```
webnn_sample/
├── index.html                          # Landing page linking to demos
├── facial_detection/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js                      # Camera, model init, inference loop
│       ├── ssd_mobilenetv2_face.js     # SSD MobileNetV2 face detection model
│       ├── face_landmark.js            # Face Landmark SimpleCNN model
│       ├── ssd_decoder.js              # SSD post-processing (anchors, NMS, drawing)
│       ├── utils.js                    # Weight loading, tensor prep, camera helpers
│       └── numpy.js                    # .npy binary format parser
├── hand_tracking/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js                      # Camera, MediaPipe init, inference loop
│       └── drawing.js                  # Hand landmark & connection drawing
├── CLAUDE.md
└── README.md
```

## Controls

Both demos share the same control pattern:

| Button | Action |
|--------|--------|
| **Start Camera** | Opens the webcam feed |
| **Start Detection** | Loads ML models and begins real-time inference |
| **Stop Camera** | Stops both the camera and detection |
| **Device** (facial detection only) | Select GPU or CPU for WebNN inference |

## References

- Facial detection: based on [WebNN Samples — Facial Landmark Detection](https://github.com/webmachinelearning/webnn-samples/tree/master/facial_landmark_detection/) by the [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/)
- Hand tracking: uses [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) by Google

## License

This project is for educational and demonstration purposes.
