import * as util from '@/util';
import * as cursors from '@/cursors';
import * as spatial from '@/spatial';
import * as events from '@/events';
import { ScoreRendering } from './score';
import { Events } from './events';

const MOVE_THROTTLE_MS = 30;

const MOUSE_EVENT_NAMES = ['mousedown', 'mousemove', 'mouseup'] as const;
const TOUCH_EVENT_NAMES = ['touchstart', 'touchmove', 'touchend'] as const;

export class Rendering {
  private scoreRendering: ScoreRendering;
  private topic: events.Topic<Events>;
  private cursor: cursors.PointCursor<any>;
  private device: util.Device;

  private installed: boolean;

  constructor(opts: {
    scoreRendering: ScoreRendering;
    topic: events.Topic<Events>;
    cursor: cursors.PointCursor<any>;
    device: util.Device;
  }) {
    this.scoreRendering = opts.scoreRendering;
    this.topic = opts.topic;
    this.cursor = opts.cursor;
    this.device = opts.device;
    this.installed = false;
  }

  addEventListener<N extends keyof Events>(name: N, listener: events.Listener<Events[N]>): number {
    if (!this.installed) {
      this.install();
    }
    return this.topic.subscribe(name, listener);
  }

  removeEventListener(id: number): void {
    this.topic.unsubscribe(id);
    if (this.topic.getSubscriberCount() === 0 && this.installed) {
      this.uninstall();
    }
  }

  removeAllEventListeners(): void {
    this.topic.unsubscribeAll();
    if (this.installed) {
      this.uninstall();
    }
  }

  private install() {
    util.assert(!this.installed, 'Rendering has already installed native events');

    for (const eventName of this.getNativeEventNames()) {
      switch (eventName) {
        case 'mousedown':
          this.scoreRendering.container.addEventListener('mousedown', this.onNativeMouseDown);
          break;
        case 'mousemove':
          this.scoreRendering.container.addEventListener('mousemove', this.onNativeMouseMove);
          break;
        case 'mouseup':
          this.scoreRendering.container.addEventListener('mouseup', this.onNativeMouseUp);
          break;
        case 'touchstart':
          this.scoreRendering.container.addEventListener('touchstart', this.onNativeTouchStart, { passive: true });
          break;
        case 'touchmove':
          this.scoreRendering.container.addEventListener('touchmove', this.onNativeTouchMove, { passive: true });
          break;
        case 'touchend':
          this.scoreRendering.container.addEventListener('touchend', this.onNativeTouchEnd, { passive: true });
          break;
      }
    }

    this.installed = true;
  }

  private uninstall() {
    util.assert(this.installed, 'Rendering does not have native events installed');

    for (const eventName of this.getNativeEventNames()) {
      switch (eventName) {
        case 'mousedown':
          this.scoreRendering.container.removeEventListener('mousedown', this.onNativeMouseDown);
          break;
        case 'mousemove':
          this.scoreRendering.container.removeEventListener('mousemove', this.onNativeMouseMove);
          break;
        case 'mouseup':
          this.scoreRendering.container.removeEventListener('mouseup', this.onNativeMouseDown);
          break;
        case 'touchstart':
          this.scoreRendering.container.removeEventListener('touchstart', this.onNativeTouchStart);
          break;
        case 'touchmove':
          this.scoreRendering.container.removeEventListener('touchmove', this.onNativeTouchMove);
          break;
        case 'touchend':
          this.scoreRendering.container.removeEventListener('touchend', this.onNativeTouchEnd);
          break;
      }
    }

    this.installed = false;
  }

  private getPoint(clientX: number, clientY: number): spatial.Point {
    const container = this.scoreRendering.container;

    let host: Element = container;
    if (container instanceof HTMLDivElement) {
      host = container.firstElementChild!;
    }

    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return new spatial.Point(x, y);
  }

  private getNativeEventNames() {
    switch (this.device.inputType) {
      case 'mouseonly':
        return [...MOUSE_EVENT_NAMES];
      case 'touchonly':
        return [...TOUCH_EVENT_NAMES];
        break;
      case 'hybrid':
        return [...MOUSE_EVENT_NAMES, ...TOUCH_EVENT_NAMES];
    }
  }

  private onNativeMouseDown = (e: Event) => {
    this.topic.publish('click', {
      type: 'click',
      targets: this.cursor.getTargets(),
      point: this.cursor.getPoint(),
      src: e,
    });
  };

  private onNativeMouseMove = util.throttle((e: Event) => {
    util.assert(e instanceof MouseEvent, 'e must be a MouseEvent');
    const point = this.getPoint(e.clientX, e.clientY);
    this.cursor.update(point);
  }, MOVE_THROTTLE_MS);

  private onNativeMouseUp = () => {};

  private onNativeTouchStart = () => {};

  private onNativeTouchMove = util.throttle((e: Event) => {
    util.assert(e instanceof TouchEvent, 'e must be a TouchEvent');

    if (e.touches.length > 1) {
      return;
    }

    const touch = e.touches.item(0);
    if (!touch) {
      return;
    }

    const point = new spatial.Point(touch.clientX, touch.clientY);

    this.cursor.update(point);
  }, MOVE_THROTTLE_MS);

  private onNativeTouchEnd = () => {};
}
