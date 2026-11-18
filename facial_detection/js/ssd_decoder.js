'use strict';

import {permuteData} from './utils.js';

export function decodeOutputBoxTensor(options, outputBoxTensor, anchors) {
  const {
    boxSize = 4,
    numBoxes = 1083 + 600 + 150 + 54 + 24 + 6,
  } = options;

  const scaleFactors = [10.0, 10.0, 5.0, 5.0];
  let boxOffset = 0;

  for (let y = 0; y < numBoxes; ++y) {
    const [yCenterA, xCenterA, ha, wa] = anchors[y];
    const ty = outputBoxTensor[boxOffset] / scaleFactors[0];
    const tx = outputBoxTensor[boxOffset + 1] / scaleFactors[1];
    const th = outputBoxTensor[boxOffset + 2] / scaleFactors[2];
    const tw = outputBoxTensor[boxOffset + 3] / scaleFactors[3];
    const w = Math.exp(tw) * wa;
    const h = Math.exp(th) * ha;
    const yCenter = ty * ha + yCenterA;
    const xCenter = tx * wa + xCenterA;
    outputBoxTensor[boxOffset] = yCenter - h / 2;
    outputBoxTensor[boxOffset + 1] = xCenter - w / 2;
    outputBoxTensor[boxOffset + 2] = yCenter + h / 2;
    outputBoxTensor[boxOffset + 3] = xCenter + w / 2;
    boxOffset += boxSize;
  }
}

function iOU(boxCord1, boxCord2) {
  const [ymin1, xmin1, ymax1, xmax1] = boxCord1;
  const [ymin2, xmin2, ymax2, xmax2] = boxCord2;
  const height = Math.max(0, Math.min(ymax1, ymax2) - Math.max(ymin1, ymin2));
  const width = Math.max(0, Math.min(xmax1, xmax2) - Math.max(xmin1, xmin2));
  const intersection = height * width;
  const area1 = (ymax1 - ymin1) * (xmax1 - xmin1);
  const area2 = (ymax2 - ymin2) * (xmax2 - xmin2);
  const areaSum = area1 + area2 - intersection;
  if (areaSum === 0) return 0;
  return intersection / areaSum;
}

export function generateAnchors(options) {
  const {
    minScale = 0.2,
    maxScale = 0.95,
    aspectRatios = [1.0, 2.0, 0.5, 3.0, 0.3333],
    baseAnchorSize = [1.0, 1.0],
    featureMapShapeList = [[19, 19], [10, 10], [5, 5], [3, 3], [2, 2], [1, 1]],
    interpolatedScaleAspectRatio = 1.0,
    reduceBoxesInLowestLayer = true,
  } = options;

  const numLayers = featureMapShapeList.length;
  const scales = [];
  for (let i = 0; i < numLayers; ++i) {
    scales.push(minScale + (maxScale - minScale) * i / (numLayers - 1));
  }

  const boxSpecsList = [];
  scales.forEach((scale, i) => {
    const scaleNext = (i === scales.length - 1) ? 1.0 : scales[i + 1];
    let layerBoxSpecs = [];
    if (i === 0 && reduceBoxesInLowestLayer) {
      layerBoxSpecs = [[0.1, 1.0], [scale, 2.0], [scale, 0.5]];
    } else {
      aspectRatios.forEach((aspectRatio) => {
        layerBoxSpecs.push([scale, aspectRatio]);
      });
      if (interpolatedScaleAspectRatio > 0.0) {
        layerBoxSpecs.push([
          Math.sqrt(scale * scaleNext), interpolatedScaleAspectRatio]);
      }
    }
    boxSpecsList.push(layerBoxSpecs);
  });

  const anchors = [];
  for (let i = 0; i < numLayers; ++i) {
    const gridHeight = featureMapShapeList[i][0];
    const gridWidth = featureMapShapeList[i][1];
    const anchorStride = [1.0 / gridHeight, 1.0 / gridWidth];
    const anchorOffset = [anchorStride[0] / 2, anchorStride[1] / 2];
    for (let h = 0; h < gridHeight; ++h) {
      for (let w = 0; w < gridWidth; ++w) {
        boxSpecsList[i].forEach(([scale, aspectRatio]) => {
          const ratioSqrt = Math.sqrt(aspectRatio);
          const yCenter = h * anchorStride[0] + anchorOffset[0];
          const xCenter = w * anchorStride[1] + anchorOffset[1];
          const height = scale / ratioSqrt * baseAnchorSize[0];
          const width = scale * ratioSqrt * baseAnchorSize[0];
          anchors.push([yCenter, xCenter, height, width]);
        });
      }
    }
  }
  return anchors;
}

