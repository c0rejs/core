export default class Parser {

    // public
    parseList ( string, { bare } = {} ) {
        const items = [];

        const list = this.#split( string, "," );
        if ( !list ) return;

        for ( let item of list ) {
            item = this.#parseItem( item, { bare } );
            if ( !item ) return;

            items.push( item );
        }

        return items;
    }

    parseDictionary ( string, { bare, semicolon } = {} ) {
        const items = {};

        if ( semicolon ) bare = true;

        const list = this.#split( string, semicolon
            ? ";"
            : "," );
        if ( !list ) return;

        for ( let item of list ) {
            item = this.#parseItem( item, { bare } );
            if ( !item ) return;

            const keyValue = this.#parseKeyValue( item.value );
            if ( !keyValue ) continue;

            items[ keyValue.key ] = {
                "key": keyValue.key,
                "value": keyValue.value,
                "parameters": item.parameters,
            };
        }

        return items;
    }

    parseItem ( string, { bare } = {} ) {
        const list = this.parseList( string, { bare } );
        if ( !list ) return;

        return list[ 0 ];
    }

    // private
    #split ( string, separator ) {
        const values = [];

        var quoted,
            index = 0;

        for ( let n = 0; n < string.length; n++ ) {
            let char = string[ n ];

            if ( char === '"' ) {
                quoted = !quoted;
            }
            else if ( char === "\\" ) {
                if ( quoted ) {
                    char = string[ n + 1 ];

                    if ( char === "\\" || char === '"' ) {
                        n++;
                    }
                }
            }
            else if ( char === separator ) {
                if ( !quoted ) {
                    const value = string.slice( index, n ).trim();

                    if ( value ) values.push( value );

                    index = n + 1;
                }
            }
        }

        if ( quoted ) {
            return;
        }
        else {
            const value = string.slice( index ).trim();

            if ( value ) values.push( value );

            return values;
        }
    }

    #parseItem ( string, { bare } = {} ) {
        var item;

        if ( bare ) {
            item = {
                "value": string,
                "parameters": {},
            };
        }
        else {
            const parameters = this.#split( string, ";" );
            if ( !parameters ) return;

            item = {
                "value": parameters[ 0 ],
                "parameters": {},
            };

            for ( let n = 1; n < parameters.length; n++ ) {
                const parameter = this.#parseKeyValue( parameters[ n ] );
                if ( !parameter ) continue;

                item.parameters[ parameter.key ] = parameter.value;
            }
        }

        return item;
    }

    #parseKeyValue ( string ) {
        const idx = string.indexOf( "=" );

        if ( idx < 0 ) {
            return {
                "key": string.toLowerCase(),
                "value": undefined,
            };
        }
        else {
            return {
                "key": string.slice( 0, idx ).trim().toLowerCase(),
                "value": string.slice( idx + 1 ).trim(),
            };
        }
    }
}
