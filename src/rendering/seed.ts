import { Config } from './config';
import { Measure } from './measure';
import { MeasureEntry, StaveSignature } from './stavesignature';
import * as musicxml from '@/musicxml';
import * as util from '@/util';
import { Part } from './part';
import { System } from './system';

const DUMMY_SYSTEM_ID = Symbol('dummy');

/** A reusable data container that houses rendering data to spawn `System` objects. */
export class Seed {
  private config: Config;
  private musicXml: {
    parts: musicxml.Part[];
    staveLayouts: musicxml.StaveLayout[];
  };

  constructor(opts: {
    config: Config;
    musicXml: {
      parts: musicxml.Part[];
      staveLayouts: musicxml.StaveLayout[];
    };
  }) {
    this.config = opts.config;
    this.musicXml = opts.musicXml;
  }

  /** Splits the measures into parts and systems that fit the given width. */
  split(width: number): System[] {
    const systems = new Array<System>();

    let remainingWidth = width;
    let measureStartIndex = 0;

    /** Adds a system to the return value. */
    const commitSystem = (measureEndIndex: number) => {
      const parts = this.musicXml.parts.map((part) => {
        const partId = part.getId();
        return new Part({
          config: this.config,
          musicXml: { part },
          measures: this.getMeasures(partId).slice(measureStartIndex, measureEndIndex),
        });
      });

      const system = new System({
        config: this.config,
        parts,
      });

      systems.push(system);

      measureStartIndex = measureEndIndex;
    };

    /** Accounts for a system being added. */
    const continueSystem = (width: number) => {
      remainingWidth -= width;
    };

    const measureCount = this.getMeasureCount();

    for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
      // Represents a column of measures across each part.
      const measures = this.musicXml.parts
        .map((part) => part.getId())
        .map((partId) => this.getMeasures(partId))
        .map<[previousMeasure: Measure | null, currentMeasure: Measure]>((measures) => [
          measures[measureIndex - 1] ?? null,
          measures[measureIndex],
        ]);

      let minRequiredWidth = util.max(
        measures.map(([previousMeasure, currentMeasure]) => currentMeasure.getMinRequiredWidth(previousMeasure))
      );

      const isProcessingLastMeasure = measureIndex === measureCount - 1;
      if (isProcessingLastMeasure) {
        if (minRequiredWidth <= remainingWidth) {
          commitSystem(measureIndex + 1);
        } else {
          commitSystem(measureIndex);
          commitSystem(measureIndex + 1);
        }
      } else if (minRequiredWidth <= remainingWidth) {
        continueSystem(minRequiredWidth);
      } else {
        commitSystem(measureIndex);
        // Recalculate to reflect the new conditions of the measure being on a different system, which is why null
        // is being used.
        minRequiredWidth = util.max(measures.map(([, currentMeasure]) => currentMeasure.getMinRequiredWidth(null)));
        continueSystem(minRequiredWidth);
      }
    }

    return systems;
  }

  @util.memoize()
  private getMeasuresByPartId(): Record<string, Measure[]> {
    const result: Record<string, Measure[]> = {};

    let multiMeasureCount = 0;

    for (const part of this.musicXml.parts) {
      const partId = part.getId();
      result[partId] = [];

      let previousMeasure: Measure | null = null;

      const staveCount = this.getStaveCount(partId);
      const measures = part.getMeasures();

      for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
        if (multiMeasureCount > 0) {
          multiMeasureCount--;
          continue;
        }

        const measure: Measure = new Measure({
          config: this.config,
          index: measureIndex,
          musicXml: {
            measure: measures[measureIndex],
            staveLayouts: this.musicXml.staveLayouts,
          },
          staveCount,
          systemId: DUMMY_SYSTEM_ID,
          previousMeasure,
          leadingStaveSignature: this.getLeadingStaveSignature(partId, measureIndex),
          measureEntries: this.getMeasureEntries(partId, measureIndex),
        });

        result[partId].push(measure);
        previousMeasure = measure;

        // -1 since this measure is part of the multi rest.
        multiMeasureCount += measure.getMultiRestCount() - 1;
      }
    }

    return result;
  }

  @util.memoize()
  private getMeasureEntryGroupsByPartId(): Record<string, MeasureEntry[][]> {
    const result: Record<string, MeasureEntry[][]> = {};

    for (const part of this.musicXml.parts) {
      const partId = part.getId();
      result[partId] = StaveSignature.toMeasureEntryGroups({ part });
    }

    return result;
  }

  private getMeasures(partId: string): Measure[] {
    const measuresByPartId = this.getMeasuresByPartId();
    return measuresByPartId[partId];
  }

  private getMeasureEntries(partId: string, measureIndex: number): MeasureEntry[] {
    const measureEntryGroups = this.getMeasureEntryGroups(partId);
    return measureEntryGroups[measureIndex];
  }

  private getMeasureEntryGroups(partId: string): MeasureEntry[][] {
    const measureEntryGroupsByPartId = this.getMeasureEntryGroupsByPartId();
    return measureEntryGroupsByPartId[partId];
  }

  private getMeasureCount(): number {
    return util.max(this.musicXml.parts.map((part) => part.getMeasures().length));
  }

  /** Returns the stave signature that is active at the beginning of the measure. */
  private getLeadingStaveSignature(partId: string, measureIndex: number): StaveSignature | null {
    const measureEntryGroupsByPartId = this.getMeasureEntryGroupsByPartId();
    const measureEntryGroups = measureEntryGroupsByPartId[partId];

    const staveSignatures = measureEntryGroups
      .flat()
      .filter((entry): entry is StaveSignature => entry instanceof StaveSignature)
      .filter((staveSignature) => staveSignature.getMeasureIndex() <= measureIndex);

    // Get the first stave signature that matches the measure index or get the last stave signature seen before this
    // measure index.
    return (
      staveSignatures.find((staveSignature) => staveSignature.getMeasureIndex() === measureIndex) ??
      util.last(staveSignatures)
    );
  }

  private getStaveCount(partId: string): number {
    const measureEntryGroupsByPartId = this.getMeasureEntryGroupsByPartId();
    const measureEntryGroups = measureEntryGroupsByPartId[partId];

    return util.max(
      measureEntryGroups
        .flat()
        .filter((entry): entry is StaveSignature => entry instanceof StaveSignature)
        .map((entry) => entry.getStaveCount())
    );
  }
}
