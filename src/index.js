#!/usr/bin/env node

import winston from "winston";
import path from "path";

winston.configure({
  level: process.env.DEBUG ? "debug" : "warn",
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
      colorize: "all",
      prettyPrint: true,
      handleExceptions: true,
    }),
  ],
});

require("yargs")
  .commandDir(path.join(__dirname, "cmds"))
  .help()
  .argv
;
