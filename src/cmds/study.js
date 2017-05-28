import _ from "lodash";
import chalk from "chalk";
import Package from "../package";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { printResults } from "../results";
import { createHandler, createBuilder } from "./common";
import emitter from "../events";

export const command = "study [package]";
export const desc = "Displays a package score";
export const builder = createBuilder((yargs) => {
  yargs.option("ranges", {
    alias: "r",
    description: "Specify the score ranges to use when deciding if you should use a package or not",
    default: "300,500,1000",
  });

  yargs.option("why", {
    alias: "w",
    description: "Gives a more detailed explanation of the score",
    type: "boolean",
  });
});

const analyzePackage = async (packageName, auth, ranges, why) => {
  const pk = new Package(packageName, emitter, { auth });
  await pk.analyze();
  pk.update();

  printResults(pk, ranges, !why);

  return pk.shouldInstall(ranges);
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
    process.exit((await analyzePackage(packageName, auth, ranges, argv.why)) ? 0 : 1);
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

    packages.forEach((item) => {
      queue.add(() => analyzePackage(
        item,
        auth,
        ranges,
        argv.why
      ));
    });

    await queue;
  }
});
