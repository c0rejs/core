#!/usr/bin/env -S node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Numeric from "#lib/numeric";

suite( "numeric", () => {
    suite( "precision", () => {
        const tests = [

            // scale = 0
            {
                "test": () => Numeric( "123", { "precision": 3 } ),
                "result": "123",
            },
            {
                "test": () => Numeric( "123.456", { "precision": 3 } ),
                "result": "123",
            },
            {
                "test": () => Numeric( "123.999", { "precision": 3 } ),
                "result": "124",
            },
            {
                "test": () => Numeric( "999.999", { "precision": 3 } ),
                "result": null,
            },
            {
                "test": () => Numeric( "123.456", { "precision": 2 } ),
                "result": null,
            },

            // operations
            {
                "test": () => Numeric( 1 ).divide( "3".repeat( 10 ) ).multiply( "3".repeat( 10 ) ),
                "result": "1",
            },
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                try {
                    const numeric = tests[ n ].test();

                    strictEqual( numeric.toString(), tests[ n ].result );
                }
                catch ( e ) {
                    if ( tests[ n ].result != null ) {
                        throw e;
                    }
                }
            } );
        }
    } );
} );
