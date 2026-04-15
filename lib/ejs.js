import fs from "node:fs";
import { fileURLToPath } from "node:url";
import _ejs from "ejs";
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
    "renderFile": {
        "configurable": false,
        "writable": false,
        "enumerable": false,
        async value ( path, data, options ) {
            if ( path instanceof URL ) {
                path = fileURLToPath( path );
            }

            return _ejs.renderFile( path, data, options );
        },
    },
} );
