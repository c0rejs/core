import "#lib/temporal";
import ansi from "#lib/ansi";
import DigitalSize from "#lib/digital-size";
import Interval from "#lib/interval";
import Locale from "#lib/locale";
import Numeric from "#lib/numeric";
import Signal from "#lib/threads/signal";

const BAR_WIDTH = 30,
    BAR_TTY_SPACE_CHAR = "■",
    BAR_SPACE_CHAR = "·", // "⋯",
    BAR_VALUE_CHAR = "■",
    BAR_SPACE_COLOR = ansi.gray15,
    BAR_VALUE_COLOR = ansi.green,
    ELAPSED_LABEL = "T",
    ESTIMATED_LABEL = "ETA",
    SPEED_LABEL = "S",
    UNIT_STYLE = "short",
    UPDATE_INTERVAL = 1000;

export default class Progress {
    #outputStream;
    #tty;
    #unitStyle;
    #showBar;
    #locale;
    #bytes;
    #scale = 0;
    #percentScale = 2;
    #maxValue = 0;
    #value = 0;
    #elapsed = 0;
    #showStatus;
    #started;
    #stopped;
    #signal;
    #updateInterval;
    #updateTimeout;

    constructor ( { maxValue, showStatus = true, outputStream = process.stdout, tty, unitStyle, showBar = true, locale, bytes, updateInterval } = {} ) {
        this.#maxValue = maxValue;
        this.#showStatus = Boolean( showStatus );
        this.#outputStream = outputStream;
        this.#tty = Boolean( tty ?? this.#outputStream?.isTTY );
        this.#unitStyle = unitStyle || UNIT_STYLE;
        this.#showBar = Boolean( showBar );
        this.#locale = locale || Locale.default;
        this.#bytes = Boolean( bytes );
        this.#updateInterval = updateInterval ?? UPDATE_INTERVAL;
    }

    // properties
    get maxValue () {
        return this.#maxValue;
    }

    get value () {
        return this.#value;
    }

    get percent () {
        if ( this.#maxValue ) {
            return this.#value / this.#maxValue;
        }
        else {
            return 0;
        }
    }

    get started () {
        return this.#started;
    }

    get stopped () {
        return this.#stopped;
    }

    get elapsed () {
        return this.#elapsed;
    }

    // XXX
    get elapsed1 () {
        if ( this.#stopped ) {
            return this.#stopped.epochMilliseconds - this.#started.epochMilliseconds;
        }
        else {
            return Temporal.Now.instant().epochMilliseconds - this.#started.epochMilliseconds;
        }
    }

    get estimated () {
        if ( this.#maxValue ) {
            const speed = this.speed;

            if ( speed ) {
                const value = this.#maxValue - this.#value;

                if ( value === 0 ) {
                    return 0;
                }
                else {
                    return value / speed;
                }
            }
            else {
                return Infinity;
            }
        }
        else {
            return;
        }
    }

    get speed () {
        if ( this.#elapsed ) {
            return this.#value / this.#elapsed;
        }
        else {
            return 0;
        }
    }

