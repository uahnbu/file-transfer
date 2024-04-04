const fs = require('fs')
const http = require('http')
const path = require('path')
const os = require('os')

const urlMap = {
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/style.css': 'public/style.css',
  '/upload.js': 'public/upload.js',
  '/scroll.js': 'public/scroll.js',
  '/qrcode.js': 'public/qrcode.js'
}

const uploadStatusUpdater = {
  /** @type {http.ServerResponse} */
  response: null,
  pushStatus(data) {
    if (!this.response) return
    this.response.write('data: ' + JSON.stringify(data))
    this.response.write('\n\n')
  }
}

/**
 * @typedef {Object} FileCache
 * @property {fs.WriteStream} writeStream
 * @property {number} size
 * @property {number} receivedSize
 * @property {string} modifiedFileName
 */

/** @type {Object<string, FileCache>} */
const fileStorage = {}

const nets = os.networkInterfaces()['Wi-Fi']
const ip = nets.find((net) => net.family === 'IPv4').address

let address

const server = http.createServer((req, res) => {
  if (req.method === 'GET')
    switch (req.url) {
      case '/address':
        return res.end(address)
      case '/upload-status':
        return handleUploadStatusRequest.call(res)
      default:
        return handleGetRequest.call(res, req.url)
    }
  if (req.url === '/upload' && req.method === 'POST') {
    return req.on('data', handleUploadRequest.bind(res, req.headers))
  }
  res.writeHead(405)
  res.end('Method not allowed')
})

server.listen(0, () => {
  address = `http://${ip}:${server.address().port}`
  console.log('Server is running on ' + address)
})

/**
 * @this {http.ServerResponse}
 */
function handleUploadStatusRequest() {
  uploadStatusUpdater.response = this
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream'
  })
}

/**
 * @param {string} url
 */
function handleGetRequest(url) {
  if (!urlMap.hasOwnProperty(url)) {
    this.writeHead(404)
    return this.end('Not found')
  }
  const filePath = path.join(__dirname, urlMap[url])
  // res.end  : Data is sent as a whole.
  // res.write: Data is sent in a series of chunks.
  this.write(fs.readFileSync(filePath))
  return this.end()
}

/**
 * @param {http.IncomingHttpHeaders} headers
 * @param {Uint8Array} data
 */
function handleUploadRequest(headers, data) {
  const fileName = decodeURI(headers['file-name'])
  const fileSize = +headers['file-size']
  if (!fileName || !handleData(data, fileName, fileSize)) {
    this.writeHead(400)
    return this.end('Bad request')
  } else this.end()
}

/**
 * @param {Uint8Array} data
 * @param {string} fileName
 * @param {number} fileSize
 * @returns {boolean}
 */
function handleData(data, fileName, fileSize) {
  const re = /^[^<>:"/\\|?*]+$/
  if (!re.test(fileName)) return false

  if (!fileStorage[fileName]) {
    const modifiedFileName = generateUnusedFileName(fileName)
    const filePath = path.join(downloadPath, modifiedFileName)
    fileStorage[fileName] = {
      writeStream: fs.createWriteStream(filePath),
      size: fileSize,
      receivedSize: 0
    }
  }
  const cache = fileStorage[fileName]
  // TODO: Write file metadata as well.
  cache.writeStream.write(data, 'binary')
  cache.receivedSize += data.length
  // console.log(`${fileName}: ${cache.receivedSize}/${cache.size}`);
  uploadStatusUpdater.pushStatus({
    fileName,
    received: cache.receivedSize,
    size: cache.size
  })
  if (cache.receivedSize === cache.size) {
    cache.writeStream.end()
    delete fileStorage[fileName]
    console.log('File received:', fileName)
  }
  return true
}

/**
 * @param {string} fileName
 * @returns {string}
 */
function generateUnusedFileName(fileName) {
  const fileExt = path.extname(fileName)
  const fileTitle = fileName.slice(0, -fileExt.length)
  for (let i = 2, newFileName = fileName; ; ++i) {
    const filePath = path.join(downloadPath, newFileName)
    // TODO: fs sync methods block the event loop.
    if (!fs.existsSync(filePath)) return newFileName
    newFileName = `${fileTitle} (${i})${fileExt}`
  }
}
