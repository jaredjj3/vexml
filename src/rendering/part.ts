import * as musicxml from '@/musicxml';
import { Measure, MeasureRendering } from './measure';
import { Config } from './config';

/** The result of rendering a Part. */
export type PartRendering = {
  id: string;
  measures: MeasureRendering[];
};

/**
 * Represents a Part in a musical score, corresponding to the <part> element in MusicXML. This class encompasses the
 * entire musical content for a specific instrument or voice, potentially spanning multiple systems when rendered in the
 * viewport.
 */
export class Part {
  private config: Config;
  private id: string;
  private systemId: symbol;
  private measures: Measure[];

  private constructor(opts: { config: Config; id: string; systemId: symbol; measures: Measure[] }) {
    this.config = opts.config;
    this.id = opts.id;
    this.systemId = opts.systemId;
    this.measures = opts.measures;
  }

  /** Creates a Part. */
  static create(opts: { config: Config; musicXml: { part: musicxml.Part }; systemId: symbol }): Part {
    const id = opts.musicXml.part.getId();

    const measures = new Array<Measure>();
    const mxMeasures = opts.musicXml.part.getMeasures();
    for (let index = 0; index < mxMeasures.length; index++) {
      const mxMeasure = mxMeasures[index];

      const measure = Measure.create({
        // When splitting a system into smaller systems, the measure index should be maintained from when it was just
        // a single system. Therefore, this index should continue to be correct when a system is split.
        index,
        config: opts.config,
        musicXml: { measure: mxMeasure },
        systemId: opts.systemId,
      });

      measures.push(measure);
    }

    return new Part({ config: opts.config, id, systemId: opts.systemId, measures });
  }

  /** Returns the measures of the Part. */
  getMeasures(): Measure[] {
    return this.measures;
  }

  /** Returns a measure at a specific index. */
  getMeasureAt(measureIndex: number): Measure | null {
    return this.measures[measureIndex] ?? null;
  }

  /** Slices the measures of the part using the indexes, clones, them, then creates a new Part from them. */
  slice(opts: { systemId: symbol; measureStartIndex: number; measureEndIndex: number }): Part {
    const measureStartIndex = opts.measureStartIndex;
    const measureEndIndex = opts.measureEndIndex;
    if (measureStartIndex < 0) {
      throw new Error(`measureStartIndex cannot be less than 0, got: ${measureStartIndex}`);
    }
    if (measureEndIndex > this.measures.length) {
      throw new Error(
        `measureEndIndex cannot be greater than measures length (${this.measures.length}), got: ${measureEndIndex}`
      );
    }
    const measures = this.measures
      .slice(opts.measureStartIndex, opts.measureEndIndex)
      .map((measure) => measure.clone(opts.systemId));

    return new Part({
      config: this.config,
      id: this.id,
      systemId: opts.systemId,
      measures,
    });
  }

  /** Renders the part. */
  render(opts: {
    x: number;
    y: number;
    targetSystemWidth: number;
    minRequiredSystemWidth: number;
    isLastSystem: boolean;
    staffLayouts: musicxml.StaffLayout[];
  }): PartRendering {
    const measureRenderings = new Array<MeasureRendering>();

    let x = opts.x;
    const y = opts.y;

    for (let index = 0; index < this.measures.length; index++) {
      const measure = this.measures[index];
      const previousMeasure = this.measures[index - 1] ?? null;

      const measureRendering = measure.render({
        x,
        y,
        isLastSystem: opts.isLastSystem,
        previousMeasure,
        minRequiredSystemWidth: opts.minRequiredSystemWidth,
        targetSystemWidth: opts.targetSystemWidth,
        staffLayouts: opts.staffLayouts,
      });
      measureRenderings.push(measureRendering);

      x += measureRendering.staves[0]?.width ?? 0;
    }

    return { id: this.id, measures: measureRenderings };
  }
}
