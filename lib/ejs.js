import fs from "node:fs";
import { fileURLToPath } from "node:url";
import _ejs from "ejs";

export class Ejs {
    #tenderer;

    constructor ( template, options ) {
        this.#tenderer = _ejs.compile( template, options );
    }

    // static
    static get Template () {
        return _ejs.Template;
    }

    static new ( template, options ) {
        if ( template instanceof this ) {
            return template;
        }
        else {
            return new this( template, options );
        }
    }

    static fromFile ( path, options ) {
        return new this( fs.readFileSync( path, "utf8" ), options );
    }

    static async renderFile ( path, data, options ) {
        if ( path instanceof URL ) {
            path = fileURLToPath( path );
        }

        return _ejs.renderFile( path, data, options );
    }

    // public
    render ( data ) {
        return this.#tenderer( data );
    }
}

export default function ejs ( template, options ) {
    return Ejs.new( template, options );
}

Object.defineProperties( ejs, {
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
