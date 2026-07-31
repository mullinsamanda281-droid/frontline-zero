export class Keyboard {
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.pressed.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.code);
  };

  constructor(private readonly target: Window = window) {}

  attach(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }

  isDown(code: string): boolean {
    return this.pressed.has(code);
  }
}
