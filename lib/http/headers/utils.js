import { parseHttpDate } from "#lib/dates";

export function encodeValue ( value, { encode = true, quote } = {} ) {
    if ( value == null ) {
        return "";
    }
    else if ( typeof value === "string" ) {

        // encode
        if ( encode ) {
            value = encodeURI( value ).replaceAll( ",", "%2C" ).replaceAll( ";", "%3B" ).replaceAll( "=", "%3D" );
        }

        // quote
        if ( quote ) {
            value = `"${ value }"`;
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
        etag = encodeValue( etag, {
            "encode": true,
            "quote": true,
        } );

        if ( weak ) {
            etag = "W/" + etag;
        }

        return etag;
    }
}

export function decodeValue ( value, { unquote, decode } = {} ) {
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
            value = decodeString( value, { decode } );
        }

        return value;
    }
}

export function decodeString ( value, { unquote = true, decode = true } = {} ) {
    if ( value == null ) {
        value = "";
    }
    else if ( typeof value !== "string" ) {
        value = String( value );
    }

    if ( unquote && value.startsWith( '"' ) && value.endsWith( '"' ) ) {
        value = value.slice( 1, -1 );
    }

    if ( decode ) {
        value = decodeURIComponent( value );
    }

    return value;
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

export function decodeBoolean ( value ) {
    if ( value == null ) {
        return true;
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
