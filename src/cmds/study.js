import _ from "lodash";
import chalk from "chalk";
import Package from "../package";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { printResults, printReport } from "../results";
import { createHandler, createBuilder } from "./common";
import emitter from "../events";

export const command = ["study [package]", "*"];
export const desc = "Displays a package score";
export const builder = createBuilder((yargs) => {
  yargs.option("ranges", {
    alias: "r",
    description: "Specifies the score ranges to use when deciding " +
      "if you should use a package or not this" +
      " is in the format: [lowest score, good score]",
    default: "300,500",
  });

  yargs.option("test", {
    alias: "t",
    description: "Shows a small report of the result, "+
      "useful when integrated into a testing pipeline",
    default: true,
  });

  yargs.option("strict", {
    alias: "s",
    description: "Fail with any package below the 'good score' threshold (see -r)." +
      "Useful in conjunction with -t",
  });

  yargs.option("why", {
    alias: "w",
    description: "Gives a more detailed explanation of the score",
    type: "boolean",
  });
});

const analyzePackage = async (packageName, auth) => {
  const pk = new Package(packageName, emitter, { auth });
  await pk.analyze();
  pk.update();
  return pk;
};

export const handler = createHandler(async (argv, spinner, auth) => {
  const packageName = argv.package;
  const ranges = argv.ranges.split(/\s*,\s*/);

  emitter.on("package.analyzing", () => spinner.start());

  emitter.on("package.progress", (event) => {
    if (event.text) {
      spinner.text = `${chalk.bold(event.package.name)}: ${event.text}`;
    }
  });

  emitter.on("package.updated", () => spinner.stop());

  if (packageName) {
    const pkg = await analyzePackage(packageName, auth);
    printResults(pkg, ranges, !argv.why);
    process.exit(pkg.shouldInstall(ranges) ? 0 : 1);
  } else {
    const pkgJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error("No package.json file found in this directory");
    }

    const pkgJsonData = require(pkgJsonPath);
    const packages = _.keys(_.merge(
      {},
      _.get(pkgJsonData, "dependencies", {}),
      _.get(pkgJsonData, "devDependencies", {})
    ));

    const queue = new PQueue({ concurrency: 4 });
    const pkgResults = [];

    packages.forEach(async (item) => {
      const pkg = await queue.add(() => analyzePackage(
        item,
        auth
      ));

      pkgResults.push(pkg);
    });

    await queue.onEmpty();

    if (!argv.test) {
      pkgResults.forEach((pkg) => {
        printResults(pkg, ranges, !argv.why);
      });
    } else {
      const result = printReport(pkgResults, ranges, argv.strict);
      process.exit(result ? 1 : 0);
    }
  }
});
