const WORD_BREAKING_CHARS = new Set( [ " ", "\n" ] ),
    SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = "";
    #ansiCodeStarted;
    #word = [];
    #wordVisibleLength = 0;
    #line = "";
    #lineVisibleLength = 0;
    #ansiCode = [];
    #ansiStyle = "";

    constructor ( maxLength, { trim, wordWrap } = {} ) {
        this.#maxLength = maxLength;
        this.#trim = trim;
        this.#wordWrap = wordWrap;
    }

    // public
    wrap ( string ) {
        const segments = SEGMENTER.segment( string );

        for ( const { "segment": char } of segments ) {
            if ( this.#ansiCodeStarted ) {
                this.#continueAnsiCode( char );
            }
            else if ( char === "\x1B" || char === "\u009B" ) {
                this.#startAnsiCode( char );
            }
            else {
                this.#addChar( char );
            }
        }

        this.#endAnsiCode();
        this.#endWord();

        return this.#output;
    }

    // private
    #startAnsiCode ( char ) {
        this.#ansiCode.push( char );

        this.#ansiCodeStarted = true;
    }

    #continueAnsiCode ( char ) {
        this.#ansiCode.push( char );

        const codePoint = char.codePointAt( 0 );

        if ( char === "[" && this.#ansiCode.length === 2 && this.#ansiCode[ 0 ] === "\x1B" ) {
            return;
        }

        // escape sequence parameter
        else if ( ( codePoint >= 0x30 && codePoint <= 0x3F ) || ( codePoint >= 0x20 && codePoint <= 0x2F ) ) {
            return;
        }

        // end of the escape sequence
        else if ( codePoint >= 0x40 && codePoint <= 0x7E ) {
            this.#endAnsiCode( true );
        }

        // invalid escape sequence
        else {
            this.#endAnsiCode();
        }
    }

    #endAnsiCode ( valid ) {
        if ( valid ) {

            // style
            if ( this.#ansiCode.at( -1 ) === "m" ) {
                const style = this.#ansiCode.join( "" );

                this.#word.push( style );
                this.#ansiStyle += style;
            }
        }
        else {
            for ( const char of this.#ansiCode ) this.addChar( char );
        }

        this.#ansiCodeStarted = false;
        this.#ansiCode = [];
    }

    #addChar ( char ) {

        // replace tab with the single space
        if ( char === "\t" ) char = " ";

        // new word
        if ( WORD_BREAKING_CHARS.has( char ) ) {
            this.#endWord( char );
        }
        else {
            const codePoint = char.codePointAt( 0 );

            // ignore control characters
            if ( codePoint <= 0x1F || ( codePoint >= 0x7F && codePoint <= 0x9F ) ) return;

            this.#word.push( char );
            this.#wordVisibleLength += char.length;
        }
    }

    #endWord ( char ) {

        // add whole word
        if ( this.#wordWrap && this.#wordVisibleLength <= this.#maxLength ) {

            // can not add whole word to the current line
            if ( this.#lineVisibleLength + this.#wordVisibleLength > this.#maxLength ) {

                // new line
                this.#endLine( "\n" ).#startLine();
            }

            this.#line += this.#word.join( "" );
            this.#lineVisibleLength += this.#wordVisibleLength;
        }

        // add word char-by-char
        else {
            let wordAnsi = "";

            for ( let n = 0; n < this.#word.length; n++ ) {
                const wordChar = this.#word[ n ];

                // ansi code
                if ( wordChar[ 0 ] === "\x1B" || wordChar[ 0 ] === "\u009B" ) {
                    wordAnsi += wordChar;
                    this.#line += wordChar;
                }
                else {

                    // can not add char to the current line
                    if ( this.#lineVisibleLength + wordChar.length > this.#maxLength ) {

                        // new line
                        this.#endLine( "\n" ).#startLine( wordAnsi );
                    }

                    this.#line += wordChar;
                    this.#lineVisibleLength += wordChar.length;
                }
            }
        }

        this.#word = [];
        this.#wordVisibleLength = 0;

        // EOF / EOL
        if ( !char || char === "\n" ) {
            this.#endLine( char );
        }

        // end of the word
        else if ( char === " " ) {
            const eol = this.#lineVisibleLength >= this.#maxLength;

            if ( !eol || !this.#trim ) {

                // need to start new line
                if ( eol ) {
                    this.#endLine( "\n" ).#startLine();
                }

                this.#line += char;
                this.#lineVisibleLength += char.length;
            }
        }
    }

    #startLine ( wordAnsi ) {
        if ( this.#line.length === 0 ) this.#line += this.#ansiStyle + ( wordAnsi ?? "" );

        return this;
    }

    #endLine ( char ) {
        this.#output += this.#line;

        // reset ansi styles at line end
        if ( this.#line && this.#ansiStyle ) this.#output += "\x1B[0m";

        if ( char ) this.#output += char;

        this.#line = "";
        this.#lineVisibleLength = 0;

        return this;
    }
}

export default function wrap ( string, maxLength, { trim, wordWrap } = {} ) {
    const wrap = new Wrap( maxLength, { trim, wordWrap } );

    return wrap.wrap( string );
}
