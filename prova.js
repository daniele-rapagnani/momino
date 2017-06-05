require("yargs")
  .command('pippo', 'asd', () => {}, () => console.log("YES"))
  .command('*', 'asdas', () => {}, () => console.log("DEFAULT"))
  .help()
  .argv
;
