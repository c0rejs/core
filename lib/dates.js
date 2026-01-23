import "#lib/temporal";

const MONTHS = {
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
    HTTP_DATE_RE = new RegExp( `^(?<weekday>${ [ ...WEEKDAYS3 ].join( "|" ) }), (?<day>\\d{2}) (?<month>${ Object.keys( MONTHS3 ).join( "|" ) }) (?<year>\\d{4}) (?<hour>\\d{2}):(?<minute>\\d{2}):(?<second>\\d{2}) GMT$` );

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
    const match = date.match( HTTP_DATE_RE );

    if ( !match ) throw new Error( "HTTP date is not valid" );

    return Temporal.PlainDateTime.from( {
        "year": Number( match.groups.year ),
        "month": MONTHS3[ match.groups.month ],
        "day": Number( match.groups.day ),
        "hour": Number( match.groups.hour ),
        "minute": Number( match.groups.minute ),
        "second": Number( match.groups.second ),
    } )
        .toZonedDateTime( "UTC" )
        .toInstant();
}

export function parseHttpDate ( date ) {
    return new Date( parseInstantHttpDate( date ).epochMilliseconds );
}
