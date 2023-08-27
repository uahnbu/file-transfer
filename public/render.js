/** @type {HTMLInputElement} */
const inputElement = document.getElementById('file-selector');

/** @type {HTMLDivElement} */
const cardsContainer = document.getElementById('cards-container');

inputElement.addEventListener('change', () => {
  handleFilesSelection(Array.from(inputElement.files));
});

/**
 * Reference: Retrieve the list of files from the directory.
 * @see {@link https://stackoverflow.com/questions/3590058#53058574}
 */
document.body.addEventListener('drop', event => {
  document.body.classList.remove('dragover');
  const files = Array.from(event.dataTransfer.items)
    .map(item => (
      item.kind === 'file' &&
      item.webkitGetAsEntry().isFile &&
      item.getAsFile()
    )).filter(Boolean);
  handleFilesSelection(files);
  event.preventDefault();
});

addEventListener('DOMContentLoaded', async () => {
  const isDarkMode = matchMedia('(prefers-color-scheme: dark)').matches;
  const container = document.querySelector('#qrcode');
  const text = await (await fetch('/address')).text();
  const fill = isDarkMode ? '#eb4763' : '#5c0a18';
  QrCreator.render({ text, fill, size: 360 }, container);
});

document.body.addEventListener('dragover', event => event.preventDefault());
document.body.addEventListener('dragenter', function() {
  this.dragCounter = -~this.dragCounter;
  this.classList.add('dragover');
});
document.body.addEventListener('dragleave', function() {
  // Dragleave event is fired when the cursor enters a child element.
  --this.dragCounter || this.classList.remove('dragover');
});