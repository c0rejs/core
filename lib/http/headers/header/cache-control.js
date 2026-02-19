import Header from "#lib/http/headers/header";
import { decodeBoolean, decodeInteger } from "#lib/http/headers/utils";
import { objectIsPlain } from "#lib/utils";

const NAME = "cache-control",
    DIRECTIVES = {
        "immutable": decodeBoolean,
        "max-age": decodeInteger,
        "max-stale": decodeInteger,
        "min-fresh": decodeInteger,
        "must-revalidate": decodeBoolean,
        "must-understand": decodeBoolean,
        "no-cache": decodeBoolean,
        "no-store": decodeBoolean,
        "no-transform": decodeBoolean,
        "only-if-cached": decodeBoolean,
        "private": decodeBoolean,
        "proxy-revalidate": decodeBoolean,
        "public": decodeBoolean,
        "s-maxage": decodeInteger,
        "stale-if-error": decodeBoolean,
        "stale-while-revalidate": decodeBoolean,
    };

export default class CacheControlHeader extends Header {

    // static
    static get headerName () {
        return NAME;
    }

    // properties
    get immutable () {
        return this._getField( "immutable" );
    }

    get maxAge () {
        return this._getField( "max-age" );
    }

    get maxStale () {
        return this._getField( "max-stale" );
    }

    get minFresh () {
        return this._getField( "min-fresh" );
    }

    get mustRevalidate () {
        return this._getField( "must-revalidate" );
    }

    get mustUnderstand () {
        return this._getField( "must-understand" );
    }

    get noCache () {
        return this._getField( "no-cache" );
    }

    get noStore () {
        return this._getField( "no-store" );
    }

    get noTransform () {
        return this._getField( "no-transform" );
    }

    get onlyIfCached () {
        return this._getField( "only-if-cached" );
    }

    get private () {
        return this._getField( "private" );
    }

    get proxyRevalidate () {
        return this._getField( "proxy-revalidate" );
    }

    get public () {
        return this._getField( "public" );
    }

    get sMaxage () {
        return this._getField( "s-maxage" );
    }

    get staleIfError () {
        return this._getField( "stale-if-error" );
    }

    get staleWhileRevalidate () {
        return this._getField( "stale-while-revalidate" );
    }

    // protected
    _encodeValue ( value, { encode, quote, utf8, language } = {} ) {
        if ( objectIsPlain( value ) ) {
            return this._build( value );
        }
        else {
            return super._encodeValue( value, { encode, quote, utf8, language } );
        }
    }

    _parse ( value, parser ) {
        const data = parser.parseDictionary( value, { "bare": true } );
        if ( !data ) return;

        const fields = {};

        for ( const item of Object.values( data ) ) {
            const decoder = DIRECTIVES[ item.name ];
            if ( !decoder ) continue;

            const value = decoder( item.value );
            if ( value == null ) continue;

            fields[ item.name ] = value;
        }

        return fields;
    }

    _build ( fields ) {
        const directives = [];

        for ( const [ key, value ] of Object.entries( fields ) ) {
            if ( !DIRECTIVES[ key ] ) continue;

            if ( value == null ) continue;

            if ( value === false ) continue;

            if ( value === true ) {
                directives.push( key );
            }
            else {
                directives.push( `${ key }=${ value }` );
            }
        }

        return directives.join( ", " );
    }
}
