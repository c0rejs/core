import fs from "node:fs";
import { Ejs } from "#lib/_browser/ejs";

export { default } from "#lib/_browser/ejs";
export * from "#lib/_browser/ejs";

Object.defineProperties( Ejs, {
    "fromFile": {
        "configurable": false,
        "writable": false,
        "enumerable": false,
        value ( path, options ) {
            return new this( fs.readFileSync( path, "utf8" ), options );
        },
    },
} );
