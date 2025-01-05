import * as util from '@/util';
import * as data from '@/data';
import * as vexflow from 'vexflow';
import * as conversions from './conversions';
import { Logger } from '@/debug';
import { Config } from './config';
import { MeasureEntryKey, PartKey, StaveKey, VoiceEntryKey, VoiceKey } from './types';
import { Document } from './document';
import { Point, Rect } from '@/spatial';
import { Pen } from './pen';
import { NoopRenderContext } from './nooprenderctx';
import { Fraction } from '@/util';

const PLACEHOLDER_RECT = Rect.empty();

const MEASURE_NUMBER_PADDING_LEFT = 6;
const BARLINE_PADDING_RIGHT = 6;
const BRACE_CONNECTOR_PADDING_LEFT = 8;

const ADDITIONAL_CLEF_WIDTH = 10;
const ADDITIONAL_COMPLEX_TIME_SIGNATURE_COMPONENT_WIDTH = 12;

/**
 * An ensemble is a collection of voices across staves and parts that should be formatted together.
 *
 * This class serves as a staging area for coordinating layouts. Ensemble is not _directly_ rendered. Instead, the
 * rendering hiearchy objects will query ensemble and eventually indirectly render the vexflow objects.
 */
export class Ensemble {
  constructor(
    private config: Config,
    private log: Logger,
    private document: Document,
    private key: MeasureEntryKey,
    private position: Point,
    private width: number | null,
    private multiRestCount: number
  ) {}

  getWidth(): number {
    return this.width ?? this.getMeasureEntry().parts.at(0)?.rect.w ?? 0;
  }

  @util.memoize()
  getMeasureEntry(): EnsembleMeasureEntry {
    const pen = new Pen(this.position);
    const measureEntry = new EnsembleMeasureEntryFactory(this.config, this.log, this.document).create(
      this.key,
      pen,
      this.multiRestCount
    );
    new EnsembleFormatter(this.config, this.log, this.document, this.position, this.width).format(measureEntry, pen);
    return measureEntry;
  }

  getPart(key: PartKey): EnsemblePart {
    const part = this.getMeasureEntry().parts.at(key.partIndex);
    util.assertDefined(part);
    return part;
  }

  getStave(key: StaveKey): EnsembleStave {
    const stave = this.getPart(key).staves.at(key.staveIndex);
    util.assertDefined(stave);
    return stave;
  }

  getVoice(key: VoiceKey): EnsembleVoice {
    const voice = this.getStave(key).voices.at(key.voiceIndex);
    util.assertDefined(voice);
    return voice;
  }

  getVoiceEntry(key: VoiceEntryKey): EnsembleVoiceEntry {
    const voiceEntry = this.getVoice(key).entries.at(key.voiceEntryIndex);
    util.assertDefined(voiceEntry);
    return voiceEntry;
  }
}

class EnsembleFormatter {
  constructor(
    private config: Config,
    private log: Logger,
    private document: Document,
    private position: Point,
    private width: number | null
  ) {}

