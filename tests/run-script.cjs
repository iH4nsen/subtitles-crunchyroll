const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function readProjectFile(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function runScript(file, context) {
  vm.runInNewContext(readProjectFile(file), context);
  return context;
}

module.exports = { readProjectFile, runScript };
