import * as vexflow from 'vexflow';
import { Document } from './document';

/** Formatter produces a new formatted document from an unformatted one. */
export interface Formatter {
  format(document: Document): Document;
}

export interface Drawable {
  setContext(ctx: vexflow.RenderContext): this;
  draw(): this;
}

export type Padding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type PartLabelKey = {
  partIndex: number;
};

export type SystemArrangement = {
  measureIndexes: number[];
};

export type SystemKey = {
  systemIndex: number;
};

export type MeasureKey = SystemKey & {
  measureIndex: number;
};

export type MeasureEntryKey = MeasureKey & {
  measureEntryIndex: number;
};

export type PartKey = MeasureEntryKey & {
  partIndex: number;
};

export type StaveKey = PartKey & {
  staveIndex: number;
};

export type VoiceKey = StaveKey & {
  voiceIndex: number;
};

export type VoiceEntryKey = VoiceKey & {
  voiceEntryIndex: number;
};
