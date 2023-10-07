import { Config } from './config';
import { Stave, StaveRendering } from './stave';
import * as musicxml from '@/musicxml';

/** The result of rendering a measure fragment. */
export type MeasureFragmentRendering = {
  type: 'measurefragment';
  staves: StaveRendering[];
};

/** MusicXML elements that compose a MeasureFragment. */
export type MeasureFragmentEntry = musicxml.Note | musicxml.Forward | musicxml.Backup;

/** Represents a fragment of a measure. */
export class MeasureFragment {
  private config: Config;
  private attributes: musicxml.Attributes | null;
  private clefType: musicxml.ClefType;
  private timeSignature: musicxml.TimeSignature;
  private keySignature: string;
  private beginningBarStyle: musicxml.BarStyle;
  private endBarStyle: musicxml.BarStyle;
  private staves: Stave[];

  private constructor(opts: {
    config: Config;
    attributes: musicxml.Attributes | null;
    clefType: musicxml.ClefType;
    timeSignature: musicxml.TimeSignature;
    keySignature: string;
    beginningBarStyle: musicxml.BarStyle;
    endBarStyle: musicxml.BarStyle;
    staves: Stave[];
  }) {
    this.config = opts.config;
    this.attributes = opts.attributes;
    this.clefType = opts.clefType;
    this.timeSignature = opts.timeSignature;
    this.keySignature = opts.keySignature;
    this.beginningBarStyle = opts.beginningBarStyle;
    this.endBarStyle = opts.endBarStyle;
    this.staves = opts.staves;
  }

  /** Creates a MeasureFragment. */
  static create(opts: {
    config: Config;
    musicXml: {
      attributes: musicxml.Attributes | null;
      measureEntries: musicxml.MeasureEntry[];
      beginningBarStyle: musicxml.BarStyle;
      endBarStyle: musicxml.BarStyle;
    };
    staveCount: number;
    staffNumber: number;
    previousMeasureFragment: MeasureFragment | null;
  }): MeasureFragment {
    const config = opts.config;
    const attributes = opts.musicXml.attributes;
    const measureEntries = opts.musicXml.measureEntries;
    const staveCount = opts.staveCount;
    const staffNumber = opts.staffNumber;
    const previousMeasureFragment = opts.previousMeasureFragment;
    const beginningBarStyle = opts.musicXml.beginningBarStyle;
    const endBarStyle = opts.musicXml.endBarStyle;

    const clefType =
      attributes
        ?.getClefs()
        .find((clef) => clef.getStaffNumber() === staffNumber)
        ?.getClefType() ??
      previousMeasureFragment?.clefType ??
      'treble';

    const timeSignature =
      attributes
        ?.getTimes()
        .find((time) => time.getStaffNumber() === opts.staffNumber)
        ?.getTimeSignatures()[0] ??
      previousMeasureFragment?.timeSignature ??
      new musicxml.TimeSignature(4, 4);

    const keySignature =
      attributes
        ?.getKeys()
        .find((key) => key.getStaffNumber() === opts.staffNumber)
        ?.getKeySignature() ??
      previousMeasureFragment?.keySignature ??
      'C';

    const staves = new Array<Stave>(staveCount);
    let previousStave: Stave | null = null;
    for (let staffNumber = 1; staffNumber <= staveCount; staffNumber++) {
      const staffIndex = staffNumber - 1;

      // TODO: Finish staves implementation.
      // staves[staffIndex] = Stave.create({
      //   config,
      //   staffNumber,
      //   musicXml: {
      //     // TODO: Fix this.
      //     measureEntries: [],
      //   },
      //   previousStave,
      //   previousMeasureFragmentment,
      // });

      previousStave = staves[staffIndex];
    }

    return new MeasureFragment({
      config,
      attributes,
      clefType,
      timeSignature,
      keySignature,
      beginningBarStyle,
      endBarStyle,
      staves: [],
    });
  }

  /** Returns the attributes that the MeasureFrament is using. */
  getAttributes(): musicxml.Attributes | null {
    return this.attributes;
  }

  /** Clones the MeasureFragment. */
  clone(): MeasureFragment {
    return new MeasureFragment({
      config: this.config,
      attributes: this.attributes,
      clefType: this.clefType,
      timeSignature: this.timeSignature.clone(),
      keySignature: this.keySignature,
      beginningBarStyle: this.beginningBarStyle,
      endBarStyle: this.endBarStyle,
      staves: this.staves.map((stave) => stave.clone()),
    });
  }

  /** Renders the MeasureFragment. */
  render(): MeasureFragmentRendering {
    return {
      type: 'measurefragment',
      staves: [],
    };
  }
}
