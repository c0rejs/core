#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Browser from "#lib/browser";
import fetch from "#lib/fetch";
import Cookie from "#lib/http/cookie";
import Server from "#lib/http/server";

suite( "http", () => {
    suite( "cookies", () => {
        const TESTS = [
            {
                "name": "a",
                "value": "b",
                "path": "/",
            },
            {
                "name": "test1",
                "value": ` test- \x04-;",\\ мама`,
            },
            {
                "name": "test",
            },
            {
                "value": "test",
            },
            {
                "name": "test яяя ;,=",
                "value": "test value ййй ;,=",
                "path": "/aaa/мама;,=/",
            },
        ];

        suite( "browser", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "", async () => {
                    await testCookies( TESTS[ n ], true );
                } );
            }
        } );

        suite( "fetch", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "", async () => {
                    await testCookies( TESTS[ n ], false );
                } );
            }
        } );
    } );
} );

async function testCookies ( cookie, useBrowser ) {
    cookie = Cookie.new( cookie );

    const headers = await new Promise( resolve => getHeaders( cookie, useBrowser, resolve ) );

    strictEqual( headers.cookie.cookies?.[ cookie.name ]?.value, cookie.value );
}

async function getHeaders ( cookie, useBrowser, callback ) {
    var res, browser;

    const server = new Server().get( "/*", async req => {
        if ( req.url.searchParams?.has( "done" ) ) {
            await req.end();

            await server.stop();

            browser?.close();

            callback( req.headers );
        }
        else {
            await req.end( {
                "status": 307,
                "headers": {
                    "location": {
                        "url": req.path + "?done",
                    },
                    "set-cookie": cookie,
                },
            } );
        }
    } );

    res = await server.start( { "address": "localhost", "port": 0 } );

    const url = new URL( `http://localhost:${ res.data.port }/` );

    if ( cookie.path ) url.pathname = cookie.path;

    if ( useBrowser ) {
        browser = new Browser( url, {
            "incognito": true,
            "headless": true,
        } );
    }
    else {
        res = await fetch( url, {
            "cookies": true,
            "redirect": "follow",
            "dispatcher": new fetch.Dispatcher( {
                "pipelining": 0,
            } ),
        } );
    }
}
