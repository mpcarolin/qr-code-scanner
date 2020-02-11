import Worker from './decoder.worker';

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
  QRReader.decoder = new Worker();

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

  const onDecoderMessage = event => {
    if (event.data.length > 0) {
      var qrid = event.data[0][2];
      QRReader.active = false;
      callback(qrid);
    }
    setTimeout(newDecoderFrame, 0);
  };

  // listen to messages from worker
  QRReader.decoder.onmessage = onDecoderMessage;

  setTimeout(() => {
    setPhotoSourceToScan(null, forSelectedPhotos);
  });

  // Start QR-decoder
  function newDecoderFrame() {
    if (!QRReader.active) return;
    try {
      QRReader.ctx.drawImage(QRReader.webcam, 0, 0, QRReader.canvas.width, QRReader.canvas.height);
      const imgData = QRReader.ctx.getImageData(0, 0, QRReader.canvas.width, QRReader.canvas.height);

      if (imgData.data) {
        QRReader.decoder.postMessage(imgData);
      }
    } catch (e) {
      // Try-Catch to circumvent Firefox Bug #879717
      console.error(e);
      if (e.name == 'NS_ERROR_NOT_AVAILABLE') setTimeout(newDecoderFrame, 0);
    }
  }
  newDecoderFrame();
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

function setCanvasProperties() {
  QRReader.canvas.width = window.innerWidth;
  QRReader.canvas.height = window.innerHeight;
}

export default QRReader;
