import _ from "lodash";
import request from "request-promise-native";
import moment from "moment";
import winston from "winston";

export const npmSearch = async (search) => {
  const result = await request({
    url: `http://registry.npmjs.org/${search}`,
  }).catch((err) => {
    if (err.statusCode == 404) {
      return Promise.reject("The package could not be found");
    }
  });

  return JSON.parse(result);
};

export const npmStats = async (info) => {
  const todayDate = moment().format("YYYY-MM-DD");
  const lastMonth = moment().subtract(1, "month").format("YYYY-MM-DD");
  const monthBefore = moment().subtract(2, "month").format("YYYY-MM-DD");
  const creationDate = moment(info.time.created).format("YYYY-MM-DD");
  const existsMonths = moment().diff(moment(info.time.created), "months", true);

  const lastMonthDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/${lastMonth}:${todayDate}/${info.name}`,
  });

  let monthBeforeDownloads = false;

  if (existsMonths >= 2) {
    monthBeforeDownloads = await request({
      url: `https://api.npmjs.org/downloads/point/${monthBefore}:${lastMonth}/${info.name}`,
    });
  }

  const allDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/${creationDate}:${todayDate}/${info.name}`,
  });

  return {
    downloads: {
      lastMonth: _.get(JSON.parse(lastMonthDownloads), "downloads", 0),
      monthBefore: monthBeforeDownloads ?
        _.get(JSON.parse(monthBeforeDownloads), "downloads", 0) : false,
      all: _.get(JSON.parse(allDownloads), "downloads", 0),
    },
  };
};

export default async (name, emitter) => {
  emitter.emit("npm.progress", { text: "Querying NPM registry for information" });

  const info = await npmSearch(name);
  const stats = await npmStats(info);

  winston.debug("NPM Stats", stats);

  return {
    ...info,
    stats,
  };
};
