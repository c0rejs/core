import List from "#lib/data-structures/list";
import ThreadsPool from "#lib/threads/pool";
import Signal from "#lib/threads/signal";

export default class ThreadsPoolQueue extends ThreadsPool {
    #list = new List();
    #signal = new Signal();

    // public
    pushThread ( thread, { highPriority } = {} ) {
        const data = {
            "result": null,
        };

        this.#list.push( data );

        this.runThread( thread, { highPriority } )
            .then( res => {
                data.result = res;

                this.#ready();
            } )
            .catch( e => console.error( e ) );
    }

    async getResult () {

        // list is empty
        if ( !this.#list.length ) return;

        const res = this.#getResult();

        if ( res ) {
            return res;
        }
        else {
            return this.#signal.wait();
        }
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
        const firstEntry = this.#list.firstEntry;
        if ( !firstEntry ) return;

        const res = firstEntry.value.result;
        if ( !res ) return;

        this.#list.delete( firstEntry );

        return res;
    }
}
