import fs from "node:fs";
import path from "node:path";
import ejs from "#lib/ejs";
import Hostname from "#lib/hostname";
import NginxProxyDefaultServer from "./proxy/default-server.js";

const reouterConfigTemplate = await ejs.fromFile( new URL( "../resources/server.stream-router.nginx.conf", import.meta.url ) );

export default class NginxConfig {
    #nginx;
    #useLocalSocket;
    #localAddress;
    #localAddressPort;

    constructor ( nginx ) {
        this.#nginx = nginx;

        if ( this.#nginx.config.localAddress === "unix:" ) {
            this.#useLocalSocket = true;
        }
        else {
            this.#useLocalSocket = false;

            const url = new URL( "tcp://" + this.#nginx.config.localAddress );

            this.#localAddress = url.hostname;
            this.#localAddressPort = +url.port;
        }
    }

    // properties
    get app () {
        return this.#nginx.app;
    }

    get nginx () {
        return this.#nginx;
    }

    // public
    async generate () {
        var servers = [];

        // get servers
        for ( const proxy of this.nginx.proxies ) {

            // proxy has no upstreams
            if ( !proxy.upstreams.hasUpstreams ) continue;

            servers.push( ...proxy.servers );
        }

        const conflicts = {
            "useProxyProtocol": {},
            "udp": {},
        };

        if ( this.app.acme?.httpEnabled ) {
            conflicts.useProxyProtocol[ "80" ] = false;
        }

        // check conflicts
        servers = servers.sort( this.#compareServers.bind( this ) ).filter( server => {

            // check proxy protocol conflicts
            if ( !server.isUdp ) {
                if ( conflicts.useProxyProtocol[ server.port ] == null ) {
                    conflicts.useProxyProtocol[ server.port ] = server.useProxyProtocol;
                }
                else if ( conflicts.useProxyProtocol[ server.port ] !== server.useProxyProtocol ) {
                    console.warn( `[nginx] conflict on port "${ server.port }". Proxy protocol conflict.` );

                    return false;
                }
            }

            // check udp conflicts
            if ( server.useQuic || server.isUdp ) {
                conflicts.udp[ server.port ] ??= {
                    "quic": 0,
                    "udp": 0,
                };

                if ( server.useQuic ) {
                    conflicts.udp[ server.port ].quic++;
                }
                else if ( server.isUdp ) {
                    if ( conflicts.udp[ server.port ].quic || conflicts.udp[ server.port ].udp ) {
                        console.warn( `[nginx] conflict on port "${ server.port }". UDP port conflict.` );

                        return false;
                    }
                    else {
                        conflicts.udp[ server.port ].udp++;
                    }
                }
            }

            return true;
        } );

        const groups = {},
            ports = {};

        // add ACME http server
        if ( this.app.acme?.httpEnabled ) {
            const id = "80/http/false";

            groups[ id ] = {
                id,
                "port": 80,
                "type": "http",
                "useProxyProtocol": false,
                "useSsl": false,
                "serverNames": new Map(),
                "localAddress": null,
            };
        }

        // group servers by port configuration
        for ( const server of servers ) {
            const id = `${ server.port }/${ server.type }/${ server.useSsl }`;

            // init group
            groups[ id ] ??= {
                id,
                "port": server.port,
                "type": server.type,
                "useProxyProtocol": server.useProxyProtocol,
                "useSsl": server.useSsl,
                "serverNames": new Map(),
                "localAddress": null,
            };

            const group = groups[ id ];

            // add server
            if ( server.isDefaultServer ) {

                // group already has default server
                if ( group.serverNames.has( "" ) ) continue;

                group.serverNames.set( "", {
                    "serverName": this.nginx.defaultServerName,
                    server,
                } );
            }
            else {
                for ( const serverName of server.serverNames ) {

                    // group already has server name
                    if ( group.serverNames.has( serverName.name ) ) continue;

                    group.serverNames.set( serverName.name, {
                        serverName,
                        server,
                    } );
                }
            }
        }

        // add group default servers for "http" and "ssl" groups
        for ( const group of Object.values( groups ) ) {

            // group already has default server
            if ( group.serverNames.has( "" ) ) continue;

            if ( group.type === "http" || group.useSsl ) {

                // create default server
                group.serverNames.set( "", {
                    "serverName": this.nginx.defaultServerName,
                    "server": new NginxProxyDefaultServer( this.nginx, {
                        "port": group.port,
                        "type": group.type,
                        "useProxyProtocol": group.useProxyProtocol,
                        "useSsl": group.useSsl,
                    } ),
                } );
            }
        }

        // create ports
        for ( const group of Object.values( groups ) ) {
            const portId = group.port + "/" + ( group.type === "udp"
                ? "udp"
                : "tcp" );

            // init port
            ports[ portId ] ??= {
                "port": group.port,
                "groups": new Set(),
                "defaultNonSslGroup": null,
                "defaultSslGroup": null,
                "useProxyProtocol": group.useProxyProtocol,
            };

            const port = ports[ portId ];

            // "ssl" group
            if ( group.useSsl ) {
                if ( group.serverNames.has( "" ) ) {
                    port.defaultSslGroup ??= group;
                }
            }

            // non-ssl group
            else {

                // port can contain only 1 non-ssl servers group
                if ( port.defaultNonSslGroup ) {
                    console.warn( `[nginx] conflict on port "${ group.port }:${ group.port }". Non-ssl services can not be mixed on the same port` );

                    continue;
                }
                else {
                    port.defaultNonSslGroup = group;
                }
            }

            port.groups.add( group );
        }

        // create routers
        for ( const port of Object.values( ports ) ) {

            // use router if port server groups size > 1
            if ( port.groups.size <= 1 ) continue;

            const listen = [];

            if ( this.nginx.listenIpV4 ) {
                listen.push( `*:${ port.port } default_server ${ port.useProxyProtocol
                    ? "proxy_protocol "
                    : "" }${ this.#nginx.config.tcpListenOptions }` );
            }

            if ( this.nginx.listenIpV6 ) {
                listen.push( `[::]:${ port.port } default_server ${ port.useProxyProtocol
                    ? "proxy_protocol "
                    : "" }${ this.#nginx.config.tcpListenOptions }` );
            }

            const router = {
                "port": port.port,
                "defaultNonSslLocalAddress": null,
                "defaultSslLocalAddress": null,
                "serverNames": new Map(),
                listen,
            };

            port.router = router;

            for ( const group of port.groups ) {
                group.localAddress = this.#createGroupLocalAddress( group );

                if ( !group.useSsl ) continue;

                for ( const serverName of [ ...group.serverNames.keys() ].sort( this.#compareServerNames.bind( this ) ) ) {

                    // ignore default servers
                    if ( !serverName ) continue;

                    if ( router.serverNames.has( serverName ) ) continue;

                    router.serverNames.set( serverName, group.localAddress );
                }
            }

            router.defaultNonSslLocalAddress = port.defaultNonSslGroup?.localAddress;
            router.defaultSslLocalAddress = port.defaultSslGroup?.localAddress;
        }

        for ( const port of Object.values( ports ) ) {

            // generate servers
            for ( const group of port.groups ) {
                const servers = new Map();

                for ( const { serverName, server } of group.serverNames.values() ) {
                    let serverNames = servers.get( server );

                    if ( !serverNames ) {
                        serverNames = [];

                        servers.set( server, serverNames );
                    }

                    serverNames.push( serverName );
                }

                const configsPaths = {},
                    promises = [];

                for ( const [ server, serverNames ] of servers.entries() ) {
                    promises.push( server
                        .generateConfig( {
                            serverNames,
                            "localAddress": group.localAddress,
                        } )
                        .then( config => {
                            configsPaths[ server.configPath ] ??= [];

                            configsPaths[ server.configPath ].push( config );

                            return config;
                        } ) );
                }

                await Promise.all( promises );

                for ( const [ configPath, configs ] of Object.entries( configsPaths ) ) {
                    await fs.promises.mkdir( path.dirname( configPath ), { "recursive": true } );

                    await fs.promises.writeFile( configPath, configs.join( "\n" ) );
                }
            }

            // generate upstreams
            const proxies = new Map();

            for ( const group of port.groups ) {
                for ( const { server } of group.serverNames.values() ) {
                    if ( !server.proxy ) continue;

                    if ( !proxies.has( server.proxy ) ) {
                        proxies.set( server.proxy, {
                            "hasHttpServers": false,
                            "hasStreamServers": false,
                        } );
                    }

                    if ( server.isHttp ) {
                        proxies.get( server.proxy ).hasHttpServers = true;
                    }
                    else {
                        proxies.get( server.proxy ).hasStreamServers = true;
                    }
                }
            }

            for ( const [ proxy, options ] of proxies.entries() ) {
                proxy.writeConfig( options );
            }

            // generate routers
            if ( port.router ) {
                const config = reouterConfigTemplate.render( {
                    "nginx": this.nginx,
                    "router": port.router,
                } );

                await fs.promises.mkdir( this.nginx.configsDir + "/stream-servers", { "recursive": true } );

                await fs.promises.writeFile( this.nginx.configsDir + `/stream-servers/${ port.port }-router.nginx.conf`, config );
            }
        }
    }

    // private
    #createGroupLocalAddress ( group ) {
        const port = this.#localAddressPort++;

        if ( this.#useLocalSocket ) {
            return "unix:" + this.#nginx.app.env.unixSocketsDir + `/nginx-${ port }.socket`;
        }
        else {
            return this.#localAddress + ":" + port;
        }
    }

    #getServerWeight ( server ) {
        var weight = 0;

        if ( server.isHttp ) {
            weight = 10;
        }
        else if ( server.isTcp ) {
            weight = 20;
        }
        else if ( server.isUdp ) {
            weight = 30;
        }

        if ( server.useProxyProtocol ) {
            weight += 5;
        }

        return weight;
    }

    #compareServers ( a, b ) {
        return this.#getServerWeight( a ) - this.#getServerWeight( b );
    }

    #compareServerNames ( a, b ) {
        return Hostname.compare( a.replaceAll( "*", "z" ), b.replaceAll( "*", "z" ) );
    }
}
