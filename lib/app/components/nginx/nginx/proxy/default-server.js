import path from "node:path";
import ejs from "#lib/ejs";
import NginxServerNames from "./server-names.js";

const httpConfigTemplate = await ejs.fromFile( new URL( "../../resources/server.http-default.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = await ejs.fromFile( new URL( "../../resources/server.stream-default.nginx.conf", import.meta.url ) );

export default class NginxProxyDefaultServer {
    #nginx;
    #port;
    #type;
    #useProxyProtocol;
    #useSsl;
    #serverNames;
    #configPath;

    constructor ( nginx, { port, type, useProxyProtocol, useSsl } = {} ) {
        this.#nginx = nginx;
        this.#port = this.#nginx.validatePort( port );

        // type
        if ( this.#port === 80 ) {
            this.#type = type || "http";
            useSsl ??= false;
        }
        else if ( this.#port === 443 ) {
            this.#type = type || "http";
            useSsl ??= true;
        }
        else {
            this.#type = type || "tcp";
        }

        if ( this.#type === "udp" ) {
            useSsl = false;
            useProxyProtocol = false;
        }

        this.#useSsl = Boolean( useSsl );

        this.#useProxyProtocol = Boolean( useProxyProtocol );

        this.#serverNames = new NginxServerNames( this.#nginx );
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get configPath () {
        if ( !this.#configPath ) {
            const dirname = [ this.nginx.configsDir ],
                filename = [ this.port ];

            if ( this.isHttp ) {
                dirname.push( "http-servers" );
            }
            else {
                dirname.push( "stream-servers" );
            }

            if ( this.isTcp ) {
                filename.push( "tcp" );
            }
            else if ( this.isUdp ) {
                filename.push( "udp" );
            }

            if ( this.useSsl ) filename.push( "ssl" );

            if ( this.proxy ) {
                filename.push( this.proxy.id );
            }
            else {
                filename.push( "default" );
            }

            dirname.push( filename.join( "-" ) + ".nginx.conf" );

            this.#configPath = path.join( ...dirname );
        }

        return this.#configPath;
    }

    get port () {
        return this.#port;
    }

    get type () {
        return this.#type;
    }

    get isHttp () {
        return this.#type === "http";
    }

    get isTcp () {
        return this.#type === "tcp";
    }

    get isUdp () {
        return this.#type === "udp";
    }

    get useProxyProtocol () {
        return this.#useProxyProtocol;
    }

    get useSsl () {
        return this.#useSsl;
    }

    get serverNames () {
        return this.#serverNames;
    }

    get isDefaultServer () {
        if ( this.isHttp || this.useSsl ) {
            return !this.serverNames.hasServerNames;
        }
        else {
            return true;
        }
    }

    get useQuic () {
        return this.nginx.quicEnabled && this.isHttp && this.useSsl;
    }

    get acmeLocation () {
        return Boolean( this.isHttp && this.port === 80 && !this.useSsl && this.nginx.privateHrrpServerUpstream && this.nginx.app.acme?.httpEnabled );
    }

    // public
    async generateConfig ( { localAddress } = {} ) {
        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                localAddress,
                "listen": this._buildListen( localAddress ),
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                localAddress,
                "listen": this._buildListen( localAddress ),
            } );
        }

        return config;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "port": this.port,
            "type": this.type,
            "useSsl": this.useSsl,
            "useProxyProtocol": this.useProxyProtocol,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }

    // protected
    _buildListen ( localAddress ) {
        const listen = [];

        if ( localAddress ) {
            listen.push( `"${ localAddress }"${ this.#getListenOptions( false ) }` );
        }
        else {
            if ( this.nginx.listenIpV4 ) {
                listen.push( `*:${ this.port }${ this.#getListenOptions( this.useProxyProtocol ) }` );
            }

            if ( this.nginx.listenIpV6 ) {
                listen.push( `[::]:${ this.port }${ this.#getListenOptions( this.useProxyProtocol ) }` );
            }
        }

        if ( this.useQuic ) {
            if ( this.nginx.listenIpV4 ) {
                listen.push( `*:${ this.port }${ this.#getListenOptionsQuic() }` );
            }

            if ( this.nginx.listenIpV6 ) {
                listen.push( `[::]:${ this.port }${ this.#getListenOptionsQuic() }` );
            }
        }

        return listen;
    }

    // private
    #getListenOptions ( useProxyProtocol ) {
        const options = [];

        if ( this.isUdp ) {
            options.push( "udp" );
        }
        else if ( this.isDefaultServer ) {
            options.push( "default_server" );
        }

        if ( useProxyProtocol ) {
            options.push( "proxy_protocol" );
        }

        if ( this.useSsl ) {
            options.push( "ssl" );
        }

        if ( this.isUdp ) {
            options.push( this.#nginx.config.udpListenOptions );
        }
        else if ( this.isDefaultServer ) {
            options.push( this.#nginx.config.tcpListenOptions );
        }

        return options.length
            ? " " + options.join( " " )
            : "";
    }

    #getListenOptionsQuic () {
        const options = [];

        if ( this.useQuic ) {
            if ( this.isDefaultServer ) {
                options.push( "default_server" );
            }

            options.push( "quic" );

            if ( this.isDefaultServer ) {
                options.push( this.#nginx.config.udpListenOptions );
            }
        }

        return options.length
            ? " " + options.join( " " )
            : "";
    }
}
