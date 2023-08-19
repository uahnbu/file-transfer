const contentContainer = document.getElementById('content-container');
const scrollbar = contentContainer.querySelector('.scrollbar');

/**
 * @typedef Scrollbox System to handle scrolling contentContainer.
 * @property {number} boxH Height of contentContainer.
 * @property {number} cardsNum Number of cards in cardsContainer.
 * @property {number} contentMinY Minimum top position of cardsContainer.
 * @property {number} contentMaxY Maximum top position of cardsContainer.
 * @property {number} thumbMaxY Maximum top position of the scrollbar.
 * @property {number} thumbToBoxRatio Ratio of the scrollbar's height to the
 *     contentContainer's height.
 * @property {number} trackToContentRatio Ratio of the unoccupied scrolltrack's
 *     height to the cardsContainer's height a.k.a. maximum scrollbar's
 *     movememt to maximum cardsContainer's movement.
 * @property {?number} scale Mouse's movement / source element's movement.
 * @property {number} oldMouseY Previous Y position of the mouse.
 * @property {number} newMouseY Current Y position of the mouse.
 * @property {number} vel Velocity of the mouse.
 * @property {boolean} isKinetic Whether the scrollbar is moving on momentum.
 * @property {?boolean} snapping The edge that the scrollbar is snapping to.
 */

/**
 * System to handle scrolling contentContainer.
 * @namespace
 * @augments Scrollbox
 */
const scrollbox = {};

/**
 * Update the measurements of scrollbar, contentContainer, and cardsContainer.
 * @memberof scrollbox
 * @this {Scrollbox}
 */
scrollbox.updateMeasurements = function() {
  this.boxH = contentContainer.offsetHeight;
  this.cardsNum = cardsContainer.childElementCount;
  if (this.cardsNum === 0) return;

  const y1 = cardsContainer.firstElementChild.offsetTop;
  const h1 = cardsContainer.firstElementChild.offsetHeight;
  this.contentMaxY = this.boxH / 2 - y1 - h1 / 2;
  if (this.cardsNum === 1) return this.updateScroll();

  const y2 = cardsContainer.lastElementChild.offsetTop;
  const h2 = cardsContainer.lastElementChild.offsetHeight;
  this.contentMinY = this.boxH / 2 - y2 - h2 / 2;

  // f(x) = slope / (x + slope - 1), f(1) = 1 ∧ f(30) = 0.1 -> slope.
  this.thumbToBoxRatio = 3 / (this.cardsNum + 3 - 1);
  this.thumbMaxY = this.boxH * (1 - this.thumbToBoxRatio);

  const contentH = this.contentMaxY - this.contentMinY;
  // The scrollbar's and the cardsContainer's movement are inverse.
  this.trackToContentRatio = this.thumbMaxY / contentH * -1;

  this.updateScroll();
};
  
/**
 * Update the position of the content and the scrollbar.
 * @memberof scrollbox
 * @this {Scrollbox}
 * @param {number} [scrollDelta] The amount of scrolling.
 * @param {boolean} smooth Whether to animate the transition.
 * @param {function} [cb] Callback function.
 */
scrollbox.updateScroll = function(scrollDelta, smooth = true, cb) {
  const { contentMinY, contentMaxY, thumbMaxY } = this;
  if (this.cardsNum === 0) return this.setPos(cardsContainer, this.boxH / 2);
  if (this.cardsNum === 1) return this.setPos(cardsContainer, contentMaxY);

  let /** @type {number} */ contentY;
  if (scrollDelta == null) {
    const cards = Array.from(cardsContainer.children);
    const firstActiveCard = cards.find(card => {
      return !card.classList.contains('upload-completed');
    }) || cards[cards.length - 1];
    const cardY = firstActiveCard.offsetTop;
    const cardH = firstActiveCard.offsetHeight;
    contentY = this.boxH / 2 - cardY - cardH / 2;
  } else {
    contentY = cardsContainer.offsetTop + scrollDelta;
    if (!this.isKinetic) this.vel = 0;
    if (contentY < contentMinY) {
      this.snapping = contentMinY;
      this.vel += (contentMinY - contentY) * this.boxH / 6e4;
    } else if (contentY > contentMaxY) {
      this.snapping = contentMaxY;
      this.vel -= (contentY - contentMaxY) * this.boxH / 6e4;
    } else if (this.snapping) {
      contentY = this.snapping;
      this.snapping = null;
      this.vel = 0;
    }
    // contentY = Math.max(contentMinY, Math.min(contentMaxY, targetedY));
  }
  this.setPos(cardsContainer, contentY, smooth, cb);

  const thumbY = interpolate(contentY, contentMinY, contentMaxY, thumbMaxY, 0);
  scrollbar.style.height = this.thumbToBoxRatio * 100 + '%';
  scrollbar.style.opacity = 1;
  this.setPos(scrollbar, thumbY, smooth);
};

