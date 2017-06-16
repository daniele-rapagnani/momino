import _ from "lodash";
import PQueue from "p-queue";

import Package from "./package";
import emitter from "./events";

export default async (packages, config) => {
  const queue = new PQueue({ concurrency: config.concurrency || 4 });

  const promises = packages.map(
    (packageName) => queue.add(async () => {
      const allowed = _.get(config, "allowed", []);
      const banned = _.get(config, "banned", []);

      const pk = new Package(packageName, emitter, {
        auth: config.auth,
        debug: Boolean(process.env.DEBUG),
      });
      
      pk.init();
      await pk.analyze();
      pk.update();

      pk.preApproved = allowed.indexOf(packageName) >= 0;
      pk.banned = banned.indexOf(packageName) >= 0;

      return pk;
    })
  );

  return Promise.all(promises);
};
