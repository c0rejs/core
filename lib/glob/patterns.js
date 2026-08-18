import GlobPattern from "./pattern.js";

export default class GlobPatterns {
    #strict;
    #caseSensitive;
    #allowNegatedPatterns;
    #allowBraces;
    #allowGlob;
    #allowBrackets;
    #allowGlobstar;
    #allowExtglob;
    #allowGlobalBasename;
    #allowIfListEmpty;
    #ignoreNegatedPatterns;
    #patterns = new Map();
    #maxDepth;
    #hasAllowedPatterns;
    #hasDeniedPatterns;
    #hasMatchAllPattern;
    #hasMatchNonePattern;
    #allowedRegexp;
    #deniedRegexp;

    constructor ( { strict = true, caseSensitive = true, allowNegatedPatterns = true, allowBraces = true, allowGlob = true, allowBrackets = true, allowGlobstar = true, allowExtglob = true, allowGlobalBasename, allowIfListEmpty, ignoreNegatedPatterns } = {} ) {
        this.#strict = Boolean( strict );
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegatedPatterns = Boolean( allowNegatedPatterns );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowGlob = Boolean( allowGlob );
        this.#allowBrackets = Boolean( allowBrackets );
        this.#allowGlobstar = Boolean( allowGlobstar );
        this.#allowExtglob = Boolean( allowExtglob );
        this.#allowGlobalBasename = Boolean( allowGlobalBasename );
        this.#allowIfListEmpty = Boolean( allowIfListEmpty );
        this.#ignoreNegatedPatterns = Boolean( ignoreNegatedPatterns );
    }

    // properties
    get isStrict () {
        return this.#strict;
    }

    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get allowNegatedPatterns () {
        return this.#allowNegatedPatterns;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowGlob () {
        return this.#allowGlob;
    }

    get allowBrackets () {
        return this.#allowBrackets;
    }

    get allowGlobstar () {
        return this.#allowGlobstar;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get allowGlobalBasename () {
        return this.#allowGlobalBasename;
    }

    get allowIfListEmpty () {
        return this.#allowIfListEmpty;
    }

    get ignoreNegatedPatterns () {
        return this.#ignoreNegatedPatterns;
    }

    get maxDepth () {
        if ( this.#maxDepth == null ) {
            this.#build();
        }

        return this.#maxDepth;
    }

    get hasPatterns () {
        return Boolean( this.#patterns.size );
    }

    get hasAllowedPatterns () {
        if ( this.#hasAllowedPatterns == null ) {
            this.#build();
        }

        return this.#hasAllowedPatterns;
    }

    get hasDeniedPatterns () {
        if ( this.#hasDeniedPatterns == null ) {
            this.#build();
        }

        return this.#hasDeniedPatterns;
    }

    get hasMatchAllPattern () {
        if ( this.#hasMatchAllPattern == null ) {
            this.#build();
        }

        return this.#hasMatchAllPattern;
    }

    get hasMatchNonePattern () {
        if ( this.#hasMatchNonePattern == null ) {
            this.#build();
        }

        return this.#hasMatchNonePattern;
    }

    get allowedRegexp () {
        if ( this.#allowedRegexp == null ) {
            this.#build();
        }

        return this.#allowedRegexp;
    }

    get deniedRegexp () {
        if ( this.#deniedRegexp == null ) {
            this.#build();
        }

        return this.#deniedRegexp;
    }

    // public
    has ( pattern, globPatternOptions ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, globPatternOptions );

        return this.#patterns.has( pattern.id );
    }

    add ( patterns, globPatternOptions ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, globPatternOptions );

            if ( pattern.isNegated && this.#ignoreNegatedPatterns ) continue;

            // move pattern
            if ( this.#patterns.has( pattern.id ) ) {
                this.#patterns.delete( pattern.id );
                this.#patterns.set( pattern.id, pattern );
            }

            // add pattern
            else {
                this.#patterns.set( pattern.id, pattern );

                this.#clear();
            }
        }

