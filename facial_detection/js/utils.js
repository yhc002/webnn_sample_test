'use strict';

import {NpyArray} from './numpy.js';

const isFloat16ArrayAvailable =
    typeof Float16Array !== 'undefined' && Float16Array.from;

export function weightsOrigin() {
  return 'https://webmachinelearning.github.io/webnn-samples/test-data/models';
}

export function sizeOfShape(shape) {
  return shape.reduce((a, b) => a * b);
}

const dataTypeMap = new Map([
  ['f2', {type: 'float16', array: isFloat16ArrayAvailable ? Float16Array : Uint16Array}],
  ['f4', {type: 'float32', array: Float32Array}],
  ['f8', {type: 'float64', array: Float64Array}],
  ['i1', {type: 'int8', array: Int8Array}],
  ['i2', {type: 'int16', array: Int16Array}],
  ['i4', {type: 'int32', array: Int32Array}],
  ['i8', {type: 'int64', array: BigInt64Array}],
  ['u1', {type: 'uint8', array: Uint8Array}],
  ['u2', {type: 'uint16', array: Uint16Array}],
  ['u4', {type: 'uint32', array: Uint32Array}],
  ['u8', {type: 'uint64', array: BigUint64Array}],
]);

export async function buildConstantByNpy(builder, url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const npArray = new NpyArray(new Uint8Array(buffer));
  if (!dataTypeMap.has(npArray.dataType)) {
    throw new Error(`Data type ${npArray.dataType} is not supported.`);
  }
  const shape = npArray.shape;
  const {type, array: TypedArrayConstructor} = dataTypeMap.get(npArray.dataType);
  const typedArray = new TypedArrayConstructor(npArray.data.buffer);
  return builder.constant({dataType: type, dimensions: shape, shape}, typedArray);
}

export function computePadding2DForAutoPad(
    inputSizes, filterSizes, strides, dilations, autoPad) {
  const [inputHeight, inputWidth] = inputSizes;
  const [filterHeight, filterWidth] = filterSizes;
  const [strideHeight, strideWidth] = strides ? strides : [1, 1];
  const [dilationHeight, dilationWidth] = dilations ? dilations : [1, 1];
  const effectiveFilterHeight = (filterHeight - 1) * dilationHeight + 1;
  const effectiveFilterWidth = (filterWidth - 1) * dilationWidth + 1;

  function pad1D(inputSize, effectiveFilterSize, stride) {
    const outSize = Math.ceil(inputSize / stride);
    const neededInput = (outSize - 1) * stride + effectiveFilterSize;
    const totalPadding = neededInput > inputSize ? neededInput - inputSize : 0;
    if (autoPad === 'same-upper') {
      return [Math.floor(totalPadding / 2), Math.floor((totalPadding + 1) / 2)];
    }
    return [Math.floor((totalPadding + 1) / 2), Math.floor(totalPadding / 2)];
  }

  const [beginH, endH] = pad1D(inputHeight, effectiveFilterHeight, strideHeight);
  const [beginW, endW] = pad1D(inputWidth, effectiveFilterWidth, strideWidth);
  return [beginH, endH, beginW, endW];
}

// Permute typed array data — replaces tf.transpose dependency.
export function permuteData(array, dims, axes) {
  const shape = new Array(axes.length);
  const stride = new Array(axes.length);
  for (let i = axes.length - 1, s = 1; i >= 0; --i) {
    stride[i] = s;
    shape[i] = dims[axes[i]];
    s *= shape[i];
  }
  const invStride = axes.map((_, i) => stride[axes.indexOf(i)]);
  const permutedData = new array.constructor(array.length);
  for (let i = 0; i < array.length; ++i) {
    let newIndex = 0;
    for (let j = dims.length - 1, k = i; j >= 0; --j) {
      newIndex += (k % dims[j]) * invStride[j];
      k = Math.floor(k / dims[j]);
    }
    permutedData[newIndex] = array[i];
  }
  return [permutedData, shape];
}

export function getInputTensor(inputElement, inputOptions) {
  const inputShape = inputOptions.inputShape;
  const tensor = new Float32Array(inputShape.slice(1).reduce((a, b) => a * b));

  inputElement.width = inputElement.videoWidth || inputElement.naturalWidth;
  inputElement.height = inputElement.videoHeight || inputElement.naturalHeight;

  const [channels, height, width] = inputShape.slice(1);
  const mean = inputOptions.mean || [0, 0, 0];
  const std = inputOptions.std || [1, 1, 1];
  const drawOptions = inputOptions.drawOptions;

  const canvasElement = document.createElement('canvas');
  canvasElement.width = width;
  canvasElement.height = height;
  const ctx = canvasElement.getContext('2d');

  if (drawOptions) {
    ctx.drawImage(inputElement, drawOptions.sx, drawOptions.sy,
        drawOptions.sWidth, drawOptions.sHeight,
        0, 0, drawOptions.dWidth, drawOptions.dHeight);
  } else {
    ctx.drawImage(inputElement, 0, 0, width, height);
  }

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const imageChannels = 4; // RGBA

  for (let c = 0; c < channels; ++c) {
    for (let h = 0; h < height; ++h) {
      for (let w = 0; w < width; ++w) {
        const value = pixels[h * width * imageChannels + w * imageChannels + c];
        // NCHW layout
        tensor[c * width * height + h * width + w] =
            (value - mean[c]) / std[c];
      }
    }
  }
  return tensor;
}

export async function getMediaStream() {
  const constraints = {
    audio: false,
    video: {facingMode: 'user'},
  };
  return await navigator.mediaDevices.getUserMedia(constraints);
}

export function stopCameraStream(animFrameId, stream) {
  cancelAnimationFrame(animFrameId);
  if (stream) {
    stream.getTracks().forEach((track) => {
      if (track.readyState === 'live' && track.kind === 'video') {
        track.stop();
      }
    });
  }
}

export function getVideoFrame(videoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function isWebNN() {
  if (typeof MLGraphBuilder !== 'undefined') {
    if (typeof MLTensorUsage === 'undefined') {
      window.MLTensorUsage = {WEBGPU_INTEROP: 1, READ: 2, WRITE: 4};
    }
    return true;
  }
  return false;
}
