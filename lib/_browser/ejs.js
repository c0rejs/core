// DOCS:
// <% "Scriptlet" tag, for control-flow, no output
// <%_ "Whitespace Slurping" Scriptlet tag, strips all whitespace before it
//
// <%= Outputs the value into the template (escaped)
// <%- Outputs the unescaped value into the template
//
// %> Plain ending tag
// -%> Trim-mode ("newline slurp") tag, trims following newline
// _%> "Whitespace Slurping" ending tag, removes all whitespace after it
//
// <%# Comment tag, no execution, no output
// <%% Outputs a literal "<%"
// %%> Outputs a literal "%>"

const START_TOKENS = new Set( [ "<%", "<%-", "<%_", "<%=", "<%#" ] ),
    END_TOKENS = new Set( [ "%>", "-%>", "_%>" ] ),
    ESCAPE = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&apos;",
        '"': "&quot;",
    },
    ESCAPE_RE = new RegExp( String.raw`[${ Object.keys( ESCAPE ).join( "" ) }]`, "g" );

function stringify ( escape, value ) {
    if ( value == null ) {
        return "";
    }
    else {
        value = String( value );

        if ( value && escape ) {
            value = escape( value );
        }

        return value;
    }
}

function escapeXml ( string ) {
    return string && string.replaceAll( ESCAPE_RE, char => ESCAPE[ char ] || char );
}

function include ( path, data, { output, options } ) {
    output( `Unable to include "${ path }"` );
}

class EjsNode {
    #start;
    #end;
    #text = "";

    constructor ( token ) {
        if ( START_TOKENS.has( token ) ) {
            this.#start = token;
        }
        else if ( END_TOKENS.has( token ) ) {
            this.#end = token;
        }
        else {
            this.addText( token );
        }
    }

    // properties
    get isTag () {
        return this.#start
            ? true
            : false;
    }

    get isComment () {
        return this.#start === "<%#";
    }

    get startToken () {
        return this.#start;
    }

    get endToken () {
        return this.#end;
    }

    get text () {
        return this.#text;
    }

    // public
    addText ( text ) {
        if ( text === "<%%" || text === "%%>" ) {
            text = text.replace( "%%", "%" );
        }

        this.#text += text;
    }

    close ( text ) {
        this.#end = text;
    }

    createOutput ( previousNode, nextNode ) {
        var text = this.#text;

        if ( this.isComment ) {
            return;
        }
        else if ( this.isTag ) {
            text = text.trim();

            if ( !text ) return;

            // escaped text tag
            if ( this.#start === "<%=" ) {
                return `__output += __options.stringify( __options.escape, ${ text } );`;
            }

            // text tag
            else if ( this.#start === "<%-" ) {
                return `__output += __options.stringify( null, ${ text } );`;
            }

            // code tag
            else if ( this.#start === "<%" || this.#start === "<%_" ) {
                return text;
            }
        }
        else {

            // remove single newline at the start
            if ( previousNode?.endToken === "-%>" ) {
                text = text.replace( /^(?:\r\n|\r|\n)/, "" );
            }

            // remove all whitespaces and single new line at the start
            else if ( previousNode?.endToken === "_%>" ) {
                text = text.replace( /^[\t ]*(?:\r\n|\r|\n)?/, "" );
            }

            // remove all whitespace at the end
            if ( nextNode?.startToken === "<%_" ) {
                text = text.replace( /[\t ]+$/, "" );
            }
            else if ( nextNode?.isComment ) {
                text = text.replace( /(?:\r\n|\r|\n)[\t ]*$/, "" );
            }

            if ( text ) {
                return `__output += ${ JSON.stringify( text ) };`;
            }
        }
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {};

        if ( this.isTag ) {
            spec.startToken = this.#start;
            spec.endToken = this.#end;
        }

        if ( this.#text ) {
            spec.text = this.#text;
        }

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}

export class Ejs {
    #code;
    #renderer;

    constructor ( template, { async, context, escape } = {} ) {
        if ( escape === undefined ) escape = escapeXml;

        this.#code = this.#compile( template );

        const body = `
with ( __options.data || {} ) {
    return ( ${ async
        ? "async "
        : "" }function () {
        "use strict";

        var __output = "",
            include = ( path, data ) => __options.include( path, data, {
                options: __options,
                output ( text ) {
                    __output += text;
                }
            } );


${ this.#code }

        return __output;
    } ).call( __options.context );
}
`.trim();

        const renderer = new Function( "__options", body );

        this.#renderer = data =>
            renderer( {
                data,
                context,
                escape,
                stringify,
                include,
            } );
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
    #compile ( template ) {
        const nodes = [];

        var node;

        for ( const token of template.split( /(<%[#%=_-]?|[%_-]?%>)/ ) ) {
            if ( !token ) {
                continue;
            }

            // start tag
            else if ( START_TOKENS.has( token ) ) {
                if ( node ) {
                    if ( node.isComment ) {
                        node.addText( token );

                        continue;
                    }
                    else if ( node.isTag ) {
                        throw new Error( "EJS nested tags are not allowed" );
                    }
                }

                node = this.#createNode( nodes, token );
            }

            // end tag
            else if ( END_TOKENS.has( token ) ) {
                if ( node?.isTag ) {
                    node.close( token );

                    node = null;
                }
                else {
                    throw new Error( "EJS tag not opened" );
                }
            }

            // text
            else {
                if ( node ) {
                    node.addText( token );
                }
                else {
                    node = this.#createNode( nodes, token );
                }
            }
        }

        if ( node?.isTag ) {
            throw new Error( "EJS tag not closed" );
        }

        const lines = [];

        for ( let n = 0; n < nodes.length; n++ ) {
            const line = nodes[ n ].createOutput( nodes[ n - 1 ], nodes[ n + 1 ] );

            if ( line ) {
                lines.push( line );
            }
        }

        return lines.join( "\n" );
    }

    #createNode ( nodes, token ) {
        const node = new EjsNode( token );

        nodes.push( node );

        return node;
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