    // public
    showStatus () {
        if ( !this.#showStatus && this.#outputStream ) {
            this.#showStatus = true;

            if ( this.#started ) this.#updateStatus();
        }

        return this;
    }

    start () {
        if ( !this.#started ) {
            this.#started = Temporal.Now.instant();

            this.#updateStatus();
        }

        return this;
    }

    stop () {
        if ( !this.#stopped ) {
            this.#stopped = Temporal.Now.instant();

            this.#updateStatus();

            this.#signal?.broadcast();
        }

        return this;
    }

    incrementValue ( value ) {
        if ( !this.#stopped ) {
            this.#value += value;

            this.#update();
        }

        return this;
    }

    setValue ( value ) {
        if ( !this.#stopped ) {
            this.#value = value;

            this.#update();
        }

        return this;
    }

    updateStatus () {
        this.#updateStatus();

        return this;
    }

    async wait () {
        if ( this.#stopped ) return;

        this.#signal ??= new Signal();

        return this.#signal.wait();
    }

    // private
    #update () {
        if ( this.#maxValue ) {
            if ( this.#value > this.#maxValue ) {
                this.#value = this.#maxValue;

                this.stop();
            }
            else if ( this.#value === this.#maxValue ) {
                this.stop();
            }
            else if ( !this.#updateInterval ) {
                this.#updateStatus();
            }
        }
        else if ( !this.#updateInterval ) {
            this.#updateStatus();
        }
    }

    #updateStatus () {
        this.#stopUpdateStatus();

        if ( !this.#showStatus ) return;

        let status;

        const tty = this.#tty,
            value = this.#bytes
                ? this.#locale.formatDigitalSize( new DigitalSize( this.#value ), `unitDisplay:${ this.#unitStyle }` )
                : Numeric.truncate( this.#value, { "scale": this.#scale } ),
            elapsed = this.#locale.formatDuration( new Interval( this.elapsed, "milliseconds" ).truncate( "seconds" ), `style:${ this.#unitStyle }` );

        let speed;

        if ( this.#bytes ) {
            speed = this.#locale.formatDigitalSize( this.speed * 1000, `unitDisplay:${ this.#unitStyle }` ) + "/" + this.#locale.formatName( "second", `type:dateTimeField,style:${ this.#unitStyle }` );
        }
        else {
            speed = Numeric.truncate( this.speed * 1000, { "scale": this.#scale } ) + "/" + this.#locale.formatName( "second", `type:dateTimeField,style:${ this.#unitStyle }` );
        }

        const disposableStack = new DisposableStack();
        disposableStack.use( ansi.pushEnabled( tty ) );

        if ( this.#maxValue ) {
            const percent = this.#locale.formatPercent( this.percent, `minimumFractionDigits:${ this.#percentScale },maximumFractionDigits:${ this.#percentScale }` ),
                maxValue = this.#bytes
                    ? this.#locale.formatDigitalSize( new DigitalSize( this.#maxValue ), `unitDisplay:${ this.#unitStyle }` )
                    : Numeric.truncate( this.#maxValue, { "scale": this.#scale } ),
                estimated = this.#locale.formatRelativeDate( new Interval( this.estimated, "milliseconds" ), `style:${ this.#unitStyle }` );

            let bar;

            if ( this.#showBar ) {
                const barWidth = BAR_WIDTH,
                    valueWidth = this.#value === this.#maxValue
                        ? barWidth
                        : Math.trunc( ( this.#value * barWidth ) / this.#maxValue ),
                    barSpaceChar = tty
                        ? BAR_TTY_SPACE_CHAR
                        : BAR_SPACE_CHAR;

                bar = "[" + BAR_VALUE_COLOR( BAR_VALUE_CHAR.repeat( valueWidth ) ) + BAR_SPACE_COLOR( barSpaceChar.repeat( barWidth - valueWidth ) ) + "] ";
            }
            else {
                bar = "";
            }

            if ( this.#stopped ) {
                status = `${ bar }${ percent } (${ value }/${ maxValue }); ${ ELAPSED_LABEL }: ${ elapsed }; ${ SPEED_LABEL }: ${ speed }`;
            }
            else {
                status = `${ bar }${ percent } (${ value }/${ maxValue }); ${ ELAPSED_LABEL }: ${ elapsed }; ${ ESTIMATED_LABEL }: ${ estimated }; ${ SPEED_LABEL }: ${ speed }`;
            }
        }
        else {
            status = `${ value }; ${ ELAPSED_LABEL }: ${ elapsed }; ${ SPEED_LABEL }: ${ speed }`;
        }

        if ( tty ) {
            this.#outputStream.write( "\u{1B}[2K\r" + status + ( this.#stopped
                ? "\n"
                : "" ) );
        }
        else {
            this.#outputStream.write( status + "\n" );
        }

        if ( !this.#stopped && this.#updateInterval ) {
            this.#updateTimeout = setTimeout( this.#updateStatus.bind( this ), this.#updateInterval );
        }
    }

    #stopUpdateStatus () {
        clearTimeout( this.#updateTimeout );

        this.#updateTimeout = null;
    }
}