  /**
   * Formats the ensemble, updating the rects of all the objects in place.
   */
  format(measureEntry: EnsembleMeasureEntry, pen: Pen): void {
    const key = measureEntry.key;
    const staves = measureEntry.parts.flatMap((p) => p.staves);
    const clefs = staves.flatMap((s) => s.clef).filter((c) => c !== null);
    const times = staves.flatMap((s) => s.time).filter((t) => t !== null);
    const hasMultiMeasureRest = staves.some((s) => s.vexflowMultiMeasureRest !== null);

    // Now that we have all the voices, we can format them.
    const vexflowVoices = staves.flatMap((s) => s.voices).map((v) => v.vexflowVoice);
    const vexflowFormatter = new vexflow.Formatter();

    if (vexflowVoices.length > 0) {
      vexflowFormatter.joinVoices(vexflowVoices);
    }

    // Non-voice width components.
    let nonVoiceWidth = vexflow.Stave.defaultPadding;
    if (clefs.length > 0) {
      nonVoiceWidth += util.max(clefs.map((c) => c.width));
    }
    if (times.length > 0) {
      nonVoiceWidth += util.max(times.map((t) => t.width));
    }

    let initialStaveWidth: number;
    if (this.width) {
      initialStaveWidth = this.width;
    } else if (hasMultiMeasureRest) {
      const baseWidth = this.config.BASE_MULTI_REST_MEASURE_WIDTH;
      initialStaveWidth = baseWidth + nonVoiceWidth;
    } else {
      // Voice width components.
      const baseWidth = this.config.BASE_VOICE_WIDTH;
      const minWidth = vexflowVoices.length > 0 ? vexflowFormatter.preCalculateMinTotalWidth(vexflowVoices) : 0;
      initialStaveWidth = baseWidth + minWidth + nonVoiceWidth;
    }

    const left = pen;
    const right = new Pen(this.position);
    right.moveBy({ dx: initialStaveWidth });

    const isLastMeasure = this.document.isLastMeasure(key);
    const isLastMeasureEntry = this.document.isLastMeasureEntry(key);
    if (isLastMeasure && isLastMeasureEntry) {
      right.moveBy({ dx: -BARLINE_PADDING_RIGHT });
    }

    const staveWidth = right.x - left.x;

    // Set the width on the staves.
    for (const stave of staves) {
      stave.vexflowStave.setWidth(staveWidth);
    }

    // Associate everything with a stave.
    for (const stave of staves) {
      stave.vexflowMultiMeasureRest?.setStave(stave.vexflowStave);

      for (const voice of stave.voices) {
        voice.vexflowVoice.setStave(stave.vexflowStave);

        for (const entry of voice.entries) {
          entry.vexflowTickable.setStave(stave.vexflowStave);
        }
      }
    }

    // Format! The voice width must be smaller than the stave or the stave won't contain it.
    const voiceWidth = staveWidth - nonVoiceWidth;
    if (vexflowVoices.length > 0) {
      vexflowFormatter.format(vexflowVoices, voiceWidth);
    }

    // At this point, we can call getBoundingBox() on everything, but vexflow does some extra formatting in draw() that
    // mutates the objects. Before we set the rects, we need to draw the staves to a noop context, then unset the
    // context and rendered state.
    const ctx = new NoopRenderContext();
    for (const stave of staves) {
      stave.vexflowStave.setContext(ctx).draw();
      stave.vexflowStave.setRendered(false);

      for (const voice of stave.voices) {
        voice.vexflowVoice.setContext(ctx).draw();
        voice.vexflowVoice.setRendered(false);

        for (const entry of voice.entries) {
          entry.vexflowTickable.setContext(ctx).draw();
          entry.vexflowTickable.setRendered(false);
        }
      }
    }

    // At this point, we should be able to call getBoundingBox() on all of the vexflow objects. We can now update the
    // rects accordingly.
    let excessHeight = 0;
    for (const stave of staves) {
      for (const voice of stave.voices) {
        voice.rect = Rect.fromRectLike(voice.vexflowVoice.getBoundingBox());
        for (const entry of voice.entries) {
          entry.rect = Rect.fromRectLike(entry.vexflowTickable.getBoundingBox());
        }
      }
      stave.rect = this.getStaveRect(stave, left, right);
      stave.intrinsicRect = this.getStaveIntrinsicRect(stave);
      excessHeight = Math.max(excessHeight, this.getExcessHeight(stave));
    }

    measureEntry.rect = Rect.merge(staves.map((s) => s.rect));
    measureEntry.excessHeight = excessHeight;
  }