export function nonMaxSuppression(options, outputBoxTensor, outputClassScoresTensor) {
  const {
    scoreThreshold = 0.5,
    iouThreshold = 0.5,
    maxDetectionsPerClass = 10,
    maxTotalDetections = 100,
    numBoxes = 1083 + 600 + 150 + 54 + 24 + 6,
    numClasses = 2,
    boxSize = 4,
  } = options;

  let boxesList = [];
  let scoresList = [];
  let classesList = [];

  // Skip background class 0
  for (let x = 1; x < numClasses; ++x) {
    let boxes = [];
    let scores = [];
    for (let y = 0; y < numBoxes; ++y) {
      const scoreIndex = y * numClasses + x;
      if (outputClassScoresTensor[scoreIndex] > scoreThreshold) {
        const boxIndexStart = y * boxSize;
        boxes.push(
            outputBoxTensor.subarray(boxIndexStart, boxIndexStart + boxSize));
        scores.push(outputClassScoresTensor[scoreIndex]);
      }
    }
    const boxForClassi = [];
    const scoreForClassi = [];
    const classi = [];
    while (scores.length !== 0 &&
        scoreForClassi.length < maxDetectionsPerClass) {
      let max = 0;
      let maxIndex = 0;
      scores.forEach((score, j) => {
        if (score > max) {
          max = score;
          maxIndex = j;
        }
      });
      const maxBox = boxes[maxIndex];
      boxForClassi.push(boxes.splice(maxIndex, 1)[0]);
      scoreForClassi.push(scores.splice(maxIndex, 1)[0]);
      classi.push(x);
      const retainBoxes = [];
      const retainScores = [];
      boxes.forEach((box, j) => {
        if (iOU(box, maxBox) < iouThreshold) {
          retainBoxes.push(boxes[j]);
          retainScores.push(scores[j]);
        }
      });
      boxes = retainBoxes;
      scores = retainScores;
    }
    boxesList = boxesList.concat(boxForClassi);
    scoresList = scoresList.concat(scoreForClassi);
    classesList = classesList.concat(classi);
  }

  let totalDetections;
  if (scoresList.length > maxTotalDetections) {
    totalDetections = maxTotalDetections;
    // Partial quicksort to keep top maxTotalDetections
    let low = 0;
    let high = scoresList.length - 1;
    while (low < high) {
      let i = low;
      let j = high;
      const tmpScore = scoresList[i];
      const tmpBox = boxesList[i];
      const tmpClassi = classesList[i];
      while (i < j) {
        while (i < j && scoresList[j] < tmpScore) --j;
        if (i < j) {
          scoresList[i] = scoresList[j];
          boxesList[i] = boxesList[j];
          classesList[i] = classesList[j];
          ++i;
        }
        while (i < j && scoresList[i] > tmpScore) ++i;
        if (i < j) {
          scoresList[j] = scoresList[i];
          boxesList[j] = boxesList[i];
          classesList[j] = classesList[i];
          --j;
        }
      }
      scoresList[i] = tmpScore;
      boxesList[i] = tmpBox;
      classesList[i] = tmpClassi;
      if (i === maxTotalDetections) {
        low = high;
      } else if (i < maxTotalDetections) {
        low = i + 1;
      } else {
        high = i - 1;
      }
    }
  } else {
    totalDetections = scoresList.length;
  }

  return [totalDetections, boxesList, scoresList, classesList];
}

