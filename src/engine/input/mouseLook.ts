export class PointerLock {
  private locked = false;
  private readonly listeners = new Set<(locked: boolean) => void>();
  private readonly onChange = () => {
    this.locked = document.pointerLockElement === this.element;
    this.listeners.forEach((listener) => listener(this.locked));
  };

  constructor(private readonly element: HTMLElement) {}

  attach(): void {
    document.addEventListener('pointerlockchange', this.onChange);
  }

  detach(): void {
    document.removeEventListener('pointerlockchange', this.onChange);
  }

  request(): void {
    this.element.requestPointerLock();
  }

  exit(): void {
    if (this.locked) document.exitPointerLock();
  }

  get isLocked(): boolean {
    return this.locked;
  }

  onLockChange(listener: (locked: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class MouseLook {
  private dx = 0;
  private dy = 0;
  private readonly onMove = (event: MouseEvent) => {
    if (document.pointerLockElement === null) return;
    this.dx += event.movementX;
    this.dy += event.movementY;
  };

  attach(): void {
    document.addEventListener('mousemove', this.onMove);
  }

  detach(): void {
    document.removeEventListener('mousemove', this.onMove);
    this.dx = 0;
    this.dy = 0;
  }

  consume(): { dx: number; dy: number } {
    const value = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return value;
  }
}
