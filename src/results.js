import _ from "lodash";
import chalk from "chalk";
import pluralize from "pluralize";

const out = (msg) => process.stdout.write(`${msg}\n`);

export function printScore(pkg) {
  out(`\n${chalk.bold(pkg.name)} has scored: ${chalk.green.bold(pkg.score)}\n`);
}

export function printList(pkg, list, label, color = "green", withMetric = true) {
  list = _.get(pkg, list, []);

  if (list.length > 0) {
    out(chalk[color].bold(`${label}:`));
    list.forEach((item) => {
      let msg = chalk[color](`- ${item.message}`);

      if (withMetric && item.metric) {
        const score = Math.round(pkg.scorePartials[item.metric]);

        if (score) {
          msg = `${msg} ${chalk[color].bold("+" + score)}`;
        }
      }

      out(msg);
    });
  }
}

export function printReasons(pkg) {
  printList(pkg, "pros", "Pros", "green");
  printList(pkg, "cons", "\nCons", "red");
  printList(pkg, "notes", "\nNotes", "grey");
}

export function printSummary(pkg, [min, mid]) {
  if (pkg.score < min) {
    out(`${chalk.red(`You should probably not adopt ${pkg.name} (score: ${pkg.score})`)}`);
  } else if (pkg.score > min && pkg.score < mid) {
    out(`${chalk.yellow(`Maybe you should not adopt ${pkg.name} (score: ${pkg.score})`)}`);
  } else {
    out(`${chalk.green(`You should adopt ${pkg.name} (score: ${pkg.score})`)}`);
  }
}

export function printFull(pkg) {
  printScore(pkg);
  out("");
  printReasons(pkg);
}

export function printResults(pkgs, { test, why, ranges, strict }) {
  pkgs = [].concat(pkgs);

  if (test) {
    return printReport(pkgs, ranges, strict);
  }

  pkgs.forEach((p) => why ? printFull(p) : printSummary(p, ranges));

  return true;
}

export function printReportLine(color, message, list) {
  if (list.length > 0) {
    out(
      chalk[color].bold(list.length) +
      chalk[color](
        ` ${pluralize("package", list.length)} ${list.length > 1 ? message[0] : message[1]}: `
      ) +
      chalk[color].bold(`${list.map((p) => p.name).join(", ")}`)
    );
  }
}

export function printReport(pkgs, [lowRange, goodRange], strict = false) {
  const failing = pkgs.filter(
    (pkg) => !pkg.banned && !pkg.preApproved && pkg.score < (strict ? goodRange : lowRange)
  );

  const banned = pkgs.filter((pkg) => pkg.banned);
  const allowed = pkgs.filter((pkg) => pkg.preApproved);

  const good = pkgs.filter(
    (pkg) => !pkg.banned && !pkg.preApproved && pkg.score > goodRange
  );

  let warning = [];

  if (!strict) {
    warning = pkgs.filter(
      (pkg) => !pkg.banned && !pkg.preApproved && pkg.score >= lowRange && pkg.score < goodRange
    );
  }

  printReportLine("red", ["are banned", "is banned"], banned);
  printReportLine(
    "red",
    ["are below your quality standard", "is below your quality standard"],
    failing
  );
  printReportLine(
    "yellow",
    ["require careful consideration", "requires careful consideration"],
    warning
  );
  printReportLine("green", ["are good", "is good"], good);
  printReportLine("green", ["are pre-approved", "is pre-approved"], allowed);

  return failing.length <= 0 && banned.length <= 0;
}
