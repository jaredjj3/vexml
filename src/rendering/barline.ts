import * as musicxml from '@/musicxml';
import * as vexflow from 'vexflow';
import { Config } from './config';

/** The result of rendering a barline. */
export type BarlineRendering = {
  type: 'barline';
  vexflow: {
    barlineType: vexflow.BarlineType;
  };
};

/** The type of barline. */
export type BarlineType = 'single' | 'double' | 'end' | 'repeat-begin' | 'repeat-end' | 'repeat-both' | 'none';

export class Barline {
  private config: Config;
  private barlineType: BarlineType;

  constructor(opts: { config: Config; barlineType: BarlineType }) {
    this.config = opts.config;
    this.barlineType = opts.barlineType;
  }

  static fromMusicXML(opts: { config: Config; musicXML: { barline: musicxml.Barline } }) {
    let barlineType: BarlineType = 'none';

    const barline = opts.musicXML.barline;
    if (barline.isRepeat()) {
      switch (barline.getRepeatDirection()) {
        case 'forward':
          barlineType = 'repeat-begin';
          break;
        case 'backward':
          barlineType = 'repeat-end';
          break;
      }
    }
    switch (barline.getBarStyle()) {
      case 'regular':
      case 'short':
      case 'dashed':
      case 'dotted':
      case 'heavy':
        barlineType = 'single';
        break;
      case 'heavy-light':
      case 'heavy-heavy':
      case 'light-light':
      case 'tick':
        barlineType = 'double';
        break;
      case 'light-heavy':
        barlineType = 'end';
        break;
    }

    return new Barline({
      config: opts.config,
      barlineType,
    });
  }

  /** Renders the barline. */
  render(): BarlineRendering {
    return {
      type: 'barline',
      vexflow: {
        barlineType: this.getVfBarlineType(),
      },
    };
  }

  private getVfBarlineType(): vexflow.BarlineType {
    switch (this.barlineType) {
      case 'single':
        return vexflow.Barline.type.SINGLE;
      case 'double':
        return vexflow.Barline.type.DOUBLE;
      case 'end':
        return vexflow.Barline.type.END;
      case 'repeat-begin':
        return vexflow.Barline.type.REPEAT_BEGIN;
      case 'repeat-end':
        return vexflow.Barline.type.REPEAT_END;
      case 'repeat-both':
        return vexflow.Barline.type.REPEAT_BOTH;
      case 'none':
        return vexflow.Barline.type.NONE;
    }
  }
}
