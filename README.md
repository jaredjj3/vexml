# vexml

[MusicXML](https://www.w3.org/2021/06/musicxml40/) to [VexFlow](https://www.vexflow.com/).

![test workflow](https://github.com/stringsync/vexml/actions/workflows/test.yml/badge.svg)

## Usage

### Installing

You _will_ be able to use any JavaScript package manager (e.g. `yarn`, `npm`, `pnpm`) to install `vexml`. At the moment, `stringsync/vexml` is not published to any public registry.

### Rendering

```ts
import { vexml } from 'vexml';

const width = 600;
const height = 600;

const div = document.createElement('div');
div.style.width = `${width}px`;
div.style.height = `${height}px`;

const xml = 'some valid musicXML'; // see tests/integration/__data__ for valid musicXML documents

vexml.Vexml.render({ element: div, width: width, xml: xml });
```

This will render a child SVG element whose height will automatically adjust to fit the container. There is currently no option to disable this.

## Development

### Prerequisites

- [yarn](https://classic.yarnpkg.com/lang/en/docs/install)
- [docker](https://docs.docker.com/engine/install)

### Installing

Before you run any commands, install the dependencies.

```sh
yarn install
```

### Running Tests

In order to run tests on x86 architecture, run:

```sh
yarn test
```

If you're running a machine using ARM architecture (such as an M series mac), try setting the default platform before running the command (or set it in your shell profile):

```sh
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

These commands are just an alias for `jest`, so you use all the [jest CLI options](https://jestjs.io/docs/cli). For example, to run in watch mode:

```
yarn test --watchAll
```

### Snapshots

This library uses [americanexpress/jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot) for image-based snapshot tests.

#### Diffs

You can see diff images in the `__diff_output__` directory (nested under `__image_snapshots__`). Images here are ignored by git, but allow you to see what changed. The order of images are: snapshot, diff, proposed.

#### Updating Snapshots

Rendering varies by platform, so it is important you run tests using the `yarn test*` commands, since that runs tests in a consistent environment (via Docker). This is also the environment that CI will use.

When you want to update all snapshots, rerun the test command with the `--updateSnapshot`.

```sh
yarn test --updateSnapshot
```

If you want to only update a single snapshot from specific test, you can use [`--testNamePattern`](https://jestjs.io/docs/cli#--testnamepatternregex).

#### Removing tests

When removing a test, it is important to remove the corresponding snapshot. There is currently no automatic mechanism to do this. Alternatively, you can run the `vexml:latest` Docker image with `JEST_IMAGE_SNAPSHOT_TRACK_OBSOLETE=1`, but make sure you're running the entire test suite. See the [docs](https://github.com/americanexpress/jest-image-snapshot#removing-outdated-snapshots) for more information.
