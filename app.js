const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');

const urlMap = {
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/style.css': 'public/style.css',
  '/upload.js': 'public/upload.js',
  '/scroll.js': 'public/scroll.js',
  '/qrcode.js': 'public/qrcode.js',
};

const uploadStatusUpdater = {
  response: null,
  pushStatus(data) {
    if (!this.response) return;
    this.response.write('data: ' + JSON.stringify(data));
    this.response.write('\n\n');
  }
};

const fileStorage = {};

const PORT = 8080;
const nets = os.networkInterfaces()['Wi-Fi'];
const ip = nets.find(net => net.family === 'IPv4').address;
const address = `http://${ip}:${PORT}`;  

http
  .createServer((req, res) => {
    if (req.method === 'GET') return req.url === '/upload-status'
      ? handleUploadStatusRequest.call(res)
      : handleGetRequest.call(res, req.url);
    if (req.url === '/upload' && req.method === 'POST') {
      return req.on('data', handleUploadRequest.bind(res, req.headers));
    }
    res.writeHead(405);
    res.end('Method not allowed');
  })
  .listen(PORT, () => console.log(`Server is running on ${address}`));

function handleUploadStatusRequest() {
  uploadStatusUpdater.response = this;
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream'
  });
}

function handleGetRequest(url) {
  // res.end: Data is sent as a whole.
  if (url === '/address') return this.end(address);
  if (!urlMap.hasOwnProperty(url)) {
    this.writeHead(404);
    return this.end('Not found');
  }
  const filePath = path.join(__dirname, urlMap[url]);
  // res.write: Data is sent in a series of chunks.
  this.write(fs.readFileSync(filePath));
  return this.end();
}

function handleUploadRequest(headers, data) {
  const fileName = decodeURI(headers['file-name']);
  const fileSize = +headers['file-size'];
  if (!fileName || !handleData(data, fileName, fileSize)) {
    this.writeHead(400);
    return this.end('Bad request');
  } else this.end();
}

function handleData(data, fileName, fileSize) {
  const re = /^[^<>:"/\\|?*]+$/;
  if (!re.test(fileName)) return false;
  const file = fileStorage[fileName] = fileStorage[fileName] || {};
  if (!file.size) {
    const filePath = path.join(__dirname, 'uploads', fileName);
    file.writeStream = fs.createWriteStream(filePath);
    file.size = fileSize;
    file.receivedSize = 0;
  }

  file.writeStream.write(data, 'binary');
  file.receivedSize += data.length;
  console.log(`${fileName}: ${file.receivedSize}/${file.size}`);
  uploadStatusUpdater.pushStatus({
    fileName,
    received: file.receivedSize,
    size: file.size
  });

  if (file.receivedSize === file.size) {
    file.writeStream.end();
    delete fileStorage[fileName];
    console.log('File received:', fileName);
  }
  return true;
}