const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');

const {
  handleUploadStatusRequest,
  handleUploadRequest
} = require('./upload');

const urlMap = {
  '/': '../public/index.html',
  '/index.html': '../public/index.html',
  '/style.css': '../public/style.css',
  '/render.js': '../public/render.js',
  '/upload.js': '../public/upload.js',
  '/qrcode.js': '../public/qrcode.js',
};

const netInterfaces = os.networkInterfaces();
const nets = netInterfaces['Wi-Fi'] || netInterfaces['en0'];
const ip = nets.find(net => net.family === 'IPv4').address;

// console.log(
//   Object.entries(netInterfaces)
//     .map(([name, net]) => [name].concat(
//       net.filter(net => (
//         net.family === 'IPv4' &&
//         net.address.startsWith('192.168.') &&
//         +net.address.split('.')[2] < 10
//       ))
//     ))
// );

let address;

const server = http.createServer((req, res) => {
  // console.log('XFF:', req.socket.remoteAddress, req.headers['x-forwarded-for']);
  if (req.method === 'GET') switch (req.url) {
    case '/address': return res.end(address);
    case '/upload-status': return handleUploadStatusRequest.call(res);
    default: return handleGetRequest.call(res, req.url);
  }
  if (req.url === '/upload' && req.method === 'POST') {
    return req.on('data', handleUploadRequest.bind(res, req.headers));
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

module.exports = new Promise(resolve => {
  server.listen(0, () => {
    address = `http://${ip}:${server.address().port}`;
    console.log('Server is running on ' + address);
    resolve({ address });
  });
});

/**
 * @param {string} url
 */
function handleGetRequest(url) {
  if (!urlMap.hasOwnProperty(url)) {
    this.writeHead(404);
    return this.end('Not found');
  }
  const filePath = path.join(__dirname, urlMap[url]);
  // res.end  : Data is sent as a whole.
  // res.write: Data is sent in a series of chunks.
  this.write(fs.readFileSync(filePath));
  return this.end();
}