  private getStaveRect(stave: EnsembleStave, left: Pen, right: Pen): Rect {
    const vexflowStave = stave.vexflowStave;

    const box = vexflowStave.getBoundingBox();

    const x = box.x - left.x + this.position.x;
    const y = box.y;
    const w = right.x - this.position.x;
    const h = box.h;

    const vexflowVoiceRects = stave.voices
      .map((voice) => voice.vexflowVoice.getBoundingBox())
      .map((box) => Rect.fromRectLike(box));

    return Rect.merge([new Rect(x, y, w, h), ...vexflowVoiceRects]);
  }

  /**
   * Returns the rect of the stave itself, ignoring any influence by child elements such as notes.
   */
  private getStaveIntrinsicRect(stave: EnsembleStave): Rect {
    const vexflowStave = stave.vexflowStave;

    const box = vexflowStave.getBoundingBox();
    const topLineY = vexflowStave.getTopLineTopY();
    const bottomLineY = vexflowStave.getBottomLineBottomY();

    const x = box.x;
    const y = topLineY;
    const w = box.w;
    const h = bottomLineY - topLineY;

    return new Rect(x, y, w, h);
  }

  /**
   * Returns how much height the voice exceeded the normal vexflow.Stave (not EnsembleStave) boundaries. Callers may
   * need to account for this when positioning the system that this ensemble belongs to.
   */
  private getExcessHeight(stave: EnsembleStave): number {
    const voices = stave.voices;
    if (voices.length === 0) {
      return 0;
    }

    const highestY = Math.min(...voices.map((v) => v.rect.y));
    const vexflowStaveY = stave.vexflowStave.getBoundingBox().y;
    return vexflowStaveY - highestY;
  }
}

type EnsembleMeasureEntry = {
  type: 'measureentry';
  key: MeasureEntryKey;
  rect: Rect;
  excessHeight: number;
  parts: EnsemblePart[];
  vexflowStaveConnectors: vexflow.StaveConnector[];
};

class EnsembleMeasureEntryFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: MeasureEntryKey, pen: Pen, multiRestCount: number): EnsembleMeasureEntry {
    const parts = new Array<EnsemblePart>();
    const partFactory = new EnsemblePartFactory(this.config, this.log, this.document);
    const partCount = this.document.getPartCount(key);

    let hasBraceConnector = false;
    for (let partIndex = 0; partIndex < partCount; partIndex++) {
      const partKey: PartKey = { ...key, partIndex };
      if (this.document.getStaveCount(partKey) > 1) {
        hasBraceConnector = true;
        break;
      }
    }

    const isFirstMeasure = this.document.isFirstMeasure(key);
    const isFirstMeasureEntry = this.document.isFirstMeasureEntry(key);
    if (isFirstMeasure) {
      pen.moveBy({ dx: MEASURE_NUMBER_PADDING_LEFT });
    }
    if (isFirstMeasure && isFirstMeasureEntry && hasBraceConnector) {
      pen.moveBy({ dx: BRACE_CONNECTOR_PADDING_LEFT });
    }

    for (let partIndex = 0; partIndex < partCount; partIndex++) {
      const partKey: PartKey = { ...key, partIndex };
      parts.push(partFactory.create(partKey, pen, multiRestCount));
    }

    const vexflowStaveConnectors = this.getVexflowStaveConnectors(key, parts);