/**
 * Animate the top property of an element.
 * @memberof scrollbox
 * @param {HTMLElement} element Element to move.
 * @param {number} y Target's top position.
 * @param {boolean} smooth Whether to animate the transition (mouse wheeled).
 */
scrollbox.setPos = function(element, y, smooth, cb) {
  const options = { duration: smooth ? 100 : 0, fill: 'forwards' };
  // Web animation is used instead because transition is lagging when
  // multiple position changes are triggered on mouse wheel.
  const animation = element.animate({ top: y + 'px' }, options);
  animation.addEventListener('finish', cb);
};

/**
 * Track mouse drag and update cardsContainer's position.
 * @memberof scrollbox
 * @this {Scrollbox}
 */
scrollbox.trackMouse = function() {
  if (!this.scale) return;
  const { oldMouseY, newMouseY, scale } = this;
  const scrollDelta = (newMouseY - oldMouseY) / scale;
  this.updateScroll(scrollDelta, false);
  this.oldMouseY = newMouseY;
  requestAnimationFrame(this.trackMouse.bind(this));
};

/**
 * Scroll the cards container from momentum.
 * @memberof scrollbox
 * @this {Scrollbox}
 */
scrollbox.momentumScroll = function() {
  if (Math.abs(this.vel *= .9) > 1e-2) {
    this.isKinetic = true;
    this.updateScroll(this.vel, false);
    requestAnimationFrame(this.momentumScroll.bind(this));
  } else this.isKinetic = false;
};

scrollbox.updateMeasurements();

contentContainer.addEventListener('wheel', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  scrollbox.vel = 0;
  scrollbox.updateScroll(-e.deltaY, true, () => {
    scrollbox.momentumScroll();
  });
});

window.addEventListener('resize', () => scrollbox.updateMeasurements());

// The event triggers when one of the child elements is clicked.
contentContainer.addEventListener('mousedown', handlePointerDown);
contentContainer.addEventListener('touchstart', e => handlePointerDown(e.changedTouches[0]));

document.addEventListener('mousemove', handlePointerMove);
document.addEventListener('touchmove', e => handlePointerMove(e.changedTouches[0]));

document.addEventListener('mouseup', handlePointerUp);
document.addEventListener('touchend', e => handlePointerUp(e.changedTouches[0]));

function handlePointerDown(e) {
  scrollbox.oldMouseY = e.clientY;
  scrollbox.newMouseY = e.clientY;
  scrollbox.vel = 0;
  if (e.target !== scrollbar) scrollbox.scale = 1;
  else scrollbox.scale = scrollbox.trackToContentRatio;
  scrollbox.trackMouse();
  'preventDefault' in e && e.preventDefault();
}

function handlePointerMove(e) {
  if (scrollbox.scale) scrollbox.newMouseY = e.clientY;
}

function handlePointerUp(e) {
  if (!scrollbox.scale) return;
  const { oldMouseY, scale } = scrollbox;
  scrollbox.vel += (e.clientY - oldMouseY) / scale;
  scrollbox.scale = null;
  scrollbox.momentumScroll();
}

/**
 * Interpolate a value between two ranges.
 * @param {number} t The value to interpolate.
 * @param {number} a1 The lower bound of the first range.
 * @param {number} a2 The upper bound of the first range.
 * @param {number} b1 The lower bound of the second range.
 * @param {number} b2 The upper bound of the second range.
 * @returns {number} The interpolated value.
 */
function interpolate(t, a1, a2, b1, b2) {
  return (t - a1) / (a2 - a1) * (b2 - b1) + b1;
};