/** Only cache misses enter this queue. Cache reads never wait for a slot. */
export const PICTURE_DEBOUNCE_MS = 250;
export const MAX_CONCURRENT_PICTURES = 5;
export const PICTURE_RETRY_DELAY_MS = 1_000;
export const PICTURE_MAX_RETRY_DELAY_MS = 60_000;
export class PicturePendingError extends Error {
  constructor(readonly retryAfterMs = PICTURE_RETRY_DELAY_MS) { super('Picture request can be retried'); }
}
type Task<T> = { run: () => Promise<T>; wanted: () => boolean; resolve: (value: T | null) => void;
  reject: (error: unknown) => void; started: boolean; cancelled: boolean };

export class PictogramQueue {
  private active = 0;
  private waiting: Task<unknown>[] = [];

  enqueue<T>(run: () => Promise<T>, wanted: () => boolean) {
    let timer!: ReturnType<typeof setTimeout>;
    let task!: Task<T>;
    const promise = new Promise<T | null>((resolve, reject) => {
      task = { run, wanted, resolve, reject, started: false, cancelled: false };
      timer = setTimeout(() => {
        this.waiting.push(task as Task<unknown>);
        this.drain();
      }, PICTURE_DEBOUNCE_MS);
    });
    return { promise, cancel: () => {
      if (task.started || task.cancelled) return false;
      task.cancelled = true;
      clearTimeout(timer);
      this.waiting = this.waiting.filter(value => value !== task);
      task.resolve(null);
      return true;
    } };
  }

  private drain() {
    while (this.active < MAX_CONCURRENT_PICTURES && this.waiting.length) {
      const task = this.waiting.shift()!;
      if (task.cancelled || !task.wanted()) { task.resolve(null); continue; }
      task.started = true;
      this.active++;
      // Started provider work may still be billed. Let it finish and populate
      // the shared cache even when its original prediction has disappeared.
      task.run().then(task.resolve, task.reject).finally(() => { this.active--; this.drain(); });
    }
  }
}
