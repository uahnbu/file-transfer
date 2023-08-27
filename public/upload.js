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
  if (fileCard) updateFileCard(fileCard, received, size);
  else createFileCard(fileName, size);
});

/**
 * @param {File[]} files
 */
async function handleFilesSelection(files) {
  await Promise.all(files.map(async file => {
    const sel = `.file-card[data-uid="${file.name}"]`;
    const fileCard = cardsContainer.querySelector(sel);
    if (fileCard) return;
    createFileCard(file.name, file.size);

    /** @param {Uint8Array} chunk */
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
  }));
}

/**
 * @param {string} fileName
 * @param {number} fileSize
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
  card.title = card.dataset.uid = fileName;
  card.classList.add('file-card');
  updateFileCard(card, 0, fileSize);
  cardsContainer.appendChild(card);
}

/**
 * @param {HTMLElement} fileCard
 * @param {number} received
 * @param {number} size
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
 * @param {number} bytes
 * @returns {{size: number, sizeUnit: string}}
 */
function exportSize(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  for (; bytes >= 1024 && i < units.length; ++i) bytes /= 1024;
  return { size: bytes, sizeUnit: ' ' + units[i] };
}