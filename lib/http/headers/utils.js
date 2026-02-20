import { parseHttpDate } from "#lib/dates";

export function encodeValue ( value, { encode = true, quote = true, utf8, language } = {} ) {
    if ( value == null ) {
        return "";
    }
    else if ( typeof value === "string" ) {

        // utf8
        if ( utf8 ) {
            value = `utf-8'${ language || "" }'${ encodeURIComponent( value ) }`;
        }

        // encode
        else if ( encode ) {
            if ( quote ) {
                return `"${ encodeURI( value ) }"`;
            }
            else {
                return encodeURIComponent( value );
            }
        }

        // quote
        else if ( quote ) {
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
        etag = "";
    }
    else if ( Buffer.isBuffer( etag ) ) {
        etag = etag.toString( "base64" );
    }
    else if ( typeof etag !== "string" ) {
        etag = String( etag );
    }

    if ( !etag ) {
        return "";
    }
    else {
        etag = encodeValue( etag );

        if ( weak ) {
            etag = "W/" + etag;
        }

        return etag;
    }
}

export function decodeValue ( value, { utf8, unquote, decode } = {} ) {
    if ( value == null ) {
        return null;
    }

    // not a string
    else if ( typeof value !== "string" ) {
        return value;
    }

    // quoted string
    else if ( value.startsWith( '"' ) && value.endsWith( '"' ) ) {
        if ( unquote || decode ) {
            value = decodeString( value, { unquote, decode } );
        }

        return value;
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
        if ( decode ) {
            value = decodeString( value, { utf8, decode } );
        }

        return value;
    }
}

export function decodeString ( value, { utf8, unquote = true, decode = true } = {} ) {
    if ( value == null ) {
        value = "";
    }
    else if ( typeof value !== "string" ) {
        value = String( value );
    }

    // utf8
    if ( utf8 ) {
        const match = value.match( /^(?<encoding>[\dA-Za-z-]+)'(?<language>[A-Z_a-z]*)'(?<value>.+)/ );
        if ( !match ) return;

        return decodeURIComponent( match.groups.value );
    }

    // quoted string
    else if ( unquote && value.startsWith( '"' ) && value.endsWith( '"' ) ) {
        value = value.slice( 1, -1 ).replaceAll( /\\(["\\])/g, match => match[ 1 ] );

        if ( decode ) {
            value = decodeURIComponent( value );
        }

        return value;
    }
    else if ( decode ) {
        return decodeURIComponent( value );
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
