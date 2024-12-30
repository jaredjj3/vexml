import * as util from '@/util';
import { Config } from './config';
import { Logger, PerformanceMonitor, Stopwatch } from '@/debug';
import { Document } from './document';
import { MeasureEntryKey, MeasureKey, Renderable, RenderLayer } from './types';
import { Point, Rect } from '@/spatial';
import { RenderContext } from 'vexflow';
import { Fragment } from './fragment';
import { Gap } from './gap';

export class Measure implements Renderable {
  constructor(
    private config: Config,
    private log: Logger,
    private document: Document,
    private key: MeasureKey,
    private position: Point,
    private width: number | null
  ) {}

  get rect(): Rect {
    const rects = this.getChildren().map((renderable) => renderable.rect);
    return Rect.merge(rects);
  }

  get layer(): RenderLayer {
    return 'background';
  }

  render(ctx: RenderContext): void {
    const stopwatch = Stopwatch.start();
    const performanceMonitor = new PerformanceMonitor(this.log, this.config.SLOW_WARNING_THRESHOLD_MS);

    const children = this.getChildren();

    for (const child of children) {
      if (child.layer === 'background') {
        child.render(ctx);
      }
    }

    for (const child of children) {
      if (child.layer === 'foreground') {
        child.render(ctx);
      }
    }

    performanceMonitor.check(stopwatch.lap(), this.key);
  }

  @util.memoize()
  private getChildren(): Renderable[] {
    const children = new Array<Renderable>();

    const stopwatch = Stopwatch.start();
    const performanceMonitor = new PerformanceMonitor(this.log, this.config.SLOW_WARNING_THRESHOLD_MS);

    for (const measureEntry of this.getMeasureEntries()) {
      children.push(measureEntry);
    }

    performanceMonitor.check(stopwatch.lap(), this.key);

    return children;
  }

  private getMeasureEntries(): Array<Fragment | Gap> {
    return this.document.getMeasureEntries(this.key).map((entry, measureEntryIndex) => {
      const key: MeasureEntryKey = { ...this.key, measureEntryIndex };
      switch (entry.type) {
        case 'fragment':
          return new Fragment(this.config, this.log, this.document, key, Point.origin(), null);
        case 'gap':
          return new Gap(this.config, this.log, this.document, key, Point.origin());
      }
    });
  }
}
