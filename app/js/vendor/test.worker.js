postMessage('Worker running');

onmessage = function(imgData) {
  console.log('WORKER: received', imgData);
  postMessage('test test test');
};
