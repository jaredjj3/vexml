import * as rendering from '@/rendering';
import { Config } from '@/config';
import { Rect } from '@/spatial';
import { Logger } from '@/debug';
import { Part } from './part';

export class Fragment {
  private constructor(
    private config: Config,
    private log: Logger,
    private document: rendering.Document,
    private fragmentRender: rendering.FragmentRender,
    private parts: Part[]
  ) {}

  static create(
    config: Config,
    log: Logger,
    document: rendering.Document,
    fragmentRender: rendering.FragmentRender
  ): Fragment {
    const parts = fragmentRender.partRenders.map((partRender) => Part.create(config, log, document, partRender));
    return new Fragment(config, log, document, fragmentRender, parts);
  }

  /** The name of the element, which can be used as a type discriminant. */
  public readonly name = 'fragment';

  /** Returns the bounding box of the element. */
  rect(): Rect {
    return this.fragmentRender.rect;
  }

  /** Returns the parts of the fragment. */
  getParts(): Part[] {
    return this.parts;
  }

  /** Returns the bpm of the fragment. */
  getBpm(): number {
    return this.document.getFragment(this.fragmentRender.key).signature.metronome.playbackBpm || 1; // disallow 0;
  }

  /** Returns the max number of parts in this score. */
  getPartCount(): number {
    return this.parts.length;
  }
}
