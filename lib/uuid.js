import crypto from "node:crypto";
import { uuidv7 as browserUuidv7 } from "#lib/_browser/uuid";

// public
export default uuidv4;

export const uuidv4 = crypto.randomUUID();

// XXX remove  condition in node >= 26
export const uuidv7 = crypto.randomUUIDv7 || browserUuidv7;

export function uuidToBuffer ( uuid ) {
    return Buffer.from( uuid.replaceAll( "-", "" ), "hex" );
}

export function uuidFromBuffer ( buffer, start = 0 ) {
    if ( start + 16 > buffer.length ) throw new Error( "UUID beffer length is not valid" );

    const hex = buffer.toString( "hex", start, start + 16 );

    return `${ hex.slice( 0, 8 ) }-${ hex.slice( 8, 12 ) }-${ hex.slice( 12, 16 ) }-${ hex.slice( 16, 20 ) }-${ hex.slice( 20 ) }`;
}
