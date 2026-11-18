'use strict';

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [17, 18], [18, 19], [19, 20],
  [0, 5], [0, 17], [5, 9], [9, 13], [13, 17],
];

const TIP_INDICES = new Set([0, 4, 8, 12, 16, 20]);

export function drawConnections(ctx, landmarks, width, height) {
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 3;
  for (const [i, j] of HAND_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }
}

export function drawLandmarks(ctx, landmarks, width, height) {
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * width;
    const y = lm.y * height;
    const isTip = TIP_INDICES.has(i);
    const radius = isTip ? 6 : 4;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isTip ? '#FF0000' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawHandLabel(ctx, landmarks, handedness, width, height) {
  const wrist = landmarks[0];
  const x = wrist.x * width;
  const y = wrist.y * height - 15;
  const label = handedness.label;
  const score = (handedness.score * 100).toFixed(0);
  const text = `${label} (${score}%)`;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#FFFF00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
