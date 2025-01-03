import { Enum, EnumValues } from '@/util';

/**
 * The direction of the stem of a note.
 */
export type StemDirection = EnumValues<typeof STEM_DIRECTIONS>;
export const STEM_DIRECTIONS = new Enum(['auto', 'up', 'down', 'none'] as const);

/**
 * Different types of clef symbols.
 *
 * See https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/clef-sign/
 */
export type ClefSign = EnumValues<typeof CLEF_SIGNS>;
export const CLEF_SIGNS = new Enum(['G', 'F', 'C', 'percussion', 'TAB', 'jianpu', 'none'] as const);

/**
 * The <mode> element is used to specify major/minor and other mode distinctions.
 *
 * See https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/mode/
 */
export type KeyMode = EnumValues<typeof KEY_MODES>;
const KEY_MODES = new Enum([
  'none',
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'ionian',
  'locrian',
] as const);

/**
 * The accidental code from VexFlow. The list only contains typical accidentals from Western music and is currently not
 * exhaustive.
 *
 * See https://github.com/0xfe/vexflow/blob/17755d786eae1670ee20e8101463b3368f2c06e5/src/tables.ts#L169
 */
export type AccidentalCode = EnumValues<typeof ACCIDENTAL_CODES>;
export const ACCIDENTAL_CODES = new Enum(['#', '##', 'b', 'bb', 'n', 'd', '_', 'db', '+', '++'] as const);

/**
 * The suffix for a fully qualified key.
 *
 * See https://github.com/0xfe/vexflow/blob/974fe1aaf5bb6270577053200a59c87b32d99d31/src/tables.ts#L817
 */
export type Notehead = EnumValues<typeof NOTEHEADS>;
export const NOTEHEADS = new Enum([
  '',
  'D0',
  'D1',
  'D2',
  'D3',
  'T0',
  'T1',
  'T2',
  'T3',
  'X0',
  'X1',
  'X2',
  'X3',
  'S1',
  'S2',
  'R1',
  'R2',
  'DO',
  'RE',
  'MI',
  'FA',
  'FAUP',
  'SO',
  'LA',
  'TI',
  'D',
  'H',
  'N',
  'G',
  'M',
  'X',
  'CX',
  'CI',
  'S',
  'SQ',
  'TU',
  'TD',
  'SF',
  'SB',
] as const);
