# Momino

Momino is an npm package adoption advisor: it inspects your project's dependencies in order to assign a score based on heuristics about development continuity, community health and global adoption.

![Momino](https://raw.github.com/daniele-rapagnani/momino/master/docs/momino.gif)

Momino can be used in test mode and integrated in your favourite CI environment or pre-commit hooks.

![Momino Test Mode](https://raw.github.com/daniele-rapagnani/momino/master/docs/momino_test.gif)

# Install

Momino can be installed as a global npm package:

```bash
npm install -g momino
```

It can also be installed locally:

```bash
npm install --save momino
npx momino # Runs local momino installation
```

# Configuration

Momino should work out of the box without any further configuration but
you should consider configuring it with a GitHub personal access token
to avoid reaching GitHub's guest API limit.
You can generate a personal access token from your GitHub's account page.

To input the token you can simply run the configuration wizard:

```bash
momino configure
```

If you don't want to use a personal access token you
can just setup momino to ask for your credentials
when needed, just add the `-A` option when executing
momino:

```bash
momino -A react # Will prompt for your GitHub user and pass
```

# Usage

Running momino without any arguments will analyze the
dependencies of any `package.json` file in the current
directory:

```bash
momino
```

You can ask momino to analyze a package which is not
currently a dependency yet by using the package name
as the first argument:

```bash
momino p-queue # This is an alias of "momino study p-queue"
```

You can also use the `--why` flag to have momino
output detailed information about why and how
the score was calculated.

```bash
momino chalk --why
```

You can view all the other supported options by running:
```bash
momino help study
```

## Project configuration

You can create a custom configuration file in the root
of your project which will be used by default every time
momino is run in that directory.
The name of the file must be `.mominorc.json`, the content
is a JSON file and the supported options are the same that
are supported on the command line.

A custom configuration can look something like:
```json
{
    "ranges": [1000, 2000],
    "allowed": ["data-store"],
    "banned": ["lodash"]
}
```

The options specified in the configuration file
can still be overriden on the command line.

# How it works

When given the name of a package momino attempts to extract
some information from NPM. It then checks if there's an associated
repository and if there is, it starts to analyze it in order to
extract meaningful information about the develpment process,
the community, etc. All the data collected is then mapped to some
value, using custom heuristics, and then a simple linear regression
is used on some sample data to output the final value.s

This algorithm is far from perfect but it still manages to give
useful insights.

# License

MIT © Daniele Rapagnani