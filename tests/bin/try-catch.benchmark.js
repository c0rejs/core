#!/usr/bin/env -S node

import benchmark from "#lib/benchmark";

function test () {
    return 1;
}

const tests = {
    [ "no try / catch" ] () {
        test();
    },

    [ "try / catch" ] () {
        try {
            test();
        }
        catch {}
    },
};

for ( let n = 0; n < 3; n++ ) {
    await benchmark( "Try / catch speed test", tests, {

        // "maxTotalTime": 5000,
    } );
}
