import Header from "#lib/http/headers/header";
import AcceptEncodingHeader from "#lib/http/headers/header/accept-encoding";
import AcceptRangesHeader from "#lib/http/headers/header/accept-ranges";
import AuthorizationHeader from "#lib/http/headers/header/authorization";
import CacheControlHeader from "#lib/http/headers/header/cache-control";
import ContentDispositionHeader from "#lib/http/headers/header/content-disposition";
import ContentLengthHeader from "#lib/http/headers/header/content-length";
import ContentRangeHeader from "#lib/http/headers/header/content-range";
import ContentTypeHeader from "#lib/http/headers/header/content-type";
import CookieHeader from "#lib/http/headers/header/cookie";
import DateHeader from "#lib/http/headers/header/date";
import EtagHeader from "#lib/http/headers/header/etag";
import IfMatchHeader from "#lib/http/headers/header/if-match";
import IfModifiedSinceHeader from "#lib/http/headers/header/if-modified-since";
import IfNoneMatchHeader from "#lib/http/headers/header/if-none-match";
import IfRangeHeader from "#lib/http/headers/header/if-range";
import IfUnmodifiedSinceHeader from "#lib/http/headers/header/if-unmodified-since";
import LastModifiedHeader from "#lib/http/headers/header/last-modified";
import LocationHeader from "#lib/http/headers/header/location";
import ProxyAuthorizationHeader from "#lib/http/headers/header/proxy-authorization";
import RangeHeader from "#lib/http/headers/header/range";
import SetCookieHeader from "#lib/http/headers/header/set-cookie";
import WwwAuthenticateHeader from "#lib/http/headers/header/www-authenticate";
import { toCamelCase } from "#lib/naming-conventions";

const CUSTOM_HEADERS = {};

export default class Headers {
    #headers = {};

    constructor ( headers ) {
        if ( headers ) {
            if ( headers instanceof this.constructor ) {
                for ( let header of headers.values() ) {
                    header = header.clone();

                    this.#headers[ header.headerName ] = header;
                }
            }
            else {
                this.add( headers );
            }
        }
    }

    // static
    static new ( headers ) {
        if ( headers instanceof this ) {
            return headers;
        }
        else {
            return new this( headers );
        }
    }

    static parse ( buffer ) {
        const headers = new this();

        if ( Buffer.isBuffer( buffer ) ) buffer = buffer.toString( "latin1" );

        for ( const header of buffer.split( "\r\n" ) ) {
            const idx = header.indexOf( ":" );

            const name = header.slice( 0, idx ).trim();
            const value = header.slice( idx + 1 ).trim();

            headers.add( name, value );
        }

        return headers;
    }

    static registerCustomHeader ( CustomHeaderClass ) {
        CUSTOM_HEADERS[ CustomHeaderClass.headerName ] = CustomHeaderClass;

        Object.defineProperty( Headers.prototype, toCamelCase( CustomHeaderClass.headerName ), {
            "configurable": false,
            "enumerable": false,
            get () {
                return this.#get( CustomHeaderClass.headerName );
            },
        } );
    }

    // public
    has ( name ) {
        return this.#headers[ name.toLowerCase() ]?.hasValue;
    }

    get ( name ) {
        return this.#headers[ name.toLowerCase() ]?.value;
    }

    set ( name, value ) {
        if ( name != null ) {
            if ( typeof name === "object" ) {
                if ( Array.isArray( name ) ) {
                    for ( let n = 0; n < name.length; n += 2 ) {
                        this.#set( name[ n ], name[ n + 1 ] );
                    }
                }
                else if ( typeof name.entries === "function" ) {
                    for ( const [ key, value ] of name.entries() ) this.#set( key, value );
                }
                else {
                    for ( const [ key, value ] of Object.entries( name ) ) this.#set( key, value );
                }
            }
            else {
                this.#set( name, value );
            }
        }

        return this;
    }

