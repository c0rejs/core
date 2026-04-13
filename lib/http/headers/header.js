import { SINGLE_VALUE_HEADERS, STANDARD_NAMES } from "#lib/http/headers/names";
import Parser from "#lib/http/headers/parser";
import { encodeValue } from "#lib/http/headers/utils";

const VALUES_SEPARATOR = ",";

export default class Header {
    #headerName;
    #headerOriginalName;
    #value;
    #fields;
    #built = true;
    #parsed = false;
    #parseError;
    #parser;

    constructor ( originalName ) {
        if ( originalName instanceof Header ) {
            const value = originalName.value;

            this.#value = Array.isArray( value )
                ? [ ...value ]
                : value;

            originalName = originalName.headerOriginalName;
        }

        this.#headerName = this.constructor.headerName || originalName.toLowerCase();
        this.#headerOriginalName = originalName;
    }

    // static
    static get headerName () {
        return;
    }

    // properties
    get headerName () {
        return this.#headerName;
    }

    get headerOriginalName () {
        return this.#headerOriginalName;
    }

    get headerNormalName () {
        return STANDARD_NAMES[ this.#headerName ] || this.#headerOriginalName || this.#headerName;
    }

    get valuesSeparator () {
        return VALUES_SEPARATOR;
    }

    get value () {
        if ( !this.#built ) this.#build();

        return this.#value;
    }

    get hasValue () {
        return this.value != null;
    }

    // public
    add ( value ) {
        if ( Array.isArray( value ) ) {
            for ( const item of value ) {
                this.#add( item );
            }
        }
        else {
            this.#add( value );
        }

        return this;
    }

    set ( value ) {
        if ( Array.isArray( value ) ) {
            for ( const item of value ) {
                this.#set( item );
            }
        }
        else {
            this.#set( value );
        }

        return this;
    }

    delete () {
        this.#set();

        return this;
    }

    toString () {
        return this.value;
    }

    toJSON () {
        return this.value;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "name": this.headerName,
            "value": this.value,
        };

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }

    // protected
    _encodeValue ( value ) {
        return encodeValue( value );
    }

    _getField ( field ) {
        if ( !this.#parsed ) this.#parse();

        return this.#fields[ field ];
    }

    _setField ( field, value ) {
        if ( !this.#parsed ) this.#parse();

        value ??= undefined;

        if ( this.#parseError ) {
            this.#parseError = false;
            this.#built = false;
        }
        else {

            // value was changed
            if ( ( this.#fields[ field ] ?? undefined ) !== value ) {
                this.#built = false;
            }
        }

        this.#fields[ field ] = value;

        return this;
    }

    _deleteField ( field ) {
        return this._setField( field );
    }

    _parse ( value, parser ) {
        return {};
    }

    _build ( fields ) {}

    // private
    #add ( value, parsed ) {
        if ( value == null ) {
            return;
        }
        else if ( typeof value !== "string" ) {

            // stringify value
            value = this._encodeValue( value );
        }

        // add value
        if ( value ) {
            if ( SINGLE_VALUE_HEADERS.has( this.#headerName ) ) {
                this.#set( value, parsed );
            }
            else if ( !this.value ) {
                this.#set( value, parsed );
            }
            else {

                // downgrade value to "latin1"
                if ( /[^\x00-\xFF]/.test( value ) ) {
                    value = Buffer.from( value ).toString( "latin1" );
                }

                if ( this.valuesSeparator ) {
                    value = this.value + this.valuesSeparator + " " + value;

                    this.#set( value, parsed );
                }
                else {
                    this.#value.push( value );

                    this.#built = true;

                    if ( !parsed ) {
                        this.#parsed = false;
                        this.#fields = {};
                    }
                }
            }
        }
    }

    #set ( value, parsed ) {
        this.#built = true;

        // stringify value
        if ( value != null && typeof value !== "string" ) {
            value = this._encodeValue( value );
        }

        if ( value ) {

            // downgrade value to "latin1"
            if ( /[^\x00-\xFF]/.test( value ) ) {
                value = Buffer.from( value ).toString( "latin1" );
            }

            if ( this.valuesSeparator ) {

                // value changed
                if ( this.#value !== value ) {
                    this.#value = value;

                    if ( !parsed ) {
                        this.#parsed = false;
                        this.#fields = {};
                    }
                }
            }
            else {
                this.#value = [ value ];

                if ( !parsed ) {
                    this.#parsed = false;
                    this.#fields = {};
                }
            }
        }
        else {
            this.#value = undefined;
            this.#parsed = true;
            this.#fields = {};
        }
    }

    #parse () {
        this.#parsed = true;

        if ( this.#value ) {
            this.#parser ||= new Parser();

            // parse
            const fields = this._parse( this.#value, this.#parser );

            if ( fields ) {
                this.#fields = fields;
                this.#parseError = false;
            }
            else {
                this.#fields = {};
                this.#parseError = true;
            }
        }
        else {
            this.#fields = {};
            this.#parseError = false;
        }
    }

    #build () {
        this.#built = true;

        const value = this._build( this.#fields );

        if ( Array.isArray( value ) ) {
            this.#set( null, true );

            for ( const item of value ) {
                this.#add( item, true );
            }
        }
        else {
            this.#set( value, true );
        }
    }
}