    return {
      type: 'measureentry',
      key,
      rect: PLACEHOLDER_RECT,
      excessHeight: 0,
      parts,
      vexflowStaveConnectors,
    };
  }

  private getVexflowStaveConnectors(key: MeasureEntryKey, parts: EnsemblePart[]): vexflow.StaveConnector[] {
    const vexflowStaveConnectors = new Array<vexflow.StaveConnector>();

    const staves = parts.flatMap((p) => p.staves).map((s) => s.vexflowStave);

    if (staves.length > 1) {
      const firstVexflowStave = staves.at(0)!;
      const lastVexflowStave = staves.at(-1)!;

      const isFirstMeausre = this.document.isFirstMeasure(key);
      const isFirstMeasureEntry = this.document.isFirstMeasureEntry(key);
      if (!isFirstMeausre && isFirstMeasureEntry) {
        vexflowStaveConnectors.push(
          new vexflow.StaveConnector(firstVexflowStave, lastVexflowStave).setType('singleLeft')
        );
      }

      const isLastSystem = this.document.isLastSystem(key);
      const isLastMeasure = this.document.isLastMeasure(key);
      const isLastMeasureEntry = this.document.isLastMeasureEntry(key);
      if (isLastMeasureEntry) {
        if (isLastSystem && isLastMeasure) {
          vexflowStaveConnectors.push(
            new vexflow.StaveConnector(firstVexflowStave, lastVexflowStave).setType('boldDoubleRight')
          );
        } else {
          vexflowStaveConnectors.push(
            new vexflow.StaveConnector(firstVexflowStave, lastVexflowStave).setType('singleRight')
          );
        }
      }
    }

    return vexflowStaveConnectors;
  }
}

type EnsemblePart = {
  type: 'part';
  key: PartKey;
  rect: Rect;
  staves: EnsembleStave[];
  vexflowBrace: vexflow.StaveConnector | null;
};

class EnsemblePartFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: PartKey, pen: Pen, multiRestCount: number): EnsemblePart {
    const staves = new Array<EnsembleStave>();
    const staveFactory = new EnsembleStaveFactory(this.config, this.log, this.document);
    const staveCount = this.document.getStaveCount(key);

    for (let staveIndex = 0; staveIndex < staveCount; staveIndex++) {
      const staveKey: StaveKey = { ...key, staveIndex };
      staves.push(staveFactory.create(staveKey, pen, multiRestCount));
    }

    let vexflowBrace: vexflow.StaveConnector | null = null;

    const isFirstMeasure = this.document.isFirstMeasure(key);
    const isFirstMeasureEntry = this.document.isFirstMeasureEntry(key);
    if (isFirstMeasure && isFirstMeasureEntry && staves.length > 1) {
      const firstVexflowStave = staves.at(0)!.vexflowStave;
      const lastVexflowStave = staves.at(-1)!.vexflowStave;

      vexflowBrace = new vexflow.StaveConnector(firstVexflowStave, lastVexflowStave).setType('brace');
    }

    return {
      type: 'part',
      key,
      rect: PLACEHOLDER_RECT,
      staves,
      vexflowBrace,
    };
  }
}

type EnsembleStave = {
  type: 'stave';
  key: StaveKey;
  rect: Rect;
  intrinsicRect: Rect;
  vexflowStave: vexflow.Stave;
  voices: EnsembleVoice[];
  clef: EnsembleClef | null;
  time: EnsembleTime | null;
  vexflowMultiMeasureRest: vexflow.MultiMeasureRest | null;
};

class EnsembleStaveFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: StaveKey, pen: Pen, multiRestCount: number): EnsembleStave {
    const voices = new Array<EnsembleVoice>();
    const voiceFactory = new EnsembleVoiceFactory(this.config, this.log, this.document);
    const voiceCount = this.document.getVoiceCount(key);

    let vexflowMultiMeasureRest: vexflow.MultiMeasureRest | null = null;

