/** @type {HTMLInputElement} */
const inputElement = document.getElementById('file-selector');

/** @type {HTMLDivElement} */
const cardsContainer = document.getElementById('cards-container');

const UploadStages = {
  Uploading: 0,
  UploadCompleted: 1
};

const UploadStagesKebabCased = Object.keys(UploadStages).map(s => {
  return s.replace(/[A-Z]/g, (e, i) => (i ? '-' : '') + e.toLowerCase());
});

const events = new EventSource('/upload-status');
events.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  const { fileName, received, size } = data;
  const sel = `.file-card[data-uid="${fileName}"]`;
  const fileCard = cardsContainer.querySelector(sel);
  fileCard && updateFileCard(fileCard, received, size);
});

inputElement.addEventListener('change', async () => {
  const files = Array.from(inputElement.files);
  await Promise.all(files.map(async file => {
    const sel = `.file-card[data-uid="${file.name}"]`;
    const fileCard = cardsContainer.querySelector(sel);
    if (!fileCard) {
      const newFileCard = createFileCard(file.name, file.size);
      cardsContainer.appendChild(newFileCard);
    } else updateFileCard(fileCard, 0, file.size);

    const write = chunk => fetch('/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'file-name': encodeURI(file.name),
        'file-size': file.size
      },
      body: chunk
    });

    const writer = new WritableStream({write});
    file.stream().pipeTo(writer);

    /*
    // Approximately 5 seconds/GiB slower.
    const reader = new FileReader;
    for (let offset = 0; offset < file.size;) {
      const chunk = file.slice(offset, offset += 1024 * 1024);
      reader.readAsArrayBuffer(chunk);
      await new Promise((resolve, reject) => {
        reader.addEventListener('load', resolve);
        reader.addEventListener('error', reject);
      });
      await fetch('/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'file-name': encodeURI(file.name),
          'file-size': file.size
        },
        body: reader.result
      });
    }
    */

    /*
    // Cannot handle files larger than 2GiB.
    const reader = new FileReader;
    reader.readAsArrayBuffer(file);
    await new Promise((resolve, reject) => {
      reader.addEventListener('load', resolve);
      reader.addEventListener('error', reject);
    });
    const payload = reader.result;

    const xhr = new XMLHttpRequest;
    xhr.open('POST', '/upload');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('file-name', encodeURI(file.name));
    xhr.addEventListener('load', () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) console.error(xhr.statusText);
    });
    xhr.addEventListener('error', () => console.error(xhr.statusText));
    xhr.send(payload);
    */
  }));
});

function handleFilesDrop(event) {

}

addEventListener('DOMContentLoaded', async () => {
  const isDarkMode = matchMedia('(prefers-color-scheme: dark)').matches;
  const container = document.querySelector('#qrcode');
  const text = await (await fetch('/address')).text();
  const fill = isDarkMode ? '#eb4763' : '#5c0a18';
  QrCreator.render({ text, fill, size: 360 }, container);
});

// addEventListener('DOMContentLoaded', () => {
//   for (let i = 0; i < 10; ++i) {
//     const size = 1024 * 1024 * 1099;
//     const fileCard = createFileCard(`test${i}.txt`, size);
//     const received = Math.random() < .4 ? size : Math.random() * size;
//     updateFileCard(fileCard, received, size);
//     cardsContainer.appendChild(fileCard);
//   }
// });

/**
 * Create a file card.
 * @param {string} fileName The file name.
 * @param {number} fileSize The file size in bytes.
 * @returns {HTMLElement} The file card.
 */
function createFileCard(fileName, fileSize) {
  const fileTitle = fileName.match(/(.+?)(?:\.[^.]*$|$)/)[1];
  const fileExt = fileName.slice(fileTitle.length);
  const { size, sizeUnit } = exportSize(fileSize);
  const card = document.createElement('div');
  card.innerHTML = `
    <span class="upload-status-icon">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5V19M12 5L6 11M12 5L18 11" />
          <path d="M4 12L8.94975 16.9497L19.5572 6.34326"/>
        </g>
      </svg>
    </span>
    <div class="file-name-container">
      <span class="file-name">${fileTitle}</span>
      <span class="file-ext">${fileExt}</span>
    </div>
    <div class="upload-progress-track">
      <div class="upload-progress-thumb"><span></span></div>
      <span>${size.toFixed(2) + sizeUnit}</span>
    </div>
  `;
  card.title = fileName;
  card.classList.add('file-card');
  card.dataset.uid = fileName;
  updateFileCard(card, 0, fileSize);
  return card;
}

/**
 * Update a file card's received status.
 * @param {HTMLElement} fileCard The file card.
 * @param {number} received The received bytes.
 * @param {number} size The file size in bytes.
 */
function updateFileCard(fileCard, received, size) {
  const { size: exportedSize, sizeUnit } = exportSize(received);
  const options = { duration: 200, fill: 'forwards' };
  const thumbElement = fileCard.querySelector('.upload-progress-thumb');
  const thumbLabel = thumbElement.firstElementChild;
  thumbLabel.textContent = exportedSize.toFixed(2) + sizeUnit;
  thumbElement.animate({ width: received / size * 100 + '%' }, options);

  if (received === size) {
    modifyClasses(UploadStages.UploadCompleted);
    console.info('File received: ' + fileCard.dataset.uid);
  } else modifyClasses(UploadStages.Uploading);

  function modifyClasses(stage) {
    for (let i = 0; i < UploadStagesKebabCased.length; ++i) {
      const action = i === stage ? 'add' : 'remove';
      fileCard.classList[action](UploadStagesKebabCased[i]);
    }
  }
}

/**
 * Convert a file size in bytes to a human-readable string.
 * @param {number} size The file size in bytes.
 * @returns {{size: number, sizeUnit: string}} The file size and its unit.
 */
function exportSize(size) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  for (; size >= 1024 && i < units.length; ++i) size /= 1024;
  return { size, sizeUnit: ' ' + units[i] };
}