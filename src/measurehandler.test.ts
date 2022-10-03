import { MeasureHandler } from './measurehandler';
import { NoopHandler } from './noophandler';
import { NoopReceiver } from './noopreceiver';
import { MeasureEndMessage, MeasureStartMessage } from './types';
import * as xml from './xml';

describe('MeasureHandler', () => {
  let receiver: NoopReceiver;
  let noteHandler: NoopHandler;
  let attributesHandler: NoopHandler;
  let barlineHandler: NoopHandler;
  let measureHandler: MeasureHandler;

  let receiverSpy: jest.SpyInstance;

  beforeEach(() => {
    receiver = new NoopReceiver();
    noteHandler = new NoopHandler();
    attributesHandler = new NoopHandler();
    barlineHandler = new NoopHandler();
    measureHandler = new MeasureHandler({
      attributesHandler,
      barlineHandler,
      noteHandler,
    });

    receiverSpy = jest.spyOn(receiver, 'onMessage');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a measure start message', () => {
    const measure = xml.measure();

    measureHandler.sendMessages(receiver, { node: measure });

    expect(receiverSpy).toHaveBeenNthCalledWith<[MeasureStartMessage]>(1, {
      msgType: 'measureStart',
      staves: 0,
      width: 100,
    });
  });

  it('sends a measure start message with the specified width', () => {
    const measure = xml.measure({ width: 42 });

    measureHandler.sendMessages(receiver, { node: measure });

    expect(receiverSpy).toHaveBeenNthCalledWith<[MeasureStartMessage]>(1, {
      msgType: 'measureStart',
      staves: 0,
      width: 42,
    });
  });

  it('sends a measure start message with the specified staves', () => {
    const measure = xml.measure({
      attributes: [
        xml.attributes({
          staves: xml.staves({ numStaves: 3 }),
        }),
      ],
    });

    measureHandler.sendMessages(receiver, { node: measure });

    expect(receiverSpy).toHaveBeenNthCalledWith<[MeasureStartMessage]>(1, {
      msgType: 'measureStart',
      staves: 3,
      width: 100,
    });
  });

  it('sends a measure end message', () => {
    const measure = xml.measure();

    measureHandler.sendMessages(receiver, { node: measure });

    expect(receiverSpy).toHaveBeenLastCalledWith<[MeasureEndMessage]>({
      msgType: 'measureEnd',
    });
  });
});
