#!/usr/bin/env node

import { deepStrictEqual } from "node:assert";
import { suite, test } from "node:test";
import Headers from "#lib/http/headers";

const TESTS = [

    // accept-encoding
    {
        "headers": {
            "accept-encoding": "br;q=0.1, deflate, gzip;q=1.0, *;q=0.5    ",
        },
        "method": headers => headers.acceptEncoding.encodings,
        "result": new Set( [ "deflate", "gzip", "*", "br" ] ),
    },

    // cookie
    {
        "headers": {
            "cookie": `a="1"; b = ccc ; c=  "1=2 3"   `,
        },
        "method": headers => headers.cookie.cookies,
        result ( res ) {
            for ( const name in res ) res[ name ] = res[ name ].value;

            deepStrictEqual(
                {
                    "a": "1",
                    "b": "ccc",
                    "c": "1=2 3",
                },
                res
            );
        },
    },

    // set-cookie
    {
        "headers": {
            "set-cookie": `name=value; expires=${ new Date( 1000 ).toUTCString() }; path=/  ; domain = .мама.google.com  ;Secure; HttpOnly; SameSite=none`,
        },
        "method": headers => headers.setCookie.cookies,
        result ( res ) {
            res = res.map( cookie => cookie.toJSON() );

            deepStrictEqual(
                [
                    {
                        "name": "name",
                        "value": "value",
                        "maxAge": undefined,
                        "expires": new Date( 1000 ),
                        "path": "/",
                        "domain": "xn--80aa8ab.google.com",
                        "secure": true,
                        "httpOnly": true,
                        "sameSite": "none",
                        "partitioned": false,
                    },
                ],
                res
            );
        },
    },

    // www-authenticate
    {
        "headers": {
            "www-authenticate": `Digest realm="Test realm, with comma",   uri    =  "/"   , qop="auth, auth-int", algorithm=SHA-256   , nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", opaque = "FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS"    `,
        },
        "method": headers => headers.wwwAuthenticate,
        result ( res ) {
            deepStrictEqual(
                {
                    "scheme": res.scheme,
                    "realm": res.realm,
                    "uri": res.uri,
                    "qop": res.qop,
                    "algorithm": res.algorithm,
                    "nonce": res.nonce,
                    "opaque": res.opaque,
                },
                {
                    "scheme": "digest",
                    "realm": "Test realm, with comma",
                    "uri": "/",
                    "qop": "auth, auth-int",
                    "algorithm": "SHA-256",
                    "nonce": "7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v",
                    "opaque": "FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS",
                }
            );
        },
    },

    // content-disposition
    {
        "headers": {
            "content-disposition": `   form-data  ;    name = file  ; filename = "тест-%22-;-.txt" ; fake1; fake2 = 234  `,
        },
        "method": headers => headers.contentDisposition,
        result ( res ) {
            return deepStrictEqual(
                {
                    "type": res.type,
                    "name": res.name,
                    "filename": res.filename,
                },
                {
                    "type": "form-data",
                    "name": "file",
                    "filename": "тест-_-;-.txt",
                }
            );
        },
    },
];

suite( "http", () => {
    suite( "headers", () => {
        for ( let n = 0; n < TESTS.length; n++ ) {
            const _test = TESTS[ n ],
                id = `${ n }`;

            test( `${ id }`, () => {
                const headers = new Headers( _test.headers );

                const res = _test.method( headers );

                // console.log( "expected:", JSON.stringify( _test.result, null, 4 ) );
                // console.log( "result:", JSON.stringify( res, null, 4 ) );

                if ( typeof _test.result === "function" ) {
                    _test.result( res );
                }
                else {
                    deepStrictEqual( res, _test.result );
                }
            } );
        }
    } );
} );
