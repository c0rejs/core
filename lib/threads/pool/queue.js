import ThreadsPool from "#lib/threads/pool";
import Signal from "#lib/threads/signal";
import Uuid from "#lib/uuid";

export default class ThreadsPoolQueue extends ThreadsPool {
    #queue = [];
    #results = {};
    #signal = new Signal();

    // public
    pushThread ( method, { highPriority, args } = {} ) {
        const id = Uuid.v4();

        this.#queue.push( id );

        this.runThread( method, { highPriority, args } )
            .then( res => {
                this.#results[ id ] = res;

                this.#ready();
            } )
            .catch( e => console.error( e ) );
    }

    async getResult () {

        // queue is empty
        if ( !this.#queue.length ) return;

        const res = this.#getResult();

        if ( res ) return res;

        return this.#signal.wait();
    }

    async* [ Symbol.asyncIterator ] () {
        var res;

        while ( ( res = await this.getResult() ) ) {
            yield res;
        }
    }

    // private
    #ready () {
        if ( !this.#signal.waitingThreads ) return;

        const res = this.#getResult();
        if ( !res ) return;

        this.#signal.broadcast( res );

        this.#ready();
    }

    #getResult () {
        const id = this.#queue[ 0 ];
        if ( !id ) return;

        const res = this.#results[ id ];
        if ( !res ) return;

        this.#queue.shift();
        delete this.#results[ id ];

        return res;
    }
}
