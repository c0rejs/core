import crypto from "node:crypto";
import BrowserUuid from "#lib/_browser/uuid";

// public
export default class Uuid extends BrowserUuid {
    #buffer;

    constructor ( uuid ) {
        if ( Buffer.isBuffer( uuid ) ) {
            uuid = new Uint8Array( uuid.buffer, uuid.byteOffset, uuid.byteLength );
        }

        super( uuid );
    }

    // static
    static v4 () {
        return crypto.randomUUID();
    }

    // XXX remove  condition in node >= 26
    static v7 () {
        return crypto.randomUUIDv7
            ? crypto.randomUUIDv7()
            : super.v7();
    }

    // properties
    get buffer () {
        if ( !this.#buffer ) {
            this.#buffer = Buffer.from( this.uint8Array.buffer, this.uint8Array.byteOffset, this.uint8Array.byteLength );
        }

        return this.#buffer;
    }
}
