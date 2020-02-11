onmessage = imgData => {
  console.log('WORKER: received', imgData);
  postMessage('test test test');
};
