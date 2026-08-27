import crypto from "node:crypto";
import CacheLru from "#lib/cache/lru";
import fetch from "#lib/fetch";

const CACHE = new CacheLru( { "maxSize": 1024 } );

export default class PwnedPasswords {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    async test ( password ) {
        const hash = crypto
            .hash( "SHA1", password, {
                "outputEncoding": "hex",
            } )
            .toUpperCase();

        let pwned = CACHE.get( hash );

        if ( pwned != null ) {
            return result( 200, {
                pwned,
            } );
        }

        const head = hash.slice( 0, 5 ),
            res = await fetch( `https://api.pwnedpasswords.com/range/${ head }`, {
                "headers": {
                    "hibp-api-key": this.#apiKey,
                },
            } );

        if ( !res.ok ) return result( res );

        const tail = hash.slice( 5 ),
            data = await res.text();

        for ( const line of data.split( "\r\n" ) ) {
            if ( line.startsWith( tail ) ) {
                pwned = Number( line.slice( 36 ) );

                CACHE.set( hash, pwned );

                return result( 200, {
                    pwned,
                } );
            }
        }

        return result( 200, {
            "pwned": 0,
        } );
    }
}
