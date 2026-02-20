import { parseHttpDate } from "#lib/dates";

export function encodeValue ( value, { encoding, language } = {} ) {
    if ( value == null ) {
        return "";
    }
    else if ( typeof value === "string" ) {

        // encode
        if ( encoding ) {
            // eslint-disable-next-line unicorn/text-encoding-identifier-case
            if ( encoding === true ) encoding = "utf-8";

            value = `${ encoding }'${ language || "" }'${ encodeURIComponent( value ) }`;
        }

        // quote
        else {
            return `"${ value.replaceAll( /["\\]/g, char => `\\${ char }` ) }"`;
        }

        return value;
    }
    else if ( typeof value === "number" ) {
        return value.toString();
    }
    else if ( value === true ) {
        return "?1";
    }
    else if ( value === false ) {
        return "?0";
    }
    else if ( Buffer.isBuffer( value ) ) {
        return `:${ value.toString( "base64" ) }:`;
    }
    else if ( value instanceof Date ) {
        return value.toUTCString();
    }
    else {
        throw new TypeError( "Invalid value type" );
    }
}

export function encodeEtag ( etag, { weak } = {} ) {
    if ( etag == null ) {
        return;
    }
    else if ( Buffer.isBuffer( etag ) ) {
        etag = etag.toString( "base64" );
    }
    else if ( typeof etag !== "string" ) {
        etag = String( etag );
    }

    if ( !etag ) {
        return '""';
    }
    else if ( etag === "*" ) {
        return etag;
    }
    else {
        etag = `"${ etag.replaceAll( /[\x00-\x20"\x7F]/g, char => encodeURIComponent( char ) ) }"`;

        if ( weak ) {
            etag = "W/" + etag;
        }

        return etag;
    }
}

export function decodeValue ( value ) {
    if ( value == null ) {
        return null;
    }

    // not a string
    else if ( typeof value !== "string" ) {
        return value;
    }

    // quoted string
    else if ( value.startsWith( '"' ) && value.endsWith( '"' ) ) {
        return decodeString( value );
    }

    // true
    else if ( value === "?0" ) {
        return false;
    }

    // false
    else if ( value === "?1" ) {
        return true;
    }

    // binary
    else if ( /^:[\d+/=A-Za-z]*:$/.test( value ) ) {
        return Buffer.from( value.slice( 1, -1 ), "base64" );
    }
    else {

        // number
        const number = Number( value );
        if ( Number.isFinite( number ) ) {
            return number;
        }

        // http date
        try {
            return parseHttpDate( value );
        }
        catch {}

        // unquoted string
        return value;
    }
}

export function decodeString ( value, { encoding } = {} ) {
    if ( value == null ) {
        value = "";
    }
    else if ( typeof value !== "string" ) {
        value = String( value );
    }

    // encode
    if ( encoding ) {
        const match = value.match( /^(?<encoding>[\dA-Za-z-]+)'(?<language>[A-Z_a-z]*)'(?<value>.+)/ );
        if ( !match ) return;

        return decodeURIComponent( match.groups.value );
    }

    // quoted string
    else if ( value.startsWith( '"' ) && value.endsWith( '"' ) ) {
        return value.slice( 1, -1 ).replaceAll( /\\(["\\])/g, match => match[ 1 ] );
    }

    // unquoted string
    else {
        return value;
    }
}

export function decodeNumber ( value ) {
    value = Number( value );

    if ( Number.isFinite( value ) ) {
        return value;
    }
}

export function decodeInteger ( value ) {
    value = Number( value );

    if ( Number.isInteger( value ) ) {
        return value;
    }
}

export function decodeBoolean ( value, { defaultValue = true } = {} ) {
    if ( value == null ) {
        return defaultValue;
    }
    else if ( value === "?0" ) {
        return false;
    }
    else if ( value === "?1" ) {
        return true;
    }
}

export function decodeBinary ( value ) {
    if ( /^:[\d+/=A-Za-z]*:$/.test( value ) ) {
        return Buffer.from( value.slice( 1, -1 ), "base64" );
    }
}

export function decodeHttpDate ( value ) {
    try {
        return parseHttpDate( value );
    }
    catch {}
}
