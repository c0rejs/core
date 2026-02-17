import "#lib/temporal";

export const MONTHS = {
        "January": 1,
        "February": 2,
        "March": 3,
        "April": 4,
        "May": 5,
        "June": 6,
        "July": 7,
        "August": 8,
        "September": 9,
        "October": 10,
        "November": 11,
        "December": 12,
    },
    MONTHS3 = Object.fromEntries( Object.entries( MONTHS ).map( ( [ month, index ] ) => [ month.slice( 0, 3 ), index ] ) ),
    WEEKDAYS = new Set( [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ] ),
    WEEKDAYS3 = new Set( [ ...WEEKDAYS ].map( day => day.slice( 0, 3 ) ) ),
    HTTP_DATE_PATTERN = String.raw`(?:${ [ ...WEEKDAYS3 ].join( "|" ) }), \d{2} (?:${ Object.keys( MONTHS3 ).join( "|" ) }) \d{4} \d{2}:\d{2}:\d{2} GMT`,
    HTTP_DATE_REGEXP = new RegExp( String.raw`^${ HTTP_DATE_PATTERN }$` );

export function isValidMonth ( month ) {
    return month in MONTHS;
}

export function isValidMonth3 ( month ) {
    return month in MONTHS3;
}

export function isValidWeekday ( weekday ) {
    return WEEKDAYS.has( weekday );
}

export function isValidWeekday3 ( weekday ) {
    return WEEKDAYS3.has( weekday );
}

export function parseInstantHttpDate ( date ) {
    if ( date.length !== 29 || !HTTP_DATE_REGEXP.test( date ) ) throw new Error( "HTTP date is not valid" );

    return Temporal.PlainDateTime.from( {
        "year": Number( date.slice( 12, 16 ) ),
        "month": MONTHS3[ date.slice( 8, 11 ) ],
        "day": Number( date.slice( 5, 7 ) ),
        "hour": Number( date.slice( 17, 19 ) ),
        "minute": Number( date.slice( 20, 22 ) ),
        "second": Number( date.slice( 23, 25 ) ),
    } )
        .toZonedDateTime( "UTC" )
        .toInstant();
}

export function parseHttpDate ( date ) {
    return new Date( parseInstantHttpDate( date ).epochMilliseconds );
}
