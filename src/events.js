import EventsEmitter from "eventemitter2";

export default new EventsEmitter({ wildcard: true, maxListeners: 200 });
