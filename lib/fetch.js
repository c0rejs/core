import "#lib/result";
import DataUrl from "#lib/data-url";
import Cookies from "#lib/http/cookies";
import Dispatcher from "#lib/http/dispatcher";
import Response from "#lib/http/response";
import Message from "#lib/message";
import { fetch as udinciFetch } from "#lib/undici";

const defaultUserAgent = "node";

export const globalDispatcher = new Dispatcher();

export default async function fetch ( url, { compress, browser, cookies, headersTimeout, bodyTimeout, reset, blocking, ...options } = {} ) {
    if ( typeof url === "string" ) url = new URL( url );

    // prepare dispatcher
    const dispatcher = options.dispatcher || globalDispatcher;

    // data url
    if ( url.protocol === "data:" ) {
        const dataUrl = DataUrl.new( url );

        return new Response( {
            "status": 200,
            url,
            "headers": {
                "content-type": dataUrl.type,
                "content-length": dataUrl.data.length || 0,
            },
            "body": dataUrl.data,
            "cookies": dispatcher.cookies,
        } );
    }

    const message = new Message( {
        "headers": options.headers,
        "body": options.body,
    } );

    if ( !message.headers.has( "user-agent" ) ) {
        message.headers.set( "user-agent", defaultUserAgent );
    }

    // compress
    compress ??= dispatcher.compress ?? Dispatcher.defaultConpress;

    // browser
    browser ??= dispatcher.browser;

    if ( browser === true ) {
        browser = Dispatcher.defaultBrowser;
    }

    // referrer
    if ( browser ) {
        options.referrer ??= true;
    }

    if ( options.referrer === true || options.referrer === "about:client" ) {
        options.referrer = url;
    }

    // cookies
    cookies ??= dispatcher.cookies;

    if ( cookies === true ) {
        cookies = new Cookies();
    }

    // host
    if ( message.headers.get( "host" ) ) {
        var hosts = {
            [ url.hostname ]: message.headers.get( "host" ),
        };
    }

    // prepare body
    if ( message.hasBody ) {
        options.duplex = "half";

        options.body = message.createBody();
    }

    // set headers
    options.headers = message.headers.toJSON();

    var responseStatus;

    // set dispatcher
    options.dispatcher = {
        dispatch ( options, handlers ) {
            responseStatus = null;

            const onHeaders = handlers.onHeaders;

            handlers.onHeaders = ( status, headers, resume, statusText ) => {
                responseStatus = [ status, statusText ];

                onHeaders.call( handlers, status, headers, resume, statusText );
            };

            options.headersTimeout = headersTimeout;
            options.bodyTimeout = bodyTimeout;
            options.reset = reset;
            options.blocking = blocking;

            options.compress = compress;
            options.browser = browser;
            options.cookies = cookies;
            options.hosts = hosts;

            dispatcher.dispatch( options, handlers );
        },
    };

    var res;

    try {
        res = await udinciFetch( url, options );
    }
    catch ( e ) {

        // preserve 407 status
        if ( responseStatus?.[ 0 ] === 407 ) {
            res = result( responseStatus );
        }
        else {
            res = result.catch( e.cause, { "log": false } );
        }
    }

    res.cookies = cookies;

    return new Response( res );
}

Object.defineProperties( fetch, {
    "Dispatcher": {
        "value": Dispatcher,
        "configurable": false,
        "writable": false,
    },
} );
