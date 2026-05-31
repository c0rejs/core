import NumericClass from "#lib/_browser/numeric/numeric";

export default class Numeric extends NumericClass {
    constructor ( value, options ) {
        if ( Buffer.isBuffer( value ) ) {
            value = value.toString( "latin1" );
        }

        super( value, options );
    }

    // public
    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = this.valueOf();

        return `${ this.constructor.name }: ${ inspect( spec ) }`;
    }
}