    if (multiRestCount > 1) {
      // A multirest that spans a single measure should have a whole rest associated with it. We only want to render
      // multirests that span multiple measures.
      vexflowMultiMeasureRest = new vexflow.MultiMeasureRest(multiRestCount, { numberOfMeasures: 1 });
    } else {
      for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex++) {
        const voiceKey: VoiceKey = { ...key, voiceIndex };
        voices.push(voiceFactory.create(voiceKey));
      }
    }

    let clef: EnsembleClef | null = null;
    let time: EnsembleTime | null = null;

    const isFirstSystem = this.document.isFirstSystem(key);
    const isLastSystem = this.document.isLastSystem(key);
    const isFirstMeasure = this.document.isFirstMeasure(key);
    const isLastMeasure = this.document.isLastMeasure(key);
    const isFirstPart = this.document.isFirstPart(key);
    const partCount = this.document.getPartCount(key);
    const isFirstStave = this.document.isFirstStave(key);
    const isFirstMeasureEntry = this.document.isFirstMeasureEntry(key);
    const isLastMeasureEntry = this.document.isLastMeasureEntry(key);
    const measureLabel = this.document.getMeasure(key).label;
    const staveSignature = this.document.getStave(key).signature;
    const staveCount = this.document.getStaveCount(key);
    const staveLineCount = staveSignature.lineCount;

    const hasStaveConnector = partCount > 1 || staveCount > 1;

    // We'll update the width later after we collect all the data needed to format the staves.
    const vexflowStave = new vexflow.Stave(pen.x, pen.y, 0, { numLines: staveLineCount });

    // TODO: Also render when it changes.
    if (isFirstMeasure && isFirstMeasureEntry) {
      clef = new EnsembleClefFactory(this.config, this.log, this.document).create(key);
      vexflowStave.addModifier(clef.vexflowClef);
    }

    if (isFirstSystem && isFirstMeasure && isFirstMeasureEntry) {
      time = new EnsembleTimeFactory(this.config, this.log, this.document).create(key);
      for (const vexflowTimeSignature of time.vexflowTimeSignatures) {
        vexflowStave.addModifier(vexflowTimeSignature);
      }
    }

    if (isFirstPart && isFirstStave && measureLabel) {
      vexflowStave.setMeasure(measureLabel);
    }

    if (!isFirstMeasure && isFirstMeasureEntry && !hasStaveConnector) {
      vexflowStave.setBegBarType(vexflow.Barline.type.SINGLE);
    } else {
      vexflowStave.setBegBarType(vexflow.Barline.type.NONE);
    }

    if (isLastMeasureEntry && !hasStaveConnector) {
      if (isLastSystem && isLastMeasure) {
        vexflowStave.setEndBarType(vexflow.Barline.type.END);
      } else {
        vexflowStave.setEndBarType(vexflow.Barline.type.SINGLE);
      }
    } else {
      vexflowStave.setEndBarType(vexflow.Barline.type.NONE);
    }

    // TODO: Check <stave-layouts> first, which has a part+stave scoped margin.
    pen.moveBy({ dy: this.config.DEFAULT_STAVE_MARGIN_BOTTOM + vexflowStave.getHeight() });

    return {
      type: 'stave',
      key,
      rect: PLACEHOLDER_RECT,
      intrinsicRect: PLACEHOLDER_RECT,
      vexflowStave,
      voices,
      clef,
      time,
      vexflowMultiMeasureRest,
    };
  }
}

type EnsembleClef = {
  type: 'clef';
  key: StaveKey;
  vexflowClef: vexflow.Clef;
  width: number;
};

class EnsembleClefFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: StaveKey): EnsembleClef {
    const clef = this.document.getStave(key).signature.clef;
    const vexflowClef = new vexflow.Clef(clef.sign);
    const width = vexflowClef.getWidth() + ADDITIONAL_CLEF_WIDTH;

    return {
      type: 'clef',
      key,
      vexflowClef,
      width,
    };
  }
}

type EnsembleTime = {
  type: 'time';
  key: StaveKey;
  vexflowTimeSignatures: vexflow.TimeSignature[];
  width: number;
};

class EnsembleTimeFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: StaveKey): EnsembleTime {
    const timeSpecs = this.getTimeSpecs(this.document, key);
    const vexflowTimeSignatures = timeSpecs.map((t) => new vexflow.TimeSignature(t));

    const padding = ADDITIONAL_COMPLEX_TIME_SIGNATURE_COMPONENT_WIDTH * (timeSpecs.length - 1);
    const width = vexflowTimeSignatures.reduce((sum, t) => sum + t.getWidth(), padding);

