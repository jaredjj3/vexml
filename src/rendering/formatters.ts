import * as util from '@/util';
import { Document } from './document';
import { Formatter, SystemArrangement } from './types';
import { Config } from './config';
import { Logger } from '@/debug';
import { Score } from './score';

export class UndefinedHeightFormatter implements Formatter {
  constructor(private config: Config, private log: Logger, private score: Score) {
    util.assertNotNull(this.config.WIDTH);
    util.assertNull(this.config.HEIGHT);
  }

  format(document: Document): Document {
    const systemArrangements = this.getSystemArrangements();
    return document.reflow(this.config.WIDTH!, systemArrangements);
  }

  private getSystemArrangements(): SystemArrangement[] {
    const arrangements: SystemArrangement[] = [{ measureIndexes: [] }];
    let remaining = this.config.WIDTH!;

    const measures = this.score.getMeasures();

    for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
      const measure = measures[measureIndex];

      const required = measure.rect.w;

      if (required > remaining) {
        arrangements.push({ measureIndexes: [] });
        remaining = this.config.WIDTH!;
      }

      arrangements.at(-1)!.measureIndexes.push(measureIndex);
      remaining -= required;
    }

    this.log.debug(`grouped ${measures.length} measures into ${arrangements.length} system(s)`);

    return arrangements;
  }
}

export class UndefinedWidthFormatter implements Formatter {
  format(): Document {
    throw new Error('Method not implemented.');
  }
}

export class DefaultFormatter implements Formatter {
  format(): Document {
    throw new Error('Method not implemented.');
  }
}

export class PagedFormatter implements Formatter {
  format(): Document {
    throw new Error('Method not implemented.');
  }
}