        return this;
    }

    set ( patterns, globPatternOptions ) {
        return this.clear().add( patterns, globPatternOptions );
    }

    delete ( patterns, globPatternOptions ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, globPatternOptions );

            // pattern exists
            if ( this.#patterns.delete( pattern.id ) ) {
                this.#clear();
            }
        }

        return this;
    }

    clear () {
        this.#patterns.clear();

        this.#clear();

        return this;
    }

    test ( testPath, { prefix, normalize, listMode } = {} ) {
        let allow = false;

        const isArray = Array.isArray( testPath );

        if ( prefix || normalize ) {
            if ( isArray ) {
                testPath = testPath.map( path => GlobPattern.normalizePath( path, { prefix, normalize } ) );
            }
            else {
                testPath = GlobPattern.normalizePath( testPath, { prefix, normalize } );
            }
        }

        // no string
        if ( isArray ) {
            testPath = testPath.filter( path => path );

            if ( !testPath.length ) return false;
        }
        else if ( !testPath ) {
            return false;
        }

        this.#build();

        // list mode
        TEST: if ( listMode ) {

            // allow by default
            if ( !this.#hasAllowedPatterns && this.#allowIfListEmpty ) {
                allow = true;
            }

            if ( allow && !this.#hasDeniedPatterns ) {
                break TEST;
            }
            else if ( !allow && !this.#hasAllowedPatterns ) {
                break TEST;
            }

            for ( const pattern of this.#patterns.values() ) {
                let match;

                if ( isArray ) {
                    for ( const item of testPath ) {
                        match = pattern.test( item );

                        if ( match ) break;
                    }
                }
                else {
                    match = pattern.test( testPath );
                }

                if ( match ) {
                    if ( pattern.isNegated ) {
                        allow = false;

                        if ( !this.#hasAllowedPatterns ) break TEST;
                    }
                    else {
                        allow = true;

                        if ( !this.#hasDeniedPatterns ) break TEST;
                    }
                }
            }
        }

        // whitelist mode
        else {

            // deny all
            if ( this.#hasMatchNonePattern ) {
                allow = false;
            }

            // allow all
            else if ( this.#hasMatchAllPattern ) {
                allow = true;
            }

            // test allowed
            else if ( this.#hasAllowedPatterns ) {
                if ( isArray ) {
                    for ( const item of testPath ) {
                        allow = this.#allowedRegexp.test( item );

                        if ( allow ) break;
                    }
                }
                else {
                    allow = this.#allowedRegexp.test( testPath );
                }
            }

            // allow by default
            else if ( this.#allowIfListEmpty ) {
                allow = true;
            }

            // deny by default
            else {
                allow = false;
            }

            if ( !allow ) return allow;

            // test denied
            if ( this.#hasDeniedPatterns ) {
                if ( isArray ) {
                    for ( const item of testPath ) {
                        allow = !this.#deniedRegexp.test( item );

                        if ( !allow ) break;
                    }
                }
                else {
                    allow = !this.#deniedRegexp.test( testPath );
                }
            }
        }

        return allow;
    }

    testAllowed ( testPath, { prefix, normalize } = {} ) {
        const isArray = Array.isArray( testPath );

        if ( prefix || normalize ) {
            if ( isArray ) {
                testPath = testPath.map( path => GlobPattern.normalizePath( path, { prefix, normalize } ) );
            }
            else {
                testPath = GlobPattern.normalizePath( testPath, { prefix, normalize } );
            }
        }

        // no string
        if ( isArray ) {
            testPath = testPath.filter( path => path );

            if ( !testPath.length ) return false;
        }
        else if ( !testPath ) {
            return false;
        }

        this.#build();

        // match all
        if ( this.#hasMatchAllPattern ) {
            return true;
        }

        // test allowed
        else if ( this.#hasAllowedPatterns ) {
            if ( isArray ) {
                for ( const item of testPath ) {
                    if ( this.#allowedRegexp.test( item ) ) {
                        return true;
                    }
                }

                return false;
            }
            else {
                return this.#allowedRegexp.test( testPath );
            }
        }

        // allow by default
        else if ( this.#allowIfListEmpty ) {
            return true;
        }

        // deny
        else {
            return false;
        }
    }

    testDenied ( testPath, { prefix, normalize } = {} ) {
        const isArray = Array.isArray( testPath );

        if ( prefix || normalize ) {
            if ( isArray ) {
                testPath = testPath.map( path => GlobPattern.normalizePath( path, { prefix, normalize } ) );
            }
            else {
                testPath = GlobPattern.normalizePath( testPath, { prefix, normalize } );
            }
        }

        // no string
        if ( isArray ) {
            testPath = testPath.filter( path => path );

            if ( !testPath.length ) return false;
        }
        else if ( !testPath ) {
            return false;
        }

        this.#build();

        // match all
        if ( this.#hasMatchNonePattern ) {
            return true;
        }

        // test denied
        else if ( this.#hasDeniedPatterns ) {
            if ( isArray ) {
                for ( const item of testPath ) {
                    if ( this.#deniedRegexp.test( item ) ) {
                        return true;
                    }
                }

                return false;
            }
            else {
                return this.#deniedRegexp.test( testPath );
            }
        }

        // deny
        else {
            return false;
        }
    }

    toJSON () {
        return [ ...this.#patterns.values() ].map( pattern => pattern.pattern );
    }

    [ Symbol.iterator ] () {
        return this.#patterns.values();
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( maxDepth, options, inspect ) {
        const spec = {
            "patterns": [ ...this.#patterns.values() ],
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }

    // private
    #createPattern ( pattern, { prefix, strict = this.#strict, caseSensitive = this.#caseSensitive, allowNegatedPatterns = this.#allowNegatedPatterns, allowBraces = this.#allowBraces, allowGlob = this.#allowGlob, allowBrackets = this.#allowBrackets, allowGlobstar = this.#allowGlobstar, allowExtglob = this.#allowExtglob, allowGlobalBasename = this.#allowGlobalBasename } = {} ) {
        return GlobPattern.new( pattern, {
            prefix,
            strict,
            caseSensitive,
            allowNegatedPatterns,
            allowBraces,
            allowGlob,
            allowBrackets,
            allowGlobstar,
            allowExtglob,
            allowGlobalBasename,
        } );
    }

    #clear () {
        this.#hasAllowedPatterns = undefined;
        this.#hasDeniedPatterns = undefined;
        this.#hasMatchAllPattern = undefined;
        this.#hasMatchNonePattern = undefined;
        this.#maxDepth = undefined;
        this.#allowedRegexp = undefined;
        this.#deniedRegexp = undefined;
    }

    #build () {
        if ( this.#hasAllowedPatterns != null ) return;

        this.#hasAllowedPatterns = false;
        this.#hasDeniedPatterns = false;
        this.#hasMatchAllPattern = false;
        this.#hasMatchNonePattern = false;
        this.#maxDepth = 0;

        const allowedRegexps = [],
            deniedRegexps = [];

        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.isNegated ) {
                this.#hasDeniedPatterns = true;

                if ( pattern.matchesNone ) {
                    this.#hasMatchNonePattern = true;
                }

                deniedRegexps.push( pattern.regexp.source );
            }
            else {
                this.#hasAllowedPatterns = true;

                if ( pattern.matchesAll ) {
                    this.#hasMatchAllPattern = true;
                }

                allowedRegexps.push( pattern.regexp.source );

                if ( pattern.maxDepth > this.#maxDepth ) {
                    this.#maxDepth = pattern.maxDepth;
                }
            }
        }

        if ( this.#hasMatchAllPattern ) {
            this.#allowedRegexp = GlobPattern.MATCH_ALL_REGEXP;
        }
        else if ( this.#hasAllowedPatterns ) {
            if ( allowedRegexps.length === 1 ) {
                this.#allowedRegexp = new RegExp( allowedRegexps[ 0 ], this.isCaseSensitive
                    ? "v"
                    : "iv" );
            }
            else {
                this.#allowedRegexp = new RegExp( "(?:" + allowedRegexps.sort( ( a, b ) => a.length - b.length ).join( "|" ) + ")", this.isCaseSensitive
                    ? "v"
                    : "iv" );
            }
        }
        else if ( this.#allowIfListEmpty ) {
            this.#allowedRegexp = GlobPattern.MATCH_ALL_REGEXP;
        }
        else {
            this.#allowedRegexp = GlobPattern.MATCH_NONE_REGEXP;
        }

        if ( this.#hasMatchNonePattern ) {
            this.#deniedRegexp = GlobPattern.MATCH_ALL_REGEXP;
        }
        else if ( this.#hasDeniedPatterns ) {
            if ( deniedRegexps.length === 1 ) {
                this.#deniedRegexp = new RegExp( deniedRegexps[ 0 ], this.isCaseSensitive
                    ? "v"
                    : "iv" );
            }
            else {
                this.#deniedRegexp = new RegExp( "(?:" + deniedRegexps.sort( ( a, b ) => a.length - b.length ).join( "|" ) + ")", this.isCaseSensitive
                    ? "v"
                    : "iv" );
            }
        }
        else {
            this.#deniedRegexp = GlobPattern.MATCH_NONE_REGEXP;
        }
    }
}
