// eslint-disable-next-line @typescript-eslint/no-var-requires
const schemaConverter = require('json-schema-to-typescript');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
const path = require("path");

function __convertSchema() {
    // compile from file
    schemaConverter
        .compileFromFile('./yaxm-printer.schema.json')
        .then(ts => fs.writeFileSync('src/config/types.ts', ts));
}

module.exports = {
    convertSchema: __convertSchema,
}

