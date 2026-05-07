import crypto from "node:crypto";
import { uuidv7 } from "#lib/_browser/uuid";

export default uuidv4;

export function uuidv4 () {
    return crypto.randomUUID();
}

// XXX enable in node >= 26
// export function uuidv7 () {
//     return crypto.randomUUIDv7();
// }
export { uuidv7 };

export function uuidToBuffer ( uuid ) {
    return Buffer.from( uuid.replaceAll( "-", "" ), "hex" );
}

export function uuidFromBuffer ( buffer, start = 0 ) {
    if ( ( start += buffer.length > 16 ) ) throw new Error( "UUID beffer length is not valid" );

    const hex = buffer.toString( "hex", start, start + 16 );

    return `${ hex.slice( 0, 8 ) }-${ hex.slice( 8, 12 ) }-${ hex.slice( 12, 16 ) }-${ hex.slice( 16, 20 ) }-${ hex.slice( 20 ) }`;
}
