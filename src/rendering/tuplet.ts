import * as vexflow from 'vexflow';
import * as util from '@/util';
import * as conversions from './conversions';
import { SpannerData } from './types';
import { SpannerMap } from './spannermap';

/** The result of rendering a tuplet. */
export type TupletRendering = {
  type: 'tuplet';
  vexflow: {
    tuplet: vexflow.Tuplet;
  };
};

/** Represents a piece of a tuplet. */
export type TupletFragment =
  | {
      type: 'start';
      vexflow: {
        note: vexflow.Note;
        location: vexflow.TupletLocation;
      };
    }
  | {
      type: 'unspecified' | 'stop';
      vexflow: {
        note: vexflow.Note;
      };
    };

type TupletFragmentType = TupletFragment['type'];

type TupletContainer = SpannerMap<null, Tuplet>;

/** Represents a time modification for a group of notes within a measure. */
export class Tuplet {
  private fragments: [TupletFragment, ...TupletFragment[]];

  private constructor(opts: { fragment: TupletFragment }) {
    this.fragments = [opts.fragment];
  }

  static process(data: SpannerData, container: TupletContainer): void {
    // Tuplets cannot be grouped, but the schema allows for multiple to be possible. We only handle the first one we
    // come across.
    const tuplet = util.first(
      data.musicXml.note
        ?.getNotations()
        .find((notations) => notations.hasTuplets())
        ?.getTuplets() ?? []
    );

    switch (tuplet?.getType()) {
      case 'start':
        Tuplet.commit(
          {
            type: 'start',
            vexflow: {
              location: conversions.fromAboveBelowToTupletLocation(tuplet.getPlacement()!),
              note: data.vexflow.staveNote,
            },
          },
          container
        );
        break;
      case 'stop':
        Tuplet.commit(
          {
            type: 'stop',
            vexflow: {
              note: data.vexflow.staveNote,
            },
          },
          container
        );
        break;
      default:
        Tuplet.commit(
          {
            type: 'unspecified',
            vexflow: {
              note: data.vexflow.staveNote,
            },
          },
          container
        );
    }
  }

  static commit(fragment: TupletFragment, container: TupletContainer): void {
    const tuplet = container.get(null);
    const last = tuplet?.getLastFragment();
    const isAllowedType = Tuplet.getAllowedTypes(last?.type).includes(fragment.type);

    if (fragment.type === 'start') {
      container.push(null, new Tuplet({ fragment }));
    } else if (tuplet && isAllowedType) {
      tuplet.fragments.push(fragment);
    }
  }

  private static getAllowedTypes(type: TupletFragmentType | undefined): TupletFragmentType[] {
    switch (type) {
      case 'start':
      case 'unspecified':
        return ['unspecified', 'stop'];
      case 'stop':
        return [];
      default:
        return [];
    }
  }

  /** Renders a tuplet. */
  render(): TupletRendering {
    const vfTupletLocation = this.getVfTupletLocation();
    const vfNotes = this.fragments.map((fragment) => fragment.vexflow.note);
    const vfTuplet = new vexflow.Tuplet(vfNotes, { location: vfTupletLocation });

    return {
      type: 'tuplet',
      vexflow: {
        tuplet: vfTuplet,
      },
    };
  }

  private getLastFragment(): TupletFragment {
    return util.last(this.fragments)!;
  }

  private getVfTupletLocation(): vexflow.TupletLocation | undefined {
    const fragment = util.first(this.fragments);
    if (!fragment) {
      return undefined;
    }

    if (fragment.type !== 'start') {
      return undefined;
    }

    return fragment.vexflow.location;
  }
}
