import * as vexflow from 'vexflow';
import * as musicxml from '@/musicxml';
import * as util from '@/util';

/** The result of rendering a beam. */
export type BeamRendering = {
  type: 'beam';
  vexflow: {
    beam: vexflow.Beam;
  };
};

/** A piece of a beam. */
export type BeamFragment = {
  value: musicxml.BeamValue;
  vexflow: {
    stemmableNote: vexflow.StemmableNote;
  };
};

/** Represents a stem connector for a group of notes within a measure. */
export class Beam {
  private fragments: [BeamFragment, ...BeamFragment[]];

  constructor(opts: { fragment: BeamFragment }) {
    this.fragments = [opts.fragment];
  }

  /** Whether the fragment can be added to the beam. */
  isAllowed(fragment: BeamFragment): boolean {
    const last = util.last(this.fragments.map((fragment) => fragment.value));
    const allowed = this.getAllowedBeamValues(last);
    return allowed.includes(fragment.value);
  }

  /** Adds the fragment to the beam. */
  addFragment(fragment: BeamFragment): void {
    this.fragments.push(fragment);
  }

  /** Renders the beam. */
  render(): BeamRendering {
    const vfStemmableNotes = this.fragments.map((fragment) => fragment.vexflow.stemmableNote);
    const beam = new vexflow.Beam(vfStemmableNotes);

    return {
      type: 'beam',
      vexflow: { beam },
    };
  }

  private getAllowedBeamValues(beamValue: musicxml.BeamValue | null): musicxml.BeamValue[] {
    switch (beamValue) {
      case null:
        return ['begin'];
      case 'begin':
      case 'continue':
      case 'backward hook':
      case 'forward hook':
        return ['continue', 'backward hook', 'forward hook', 'end'];
      case 'end':
        return [];
    }
  }
}
