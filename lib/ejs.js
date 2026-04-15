import fs from "node:fs";
import { Ejs as BrowserEjs } from "#lib/_browser/ejs";

export class Ejs extends BrowserEjs {

    // static
    static fromFile ( path, options ) {
        return new this( fs.readFileSync( path, "utf8" ), options );
    }

    static async renderFile ( path, data, options ) {
        const template = await fs.promises.readFile( path, "utf8" );

        return new this( template, options ).render( data );
    }
}

export default function ejs ( template, options ) {
    return Ejs.new( template, options );
}

Object.defineProperties( ejs, {
    "isEjs": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( value ) {
            return value instanceof BrowserEjs;
        },
    },
    "fromFile": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( path, options ) {
            return Ejs.fromFile( path, options );
        },
    },
    "renderFile": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        async value ( path, data, options ) {
            return Ejs.renderFile( path, data, options );
        },
    },
} );
