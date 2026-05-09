import crypto from "node:crypto";
import BrowserUuid from "#lib/_browser/uuid";

// public
export default class Uuid extends BrowserUuid {
    #uint8Array;

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
    // XXX remove in node >= 26
    get uint8Array () {
        if ( !this.#uint8Array ) {
            const buffer = Buffer.from( this.toString().replaceAll( "-", "" ), "hex" );

            this.#uint8Array = new Uint8Array( buffer.buffer, buffer.byteOffset, buffer.byteLength );
        }

        return this.#uint8Array;
    }

    // public
    toBuffer () {
        return Buffer.from( this.#uint8Array.buffer, this.#uint8Array.byteOffset, this.#uint8Array.byteLength );
    }
}
