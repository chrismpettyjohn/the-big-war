export interface Axial {
  q: number;
  r: number;
}

export interface Pixel {
  x: number;
  y: number;
}

export interface AxialGrid<T> {
  readonly width: number;
  readonly height: number;

  readonly cells: T[];
}
