export type MeasureStartMessage = {
  msgType: 'measureStart';
  width?: number;
  staves?: number;
};

export type AttributesMessage = {
  msgType: 'attributes';
  clefs: Map<number, string>;
  time?: string;
  key?: number;
};

export type MeasureEndMessage = {
  msgType: 'measureEnd';
};

export type BeamStartMessage = {
  msgType: 'beamStart';
};

export type BeamEndMessage = {
  msgType: 'beamEnd';
};

export type VoiceEndMessage = {
  msgType: 'voiceEnd';
  voice: string;
};

export type NoteMessage = {
  msgType: 'note';
  stem: string;
  dots: number;
  head: { pitch: string; accidental: string }[];
  type: string;
  duration?: number;
  grace: boolean;
  voice: string;
  staff: number;
};

export type EasyScoreMessage =
  | NoteMessage
  | AttributesMessage
  | MeasureStartMessage
  | MeasureEndMessage
  | BeamStartMessage
  | BeamEndMessage
  | VoiceEndMessage;

export type EasyScoreMessageReceiver = {
  onMessage(message: EasyScoreMessage): void;
};

export type Getter<T> = () => T;

export interface CodeTracker {
  let<T>(variableName: string, getter: Getter<T>): T;
  const<T>(variableName: string, getter: Getter<T>): T;
  expression<T>(getter: Getter<T>): T;
  comment(comment: string): void;
  newline(): void;
  literal(literal: string): void;
}
