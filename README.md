# QR Reader
A library for scanning QR codes on the web using a web worker.

Most of this code is taken directly from [code-kotis/qr-code-scanner](https://github.com/code-kotis/qr-code-scanner).
I have only made minor modifications to it, mainly to make it more easily consumed as a library.

## Usage

```javascript
import { QRReader } from 'qr-reader'

const element = document.getElementById('video') // could also be an <img> element. If you're using react, you can use refs for this

// initialize the qr reader and web worker
QRReader.init(element)

// scan the element
QRReader.scan(result => {
  doSomethingWithQRText(result)
})

// terminate the web worker
QRReader.terminate()
```

### Contributions

If you find a bug, please file an issue. PR's are most welcome ;)

#### MIT Licensed