    return {
      type: 'time',
      key,
      vexflowTimeSignatures,
      width,
    };
  }

  private getTimeSpecs(document: Document, key: StaveKey): string[] {
    const time = document.getStave(key).signature.time;
    const components = this.toFractions(time.components);

    switch (time.symbol) {
      case 'common':
        return ['C'];
      case 'cut':
        return ['C|'];
      case 'single-number':
        const sum = Fraction.sum(...components).simplify();
        return [this.toSimpleTimeSpecs(sum)];
      case 'hidden':
        return [];
    }

    if (components.length > 1) {
      return this.toComplexTimeSpecs(components);
    }

    return [this.toSimpleTimeSpecs(components[0])];
  }

  private toSimpleTimeSpecs(component: Fraction): string {
    return `${component.numerator}/${component.denominator}`;
  }

  private toComplexTimeSpecs(components: Fraction[]): string[] {
    const denominators = new Array<number>();
    const memo: Record<number, number[]> = {};

    for (const component of components) {
      const numerator = component.numerator;
      const denominator = component.denominator;

      if (typeof memo[denominator] === 'undefined') {
        denominators.push(denominator);
      }

      memo[denominator] ??= [];
      memo[denominator].push(numerator);
    }

    const result = new Array<string>();

    for (let index = 0; index < denominators.length; index++) {
      const denominator = denominators[index];
      const isLast = index === denominators.length - 1;

      result.push(`${memo[denominator].join('+')}/${denominator}`);

      if (!isLast) {
        result.push('+');
      }
    }

    return result;
  }

  private toFractions(components: data.Fraction[]): Fraction[] {
    return components.map((component) => new Fraction(component.numerator, component.denominator));
  }
}

type EnsembleVoice = {
  type: 'voice';
  key: VoiceKey;
  rect: Rect;
  vexflowVoice: vexflow.Voice;
  entries: EnsembleVoiceEntry[];
};

class EnsembleVoiceFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: VoiceKey): EnsembleVoice {
    const voiceEntryFactory = new EnsembleVoiceEntryFactory(this.config, this.log, this.document);
    const voiceEntryCount = this.document.getVoiceEntryCount(key);
    const voiceEntries = new Array<EnsembleVoiceEntry>();

    for (let voiceEntryIndex = 0; voiceEntryIndex < voiceEntryCount; voiceEntryIndex++) {
      const voiceEntryKey: VoiceEntryKey = { ...key, voiceEntryIndex };
      voiceEntries.push(voiceEntryFactory.create(voiceEntryKey));
    }

    const vexflowTickables = voiceEntries.map((entry) => entry.vexflowTickable);
    const vexflowVoice = new vexflow.Voice().setMode(vexflow.Voice.Mode.SOFT).addTickables(vexflowTickables);

    return {
      type: 'voice',
      key,
      rect: PLACEHOLDER_RECT,
      vexflowVoice,
      entries: voiceEntries,
    };
  }
}

type EnsembleVoiceEntry = EnsembleNote | EnsembleRest;

class EnsembleVoiceEntryFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: VoiceEntryKey): EnsembleVoiceEntry {
    const entry = this.document.getVoiceEntry(key);

    switch (entry.type) {
      case 'note':
        return new EnsembleNoteFactory(this.config, this.log, this.document).create(key);
      case 'rest':
        return new EnsembleRestFactory(this.config, this.log, this.document).create(key);
    }
  }
}

type EnsembleNote = {
  type: 'note';
  key: VoiceEntryKey;
  rect: Rect;
  vexflowTickable: vexflow.StaveNote;
};

class EnsembleNoteFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: VoiceEntryKey): EnsembleNote {
    const note = this.document.getNote(key);

    let autoStem: boolean | undefined;
    let stemDirection: number | undefined;

