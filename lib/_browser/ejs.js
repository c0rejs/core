const RE = /(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)/g,
    ESCAPE_RE = /["&'<>]/g,
    BREAK_RE = /^(\r\n|\r|\n)/,
    W_LEFT_RE = /^[\t ]+(\r\n|\r|\n)/,
    W_RIGHT_RE = /[\t ]+$/,
    INCLUDE_RE = /include\(\s*(["'])(.+?)\1\s*(,\s*({.+?})\s*)?\)/g,
    ESCAPE = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&apos;",
        '"': "&quot;",
    },
    DEFAULT_OPTIONS = {
        "escape": escapeXml,
        "localsName": "locals",
        "resolve": ( parent, path ) => path,
    },
    AsyncFunction = new Function( "return ( async () => {} ).constructor" )();

function stringify ( v ) {
    return v == null
        ? ""
        : String( v );
}

function escapeXml ( xml ) {
    return xml && xml.replaceAll( ESCAPE_RE, escapeChar );
}

function escapeChar ( char ) {
    return ESCAPE[ char ] || char;
}

export class Ejs {
    #code;
    #renderer;

    constructor ( template, options = {} ) {
        options = {
            "cache": {},
            ...DEFAULT_OPTIONS,
            ...options,
        };

        const { escape, localsName, context, filename, async } = options;

        this.#code = `"use strict"; ${ this.#compilePart( template, filename, options ) }`;

        const fn = new ( async
            ? AsyncFunction
            : Function )( localsName, "_esc", "_str", this.#code );

        this.#renderer = data => fn.call( context, data || null, escape, stringify );
    }

    // static
    static new ( template, options ) {
        if ( template instanceof this ) {
            return template;
        }
        else {
            return new this( template, options );
        }
    }

    // properties
    get code () {
        return this.#code;
    }

    // public
    render ( data ) {
        return this.#renderer( data );
    }

    // private
    #compilePart ( template, filename, options ) {
        const { locals, localsName } = options;

        let code = locals && locals.length
            ? `const {${ locals.join( ", " ) }} = ${ localsName }; `
            : "";

        code += "let _out = `";

        const originalLastIndex = RE.lastIndex;

        let lastIndex = ( RE.lastIndex = 0 ),
            match,
            prev,
            open;

        do {
            match = RE.exec( template );

            const token = match && match[ 0 ];

            if ( prev !== "<%#" ) {
                let str = template.slice( lastIndex, match
                    ? match.index
                    : undefined );

                // text
                if ( !open ) {
                    if ( token === "<%_" ) str = str.replace( W_RIGHT_RE, "" );

                    if ( prev === "_%>" ) {
                        str = str.replace( W_LEFT_RE, "" );
                    }
                    else if ( prev === "-%>" ) {
                        str = str.replace( BREAK_RE, "" );
                    }

                    code += str.replaceAll( "\\", "\\\\" ).replaceAll( "\r", "\\r" ).replaceAll( "`", "\\`" ).replaceAll( "${", "\\${" );
                }

                // code
                else {
                    code += this.#compileIncludes( str, filename, options );
                }
            }

            if ( !token || ( token[ 0 ] === "<" && token[ 2 ] !== "%" ) ) {
                if ( open ) throw new Error( `Could not find matching close tag for ${ open }.` );
                open = token;
            }

            switch ( token ) {
                case "%>":
                case "_%>":
                case "-%>":
                    code += prev === "<%=" || prev === "<%-"
                        ? "\n)) + `"
                        : prev === "<%" || prev === "<%_"
                            ? "\n_out += `"
                            : prev === "<%#"
                                ? ""
                                : token;
                    open = null;
                    break;
                case "<%":
                case "<%_":
                    code += "`;";
                    break;
                case "<%=":
                    code += "` + _esc(_str(";
                    break;
                case "<%-":
                    code += "` + _str((";
                    break;
                case "<%%":
                    code += "<%";
                    break;
                case "%%>":
                    code += "%>";
            }

            prev = token;
            lastIndex = RE.lastIndex;
        } while ( match );

        code += "`; return _out;";
        RE.lastIndex = originalLastIndex;

        return code;
    }

    #compileIncludes ( js, filename, options ) {
        const { read, resolve, cache, localsName } = options;

        let code = "";

        const originalLastIndex = INCLUDE_RE.lastIndex;

        let lastIndex = ( INCLUDE_RE.lastIndex = 0 ),
            match;

        while ( ( match = INCLUDE_RE.exec( js ) ) !== null ) {
            const includePath = match[ 2 ],
                includeData = match[ 4 ];

            if ( !read ) throw new Error( `Found an include but read option missing: ${ includePath }` );

            const before = js.slice( lastIndex, match.index );
            const key = resolve( filename, includePath );
            const includeCode = ( cache[ key ] = cache[ key ] || this.#compilePart( read( key ), key, options ) );
            const includeLocals = includeData
                ? `Object.assign( Object.create( ${ localsName } ), ${ includeData } )`
                : "";

            code += `${ before }( ( ${ includeLocals
                ? localsName
                : "" } ) => { ${ includeCode } } )( ${ includeLocals } )`;

            lastIndex = INCLUDE_RE.lastIndex;
        }

        code += js.slice( lastIndex );

        INCLUDE_RE.lastIndex = originalLastIndex;

        return code;
    }
}

export default function ejs ( template, options ) {
    return Ejs.new( template, options );
}

Object.defineProperties( ejs, {
    "isEjs": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( value ) {
            return value instanceof Ejs;
        },
    },
} );
