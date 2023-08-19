type Div = {
  top?: number;
  update: () => void;
};

const div: Div = {};

div.update = function(delta: number) {
  if (this.top == null) this.top = 0;
  this.top += delta;
};