    switch (note.stemDirection) {
      case 'up':
        stemDirection = vexflow.Stem.UP;
        break;
      case 'down':
        stemDirection = vexflow.Stem.DOWN;
        break;
      case 'none':
        break;
      default:
        autoStem = true;
    }

    const duration = Fraction.fromFractionLike(note.duration);
    const [denominator, dots] = conversions.fromFractionToNoteDuration(duration);

    const vexflowStaveNote = new vexflow.StaveNote({
      keys: [`${note.pitch.step}/${note.pitch.octave}`],
      duration: denominator,
      dots,
      autoStem,
      stemDirection,
    });

    for (let index = 0; index < dots; index++) {
      vexflow.Dot.buildAndAttach([vexflowStaveNote]);
    }

    for (const mod of note.mods) {
      if (mod.type === 'accidental') {
        const vexflowAccidental = new vexflow.Accidental(mod.code);
        if (mod.isCautionary) {
          vexflowAccidental.setAsCautionary();
        }
        vexflowStaveNote.addModifier(vexflowAccidental);
      }

      if (mod.type === 'annotation') {
        const vexflowAnnotation = new vexflow.Annotation(mod.text);
        if (mod.horizontalJustification) {
          vexflowAnnotation.setJustification(mod.horizontalJustification);
        }
        if (mod.verticalJustification) {
          vexflowAnnotation.setVerticalJustification(mod.verticalJustification);
        }
        vexflowStaveNote.addModifier(vexflowAnnotation);
      }
    }

    return {
      type: 'note',
      key,
      rect: PLACEHOLDER_RECT,
      vexflowTickable: vexflowStaveNote,
    };
  }
}

type EnsembleRest = {
  type: 'rest';
  key: VoiceEntryKey;
  rect: Rect;
  vexflowTickable: vexflow.StaveNote;
};

class EnsembleRestFactory {
  constructor(private config: Config, private log: Logger, private document: Document) {}

  create(key: VoiceEntryKey): EnsembleRest {
    const vexflowKey = this.getVexflowKey(key);
    const [denominator, dots] = this.getVexflowDuration(key);
    const shouldAlignCenter = this.shouldAlignCenter(key);
    const clef = this.document.getStave(key).signature.clef.sign;

    const vexflowStaveNote = new vexflow.StaveNote({
      keys: [vexflowKey],
      duration: `${denominator}r`,
      dots,
      clef,
      alignCenter: shouldAlignCenter,
    });

    for (let index = 0; index < dots; index++) {
      vexflow.Dot.buildAndAttach([vexflowStaveNote]);
    }

    return {
      type: 'rest',
      key,
      rect: PLACEHOLDER_RECT,
      vexflowTickable: vexflowStaveNote,
    };
  }

  private getVexflowKey(key: VoiceEntryKey): string {
    const rest = this.document.getRest(key);

    const displayPitch = rest.displayPitch;
    if (displayPitch) {
      return `${displayPitch.step}/${displayPitch.octave}`;
    }

    const clef = this.document.getStave(key).signature.clef;
    if (clef.sign === 'bass') {
      return 'D/3';
    }

    const [denominator] = this.getVexflowDuration(key);
    if (denominator === '2') {
      return 'B/4';
    }
    if (denominator === '1') {
      return 'D/5';
    }
    return 'B/4';
  }

  private getVexflowDuration(key: VoiceEntryKey): [denominator: string, dots: number] {
    const rest = this.document.getRest(key);
    const duration = Fraction.fromFractionLike(rest.duration);
    return conversions.fromFractionToNoteDuration(duration);
  }

  private shouldAlignCenter(key: VoiceEntryKey): boolean {
    const voiceEntryCount = this.document.getVoiceEntryCount(key);
    if (voiceEntryCount > 1) {
      return false;
    }

    const [denominator] = this.getVexflowDuration(key);
    if (denominator === '1') {
      return true;
    }
    if (denominator === '2') {
      return true;
    }

    return false;
  }
}
