import { hash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Ejs as BrowserEjs } from "#lib/_browser/ejs";
import { makeCallable } from "#lib/callable";

export class Ejs extends BrowserEjs {

    // static
    static fromFile ( path, options ) {
        if ( path instanceof URL ) {
            path = fileURLToPath( path );
        }

        return new this( fs.readFileSync( path, "utf8" ), options );
    }

    static async renderFile ( path, data, options ) {
        const template = await fs.promises.readFile( path, "utf8" );

        return new this( template, options ).render( data );
    }

    // protected
    _createId ( template ) {
        return hash( "SHA-256", template, "hex" );
    }
}

export default makeCallable( Ejs, "new", {
    "name": "ejs",
} );
