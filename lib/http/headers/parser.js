import "#lib/temporal";
import { HTTP_DATE_PATTERN } from "#lib/dates";
import { decodeString } from "#lib/http/headers/utils";

const OWS = String.raw`[ \t]*`,

    // chars
    ESCAPED_CHAR = String.raw`\\["\\]`,
    UNESCAPED_CHAR = String.raw`[^"\\]`,
    SEPARATOR = String.raw`(?:[ ,;]|$)`,

    // key
    QUOTED_KEY = String.raw`"(?:${ ESCAPED_CHAR }|${ UNESCAPED_CHAR })*"`,
    UNQUOTED_KEY = String.raw`[^ ,;=]*`,
    KEY = String.raw`(?<key>${ QUOTED_KEY }|${ UNQUOTED_KEY })`,

    // string
    QUOTED_STRING = String.raw`"(?:${ ESCAPED_CHAR }|${ UNESCAPED_CHAR })*"`,
    UNQUOTED_STRING = String.raw`[^ ,;]*`,
    STRING = String.raw`${ QUOTED_STRING }|${ UNQUOTED_STRING }`,

    // bare item
    BARE_ITEM = String.raw`(?<value>${ HTTP_DATE_PATTERN }|${ STRING })(?=${ SEPARATOR })`;

const REG_EXPS = {
    "COMMA_SEPARATOR": new RegExp( String.raw`^${ OWS },` ),
    "SEMICOLON_SEPARATOR": new RegExp( String.raw`^${ OWS };` ),

    "KEY_VALUE": new RegExp( String.raw`^${ OWS }${ KEY }(?:${ OWS }=${ OWS }${ BARE_ITEM })?` ),

    "BARE_ITEM": new RegExp( String.raw`^${ OWS }${ BARE_ITEM }` ),

    "PARAMETER": new RegExp( String.raw`^${ OWS };${ OWS }${ KEY }(?:${ OWS }=${ OWS }${ BARE_ITEM })?` ),
};

export default class Parser {
    #value;

    constructor ( value ) {
        this.#value = value;
    }

    // properties
    get value () {
        return this.#value;
    }

    // public
    setValue ( value ) {
        this.#value = value;

        return this;
    }

    parse ( regExp ) {
        const match = this.#value.match( regExp );

        if ( !match ) return;

        this.#value = this.#value.slice( match.index + match[ 0 ].length );

        return match;
    }

    parseList ( { bare } = {} ) {
        const list = [];

        var item;

        item = this.parseItem( { bare } );
        if ( !item ) return list;

        list.push( item );

        while ( true ) {
            const separator = this.parse( REG_EXPS.COMMA_SEPARATOR );
            if ( !separator ) break;

            item = this.parseItem( { bare } );
            if ( !item ) break;

            list.push( item );
        }

        return list;
    }

    parseDictionary ( { bare, lowerCaseKey, semicolonSeparator } = {} ) {
        if ( semicolonSeparator ) bare = true;

        const dictionary = {};

        var item;

        item = this.parseKeyValue( { bare, lowerCaseKey } );
        if ( !item ) return dictionary;

        dictionary[ item.key ] = {
            "value": item.value,
            "parameters": item.parameters,
        };

        while ( true ) {
            const separator = this.parse( semicolonSeparator
                ? REG_EXPS.SEMICOLON_SEPARATOR
                : REG_EXPS.COMMA_SEPARATOR );
            if ( !separator ) break;

            item = this.parseKeyValue( { bare, lowerCaseKey } );
            if ( !item ) break;

            dictionary[ item.key ] = {
                "value": item.value,
                "parameters": item.parameters,
            };
        }

        return dictionary;
    }

    parseKeyValue ( { bare, lowerCaseKey } = {} ) {
        const match = this.parse( REG_EXPS.KEY_VALUE );
        if ( !match ) return;

        const parameters = bare
            ? {}
            : this.parseParameters();

        let key = decodeString( match.groups.key, {
            "unquote": true,
            "decode": true,
        } );

        if ( lowerCaseKey ) key = key.toLowerCase();

        const value = match.groups.value;

        return {
            key,
            value,
            parameters,
        };
    }

    parseItem ( { bare } = {} ) {
        const match = this.parse( REG_EXPS.BARE_ITEM );
        if ( !match ) return;

        const value = match.groups.value;

        const parameters = bare
            ? {}
            : this.parseParameters();

        return {
            value,
            parameters,
        };
    }

    parseParameters () {
        const parameters = {};

        while ( true ) {
            const match = this.parse( REG_EXPS.PARAMETER );
            if ( !match ) break;

            const key = decodeString( match.groups.key, {
                "unquote": true,
                "decode": true,
            } );

            const value = match.groups.value;

            parameters[ key.toLowerCase() ] = value;
        }

        return parameters;
    }
}
