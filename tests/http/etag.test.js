#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Browser from "#lib/browser";
import Server from "#lib/http/server";

const TESTS = [
    { "etag": "a", "result": "a" },
    { "etag": { "etag": "a" }, "result": '"a"' },
    { "etag": { "etag": "a", "weak": true }, "result": 'W/"a"' },
    { "etag": `"aaa-\\",;\t-мама"`, "result": Buffer.from( `"aaa-\\",;\t-мама"` ).toString( "latin1" ) },
];

suite( "http", () => {
    suite( "etag", () => {
        suite( "browser", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "-form-data", async () => {
                    await runTest( TESTS[ n ] );
                } );
            }
        } );
    } );
} );

async function runTest ( test ) {
    const headers = await new Promise( resolve => getHeaders( test.etag, resolve ) );

    strictEqual( [ ...headers.ifNoneMatch.etags ][ 0 ], test.result );
}

async function getHeaders ( etag, callback ) {
    var res, browser;

    const body = `
<!doctype html>
<script>
( async function () {
    await fetch( "/" );
} )();
</script>
`;

    const server = new Server().any( "/*", async req => {
        if ( req.headers.has( "referer" ) ) {
            await req.end();

            await server.stop();

            browser?.close();

            callback( req.headers );
        }
        else {
            req.end( {
                "headers": {
                    "content-type": "text/html; charset=utf-8",
                    "cache-control": {
                        "public": true,
                        "private": true,
                        "must-revalidate": true,
                    },
                    etag,
                },
                body,
            } );
        }
    } );

    res = await server.start( { "address": "localhost", "port": 0 } );

    const url = new URL( `http://localhost:${ res.data.port }/` );

    browser = new Browser( url, {
        "incognito": true,
        "headless": true,
    } );
}
