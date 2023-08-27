const fs = require('fs');
const path = require('path');

const { downloadPath } = require('../main');

const uploadStatusUpdater = {
  /** @type {http.ServerResponse} */
  response: null,
  pushStatus(data) {
    if (!this.response) return;
    this.response.write('data: ' + JSON.stringify(data));
    this.response.write('\n\n');
  }
};

/**
 * @typedef {Object} FileCache
 * @property {fs.WriteStream} writeStream
 * @property {number} size
 * @property {number} receivedSize
 * @property {string} modifiedFileName
 */

/** @type {Object<string, FileCache>} */
const fileStorage = {};

/**
 * @this {http.ServerResponse}
 */
function handleUploadStatusRequest() {
  uploadStatusUpdater.response = this;
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream'
  });
}

/**
 * @param {http.IncomingHttpHeaders} headers
 * @param {Uint8Array} data
 */
function handleUploadRequest(headers, data) {
  const fileName = decodeURI(headers['file-name']);
  const fileSize = +headers['file-size'];
  if (!fileName || !handleData(data, fileName, fileSize)) {
    this.writeHead(400);
    return this.end('Bad request');
  } else this.end();
}

/**
 * @param {Uint8Array} data
 * @param {string} fileName
 * @param {number} fileSize
 * @returns {boolean}
 */
function handleData(data, fileName, fileSize) {
  const re = /^[^<>:"/\\|?*]+$/;
  if (!re.test(fileName)) return false;

  if (!fileStorage[fileName]) {
    const modifiedFileName = generateUnusedFileName(fileName);
    const filePath = path.join(downloadPath, modifiedFileName);
    fileStorage[fileName] = {
      writeStream: fs.createWriteStream(filePath),
      size: fileSize,
      receivedSize: 0,
      modifiedFileName
    };
  }

  const cache = fileStorage[fileName];
  // TODO: Write file metadata as well.
  cache.writeStream.write(data, 'binary');
  cache.receivedSize += data.length;
  // console.log(`${fileName}: ${cache.receivedSize}/${cache.size}`);
  uploadStatusUpdater.pushStatus({
    fileName,
    received: cache.receivedSize,
    size: cache.size
  });

  if (cache.receivedSize === cache.size) {
    cache.writeStream.end();
    delete fileStorage[fileName];
    console.log('File received:', fileName);
  }
  return true;
}

/**
 * @param {string} fileName
 * @returns {string}
 */
function generateUnusedFileName(fileName) {
  const fileExt = path.extname(fileName);
  const fileTitle = fileName.slice(0, -fileExt.length);
  for (let i = 2, newFileName = fileName;; ++i) {
    const filePath = path.join(downloadPath, newFileName);
    // TODO: fs sync methods block the event loop.
    if (!fs.existsSync(filePath)) return newFileName;
    newFileName = `${fileTitle} (${i})${fileExt}`;
  }
}

module.exports = {
  handleUploadStatusRequest,
  handleUploadRequest
}