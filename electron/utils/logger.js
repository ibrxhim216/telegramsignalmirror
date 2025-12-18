"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/utils/logger.ts
var logger_exports = {};
__export(logger_exports, {
  logger: () => logger
});
module.exports = __toCommonJS(logger_exports);
var import_winston = __toESM(require("winston"));
var import_path = __toESM(require("path"));
var import_electron = require("electron");
var logDir = import_electron.app.getPath("userData");
var logger = import_winston.default.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: import_winston.default.format.combine(
    import_winston.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    import_winston.default.format.errors({ stack: true }),
    import_winston.default.format.splat(),
    import_winston.default.format.json()
  ),
  defaultMeta: { service: "telegram-signal-mirror" },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new import_winston.default.transports.File({
      filename: import_path.default.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      // 5MB
      maxFiles: 5
    }),
    // Write all logs with importance level of 'info' or less to combined.log
    new import_winston.default.transports.File({
      filename: import_path.default.join(logDir, "combined.log"),
      maxsize: 5242880,
      // 5MB
      maxFiles: 5
    })
  ]
});
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new import_winston.default.transports.Console({
      format: import_winston.default.format.combine(
        import_winston.default.format.colorize(),
        import_winston.default.format.simple()
      )
    })
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  logger
});
