export default Super => {
    return class extends ( Super || class {} ) {
        async monitorContainerStats ( containerId, { signal } = {} ) {
            return this._doRequest( "GET", `containers/${ containerId }/stats`, {
                "stream": true,
                signal,
            } );
        }

        async pruneContainers ( options ) {
            return this._doRequest( "POST", "containers/prune", {
                "params": {
                    "filters": options,
                },
            } );
        }
    };
};
