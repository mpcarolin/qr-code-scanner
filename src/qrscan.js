import Worker from './decoder.worker'
import { log } from './utils'

/**
 * A QR code reader, using a webworker.
 * @example
 * const image = document.getElementById('myImage')
 * const reader = new QRReader(image)
 * reader.scan(result => {
 *  handleScanResult(result)
 * })
 *
 * ...
 *
 * reader.terminate()
 */
export class QRReader {
  /**
   * Initializes the reader and its web worker
   * @param { Object } mediaElement - either a video or image element
   */
  constructor(mediaElement) {
    this.active = false
    this.webcam = mediaElement
    this.canvas = null
    this.ctx = null
    this.decodingWorker = null
    this.streaming = false
    this.onScanComplete = null

    this.setPhotoSourceToScan(mediaElement)

    // set the canvas to match the image dimensions
    this.setCanvas()

    // initialize the decoding worker
    this.decodingWorker = this.createWorker()

    // set the canvas properties at the right time
    if (window.isMediaStreamAPISupported) {
      // Resize webcam according to input
      this.webcam.addEventListener(
        'play',
        event => {
          !this.streaming && this.setCanvasProperties()
          this.streaming = true
        },
        false
      )
    } else {
      this.setCanvasProperties()
    }
  }

  /**
   * Call this to start scanning for QR codes.
   * @param { Function } callback - callback for result of scan
   * @param { Boolean } scanForSelectedPhotos
   */
  scan(onComplete, scanForSelectedPhotos) {
    this.active = true
    this.setCanvas()

    // set the onScan callback which will be called by the message handler, if it receives data from worker
    this.onScanComplete = onComplete

    setTimeout(() => this.setPhotoSourceToScan(null, scanForSelectedPhotos))

    this.requestNewDecoderTask()
  }

  /**
   * Terminates the web worker that handles decoding. To resume scanning, you will have to call init again.
   * @function
   * @returns { void }
   */
  terminate() {
    log('Terminating worker')
    this.decodingWorker && this.decodingWorker.terminate()
    this.decodingWorker = null
  }

  /**
   * Set the dimensions of canvas to match the window
   */
  setCanvasProperties() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  /**
   * Initializes the web worker that handles decoding image data
   * Assigns the `message` and `error` handlers
   * @returns { Object } the worker
   */
  createWorker() {
    const worker = new Worker()
    worker.onerror = e => this.handleWorkerError(e)
    worker.onmessage = msg => this.handleWorkerMessage(msg)

    log('Created worker', worker)

    return worker
  }

  /**
   * creates the canvas and context
   */
  setCanvas() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
  }

  /**
   * Validates a message received from the worker
   * @param {*} msg
   */
  validateMessage(msg) {
    if (!msg) {
      console.error('Found undefined message', msg)
      return [false]
    }
    if (typeof msg === 'object') {
      return [true]
    }

    console.error('Message was not an object as expected', msg)
    return [false]
  }

  /**
   * Validates and handles a message received from the worker
   * @param {Object} message
   * @param {Object} message.data - the QR result data
   */
  handleWorkerMessage(message) {
    const [valid] = this.validateMessage(message)
    if (!valid) return

    const { name, payload } = message.data

    switch (name) {
      case 'decoded':
        return this.processDecodedQR(payload)
      case 'init':
        return this.handleWorkerInit(payload)
      default:
        return log('Unknown message type', name, payload)
    }
  }

  /**
   * Handles the worker's initialization event
   * @param {*} msg
   */
  handleWorkerInit(msg) {
    return log('Worker sent message that it initialized', msg)
  }

  /**
   * Handles an error that occurred inside the web worker
   * @param {*} err
   */
  handleWorkerError(err) {
    return console.error('Worker encountered error', err)
  }

  /**
   * Handles the decoded text from a qr code, as sent by the web worker
   * @param {Array} result
   */
  processDecodedQR(result) {
    if (result.length > 0) {
      log('Received result from worker', result)
      const text = result[0][2]
      this.active = false
      this.onScanComplete && this.onScanComplete(text)
    } else {
      log('Received empty result from worker')
    }

    setTimeout(() => this.requestNewDecoderTask(), 0)
  }

  /**
   * Requests the worker to decode the current image of the mediaElement
   * @returns { void }
   */
  requestNewDecoderTask() {
    if (!this.active) return

    try {
      // get the image data by drawing the webcam to the canvas context, then extracting the image data out
      const { width, height } = this.canvas
      this.ctx.drawImage(this.webcam, 0, 0, width, height)
      const imgData = this.ctx.getImageData(0, 0, width, height)

      if (!imgData.data) return

      log('sending data...')
      this.decodingWorker.postMessage(imgData)
    } catch (e) {
      console.error(e)
      // Try-Catch to circumvent Firefox Bug #879717
      if (e.name == 'NS_ERROR_NOT_AVAILABLE') setTimeout(() => this.requestNewDecoderTask(), 0)
    }
  }

  /**
   * Assigns webcam to the mediaElement, if defined, else searches for the element
   * @param {Object} mediaElement
   * @param {Boolean} forSelectedPhotos
   */
  setPhotoSourceToScan(mediaElement, forSelectedPhotos) {
    if (this.webcam) return

    let webcam

    if (mediaElement) {
      webcam = mediaElement
    } else if (!forSelectedPhotos && window.isMediaStreamAPISupported) {
      webcam = document.querySelector('video')
    } else {
      webcam = document.querySelector('img')
    }
    this.webcam = webcam
  }
}
