#!/usr/bin/env node

import { strictEqual } from "node:assert";
import path from "node:path";
import { suite, test } from "node:test";
import Browser from "#lib/browser";
import fetch from "#lib/fetch";
import FormData from "#lib/form-data";
import Headers from "#lib/http/headers";
import Server from "#lib/http/server";

const TESTS = [
    {
        "test": {
            "name": `- ;, \\" \\\\ \\z - ф - \n \r \t -`,
            "filename": `- ;," - ф - \t -`,
        },
        "result": {
            "name": `- ;, \\" \\\\ \\z - ф - \r\n \r\n \t -`,
            "filename": `- ;," - ф - \t -`,
        },
    },
];

suite( "http", () => {
    suite( "content-disposition", () => {
        suite( "browser", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "-form-data", async () => {
                    await runTest( TESTS[ n ], "browser", true );
                } );
            }
        } );

        suite( "node-fetch", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "-form-data", async () => {
                    await runTest( TESTS[ n ], "node-fetch", true );
                } );
            }
        } );

        suite( "core-fetch", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "-form-data", async () => {
                    await runTest( TESTS[ n ], "core-fetch", true );
                } );
            }

            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "-post-data", async () => {
                    await runTest( TESTS[ n ], "core-fetch", false );
                } );
            }
        } );
    } );
} );

async function runTest ( test, client, postFormData ) {
    const headers = await new Promise( resolve => getHeaders( test.test, client, postFormData, resolve ) );

    strictEqual( headers.contentDisposition.name, test.result.name );
    strictEqual( headers.contentDisposition.filename, path.basename( test.result.filename ) );
}

async function getHeaders ( header, client, postFormData, callback ) {
    var res, browser;

    const body = `
<!doctype html>
<script>
( async function () {
    const formData = new FormData();

    formData.append( \`${ header.name.replaceAll( "\\", "\\\\" ) }\`, new Blob( [ "aaa" ], {
        type: "text/plain"
    } ), \`${ header.filename.replaceAll( "\\", "\\\\" ) }\` );

    await fetch( "/", {
        method: "POST",
        body: formData
    } );
} )();
</script>
`;

    const server = new Server().any( "/*", async req => {
        if ( req.method === "POST" ) {
            let headers;

            if ( req.headers.contentType.type.startsWith( "multipart/" ) ) {
                const multipartData = await req.multipartData();

                headers = multipartData.parts[ 0 ].headers;
            }
            else {
                headers = req.headers;
            }

            await req.end();

            await server.stop();

            browser?.close();

            callback( headers );
        }
        else {
            req.end( {
                "headers": {
                    "content-type": "text/html; charset=utf-8",
                },
                body,
            } );
        }
    } );

    res = await server.start( { "address": "localhost", "port": 0 } );

    const url = new URL( `http://localhost:${ res.data.port }/` );

    if ( client === "browser" ) {
        browser = new Browser( url, {
            "incognito": true,
            "headless": true,
        } );
    }
    else if ( client === "node-fetch" ) {
        const formData = new globalThis.FormData();

        formData.append( header.name, new Blob( [ "aaa" ] ), header.filename );

        await globalThis.fetch( url, {
            "method": "POST",
            "body": formData,
            "dispatcher": new fetch.Dispatcher( {
                "pipelining": 0,
            } ),
        } );
    }
    else if ( client === "core-fetch" ) {
        let body;

        if ( postFormData ) {
            body = new FormData();

            body.append( header.name, new Blob( [ "aaa" ] ), header.filename );
        }
        else {
            body = "aaa";
        }

        const headers = new Headers( {
            "content-type": "text/plain",
            "content-disposition": {
                "type": "attachment",
                "name": header.name,
                "filename": header.filename,
            },
        } );

        await fetch( url, {
            "method": "POST",
            headers,
            body,
            "dispatcher": new fetch.Dispatcher( {
                "pipelining": 0,
            } ),
        } );
    }
}
