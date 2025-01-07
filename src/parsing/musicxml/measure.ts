import * as data from '@/data';
import * as util from '@/util';
import { Fragment } from './fragment';
import { MeasureEvent, StaveEvent } from './types';
import { Fraction } from '@/util';
import { Signature } from './signature';
import { MeasureContext, SystemContext } from './contexts';

type SignatureRange = {
  signature: Signature;
  start: Fraction;
  end: Fraction;
};

export class Measure {
  constructor(
    private initialSignature: Signature,
    private index: number,
    private label: number,
    private events: MeasureEvent[],
    private partIds: string[]
  ) {
    util.assert(
      events.every((e) => e.measureIndex === index),
      'Expected all events to belong to the current measure'
    );
  }

  getEvents(): MeasureEvent[] {
    return this.events;
  }

  parse(systemCtx: SystemContext): data.Measure {
    const measureCtx = new MeasureContext(systemCtx, this.index);

    return {
      type: 'measure',
      label: this.label,
      fragments: this.getFragments().map((fragment) => fragment.parse(measureCtx)),
    };
  }

  getLastSignature(): Signature {
    return this.getFragments().at(-1)?.getSignature() ?? this.initialSignature;
  }

  @util.memoize()
  private getFragments(): Fragment[] {
    const ranges = this.getSignatureRanges();

    const fragments = new Array<Fragment>();

    let index = 0;
    const events = this.events.filter((event: any): event is StaveEvent => typeof event.staveNumber === 'number');

    for (const range of ranges) {
      const fragmentEvents = new Array<StaveEvent>();
      while (events.at(index)?.measureBeat.isLessThanOrEqualTo(range.end)) {
        fragmentEvents.push(events[index]);
        index++;
      }
      fragments.push(new Fragment(range.signature, fragmentEvents, this.partIds));
    }

    // Ensure that we always have at least one fragment.
    if (fragments.length === 0) {
      return [new Fragment(this.initialSignature, [], this.partIds)];
    }

    return fragments;
  }

  private getUniqueMeasureBeats(): Fraction[] {
    const measureBeats = new Array<Fraction>();

    // Let N be the number of events. This is O(N^2) but N should be small.
    for (const event of this.events) {
      const hasEquivalent = measureBeats.some((m) => m.isEquivalent(event.measureBeat));
      if (!hasEquivalent) {
        measureBeats.push(event.measureBeat);
      }
    }

    return measureBeats;
  }

  private getSignatureRanges(): Array<SignatureRange> {
    const ranges = new Array<SignatureRange>();

    let start = new Fraction(0);
    let signature = this.initialSignature;
    const measureBeats = this.getUniqueMeasureBeats();

    for (let index = 0; index < measureBeats.length; index++) {
      const measureBeat = measureBeats[index];

      const builder = Signature.builder().setPreviousSignature(signature);

      // Process all the events that occur at this measure beat.
      const events = this.events.filter((e) => e.measureBeat.isEquivalent(measureBeat));
      for (const event of events) {
        switch (event.type) {
          case 'metronome':
            builder.setMetronome(event.metronome);
            break;
          case 'stavecount':
            builder.addStaveCount(event.staveCount);
            break;
          case 'stavelinecount':
            builder.addStaveLineCount(event.staveLineCount);
            break;
          case 'clef':
            builder.addClef(event.clef);
            break;
          case 'key':
            builder.addKey(event.key);
            break;
          case 'time':
            builder.addTime(event.time);
            break;
        }
      }

      // Build the signature and create a range if it changed.
      const nextSignature = builder.build();
      if (nextSignature.hasChanges()) {
        const end = measureBeat;
        ranges.push({ signature: nextSignature, start, end });
        signature = nextSignature;
        start = end;
      }
    }

    // Ensure that the last range can cover everything.
    const lastRange = ranges.at(-1);
    const lastMeasureBeat = measureBeats.at(-1);
    if (lastRange && lastMeasureBeat) {
      lastRange.end = new Fraction(lastMeasureBeat.numerator + 1, lastMeasureBeat.denominator);
    }

    // If there are no ranges, add a single range that covers the entire measure.
    if (ranges.length === 0 && lastMeasureBeat) {
      ranges.push({
        signature,
        start,
        end: new Fraction(lastMeasureBeat.numerator + 1, lastMeasureBeat.denominator),
      });
    }

    return ranges;
  }
}
