import Worker from './decoder.worker';
import { isObj, validate } from 'jsutils';

const SHOULD_LOG = false;
const log = (...args) => SHOULD_LOG && console.log(...args);

const QRReader = {};

QRReader.active = false;
QRReader.webcam = null;
QRReader.canvas = null;
QRReader.ctx = null;
QRReader.decoder = null;

QRReader.setCanvas = () => {
  QRReader.canvas = document.createElement('canvas');
  QRReader.ctx = QRReader.canvas.getContext('2d');
};

function setPhotoSourceToScan(mediaElement, forSelectedPhotos) {
  if (QRReader.webcam) return;
  let webcam;
  if (mediaElement) {
    webcam = mediaElement;
  } else if (!forSelectedPhotos && window.isMediaStreamAPISupported) {
    webcam = document.querySelector('video');
  } else {
    webcam = document.querySelector('img');
  }
  QRReader.webcam = webcam;
}

/**
 * @param { Object } mediaElement - either a video or image element
 */
QRReader.init = mediaElement => {
  var streaming = false;

  // Init Webcam + Canvas
  setPhotoSourceToScan(mediaElement);

  QRReader.setCanvas();
  QRReader.decoder = createWorker();

  if (window.isMediaStreamAPISupported) {
    // Resize webcam according to input
    QRReader.webcam.addEventListener(
      'play',
      event => {
        if (!streaming) {
          setCanvasProperties();
          streaming = true;
        }
      },
      false
    );
  } else {
    setCanvasProperties();
  }
};

/**
 * Call this to start scanning for QR codes.
 * @param { Function } callback - callback for result of scan
 * @param { Boolean } forSelectedPhotos
 */
QRReader.scan = function(callback, forSelectedPhotos) {
  QRReader.active = true;
  QRReader.setCanvas();

  // set the onScan callback which will be called by the message handler, if it receives data from worker
  QRReader.onScan = callback;

  setTimeout(() => {
    setPhotoSourceToScan(null, forSelectedPhotos);
  });

  requestNewDecoderTask();
};

/**
 * Terminates the web worker that handles decoding. To resume scanning, you will have to call init again.
 * @function
 * @returns { void }
 */
QRReader.terminate = () => {
  QRReader.decoder && QRReader.decoder.terminate();
  QRReader.decoder = null;
};

const setCanvasProperties = () => {
  QRReader.canvas.width = window.innerWidth;
  QRReader.canvas.height = window.innerHeight;
};

const createWorker = () => {
  const worker = new Worker();
  worker.onerror = handleWorkerError;
  worker.onmessage = handleWorkerMessage;

  console.log('Created worker', worker);

  return worker;
};

/**
 * Handles event
 * @param {*} message
 */
const handleWorkerMessage = message => {
  const [valid] = validate({ message }, { message: isObj });
  if (!valid) return;

  const { name, payload } = message.data;

  switch (name) {
    case 'decoded':
      return processDecodedQR(payload);
    case 'init':
      return handleWorkerInit(payload);
    default:
      return log('Unknown message type', name, payload);
  }
};

const handleWorkerError = err => {
  return console.error('Worker encountered error', err);
};

const processDecodedQR = result => {
  if (result.length > 0) {
    const text = result[0][2];
    QRReader.active = false;
    QRReader.onScan && QRReader.onScan(text);
  } else {
    log('Received empty result from worker');
  }
  setTimeout(requestNewDecoderTask, 0);
};

const handleWorkerInit = msg => {
  return log('Worker sent message that it initialized', msg);
};

// Start QR-decoder web worker
function requestNewDecoderTask() {
  if (!QRReader.active) return;
  try {
    QRReader.ctx.drawImage(QRReader.webcam, 0, 0, QRReader.canvas.width, QRReader.canvas.height);
    const imgData = QRReader.ctx.getImageData(0, 0, QRReader.canvas.width, QRReader.canvas.height);

    if (imgData.data) {
      log('sending data...');
      QRReader.decoder.postMessage(imgData);
    }
  } catch (e) {
    // Try-Catch to circumvent Firefox Bug #879717
    console.error(e);
    if (e.name == 'NS_ERROR_NOT_AVAILABLE') setTimeout(requestNewDecoderTask, 0);
  }
}

export default QRReader;