    add ( name, value ) {
        if ( name != null ) {
            if ( typeof name === "object" ) {
                if ( Array.isArray( name ) ) {
                    for ( let n = 0; n < name.length; n += 2 ) {
                        this.#add( name[ n ], name[ n + 1 ] );
                    }
                }
                else if ( typeof name.entries === "function" ) {
                    for ( const [ key, value ] of name.entries() ) this.#add( key, value );
                }
                else {
                    for ( const [ key, value ] of Object.entries( name ) ) this.#add( key, value );
                }
            }
            else {
                this.#add( name, value );
            }
        }

        return this;
    }

    delete ( name ) {
        if ( name != null ) {
            if ( typeof name === "object" ) {
                if ( Array.isArray( name ) ) {
                    for ( const key of name ) this.#delete( key );
                }
                else if ( typeof name.keys === "function" ) {
                    for ( const key of name.keys() ) this.#delete( key );
                }
                else {
                    for ( const key of Object.keys( name ) ) this.#delete( key );
                }
            }
            else {
                this.#delete( name );
            }
        }

        return this;
    }

    clear () {
        this.#headers = {};

        return this;
    }

    toString ( { crlf } = {} ) {
        const headers = [];

        for ( const [ name, value ] of this.entries() ) {
            headers.push( `${ name }: ${ value }\r\n` );
        }

        if ( crlf ) {
            headers.push( "\r\n" );
        }

        return headers.join( "" );
    }

    toJSON () {
        const headers = {};

        for ( const header of this.values() ) {
            headers[ header.headerNormalName ] = header.value;
        }

        return headers;
    }

    toBuffer ( { crlf } = {} ) {
        return Buffer.from( this.toString( { crlf } ), "latin1" );
    }

    keys () {
        return Object.keys( this.#headers ).filter( header => header.hasValue );
    }

    values () {
        return Object.values( this.#headers ).filter( header => header.hasValue );
    }

    * entries () {
        for ( const header of Object.values( this.#headers ) ) {
            if ( !header.hasValue ) continue;

            if ( Array.isArray( header.value ) ) {
                for ( const value of header.value ) {
                    yield [ header.headerNormalName, value ];
                }
            }
            else {
                yield [ header.headerNormalName, header.value ];
            }
        }
    }

    [ Symbol.iterator ] () {
        return this.entries();
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        return `${ this.constructor.name }: ${ inspect( this.toJSON() ) }`;
    }

    // private
    #get ( name, originalName ) {
        var header = this.#headers[ name ];

        if ( !header ) {
            header = new ( CUSTOM_HEADERS[ name ] || Header )( originalName );

            this.#headers[ name ] = header;
        }

        return header;
    }

    #set ( name, value ) {
        const header = this.#get( name.toLowerCase(), name );

        header.set( value );
    }

    #add ( name, value ) {
        const header = this.#get( name.toLowerCase(), name );

        header.add( value );
    }

    #delete ( name ) {
        this.#headers[ name.toLowerCase() ]?.delete();
    }
}

Headers.registerCustomHeader( AcceptEncodingHeader );
Headers.registerCustomHeader( AcceptRangesHeader );
Headers.registerCustomHeader( AuthorizationHeader );
Headers.registerCustomHeader( CacheControlHeader );
Headers.registerCustomHeader( ContentDispositionHeader );
Headers.registerCustomHeader( ContentLengthHeader );
Headers.registerCustomHeader( ContentRangeHeader );
Headers.registerCustomHeader( ContentTypeHeader );
Headers.registerCustomHeader( CookieHeader );
Headers.registerCustomHeader( DateHeader );
Headers.registerCustomHeader( EtagHeader );
Headers.registerCustomHeader( IfMatchHeader );
Headers.registerCustomHeader( IfModifiedSinceHeader );
Headers.registerCustomHeader( IfNoneMatchHeader );
Headers.registerCustomHeader( IfRangeHeader );
Headers.registerCustomHeader( IfUnmodifiedSinceHeader );
Headers.registerCustomHeader( LastModifiedHeader );
Headers.registerCustomHeader( LocationHeader );
Headers.registerCustomHeader( ProxyAuthorizationHeader );
Headers.registerCustomHeader( RangeHeader );
Headers.registerCustomHeader( SetCookieHeader );
Headers.registerCustomHeader( WwwAuthenticateHeader );