export function cropSsdBox(imageSource, totalDetections, boxesList, margin) {
  for (let i = 0; i < totalDetections; ++i) {
    const [ymin, xmin, ymax, xmax] = boxesList[i];
    boxesList[i][0] =
        Math.max(0, (ymax + ymin) / 2 - (ymax - ymin) / 2 * margin[2]);
    boxesList[i][2] =
        Math.min(1, (ymax + ymin) / 2 + (ymax - ymin) / 2 * margin[3]);
    boxesList[i][1] =
        Math.max(0, (xmax + xmin) / 2 - (xmax - xmin) / 2 * margin[0]);
    boxesList[i][3] =
        Math.min(1, (xmax + xmin) / 2 + (xmax - xmin) / 2 * margin[1]);
  }
  return boxesList;
}

export function processSsdOutputTensor(outputSsdTensor, inputOptions, outputsInfo) {
  const numBoxes = inputOptions.numBoxes;
  const boxSize = inputOptions.boxSize;
  const numClasses = inputOptions.numClasses;
  const totalBoxes = numBoxes.reduce((a, b) => a + b);
  const outputBoxTensor = new Float32Array(totalBoxes * boxSize);
  const outputClassScoresTensor = new Float32Array(totalBoxes * numClasses);

  let boxOffset = 0;
  let classOffset = 0;

  for (let i = 0; i < numBoxes.length; ++i) {
    let boxTensor;
    let classTensor;

    // Transpose NCHW output to NHWC for postprocessing
    const boxDims = Object.entries(outputsInfo)[2 * i][1];
    const [boxPermuted] = permuteData(
        outputSsdTensor[2 * i], boxDims, [0, 2, 3, 1]);
    boxTensor = boxPermuted;

    const classDims = Object.entries(outputsInfo)[2 * i + 1][1];
    const [classPermuted] = permuteData(
        outputSsdTensor[2 * i + 1], classDims, [0, 2, 3, 1]);
    classTensor = classPermuted;

    outputBoxTensor.set(boxTensor, boxOffset);
    outputClassScoresTensor.set(classTensor, classOffset);
    boxOffset += boxSize * numBoxes[i];
    classOffset += numClasses * numBoxes[i];
  }

  return {outputBoxTensor, outputClassScoresTensor};
}

export function drawFaceRectangles(image, canvas, faceRects, texts) {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  faceRects.forEach((rect, i) => {
    const x = rect[0] / image.height * canvas.height;
    const y = rect[1] / image.height * canvas.height;
    const w = rect[2] / image.height * canvas.height;
    const h = rect[3] / image.height * canvas.height;
    ctx.strokeStyle = '#009bea';
    ctx.fillStyle = '#009bea';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '16px sans-serif';
    const text = texts[i];
    const tw = ctx.measureText(text).width;
    if (x >= 2 && y >= 18) {
      ctx.fillRect(x - 2, y - 18, tw + 4, 18);
      ctx.fillStyle = 'white';
      ctx.fillText(text, x, y - 3);
    } else {
      ctx.fillRect(x + 2, y, tw + 4, 18);
      ctx.fillStyle = 'white';
      ctx.fillText(text, x + 2, y + 15);
    }
  });
}

export function drawKeyPoints(image, canvas, keyPoints, rects) {
  const ctx = canvas.getContext('2d');
  rects.forEach((rect, n) => {
    const keyPoint = keyPoints[n];
    for (let i = 0; i < 136; i += 2) {
      const x =
          (rect[2] * keyPoint[i] + rect[0]) / image.height * canvas.height;
      const y =
          (rect[3] * keyPoint[i + 1] + rect[1]) / image.height * canvas.height;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();
    }
  });
}
