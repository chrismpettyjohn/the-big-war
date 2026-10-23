export interface Camera {
  
  x: number;
  y: number;
  
  scale: number;
}

export interface VisibleWorldRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
