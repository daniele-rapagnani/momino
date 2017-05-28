import _ from "lodash";
import chalk from "chalk";

const out = (msg) => process.stdout.write(`${msg}\n`);

export function printScore(pkg) {
  out(`\n${chalk.bold(pkg.name)} has scored: ${chalk.green.bold(pkg.score)}\n`);
}

export function printList(pkg, list, label, color = "green", withMetric = false) {
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
  printList(pkg, "pros", "Pros", "green", true);
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

export function printResults(pkg, ranges = null, short = true) {
  if (short) {
    return printSummary(pkg, ranges);
  }

  printScore(pkg);
  out("");
  printReasons(pkg);
}
